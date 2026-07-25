import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { COMPANY_TIMEZONE } from '@/config/roles'
import { formatDateOnlyLongTr, todayDateOnlyIstanbul } from '@/lib/date'

/** First scheduled purge day (Istanbul calendar). */
export const HR_RETENTION_FIRST_PURGE = '2026-09-01'

/** Max retention warning popups per purge cycle. */
export const HR_RETENTION_WARN_MAX_SHOWS = 3

/** Inclusive warning window length ending the day before purge. */
export const HR_RETENTION_WARN_DAYS = 3

export type HrRetentionCycle = {
  /** yyyy-MM-dd purge day */
  purgeDate: string
  /** First warning day (purge − 3 days) */
  warnStartDate: string
  /** Last warning day (purge − 1 day) */
  warnEndDate: string
}

function parseDateOnlyParts(dateOnly: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return { y: y!, m: m!, d: d! }
}

/** Add whole calendar months on the 1st in Istanbul; clamps to day 1. */
export function addMonthsDateOnly(dateOnly: string, months: number): string {
  const { y, m } = parseDateOnlyParts(dateOnly)
  const index = y * 12 + (m - 1) + months
  const nextY = Math.floor(index / 12)
  const nextM = (index % 12) + 1
  return `${nextY}-${String(nextM).padStart(2, '0')}-01`
}

export function addDaysDateOnly(dateOnly: string, days: number): string {
  const base = fromZonedTime(`${dateOnly}T12:00:00`, COMPANY_TIMEZONE)
  base.setDate(base.getDate() + days)
  return formatInTimeZone(base, COMPANY_TIMEZONE, 'yyyy-MM-dd')
}

export function compareDateOnly(a: string, b: string): number {
  return a.localeCompare(b)
}

/**
 * Istanbul midnight of the purge day as epoch ms.
 * Docs with `createdAt` strictly before this are eligible for purge.
 */
export function purgeCutoffMs(purgeDate: string): number {
  return fromZonedTime(`${purgeDate}T00:00:00`, COMPANY_TIMEZONE).getTime()
}

/** Pure predicate: created before purge-day midnight (Istanbul). */
export function isCreatedBeforePurgeCutoff(
  createdAtMs: number,
  purgeDate: string,
): boolean {
  return createdAtMs < purgeCutoffMs(purgeDate)
}

export function buildHrRetentionCycle(purgeDate: string): HrRetentionCycle {
  return {
    purgeDate,
    warnStartDate: addDaysDateOnly(purgeDate, -HR_RETENTION_WARN_DAYS),
    warnEndDate: addDaysDateOnly(purgeDate, -1),
  }
}

/** Upcoming (or today's) purge cycle relative to `today`. */
export function getUpcomingHrRetentionCycle(
  today: string = todayDateOnlyIstanbul(),
): HrRetentionCycle {
  let purgeDate = HR_RETENTION_FIRST_PURGE
  while (compareDateOnly(purgeDate, today) < 0) {
    purgeDate = addMonthsDateOnly(purgeDate, 2)
  }
  return buildHrRetentionCycle(purgeDate)
}

/** Most recent purge day that is due (today or earlier). Null if none yet. */
export function getDueHrRetentionPurgeDate(
  today: string = todayDateOnlyIstanbul(),
): string | null {
  if (compareDateOnly(today, HR_RETENTION_FIRST_PURGE) < 0) return null

  let purgeDate = HR_RETENTION_FIRST_PURGE
  let due = purgeDate
  while (compareDateOnly(purgeDate, today) <= 0) {
    due = purgeDate
    purgeDate = addMonthsDateOnly(purgeDate, 2)
  }
  return due
}

export function isInHrRetentionWarningWindow(
  today: string = todayDateOnlyIstanbul(),
  cycle: HrRetentionCycle = getUpcomingHrRetentionCycle(today),
): boolean {
  return (
    compareDateOnly(today, cycle.warnStartDate) >= 0
    && compareDateOnly(today, cycle.warnEndDate) <= 0
  )
}

export function formatHrRetentionPurgeLabel(purgeDate: string): string {
  return formatDateOnlyLongTr(purgeDate)
}

export function hrRetentionWarnStorageKey(uid: string, purgeDate: string): string {
  return `brain-hr-retention-warn:${uid}:${purgeDate}`
}

export function readHrRetentionWarnCount(uid: string, purgeDate: string): number {
  if (typeof localStorage === 'undefined') return HR_RETENTION_WARN_MAX_SHOWS
  try {
    const raw = localStorage.getItem(hrRetentionWarnStorageKey(uid, purgeDate))
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { count?: unknown }
    const count = Number(parsed.count ?? 0)
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  } catch {
    return 0
  }
}

export function writeHrRetentionWarnCount(
  uid: string,
  purgeDate: string,
  count: number,
): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(
    hrRetentionWarnStorageKey(uid, purgeDate),
    JSON.stringify({ count }),
  )
}
