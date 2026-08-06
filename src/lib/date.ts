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

/** `yyyy-MM` (Istanbul calendar month). */
export function isValidYearMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const month = Number(value.slice(5, 7))
  return month >= 1 && month <= 12
}

/** Istanbul wall-clock `yyyy-MM` for the current month. */
export function currentYearMonthIstanbul(now: Date = new Date()): string {
  return todayDateOnlyIstanbul(now).slice(0, 7)
}

/**
 * `yyyy-MM` → "Ağustos 2026"
 * Invalid input returns the raw string.
 */
export function formatYearMonthLongTr(yearMonth: string): string {
  if (!isValidYearMonth(yearMonth)) return yearMonth
  const instant = fromZonedTime(`${yearMonth}-01T12:00:00`, COMPANY_TIMEZONE)
  return formatInTimeZone(instant, COMPANY_TIMEZONE, 'MMMM yyyy', { locale: tr })
}

/**
 * Human range label for the ops/stats month window (ayın son günü sonraki aya):
 * "28 Şubat – 30 Mart 2026" for 2026-03.
 */
export function formatYearMonthRangeTr(yearMonth: string): string {
  if (!isValidYearMonth(yearMonth)) return yearMonth
  try {
    const { startDate, endDate } = statsMonthDateBounds(yearMonth)
    const start = fromZonedTime(`${startDate}T12:00:00`, COMPANY_TIMEZONE)
    const end = fromZonedTime(`${endDate}T12:00:00`, COMPANY_TIMEZONE)
    const endLabel = formatInTimeZone(end, COMPANY_TIMEZONE, 'd MMMM yyyy', {
      locale: tr,
    })
    if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
      const startDay = formatInTimeZone(start, COMPANY_TIMEZONE, 'd', { locale: tr })
      return `${startDay} – ${endLabel}`
    }
    const startLabel = formatInTimeZone(start, COMPANY_TIMEZONE, 'd MMMM', {
      locale: tr,
    })
    return `${startLabel} – ${endLabel}`
  } catch {
    return yearMonth
  }
}

/** Last calendar day of `yyyy-MM` as `yyyy-MM-dd`. */
export function lastDayOfMonthDateOnly(yearMonth: string): string {
  if (!isValidYearMonth(yearMonth)) return yearMonth
  const [y, m] = yearMonth.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  return `${yearMonth}-${String(lastDay).padStart(2, '0')}`
}

export function isLastCalendarDayOfMonth(dateOnly: string): boolean {
  if (!isValidDateOnly(dateOnly)) return false
  return dateOnly === lastDayOfMonthDateOnly(dateOnly.slice(0, 7))
}

/** Add whole days to a `yyyy-MM-dd` (UTC calendar arithmetic). */
export function addDaysDateOnly(dateOnly: string, days: number): string {
  if (!isValidDateOnly(dateOnly)) return dateOnly
  const [y, m, d] = dateOnly.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * List/stat attribution: ayın son takvim günü bir sonraki aya sayılır.
 * Örn. 2026-03-31 → 2026-04-01, 2026-03-30 → 2026-03-30.
 */
export function statsAttributionDateOnly(dateOnly: string): string {
  if (!isValidDateOnly(dateOnly)) return dateOnly
  return isLastCalendarDayOfMonth(dateOnly)
    ? addDaysDateOnly(dateOnly, 1)
    : dateOnly
}

/**
 * Inclusive raw calendar window for ops month `yyyy-MM`.
 * Mart 2026 → 28 (veya 29) Şubat … 30 Mart; 31 Mart nisan ayına düşer.
 */
export function statsMonthDateBounds(yearMonth: string): {
  startDate: string
  endDate: string
} {
  if (!isValidYearMonth(yearMonth)) {
    throw new Error('Geçersiz ay')
  }
  const startDate = lastDayOfMonthDateOnly(shiftYearMonth(yearMonth, -1))
  const endDate = addDaysDateOnly(lastDayOfMonthDateOnly(yearMonth), -1)
  return { startDate, endDate }
}

/**
 * UI aralığını (attribution) Firestore sorgusu için ham takvim aralığına çevirir.
 * Örn. 01.03–31.03 → önceki ayın son günü … 30.03.
 * Boş sonuç (yalnızca ayın son günü seçildiyse) `null`.
 */
export function expandStatsQueryDateRange(
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } | null {
  if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) return null
  if (startDate > endDate) return null

  let queryStart = startDate
  const dayBeforeStart = addDaysDateOnly(startDate, -1)
  if (
    isLastCalendarDayOfMonth(dayBeforeStart) &&
    statsAttributionDateOnly(dayBeforeStart) >= startDate &&
    statsAttributionDateOnly(dayBeforeStart) <= endDate
  ) {
    queryStart = dayBeforeStart
  }

  let queryEnd = endDate
  if (isLastCalendarDayOfMonth(endDate)) {
    queryEnd = addDaysDateOnly(endDate, -1)
  }

  if (queryStart > queryEnd) return null
  return { startDate: queryStart, endDate: queryEnd }
}

/** `dateOnly` attribution'ı [startDate, endDate] içinde mi? */
export function isDateOnlyInStatsRange(
  dateOnly: string,
  startDate: string,
  endDate: string,
): boolean {
  if (!isValidDateOnly(dateOnly) || !isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
    return false
  }
  const attr = statsAttributionDateOnly(dateOnly)
  return attr >= startDate && attr <= endDate
}

/** Timestamp'in İstanbul gününün attribution'ı aralıkta mı? */
export function isInstantInStatsRange(
  instant: Date,
  startDate: string,
  endDate: string,
): boolean {
  return isDateOnlyInStatsRange(dateToDateOnlyIstanbul(instant), startDate, endDate)
}

/** Shift `yyyy-MM` by whole months (negative = past). */
export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  if (!isValidYearMonth(yearMonth)) return yearMonth
  const [y, m] = yearMonth.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1 + deltaMonths, 1))
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}`
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
