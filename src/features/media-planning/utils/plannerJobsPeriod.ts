import type { JobDocument } from '@/features/jobs/types/job'
import type { UserStats } from '@/features/users/types/user'
import {
  isValidDateOnly,
  normalizeJobSchedule,
} from '@/lib/date'

export type PlannerPeriodMode = 'all' | 'month' | 'day'

export const PLANNER_PERIOD_MODES: {
  id: PlannerPeriodMode
  label: string
}[] = [
  { id: 'all', label: 'Tüm zamanlar' },
  { id: 'month', label: 'Ay' },
  { id: 'day', label: 'Gün' },
]

/** Planned çekim günü (`yyyy-MM-dd`) — invalid schedules yield null. */
export function jobPlannedDateOnly(
  job: Pick<JobDocument, 'plannedExecutionDate'>,
): string | null {
  const dateOnly = normalizeJobSchedule(job.plannedExecutionDate).slice(0, 10)
  return isValidDateOnly(dateOnly) ? dateOnly : null
}

/**
 * İş Kayıtları dönem filtresi.
 * `all` = planlanan tarih yok sayılır, tüm kayıtlar.
 * `month` / `day` = geçerli planlanan çekim gününe göre.
 */
export function filterJobsByPeriod(
  jobs: readonly JobDocument[],
  mode: PlannerPeriodMode,
  yearMonth: string,
  day: string,
): JobDocument[] {
  if (mode === 'all') return [...jobs]
  return jobs.filter((job) => {
    const dateOnly = jobPlannedDateOnly(job)
    if (!dateOnly) return false
    if (mode === 'month') return dateOnly.startsWith(yearMonth)
    return dateOnly === day
  })
}

/**
 * MPU Tablosu sayıları — İş Kayıtları ile aynı iş setinden.
 * Alınan = konfirme + çekildi + iptal (beklemede / red hariç).
 */
export function plannerScoreFromJobs(
  jobs: readonly JobDocument[],
): UserStats {
  let jobsReceived = 0
  let jobsShot = 0
  let jobsCancelled = 0
  for (const job of jobs) {
    if (
      job.status === 'approved' ||
      job.status === 'shot' ||
      job.status === 'cancelled'
    ) {
      jobsReceived += 1
    }
    if (job.status === 'shot') jobsShot += 1
    if (job.status === 'cancelled') jobsCancelled += 1
  }
  return { jobsReceived, jobsShot, jobsCancelled }
}
