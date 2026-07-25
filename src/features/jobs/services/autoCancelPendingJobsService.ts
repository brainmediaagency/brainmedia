import {
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore'
import {
  cancelJob,
  jobsCollection,
} from '@/features/jobs/services/jobService'
import { exportJobReviewToSheet } from '@/features/jobs/services/sheetsExport'
import type { UserRole } from '@/config/roles'

const THROTTLE_MS = 15 * 60 * 1000
const FETCH_LIMIT = 50
const STORAGE_KEY = 'brain.autoCancelPendingJobs.lastRunMs'
/** Pending jobs older than this are auto-cancelled. */
export const STALE_PENDING_AFTER_MS = 48 * 60 * 60 * 1000

export const AUTO_CANCEL_REVIEW_NOTE =
  'Otomatik iptal: 48 saat içinde konfirme edilmedi.'

/** Pure check — used by auto-cancel and unit tests. */
export function isStalePendingJob(
  createdAtMs: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (createdAtMs == null || !Number.isFinite(createdAtMs)) return false
  return nowMs - createdAtMs >= STALE_PENDING_AFTER_MS
}

function readLastRunMs(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeLastRunMs(ms: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(ms))
  } catch {
    // ignore quota / private mode
  }
}

export type AutoCancelActor = {
  uid: string
  fullName: string
  role: UserRole
}

export type AutoCancelResult = {
  skipped: boolean
  reason?: 'throttled' | 'unauthorized'
  cancelled: number
}

/**
 * 48 saat içinde konfirme edilmeyen bekleyen işleri otomatik iptal eder.
 * Yalnızca yönetim/koordinatör; 15 dk throttle; saat penceresi yok.
 */
export async function autoCancelStalePendingJobs(
  actor: AutoCancelActor,
  options?: { force?: boolean },
): Promise<AutoCancelResult> {
  if (actor.role !== 'management' && actor.role !== 'coordinator') {
    return { skipped: true, reason: 'unauthorized', cancelled: 0 }
  }

  const now = Date.now()
  if (!options?.force && now - readLastRunMs() < THROTTLE_MS) {
    return { skipped: true, reason: 'throttled', cancelled: 0 }
  }

  writeLastRunMs(now)

  const snap = await getDocs(
    query(
      jobsCollection(),
      where('status', '==', 'pending'),
      limit(FETCH_LIMIT),
    ),
  )

  let cancelled = 0
  for (const docSnap of snap.docs) {
    const job = docSnap.data()
    const createdMs = job.createdAt?.toMillis?.()
    if (!isStalePendingJob(createdMs, now)) continue
    try {
      await cancelJob(docSnap.id, actor, AUTO_CANCEL_REVIEW_NOTE)
      cancelled += 1
      try {
        await exportJobReviewToSheet(job, 'cancelled', {
          reviewedByName: actor.fullName,
          reviewNote: AUTO_CANCEL_REVIEW_NOTE,
        })
      } catch {
        // Sheet update is best-effort; cancel already succeeded.
      }
    } catch {
      // Already transitioned / race — continue
    }
  }

  return { skipped: false, cancelled }
}
