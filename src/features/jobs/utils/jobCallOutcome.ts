export const JOB_CALL_OUTCOMES = [
  'busy',
  'unreachable',
  'unanswered',
  'reached',
] as const

export type JobCallOutcome = (typeof JOB_CALL_OUTCOMES)[number]

/** Manual options in the review drawer (not Ulaşıldı). */
export const MANUAL_JOB_CALL_OUTCOMES = [
  'busy',
  'unreachable',
  'unanswered',
] as const satisfies readonly JobCallOutcome[]

export type ManualJobCallOutcome = (typeof MANUAL_JOB_CALL_OUTCOMES)[number]

export const JOB_CALL_OUTCOME_LABELS: Record<JobCallOutcome, string> = {
  busy: 'Meşgul',
  unreachable: 'Ulaşılamıyor',
  unanswered: 'Cevapsız',
  reached: 'Ulaşıldı',
}

export function isJobCallOutcome(value: unknown): value is JobCallOutcome {
  return (
    typeof value === 'string' &&
    (JOB_CALL_OUTCOMES as readonly string[]).includes(value)
  )
}

export function isManualJobCallOutcome(
  value: unknown,
): value is ManualJobCallOutcome {
  return (
    typeof value === 'string' &&
    (MANUAL_JOB_CALL_OUTCOMES as readonly string[]).includes(value)
  )
}

export function parseJobCallOutcome(value: unknown): JobCallOutcome | null {
  return isJobCallOutcome(value) ? value : null
}

export function jobCallOutcomeLabel(value: JobCallOutcome | null): string {
  return value ? JOB_CALL_OUTCOME_LABELS[value] : 'Belirtilmedi'
}
