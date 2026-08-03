import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { COMPANY_TIMEZONE } from '@/config/roles'
import { todayDateOnlyIstanbul } from '@/lib/date'
import { getDb } from '@/lib/firebase/firestore'
import { sendOneSignalPush } from '@/features/notifications/services/oneSignalPush'
import { shiftDateOnlyDays } from '@/features/media-planning/services/dailyRegionService'

const META_PATH = ['appMeta', 'shootingCalendarNotify'] as const

/** İstanbul wall-clock hour when the shoot calendar evening notify may fire. */
export const SHOOTING_CALENDAR_NOTIFY_HOUR = 0

export type ShootingCalendarNotifyResult =
  | { skipped: true; reason: string; date?: string }
  | { skipped: false; date: string; jobCount: number }

/**
 * Milliseconds until the next İstanbul occurrence of `hour:00`.
 * For hour 0 this is the next calendar midnight.
 */
export function msUntilNextIstanbulHour(
  hour: number,
  now: Date = new Date(),
): number {
  const today = todayDateOnlyIstanbul(now)
  const hh = String(Math.max(0, Math.min(23, Math.floor(hour)))).padStart(2, '0')
  let target = fromZonedTime(`${today}T${hh}:00:00`, COMPANY_TIMEZONE)
  if (target.getTime() <= now.getTime()) {
    const tomorrow = shiftDateOnlyDays(today, 1)
    target = fromZonedTime(`${tomorrow}T${hh}:00:00`, COMPANY_TIMEZONE)
  }
  return Math.max(0, target.getTime() - now.getTime())
}

export function isAtOrAfterIstanbulHour(
  hour: number,
  now: Date = new Date(),
): boolean {
  if (hour === 0) {
    // Midnight window: fire from 00:00 onward on the calendar day (catch-up all day).
    return true
  }
  const currentHour = Number(formatInTimeZone(now, COMPANY_TIMEZONE, 'H'))
  return currentHour >= hour
}

/**
 * Once per Istanbul day from midnight onward, if any forwarded open (approved)
 * jobs exist for today's planned shoot date, push muhabir + kameraman.
 * Dedup via appMeta/shootingCalendarNotify.lastNotifiedDate.
 */
export async function runDueShootingCalendarNotify(actor: {
  uid: string
  fullName: string
  role: string
}): Promise<ShootingCalendarNotifyResult> {
  if (actor.role !== 'management' && actor.role !== 'coordinator') {
    return { skipped: true, reason: 'unauthorized' }
  }
  if (!isAtOrAfterIstanbulHour(SHOOTING_CALENDAR_NOTIFY_HOUR)) {
    return { skipped: true, reason: 'before_window' }
  }

  const today = todayDateOnlyIstanbul()
  const jobsSnap = await getDocs(
    query(
      collection(getDb(), 'jobs'),
      where('status', '==', 'approved'),
      where('forwardedToReporter', '==', true),
      where('plannedExecutionDate', '==', today),
      limit(50),
    ),
  )
  const jobCount = jobsSnap.size
  if (jobCount === 0) {
    return { skipped: true, reason: 'no_jobs', date: today }
  }

  const metaRef = doc(getDb(), ...META_PATH)
  const claimed = await runTransaction(getDb(), async (tx) => {
    const metaSnap = await tx.get(metaRef)
    const data = metaSnap.exists() ? metaSnap.data() : {}
    const last =
      typeof data.lastNotifiedDate === 'string' ? data.lastNotifiedDate : null
    if (last && last >= today) {
      return false
    }
    tx.set(
      metaRef,
      {
        lastNotifiedDate: today,
        lastNotifiedAt: serverTimestamp(),
        lastNotifiedByUid: actor.uid,
        lastNotifiedByName: actor.fullName,
        lastJobCount: jobCount,
      },
      { merge: true },
    )
    return true
  })

  if (!claimed) {
    return { skipped: true, reason: 'already_notified', date: today }
  }

  void sendOneSignalPush({
    title: 'Çekim takvimi hazır',
    body: `Bugün için ${jobCount} iş çekim takvimine düştü.`,
    link: '/reporter',
    roles: ['kameraman', 'reporter'],
  })

  return { skipped: false, date: today, jobCount }
}
