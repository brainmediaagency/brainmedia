import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { tr } from 'date-fns/locale'
import { COMPANY_TIMEZONE } from '@/config/roles'

export { COMPANY_TIMEZONE }

export function formatDateTr(date: Date | number): string {
  return formatInTimeZone(date, COMPANY_TIMEZONE, 'dd.MM.yyyy')
}

export function formatTimeTr(date: Date | number): string {
  return formatInTimeZone(date, COMPANY_TIMEZONE, 'HH:mm')
}

export function formatDateTimeTr(date: Date | number): string {
  return formatInTimeZone(date, COMPANY_TIMEZONE, 'dd.MM.yyyy HH:mm')
}

/** Istanbul wall-clock `yyyy-MM-dd` for today. */
export function todayDateOnlyIstanbul(now: Date = new Date()): string {
  return formatInTimeZone(now, COMPANY_TIMEZONE, 'yyyy-MM-dd')
}

/** 1-based day of year in Istanbul (1–365/366). */
export function dayOfYearIstanbul(now: Date = new Date()): number {
  const dateOnly = todayDateOnlyIstanbul(now)
  const [year, month, day] = dateOnly.split('-').map(Number)
  const start = Date.UTC(year!, 0, 1)
  const current = Date.UTC(year!, month! - 1, day!)
  return Math.floor((current - start) / 86_400_000) + 1
}

export function dateToDateOnlyIstanbul(date: Date): string {
  return formatInTimeZone(date, COMPANY_TIMEZONE, 'yyyy-MM-dd')
}

/**
 * `yyyy-MM-dd` → `dd.MM.yyyy` (e.g. 24.07.2026).
 * Invalid input returns the raw string.
 */
export function formatDateOnlyShortTr(dateOnly: string): string {
  if (!isValidDateOnly(dateOnly)) return dateOnly
  const [year, month, day] = dateOnly.split('-')
  return `${day}.${month}.${year}`
}

/**
 * `yyyy-MM-dd` → "19 Temmuz 2026"
 * Invalid input returns the raw string.
 */
export function formatDateOnlyLongTr(dateOnly: string): string {
  if (!isValidDateOnly(dateOnly)) return dateOnly
  const instant = fromZonedTime(`${dateOnly}T12:00:00`, COMPANY_TIMEZONE)
  return formatInTimeZone(instant, COMPANY_TIMEZONE, 'd MMMM yyyy', { locale: tr })
}

export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} dakika`
  if (mins === 0) return `${hours} saat`
  return `${hours} saat ${mins} dakika`
}

export function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

export function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** `HH:mm` wall-clock time for job execution. */
export function isValidJobTimeLocal(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const hours = Number(value.slice(0, 2))
  const minutes = Number(value.slice(3, 5))
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/** Combine date-only + time into `yyyy-MM-ddTHH:mm`. */
export function combineJobDateAndTime(dateOnly: string, timeHHmm: string): string {
  return `${dateOnly}T${timeHHmm}`
}

/** `yyyy-MM-ddTHH:mm` (datetime-local / job schedule storage). */
export function isValidDateTimeLocal(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
}

/** Accepts legacy date-only or datetime-local job schedule strings. */
export function isValidJobSchedule(value: string): boolean {
  return isValidDateOnly(value) || isValidDateTimeLocal(value)
}

export function compareDateOnly(a: string, b: string): number {
  return a.localeCompare(b)
}

/** Lexicographic compare works for both date-only and datetime-local. */
export function compareJobSchedule(a: string, b: string): number {
  return normalizeJobSchedule(a).localeCompare(normalizeJobSchedule(b))
}

/**
 * Whether `planned` is on/after `acquired`.
 * Date-only acquired compares by calendar day so `yyyy-MM-ddTHH:mm` approve
 * stamps on the same day are allowed (matches Firestore `jobScheduleOnOrAfter`).
 */
export function isJobScheduleOnOrAfter(planned: string, acquired: string): boolean {
  if (!isValidJobSchedule(planned) || !isValidJobSchedule(acquired)) return false
  if (isValidDateOnly(acquired)) {
    return planned.slice(0, 10) >= acquired
  }
  return compareJobSchedule(planned, acquired) >= 0
}

/** Normalize to datetime-local; date-only becomes `T09:00`. */
export function normalizeJobSchedule(value: string, defaultTime = '09:00'): string {
  if (isValidDateTimeLocal(value)) return value
  if (isValidDateOnly(value)) return `${value}T${defaultTime}`
  return value
}

/**
 * Formats job schedule fields for UI.
 * Date-only legacy → `dd.MM.yyyy`, datetime → `dd.MM.yyyy HH:mm`.
 */
export function formatJobScheduleTr(value: string): string {
  if (!value) return '—'
  if (isValidDateOnly(value)) {
    const [year, month, day] = value.split('-')
    return `${day}.${month}.${year}`
  }
  if (isValidDateTimeLocal(value)) {
    const [datePart, timePart] = value.split('T')
    const [year, month, day] = datePart!.split('-')
    return `${day}.${month}.${year} ${timePart}`
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return formatDateTimeTr(parsed)
}

/** Parse stored job schedule as Istanbul wall-clock instant. */
export function parseJobSchedule(value: string): Date | null {
  if (!isValidJobSchedule(value)) return null
  const normalized = normalizeJobSchedule(value)
  return fromZonedTime(`${normalized}:00`, COMPANY_TIMEZONE)
}

export function isJobSchedulePast(value: string, now: Date = new Date()): boolean {
  const scheduled = parseJobSchedule(value)
  if (!scheduled) return false
  return scheduled.getTime() < now.getTime()
}

/**
 * Next calendar day after a date-only or datetime schedule; skips Sundays.
 * Preserves time when present, otherwise uses 09:00.
 */
export function nextWorkdayAfter(schedule: string): string {
  if (!isValidJobSchedule(schedule)) return ''
  const dateOnly = schedule.slice(0, 10)
  const timePart = isValidDateTimeLocal(schedule) ? schedule.slice(11, 16) : '09:00'
  const [year, month, day] = dateOnly.split('-').map(Number)
  const date = new Date(year!, (month ?? 1) - 1, day ?? 1)
  date.setDate(date.getDate() + 1)
  while (date.getDay() === 0) {
    date.setDate(date.getDate() + 1)
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T${timePart}`
}
