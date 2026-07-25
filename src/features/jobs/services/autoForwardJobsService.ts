import {
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore'
import {
  forwardJobToReporter,
  jobsCollection,
} from '@/features/jobs/services/jobService'
import type { UserRole } from '@/config/roles'
import { COMPANY_TIMEZONE } from '@/config/roles'

const WINDOW_START_HOUR = 9
const WINDOW_END_HOUR = 21
const THROTTLE_MS = 15 * 60 * 1000
const FETCH_LIMIT = 50
const STORAGE_KEY = 'brain.autoForwardJobs.lastRunMs'

function istanbulHourNow(now = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: COMPANY_TIMEZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return Number(hourStr)
}

/** İstanbul 09:00–21:00 (21:00 hariç). */
export function isWithinAutoForwardWindow(now = new Date()): boolean {
  const hour = istanbulHourNow(now)
  return hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR
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

export type AutoForwardActor = {
  uid: string
  fullName: string
  role: UserRole
}

export type AutoForwardResult = {
  skipped: boolean
  reason?: 'outside_window' | 'throttled' | 'unauthorized'
  forwarded: number
}

/**
 * Konfirme + henüz iletilmemiş işleri muhabire iletir.
 * Yalnızca yönetim/koordinatör; 15 dk throttle; 09–21 TR penceresi.
 */
export async function runDueAutoForwardJobs(
  actor: AutoForwardActor,
  options?: { force?: boolean },
): Promise<AutoForwardResult> {
  if (actor.role !== 'management' && actor.role !== 'coordinator') {
    return { skipped: true, reason: 'unauthorized', forwarded: 0 }
  }
  if (!isWithinAutoForwardWindow()) {
    return { skipped: true, reason: 'outside_window', forwarded: 0 }
  }

  const now = Date.now()
  if (!options?.force && now - readLastRunMs() < THROTTLE_MS) {
    return { skipped: true, reason: 'throttled', forwarded: 0 }
  }

  writeLastRunMs(now)

  const snap = await getDocs(
    query(
      jobsCollection(),
      where('status', '==', 'approved'),
      where('forwardedToReporter', '==', false),
      limit(FETCH_LIMIT),
    ),
  )

  let forwarded = 0
  for (const docSnap of snap.docs) {
    try {
      await forwardJobToReporter(docSnap.id, actor)
      forwarded += 1
      // Sheet SON DURUM is not updated on forward.
    } catch {
      // Already forwarded / race — continue
    }
  }

  return { skipped: false, forwarded }
}
