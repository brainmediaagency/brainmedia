import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore'
import { fromZonedTime } from 'date-fns-tz'
import { COMPANY_TIMEZONE } from '@/config/roles'
import { getDb } from '@/lib/firebase/firestore'
import { getDueHrRetentionPurgeDate } from '@/features/hr/utils/hrRetentionSchedule'
import { UserFacingError, mapAppError } from '@/lib/errors'

const RETENTION_META_PATH = ['appMeta', 'zReportRetention'] as const
const BATCH_READ = 200
/** Allow another client to retry if a claim is older than this. */
const STALE_CLAIM_MS = 30 * 60 * 1000

function purgeCutoffTimestamp(purgeDate: string): Timestamp {
  const start = fromZonedTime(`${purgeDate}T00:00:00`, COMPANY_TIMEZONE)
  return Timestamp.fromDate(start)
}

/**
 * If a purge cycle is due and not yet completed, delete Z reports created
 * before the purge day (oldest → newest). Concurrent clients coordinate via
 * `appMeta/zReportRetention`. Same 2-month calendar schedule as İK retention.
 *
 * Photos live on Google Drive; Drive cleanup is optional/manual.
 */
export async function runDueZReportRetentionPurge(actor: {
  uid: string
  fullName: string
}): Promise<{ ran: boolean; purgeDate: string | null; deleted: number }> {
  const purgeDate = getDueHrRetentionPurgeDate()
  if (!purgeDate) return { ran: false, purgeDate: null, deleted: 0 }

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

  if (!shouldRun) return { ran: false, purgeDate, deleted: 0 }

  try {
    const cutoff = purgeCutoffTimestamp(purgeDate)
    let deleted = 0

    for (;;) {
      const snap = await getDocs(
        query(
          collection(getDb(), 'reporterZReports'),
          where('createdAt', '<', cutoff),
          orderBy('createdAt', 'asc'),
          limit(BATCH_READ),
        ),
      )
      if (snap.empty) break

      for (const item of snap.docs) {
        await deleteDoc(item.ref)
        deleted += 1
      }

      if (snap.size < BATCH_READ) break
    }

    await runTransaction(getDb(), async (tx) => {
      tx.set(
        metaRef,
        {
          lastCompletedPurgeDate: purgeDate,
          lastPurgedAt: serverTimestamp(),
          lastPurgedByUid: actor.uid,
          lastPurgedByName: actor.fullName,
          zReportsDeleted: deleted,
          status: 'completed',
          claimedPurgeDate: null,
          claimedAt: null,
          claimedByUid: null,
          claimedByName: null,
        },
        { merge: true },
      )
    })

    return { ran: true, purgeDate, deleted }
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
      mapAppError(error, 'Eski Z raporları temizlenemedi.'),
    )
  }
}
