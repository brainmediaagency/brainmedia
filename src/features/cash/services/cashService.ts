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

export function reportExpenseKurus(report: ReporterDailyReport): number {
  const stored = Number(report.totalExpenseKurus ?? NaN)
  if (Number.isFinite(stored) && stored >= 0) return stored
  const operating = Number(report.operatingExpenseKurus ?? 0)
  const employee = Number(report.employeeExpenseKurus ?? 0)
  const vat = Number(report.totalVatKurus ?? 0)
  return Math.max(0, operating + employee + vat)
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
