/**
 * Per-reporter daily-report form rules (beyond job date visibility).
 */

export type ReporterDailyReportRule = {
  email: string
  uid?: string
  /**
   * When true, new reports do not force every day job into the form;
   * submit may include a subset (even a single company).
   */
  allowPartialDayCompanies: boolean
}

export const REPORTER_DAILY_REPORT_RULES: readonly ReporterDailyReportRule[] = [
  {
    email: 'test.muhabir@brain.com',
    allowPartialDayCompanies: true,
  },
] as const

function normalizeEmailKey(email: string): string {
  return email.trim().toLocaleLowerCase('en-US')
}

export type ReporterReportIdentity = {
  email?: string | null
  uid?: string | null
}

function findRule(
  identity: string | ReporterReportIdentity | null | undefined,
): ReporterDailyReportRule | null {
  if (typeof identity === 'string' || identity == null) {
    const key = identity?.trim() ? normalizeEmailKey(identity) : ''
    if (!key) return null
    return (
      REPORTER_DAILY_REPORT_RULES.find(
        (item) => normalizeEmailKey(item.email) === key,
      ) ?? null
    )
  }

  const uid = identity.uid?.trim() || ''
  if (uid) {
    const byUid = REPORTER_DAILY_REPORT_RULES.find((item) => item.uid === uid)
    if (byUid) return byUid
  }

  const key = identity.email?.trim() ? normalizeEmailKey(identity.email) : ''
  if (!key) return null
  return (
    REPORTER_DAILY_REPORT_RULES.find(
      (item) => normalizeEmailKey(item.email) === key,
    ) ?? null
  )
}

/** test.muhabir etc. may submit one (or more) firms without covering the whole day. */
export function reporterAllowsPartialDayCompanies(
  identity: string | ReporterReportIdentity | null | undefined,
): boolean {
  return findRule(identity)?.allowPartialDayCompanies === true
}
