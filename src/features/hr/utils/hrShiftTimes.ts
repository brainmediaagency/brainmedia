import { isValidJobTimeLocal } from '@/lib/date'

/** Any valid clock time `HH:mm` (e.g. 06:57). */
export function isValidHrShiftTime(value: string): boolean {
  return isValidJobTimeLocal(value)
}

/** Empty string = not set. Non-empty must be HH:mm. */
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
  return isValidHrShiftTime(clockIn) && isValidHrShiftTime(clockOut) && clockOut > clockIn
}
