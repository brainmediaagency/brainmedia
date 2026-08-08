import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import {
  reportExpenseKurus,
  reportIncomeKurus,
  resolveReportDate,
} from '@/features/cash/services/cashService'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import { getDb } from '@/lib/firebase/firestore'
import { UserFacingError, mapAppError } from '@/lib/errors'
import {
  expandStatsQueryDateRange,
  isDateOnlyInStatsRange,
  isValidDateOnly,
} from '@/lib/date'

const SUMMARY_FETCH_LIMIT = 2000

export type ReporterSummaryRange = {
  startDate: string
  endDate: string
  /** Omit or empty = all reporters (mgmt / coord / HR). */
  createdByUid?: string | null
}

export type ReporterSummaryTotals = {
  reportCount: number
  companyCount: number
  newsCount: number
  shootMinutes: number
  incomeKurus: number
  vatKurus: number
  fieldPaidKurus: number
  operatingExpenseKurus: number
  hotelExpenseKurus: number
  stationeryExpenseKurus: number
  fuelExpenseKurus: number
  mealExpenseKurus: number
  extraExpenseKurus: number
  employeeExpenseKurus: number
  totalExpenseKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
  newsIncomeKurus: number
  vatChargeCount: number
  cashChargeCount: number
  uniqueReporterCount: number
}

export type ReporterSummaryDayRow = {
  reportDate: string
  reportCount: number
  companyCount: number
  newsCount: number
  shootMinutes: number
  incomeKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
}

export type ReporterSummaryReporterRow = {
  uid: string
  fullName: string
  reportCount: number
  companyCount: number
  newsCount: number
  shootMinutes: number
  incomeKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
}

export type ReporterSummaryResult = {
  totals: ReporterSummaryTotals
  byDay: ReporterSummaryDayRow[]
  byReporter: ReporterSummaryReporterRow[]
  reports: ReporterDailyReport[]
}

function emptyTotals(): ReporterSummaryTotals {
  return {
    reportCount: 0,
    companyCount: 0,
    newsCount: 0,
    shootMinutes: 0,
    incomeKurus: 0,
    vatKurus: 0,
    fieldPaidKurus: 0,
    operatingExpenseKurus: 0,
    hotelExpenseKurus: 0,
    stationeryExpenseKurus: 0,
    fuelExpenseKurus: 0,
    mealExpenseKurus: 0,
    extraExpenseKurus: 0,
    employeeExpenseKurus: 0,
    totalExpenseKurus: 0,
    reporterEarningsKurus: 0,
    cameramanEarningsKurus: 0,
    newsIncomeKurus: 0,
    vatChargeCount: 0,
    cashChargeCount: 0,
    uniqueReporterCount: 0,
  }
}

function reportNewsCount(report: ReporterDailyReport): number {
  if (!Array.isArray(report.companies)) return 0
  return report.companies.reduce(
    (sum, company) => sum + (company.hasNews ? 1 : 0),
    0,
  )
}

function reportShootMinutes(report: ReporterDailyReport): number {
  if (!Array.isArray(report.companies)) return 0
  return report.companies.reduce(
    (sum, company) => sum + Math.max(0, Number(company.shootMinutes ?? 0)),
    0,
  )
}

function reportNewsIncomeKurus(report: ReporterDailyReport): number {
  if (!Array.isArray(report.companies)) return 0
  return report.companies.reduce((sum, company) => {
    if (!company.hasNews) return sum
    return sum + Math.max(0, Number(company.newsTotalKurus ?? 0))
  }, 0)
}

function reportCompanyCount(report: ReporterDailyReport): number {
  if (Array.isArray(report.companies) && report.companies.length > 0) {
    return report.companies.length
  }
  return Math.max(0, Number(report.companyCount ?? 0))
}

function mapRawReport(
  id: string,
  data: Record<string, unknown>,
): ReporterDailyReport {
  return {
    id,
    ...(data as Omit<ReporterDailyReport, 'id'>),
  }
}

/**
 * Fetch non-deleted daily reports in a `reportDate` range.
 * Falls back to recent `createdAt` docs + client filter if the index/query fails.
 */
export async function fetchReportsForSummary(
  range: ReporterSummaryRange,
): Promise<ReporterDailyReport[]> {
  if (!isValidDateOnly(range.startDate) || !isValidDateOnly(range.endDate)) {
    throw new UserFacingError('Geçerli bir tarih aralığı seçin.')
  }
  if (range.startDate > range.endDate) {
    throw new UserFacingError('Başlangıç tarihi bitişten sonra olamaz.')
  }

  const expanded = expandStatsQueryDateRange(range.startDate, range.endDate)
  if (!expanded) return []

  const col = collection(getDb(), 'reporterDailyReports')
  const uid = range.createdByUid?.trim() || null

  try {
    const constraints = uid
      ? [
          where('createdByUid', '==', uid),
          where('reportDate', '>=', expanded.startDate),
          where('reportDate', '<=', expanded.endDate),
          orderBy('reportDate', 'asc'),
          limit(SUMMARY_FETCH_LIMIT),
        ]
      : [
          where('reportDate', '>=', expanded.startDate),
          where('reportDate', '<=', expanded.endDate),
          orderBy('reportDate', 'asc'),
          limit(SUMMARY_FETCH_LIMIT),
        ]

    const snap = await getDocs(query(col, ...constraints))
    return snap.docs
      .map((d) => mapRawReport(d.id, d.data() as Record<string, unknown>))
      .filter((r) => r.deletedAt == null)
      .filter((r) =>
        isDateOnlyInStatsRange(
          resolveReportDate(r),
          range.startDate,
          range.endDate,
        ),
      )
  } catch (error) {
    try {
      const snap = uid
        ? await getDocs(
            query(
              col,
              where('createdByUid', '==', uid),
              orderBy('createdAt', 'desc'),
              limit(SUMMARY_FETCH_LIMIT),
            ),
          )
        : await getDocs(
            query(col, orderBy('createdAt', 'desc'), limit(SUMMARY_FETCH_LIMIT)),
          )

      return snap.docs
        .map((d) => mapRawReport(d.id, d.data() as Record<string, unknown>))
        .filter((r) => r.deletedAt == null)
        .filter((r) =>
          isDateOnlyInStatsRange(
            resolveReportDate(r),
            range.startDate,
            range.endDate,
          ),
        )
        .sort((a, b) => resolveReportDate(a).localeCompare(resolveReportDate(b)))
    } catch (fallbackError) {
      throw new UserFacingError(
        mapAppError(fallbackError, 'Muhabir özeti yüklenemedi.'),
      )
    }
  }
}

/** Pure aggregation — used by UI and unit tests. */
export function aggregateReporterSummary(
  reports: ReporterDailyReport[],
): Omit<ReporterSummaryResult, 'reports'> {
  const totals = emptyTotals()
  const dayMap = new Map<string, ReporterSummaryDayRow>()
  const reporterMap = new Map<string, ReporterSummaryReporterRow>()
  const reporterUids = new Set<string>()

  for (const report of reports) {
    const reportDate = resolveReportDate(report)
    const companyCount = reportCompanyCount(report)
    const newsCount = reportNewsCount(report)
    const shootMinutes = reportShootMinutes(report)
    const incomeKurus = reportIncomeKurus(report)
    const expenseKurus = reportExpenseKurus(report)
    const reporterEarnings = Math.max(
      0,
      Number(report.totalReporterEarningsKurus ?? 0),
    )
    const cameramanEarnings = Math.max(
      0,
      Number(report.totalCameramanEarningsKurus ?? 0),
    )
    const uid = String(report.createdByUid ?? '')
    const fullName =
      String(report.createdByNameSnapshot ?? '').trim() || uid || 'Muhabir'

    if (uid) reporterUids.add(uid)

    totals.reportCount += 1
    totals.companyCount += companyCount
    totals.newsCount += newsCount
    totals.shootMinutes += shootMinutes
    totals.incomeKurus += incomeKurus
    totals.vatKurus += Math.max(0, Number(report.totalVatKurus ?? 0))
    totals.fieldPaidKurus += Math.max(0, Number(report.fieldPaidKurus ?? 0))
    totals.hotelExpenseKurus += Math.max(0, Number(report.hotelExpenseKurus ?? 0))
    totals.stationeryExpenseKurus += Math.max(
      0,
      Number(report.stationeryExpenseKurus ?? 0),
    )
    totals.fuelExpenseKurus += Math.max(0, Number(report.fuelExpenseKurus ?? 0))
    totals.mealExpenseKurus += Math.max(0, Number(report.mealExpenseKurus ?? 0))
    totals.extraExpenseKurus += Math.max(0, Number(report.extraExpenseKurus ?? 0))
    totals.operatingExpenseKurus += Math.max(
      0,
      Number(report.operatingExpenseKurus ?? 0),
    )
    totals.employeeExpenseKurus += Math.max(
      0,
      Number(report.employeeExpenseKurus ?? reporterEarnings + cameramanEarnings),
    )
    totals.totalExpenseKurus += expenseKurus
    totals.reporterEarningsKurus += reporterEarnings
    totals.cameramanEarningsKurus += cameramanEarnings
    totals.newsIncomeKurus += reportNewsIncomeKurus(report)

    if (Array.isArray(report.companies)) {
      for (const company of report.companies) {
        if (company.chargeMode === 'cash') totals.cashChargeCount += 1
        else totals.vatChargeCount += 1
      }
    }

    const day = dayMap.get(reportDate) ?? {
      reportDate,
      reportCount: 0,
      companyCount: 0,
      newsCount: 0,
      shootMinutes: 0,
      incomeKurus: 0,
      reporterEarningsKurus: 0,
      cameramanEarningsKurus: 0,
    }
    day.reportCount += 1
    day.companyCount += companyCount
    day.newsCount += newsCount
    day.shootMinutes += shootMinutes
    day.incomeKurus += incomeKurus
    day.reporterEarningsKurus += reporterEarnings
    day.cameramanEarningsKurus += cameramanEarnings
    dayMap.set(reportDate, day)

    const reporterKey = uid || fullName
    const reporter = reporterMap.get(reporterKey) ?? {
      uid: uid || reporterKey,
      fullName,
      reportCount: 0,
      companyCount: 0,
      newsCount: 0,
      shootMinutes: 0,
      incomeKurus: 0,
      reporterEarningsKurus: 0,
      cameramanEarningsKurus: 0,
    }
    reporter.reportCount += 1
    reporter.companyCount += companyCount
    reporter.newsCount += newsCount
    reporter.shootMinutes += shootMinutes
    reporter.incomeKurus += incomeKurus
    reporter.reporterEarningsKurus += reporterEarnings
    reporter.cameramanEarningsKurus += cameramanEarnings
    reporterMap.set(reporterKey, reporter)
  }

  totals.uniqueReporterCount = reporterUids.size

  const byDay = [...dayMap.values()].sort((a, b) =>
    b.reportDate.localeCompare(a.reportDate),
  )
  const byReporter = [...reporterMap.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, 'tr'),
  )

  return { totals, byDay, byReporter }
}

export async function fetchReporterSummary(
  range: ReporterSummaryRange,
): Promise<ReporterSummaryResult> {
  try {
    const reports = await fetchReportsForSummary(range)
    const aggregated = aggregateReporterSummary(reports)
    return { ...aggregated, reports }
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Muhabir özeti yüklenemedi.'))
  }
}
