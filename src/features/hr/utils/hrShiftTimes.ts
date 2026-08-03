import { isValidJobTimeLocal } from '@/lib/date'

/**
 * Normalize browser `<input type="time">` values to `HH:mm`.
 * Some browsers emit `HH:mm:ss` which Firestore rules reject.
 */
export function normalizeHrShiftTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(trimmed)
  if (!match) return trimmed
  return `${match[1]}:${match[2]}`
}

/** Any valid clock time `HH:mm` (e.g. 06:57). Accepts `HH:mm:ss` input. */
export function isValidHrShiftTime(value: string): boolean {
  return isValidJobTimeLocal(normalizeHrShiftTime(value))
}

/** Empty string = not set. Non-empty must be HH:mm (after normalize). */
export function isOptionalHrShiftTime(value: string): boolean {
  return value === '' || isValidHrShiftTime(value)
}

/**
 * When both times are set, out must be after in.
 * Lexicographic compare works for zero-padded HH:mm.
 */
export function isHrClockOutAfterIn(
  clockIn: string,
  clockOut: string,
): boolean {
  if (!clockIn || !clockOut) return true
  const inTime = normalizeHrShiftTime(clockIn)
  const outTime = normalizeHrShiftTime(clockOut)
  return isValidHrShiftTime(inTime) && isValidHrShiftTime(outTime) && outTime > inTime
}
