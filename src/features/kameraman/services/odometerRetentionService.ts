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
} from 'firebase/firestore'
import { getDueHrRetentionPurgeDate } from '@/features/hr/utils/hrRetentionSchedule'
import { getDb } from '@/lib/firebase/firestore'
import { UserFacingError, mapAppError } from '@/lib/errors'

const RETENTION_META_PATH = ['appMeta', 'odometerRetention'] as const
const BATCH_READ = 100
const STALE_CLAIM_MS = 30 * 60 * 1000

export function isOdometerReadingExpired(
  reportDate: string,
  purgeDate: string,
): boolean {
  return reportDate < purgeDate
}

/**
 * Lightweight two-month-cycle retention runner.
 *
 * Firestore metadata is removed oldest-first. Drive files are intentionally
 * left for manual archive cleanup, matching the approved retention policy.
 * This service is isolated from the reporter/Z retention pipeline.
 */
export async function runDueOdometerRetentionPurge(actor: {
  uid: string
  fullName: string
}): Promise<{ ran: boolean; purgeDate: string | null; deleted: number }> {
  const purgeDate = getDueHrRetentionPurgeDate()
  if (!purgeDate) return { ran: false, purgeDate: null, deleted: 0 }

  const metaRef = doc(getDb(), ...RETENTION_META_PATH)
  const shouldRun = await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(metaRef)
    const data = snap.exists() ? snap.data() : {}
    const lastCompleted =
      typeof data.lastCompletedPurgeDate === 'string'
        ? data.lastCompletedPurgeDate
        : null

    if (lastCompleted && lastCompleted >= purgeDate) return false

    const claimedPurge =
      typeof data.claimedPurgeDate === 'string' ? data.claimedPurgeDate : null
    const claimedAt = data.claimedAt
    const claimedMs =
      claimedAt && typeof claimedAt.toMillis === 'function'
        ? claimedAt.toMillis()
        : 0
    const claimIsFresh =
      claimedPurge === purgeDate
      && claimedMs > 0
      && Date.now() - claimedMs < STALE_CLAIM_MS

    if (claimIsFresh) return false

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
    let deleted = 0

    for (;;) {
      const snap = await getDocs(
        query(
          collection(getDb(), 'kameramanOdometerReadings'),
          where('reportDate', '<', purgeDate),
          orderBy('reportDate', 'asc'),
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
          readingsDeleted: deleted,
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
      // A later management session can reclaim a stale/failed cycle.
    }

    throw new UserFacingError(
      mapAppError(error, 'Eski km raporları temizlenemedi.'),
    )
  }
}
