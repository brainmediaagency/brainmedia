import { isValidJobTimeLocal } from '@/lib/date'

/**
 * Normalize browser `<input type="time">` values to `HH:mm`.
 * Some browsers emit `HH:mm:ss` which Firestore rules reject.
 */
export function normalizeJobClockTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(trimmed)
  if (!match) return trimmed
  return `${match[1]}:${match[2]}`
}

export function isValidJobClockTime(value: string): boolean {
  return isValidJobTimeLocal(normalizeJobClockTime(value))
}

/** Empty or valid HH:mm. */
export function isOptionalJobClockTime(value: string): boolean {
  const normalized = normalizeJobClockTime(value)
  return normalized === '' || isValidJobClockTime(normalized)
}

/**
 * When both times are set, out must be after in.
 * Either side may be empty (partial entry).
 */
export function isJobClockOutAfterIn(
  clockIn: string,
  clockOut: string,
): boolean {
  const inTime = normalizeJobClockTime(clockIn)
  const outTime = normalizeJobClockTime(clockOut)
  if (!inTime || !outTime) return true
  return (
    isValidJobClockTime(inTime) &&
    isValidJobClockTime(outTime) &&
    outTime > inTime
  )
}

export function parseOptionalJobClockTimes(
  clockInTime: string,
  clockOutTime: string,
): { clockInTime: string | null; clockOutTime: string | null } {
  const clockIn = normalizeJobClockTime(clockInTime)
  const clockOut = normalizeJobClockTime(clockOutTime)
  return {
    clockInTime: clockIn && isValidJobClockTime(clockIn) ? clockIn : null,
    clockOutTime: clockOut && isValidJobClockTime(clockOut) ? clockOut : null,
  }
}

export function formatJobClockRangeTr(
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
): string {
  const inTime = clockIn ? normalizeJobClockTime(clockIn) : ''
  const outTime = clockOut ? normalizeJobClockTime(clockOut) : ''
  if (inTime && outTime) return `${inTime} – ${outTime}`
  if (inTime) return `Giriş ${inTime}`
  if (outTime) return `Çıkış ${outTime}`
  return '—'
}

/** Staff view: declared time + when the cameraman actually saved it. */
export function formatJobClockStaffSlotTr(
  declared: string | null | undefined,
  submittedAt: string | null | undefined,
  label: 'Giriş' | 'Çıkış',
): string | null {
  const time = declared ? normalizeJobClockTime(declared) : ''
  if (!time) return null
  const submitted = submittedAt ? normalizeJobClockTime(submittedAt) : ''
  if (submitted && submitted !== time) {
    return `${label} ${time} (işlem ${submitted})`
  }
  if (submitted) return `${label} ${time} (işlem ${submitted})`
  return `${label} ${time}`
}

export function formatJobClockStaffSummaryTr(clock: {
  clockInTime: string | null
  clockOutTime: string | null
  clockInSubmittedAtHHmm: string | null
  clockOutSubmittedAtHHmm: string | null
}): string {
  const parts = [
    formatJobClockStaffSlotTr(
      clock.clockInTime,
      clock.clockInSubmittedAtHHmm,
      'Giriş',
    ),
    formatJobClockStaffSlotTr(
      clock.clockOutTime,
      clock.clockOutSubmittedAtHHmm,
      'Çıkış',
    ),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

