import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import type { ReportCashGroup, ReportCashTotals } from '@/features/cash/types/cash'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import {
  dateToDateOnlyIstanbul,
  formatDateOnlyLongTr,
  isValidDateOnly,
  todayDateOnlyIstanbul,
} from '@/lib/date'

export function reportIncomeKurus(report: ReporterDailyReport): number {
  if (Array.isArray(report.companies) && report.companies.length > 0) {
    return report.companies.reduce((sum, company) => {
      const base = Number(company.vatBaseKurus ?? 0)
      const vat = Number(company.vatKurus ?? 0)
      return sum + base + vat
    }, 0)
  }
  return Math.max(0, Number(report.earningsKurus ?? 0))
}

/**
 * Toplam gider = saha giderleri + ücretler.
 * KDV gelire dahildir, gidere eklenmez (eski kayıtlarda `totalExpenseKurus`
 * KDV içerebilir — her zaman işletme + çalışan üzerinden hesapla).
 */
export function reportExpenseKurus(report: ReporterDailyReport): number {
  const hotel = Math.max(0, Number(report.hotelExpenseKurus ?? 0))
  const stationery = Math.max(0, Number(report.stationeryExpenseKurus ?? 0))
  const fuel = Math.max(0, Number(report.fuelExpenseKurus ?? 0))
  const extra = Math.max(0, Number(report.extraExpenseKurus ?? 0))
  const operatingStored = Number(report.operatingExpenseKurus ?? NaN)
  const operating = Number.isFinite(operatingStored) && operatingStored >= 0
    ? operatingStored
    : hotel + stationery + fuel + extra
  const reporter = Math.max(0, Number(report.totalReporterEarningsKurus ?? 0))
  const cameraman = Math.max(0, Number(report.totalCameramanEarningsKurus ?? 0))
  const employeeStored = Number(report.employeeExpenseKurus ?? NaN)
  const employee = Number.isFinite(employeeStored) && employeeStored >= 0
    ? employeeStored
    : reporter + cameraman
  return Math.max(0, Math.trunc(operating + employee))
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

export function emptyReportCashTotals(): ReportCashTotals {
  return {
    totalIncomeKurus: 0,
    totalExpenseKurus: 0,
    totalFieldPaidKurus: 0,
    reportCount: 0,
  }
}

/**
 * Muhabir günlük raporlarından kasa grupları + toplamlar.
 */
export function subscribeReportCashGroups(
  onData: (groups: ReportCashGroup[], totals: ReportCashTotals) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(getDb(), 'reporterDailyReports'),
      orderBy('createdAt', 'desc'),
      limit(2000),
    ),
    (snap) => {
      const groups: ReportCashGroup[] = []
      const totals = emptyReportCashTotals()

      for (const reportDoc of snap.docs) {
        const report = reportDoc.data() as ReporterDailyReport
        if (report.deletedAt != null) continue

        const reportDate = resolveReportDate(report)
        const income = reportIncomeKurus(report)
        const expense = reportExpenseKurus(report)
        const fieldPaid = Math.max(0, Number(report.fieldPaidKurus ?? 0))
        const reporterName = String(report.createdByNameSnapshot ?? 'Muhabir')

        totals.reportCount += 1
        totals.totalIncomeKurus += income
        totals.totalExpenseKurus += expense
        totals.totalFieldPaidKurus += fieldPaid

        groups.push({
          reportId: reportDoc.id,
          reportDate,
          title: `${formatDateOnlyLongTr(reportDate)} tarihli rapor`,
          reporterName,
          createdByUid: String(report.createdByUid ?? ''),
          createdAt: report.createdAt ?? null,
          incomeKurus: income,
          expenseKurus: expense,
          fieldPaidKurus: fieldPaid,
        })
      }

      groups.sort((a, b) => {
        const byDate = b.reportDate.localeCompare(a.reportDate)
        if (byDate !== 0) return byDate
        return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
      })

      onData(groups, totals)
    },
    (error) => onError?.(error),
  )
}
