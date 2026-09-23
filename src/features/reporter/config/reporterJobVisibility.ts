/**
 * Per-reporter earliest çekim günü on calendar / daily-report job lists.
 * Merve and other accounts have no entry → see the full shared pool.
 * Kameraman is unaffected (different email / uid).
 */
export type ReporterJobVisibilityRule = {
  email: string
  /** Optional Auth/Firestore uid — preferred when present. */
  uid?: string
  /** Inclusive `yyyy-MM-dd` — jobs with planned day before this are hidden. */
  visibleJobsFromDate: string
}

export const REPORTER_JOB_VISIBILITY: readonly ReporterJobVisibilityRule[] = [
  {
    email: 'muhabir2@brain.com',
    uid: '5aKWpVWvnEX7TDyftXtww41VlNY2',
    visibleJobsFromDate: '2026-09-13',
  },
] as const

function normalizeEmailKey(email: string): string {
  return email.trim().toLocaleLowerCase('en-US')
}

export type ReporterVisibilityIdentity = {
  email?: string | null
  uid?: string | null
}

/** Earliest visible planned day for this reporter, or null = no cutoff. */
export function reporterVisibleJobsFromDate(
  identity: string | ReporterVisibilityIdentity | null | undefined,
): string | null {
  // Legacy: bare email string
  if (typeof identity === 'string' || identity == null) {
    const key = identity?.trim() ? normalizeEmailKey(identity) : ''
    if (!key) return null
    return (
      REPORTER_JOB_VISIBILITY.find(
        (item) => normalizeEmailKey(item.email) === key,
      )?.visibleJobsFromDate ?? null
    )
  }

  const uid = identity.uid?.trim() || ''
  if (uid) {
    const byUid = REPORTER_JOB_VISIBILITY.find((item) => item.uid === uid)
    if (byUid) return byUid.visibleJobsFromDate
  }

  const key = identity.email?.trim() ? normalizeEmailKey(identity.email) : ''
  if (!key) return null
  return (
    REPORTER_JOB_VISIBILITY.find((item) => normalizeEmailKey(item.email) === key)
      ?.visibleJobsFromDate ?? null
  )
}

function plannedDayKey(plannedExecutionDate: string): string {
  return plannedExecutionDate.trim().slice(0, 10)
}

/**
 * Whether a job’s çekim günü is visible for this reporter account.
 * Accounts without a rule always see the job (subject to other calendar filters).
 */
export function isJobVisibleForReporterEmail(
  job: { plannedExecutionDate: string },
  identity: string | ReporterVisibilityIdentity | null | undefined,
): boolean {
  const from = reporterVisibleJobsFromDate(identity)
  if (!from) return true
  const day = plannedDayKey(job.plannedExecutionDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  return day >= from
}

export function filterJobsVisibleForReporterEmail<
  T extends { plannedExecutionDate: string },
>(
  jobs: T[],
  identity: string | ReporterVisibilityIdentity | null | undefined,
): T[] {
  const from = reporterVisibleJobsFromDate(identity)
  if (!from) return jobs
  return jobs.filter((job) => isJobVisibleForReporterEmail(job, identity))
}
