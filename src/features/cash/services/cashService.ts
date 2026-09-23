import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import type {
  ReportCashExpenseParts,
  ReportCashGroup,
  ReportCashTotals,
} from '@/features/cash/types/cash'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import {
  emptyReportCashTotals,
  filterReportCashGroups,
  filterReportCashGroupsByReportDateRange,
  sumExpenseParts,
  sumReportCashGroups,
} from '@/features/cash/utils/filterReportCashGroups'
import {
  dateToDateOnlyIstanbul,
  formatDateOnlyLongTr,
  isValidDateOnly,
  isValidYearMonth,
  statsMonthDateBounds,
  todayDateOnlyIstanbul,
} from '@/lib/date'

export {
  emptyReportCashTotals,
  filterReportCashGroups,
  filterReportCashGroupsByReportDateRange,
  sumExpenseParts,
}

const MONTHLY_CASH_FETCH_LIMIT = 2000

function nonNegKurus(value: unknown): number {
  return Math.max(0, Math.trunc(Number(value ?? 0) || 0))
}

/** Gelir kırılımı: matrah + KDV (= kasaya geçen toplam). */
export function reportIncomeParts(report: ReporterDailyReport): {
  vatBaseKurus: number
  vatKurus: number
  incomeKurus: number
} {
  if (Array.isArray(report.companies) && report.companies.length > 0) {
    let vatBaseKurus = 0
    let vatKurus = 0
    for (const company of report.companies) {
      vatBaseKurus += Number(company.vatBaseKurus ?? 0) || 0
      vatKurus += Number(company.vatKurus ?? 0) || 0
    }
    vatBaseKurus = nonNegKurus(vatBaseKurus)
    vatKurus = nonNegKurus(vatKurus)
    return {
      vatBaseKurus,
      vatKurus,
      incomeKurus: vatBaseKurus + vatKurus,
    }
  }

  const earningsKurus = nonNegKurus(report.earningsKurus)
  const vatKurus = nonNegKurus(report.totalVatKurus)
  const vatBaseKurus = nonNegKurus(earningsKurus - vatKurus)
  return {
    vatBaseKurus,
    vatKurus: Math.min(vatKurus, earningsKurus),
    incomeKurus: earningsKurus,
  }
}

export function reportIncomeKurus(report: ReporterDailyReport): number {
  return reportIncomeParts(report).incomeKurus
}

/**
 * Gider kırılımı (KDV hariç). Eski kayıtlarda yalnızca toplam
 * `operatingExpenseKurus` / `employeeExpenseKurus` varsa tek kaleme yığılır.
 */
export function reportExpenseParts(
  report: ReporterDailyReport,
): ReportCashExpenseParts {
  let hotelExpenseKurus = nonNegKurus(report.hotelExpenseKurus)
  let stationeryExpenseKurus = nonNegKurus(report.stationeryExpenseKurus)
  let fuelExpenseKurus = nonNegKurus(report.fuelExpenseKurus)
  let mealExpenseKurus = nonNegKurus(report.mealExpenseKurus)
  let extraExpenseKurus = nonNegKurus(report.extraExpenseKurus)
  const operatingParts =
    hotelExpenseKurus +
    stationeryExpenseKurus +
    fuelExpenseKurus +
    mealExpenseKurus +
    extraExpenseKurus
  const operatingStored = Number(report.operatingExpenseKurus ?? NaN)
  if (
    operatingParts === 0 &&
    Number.isFinite(operatingStored) &&
    operatingStored > 0
  ) {
    extraExpenseKurus = Math.trunc(operatingStored)
  }

  let reporterEarningsKurus = nonNegKurus(report.totalReporterEarningsKurus)
  let cameramanEarningsKurus = nonNegKurus(report.totalCameramanEarningsKurus)
  const employeeParts = reporterEarningsKurus + cameramanEarningsKurus
  const employeeStored = Number(report.employeeExpenseKurus ?? NaN)
  if (
    employeeParts === 0 &&
    Number.isFinite(employeeStored) &&
    employeeStored > 0
  ) {
    reporterEarningsKurus = Math.trunc(employeeStored)
  }

  return {
    hotelExpenseKurus,
    stationeryExpenseKurus,
    fuelExpenseKurus,
    mealExpenseKurus,
    extraExpenseKurus,
    reporterEarningsKurus,
    cameramanEarningsKurus,
  }
}

/**
 * Toplam gider = saha giderleri + ücretler (KDV hariç).
 */
export function reportExpenseKurus(report: ReporterDailyReport): number {
  return sumExpenseParts(reportExpenseParts(report))
}

export function resolveReportDate(report: ReporterDailyReport): string {
  if (typeof report.reportDate === 'string' && isValidDateOnly(report.reportDate)) {
    return report.reportDate
  }
  if (report.createdAt) {
    return dateToDateOnlyIstanbul(report.createdAt.toDate())
  }
  return todayDateOnlyIstanbul()
}

/** Build one cash group from a daily report (skips soft-deleted). */
export function buildReportCashGroup(
  reportId: string,
  report: ReporterDailyReport,
): ReportCashGroup | null {
  if (report.deletedAt != null) return null

  const reportDate = resolveReportDate(report)
  const parts = reportExpenseParts(report)
  const income = reportIncomeParts(report)
  return {
    reportId,
    reportDate,
    title: `${formatDateOnlyLongTr(reportDate)} tarihli rapor`,
    reporterName: String(report.createdByNameSnapshot ?? 'Muhabir'),
    createdByUid: String(report.createdByUid ?? ''),
    createdAt: report.createdAt ?? null,
    incomeKurus: income.incomeKurus,
    vatBaseKurus: income.vatBaseKurus,
    vatKurus: income.vatKurus,
    expenseKurus: sumExpenseParts(parts),
    fieldPaidKurus: nonNegKurus(report.fieldPaidKurus),
    ...parts,
  }
}

export function sortReportCashGroups(
  groups: ReportCashGroup[],
): ReportCashGroup[] {
  return [...groups].sort((a, b) => {
    const byDate = b.reportDate.localeCompare(a.reportDate)
    if (byDate !== 0) return byDate
    return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
  })
}

/**
 * Pure: reports → groups/totals for a calendar month (`statsMonthDateBounds`).
 * Used by fetch + unit tests.
 */
export function reportCashGroupsForOpsMonth(
  items: ReadonlyArray<{ id: string; report: ReporterDailyReport }>,
  yearMonth: string,
  createdByUid?: string | null,
): { groups: ReportCashGroup[]; totals: ReportCashTotals } {
  if (!isValidYearMonth(yearMonth)) {
    return { groups: [], totals: emptyReportCashTotals() }
  }
  const { startDate, endDate } = statsMonthDateBounds(yearMonth)
  const built: ReportCashGroup[] = []
  for (const item of items) {
    const group = buildReportCashGroup(item.id, item.report)
    if (group) built.push(group)
  }
  const inRange = filterReportCashGroupsByReportDateRange(
    built,
    startDate,
    endDate,
  )
  const { groups, totals } = filterReportCashGroups(inRange, createdByUid)
  return { groups: sortReportCashGroups(groups), totals }
}

export type SubscribeReportCashOptions = {
  /** When set, only that muhabir's reports. */
  createdByUid?: string | null
}

function reportCashGroupsQuery(createdByUid?: string | null) {
  const col = collection(getDb(), 'reporterDailyReports')
  const uid = createdByUid?.trim() || ''
  if (uid) {
    return query(
      col,
      where('createdByUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(2000),
    )
  }
  return query(col, orderBy('createdAt', 'desc'), limit(2000))
}

/**
 * Muhabir günlük raporlarından kasa grupları + toplamlar.
 * `createdByUid` verilince sorgu o uid ile sınırlanır — muhabir kuralları
 * yalnızca kendi belgelerini okuyabilir.
 */
export function subscribeReportCashGroups(
  onData: (groups: ReportCashGroup[], totals: ReportCashTotals) => void,
  onError?: (error: Error) => void,
  options?: SubscribeReportCashOptions,
): Unsubscribe {
  const filterUid = options?.createdByUid?.trim() || null

  return onSnapshot(
    reportCashGroupsQuery(filterUid),
    (snap) => {
      const groups: ReportCashGroup[] = []

      for (const reportDoc of snap.docs) {
        const report = reportDoc.data() as ReporterDailyReport
        const group = buildReportCashGroup(reportDoc.id, report)
        if (group) groups.push(group)
      }

      const sorted = sortReportCashGroups(groups)
      const { groups: nextGroups, totals } = filterReportCashGroups(
        sorted,
        filterUid,
      )
      onData(nextGroups, totals)
    },
    (error) => onError?.(error),
  )
}

/**
 * Ops-month cash groups (same window as Aylık Özet).
 * Prefer reportDate range; fall back to recent createdAt + client filter.
 */
export async function fetchReportCashGroupsForMonth(
  yearMonth: string,
  options?: SubscribeReportCashOptions,
): Promise<{ groups: ReportCashGroup[]; totals: ReportCashTotals }> {
  if (!isValidYearMonth(yearMonth)) {
    return { groups: [], totals: emptyReportCashTotals() }
  }

  const { startDate, endDate } = statsMonthDateBounds(yearMonth)
  const filterUid = options?.createdByUid?.trim() || null
  const col = collection(getDb(), 'reporterDailyReports')

  let items: Array<{ id: string; report: ReporterDailyReport }>

  try {
    const snap = await getDocs(
      query(
        col,
        where('reportDate', '>=', startDate),
        where('reportDate', '<=', endDate),
        orderBy('reportDate', 'desc'),
        limit(MONTHLY_CASH_FETCH_LIMIT),
      ),
    )
    items = snap.docs.map((d) => ({
      id: d.id,
      report: d.data() as ReporterDailyReport,
    }))
  } catch {
    const snap = await getDocs(
      query(col, orderBy('createdAt', 'desc'), limit(MONTHLY_CASH_FETCH_LIMIT)),
    )
    items = snap.docs.map((d) => ({
      id: d.id,
      report: d.data() as ReporterDailyReport,
    }))
  }

  return reportCashGroupsForOpsMonth(items, yearMonth, filterUid)
}

/** Re-export for callers that only need totals after a custom filter. */
export { sumReportCashGroups }
