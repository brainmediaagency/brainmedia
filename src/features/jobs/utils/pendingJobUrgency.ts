import { shiftDateOnlyDays, todayDateOnlyIstanbul } from '@/lib/date'

export type PendingJobUrgency = 'overdue' | 'today' | 'tomorrow'

/** How close a pending job's planned shoot day is (Istanbul calendar). */
export function pendingJobUrgency(
  plannedExecutionDate: string,
  today: string = todayDateOnlyIstanbul(),
): PendingJobUrgency | null {
  const day = plannedExecutionDate?.slice(0, 10)
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  if (day < today) return 'overdue'
  if (day === today) return 'today'
  if (day === shiftDateOnlyDays(today, 1)) return 'tomorrow'
  return null
}

export const PENDING_JOB_URGENCY_LABEL: Record<PendingJobUrgency, string> = {
  overdue: 'Tarihi geçti',
  today: 'Bugün',
  tomorrow: 'Yarın',
}
