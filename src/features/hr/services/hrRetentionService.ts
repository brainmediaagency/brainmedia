import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { fromZonedTime } from 'date-fns-tz'
import { COMPANY_TIMEZONE } from '@/config/roles'
import { getDb } from '@/lib/firebase/firestore'
import { getDueHrRetentionPurgeDate } from '@/features/hr/utils/hrRetentionSchedule'
import { UserFacingError, mapAppError } from '@/lib/errors'

const RETENTION_META_PATH = ['appMeta', 'hrRetention'] as const
const BATCH_READ = 200
/** Allow another client to retry if a claim is older than this. */
const STALE_CLAIM_MS = 30 * 60 * 1000

function purgeCutoffTimestamp(purgeDate: string): Timestamp {
  const start = fromZonedTime(`${purgeDate}T00:00:00`, COMPANY_TIMEZONE)
  return Timestamp.fromDate(start)
}

async function deleteQueryInPages(
  collectionName: string,
  cutoff: Timestamp,
  onDoc: (snap: QueryDocumentSnapshot) => Promise<void>,
): Promise<number> {
  let deleted = 0
  for (;;) {
    const snap = await getDocs(
      query(
        collection(getDb(), collectionName),
        where('createdAt', '<', cutoff),
        limit(BATCH_READ),
      ),
    )
    if (snap.empty) break

    for (const item of snap.docs) {
      await onDoc(item)
      deleted += 1
    }
  }
  return deleted
}

async function deleteHiringNoteDoc(snap: QueryDocumentSnapshot): Promise<void> {
  // Attachments live on Google Drive (not Firebase Storage). Drive cleanup is
  // optional/manual; Firestore row deletion is enough for app retention.
  await deleteDoc(snap.ref)
}

/**
 * If a purge cycle is due and not yet completed, delete İK reports and hiring
 * notes created before the purge day (incl. CV PDFs). Concurrent clients
 * coordinate via `appMeta/hrRetention`.
 */
export async function runDueHrRetentionPurge(actor: {
  uid: string
  fullName: string
}): Promise<{ ran: boolean; purgeDate: string | null }> {
  const purgeDate = getDueHrRetentionPurgeDate()
  if (!purgeDate) return { ran: false, purgeDate: null }

  const metaRef = doc(getDb(), ...RETENTION_META_PATH)

  const shouldRun = await runTransaction(getDb(), async (tx) => {
    const metaSnap = await tx.get(metaRef)
    const data = metaSnap.exists() ? metaSnap.data() : {}
    const lastCompleted =
      typeof data.lastCompletedPurgeDate === 'string'
        ? data.lastCompletedPurgeDate
        : null

    if (lastCompleted && lastCompleted >= purgeDate) {
      return false
    }

    const claimedPurge =
      typeof data.claimedPurgeDate === 'string' ? data.claimedPurgeDate : null
    const claimedAt = data.claimedAt
    const claimedMs =
      claimedAt && typeof claimedAt.toMillis === 'function'
        ? claimedAt.toMillis()
        : 0
    const claimFresh =
      claimedPurge === purgeDate
      && claimedMs > 0
      && Date.now() - claimedMs < STALE_CLAIM_MS

    if (claimFresh) {
      return false
    }

    tx.set(
      metaRef,
      {
        claimedPurgeDate: purgeDate,
        claimedAt: serverTimestamp(),
        claimedByUid: actor.uid,
        claimedByName: actor.fullName,
        status: 'running',
      },
      { merge: true },
    )
    return true
  })

  if (!shouldRun) return { ran: false, purgeDate }

  try {
    const cutoff = purgeCutoffTimestamp(purgeDate)
    const hrReportsDeleted = await deleteQueryInPages('hrReports', cutoff, (snap) =>
      deleteDoc(snap.ref),
    )
    const hiringNotesDeleted = await deleteQueryInPages(
      'hiringNotes',
      cutoff,
      deleteHiringNoteDoc,
    )

    await runTransaction(getDb(), async (tx) => {
      tx.set(
        metaRef,
        {
          lastCompletedPurgeDate: purgeDate,
          lastPurgedAt: serverTimestamp(),
          lastPurgedByUid: actor.uid,
          lastPurgedByName: actor.fullName,
          hrReportsDeleted,
          hiringNotesDeleted,
          status: 'completed',
          claimedPurgeDate: null,
          claimedAt: null,
          claimedByUid: null,
          claimedByName: null,
        },
        { merge: true },
      )
    })

    return { ran: true, purgeDate }
  } catch (error) {
    try {
      await runTransaction(getDb(), async (tx) => {
        tx.set(
          metaRef,
          {
            status: 'failed',
            claimedPurgeDate: null,
            claimedAt: null,
            claimedByUid: null,
            claimedByName: null,
            lastErrorAt: serverTimestamp(),
          },
          { merge: true },
        )
      })
    } catch {
      // ignore unlock failure
    }
    throw new UserFacingError(
      mapAppError(error, 'Eski İK / CV kayıtları temizlenemedi.'),
    )
  }
}
