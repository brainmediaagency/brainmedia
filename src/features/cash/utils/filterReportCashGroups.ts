import type {
  ReportCashExpenseParts,
  ReportCashGroup,
  ReportCashTotals,
} from '@/features/cash/types/cash'

export function emptyExpenseParts(): ReportCashExpenseParts {
  return {
    hotelExpenseKurus: 0,
    stationeryExpenseKurus: 0,
    fuelExpenseKurus: 0,
    mealExpenseKurus: 0,
    extraExpenseKurus: 0,
    reporterEarningsKurus: 0,
    cameramanEarningsKurus: 0,
  }
}

export function emptyReportCashTotals(): ReportCashTotals {
  return {
    totalIncomeKurus: 0,
    totalVatBaseKurus: 0,
    totalVatKurus: 0,
    totalExpenseKurus: 0,
    totalFieldPaidKurus: 0,
    reportCount: 0,
    ...emptyExpenseParts(),
  }
}

export function sumExpenseParts(
  parts: ReportCashExpenseParts,
): number {
  return (
    parts.hotelExpenseKurus +
    parts.stationeryExpenseKurus +
    parts.fuelExpenseKurus +
    parts.mealExpenseKurus +
    parts.extraExpenseKurus +
    parts.reporterEarningsKurus +
    parts.cameramanEarningsKurus
  )
}

export function sumReportCashGroups(
  groups: readonly ReportCashGroup[],
): ReportCashTotals {
  const totals = emptyReportCashTotals()
  for (const group of groups) {
    totals.reportCount += 1
    totals.totalIncomeKurus += group.incomeKurus
    totals.totalVatBaseKurus += group.vatBaseKurus
    totals.totalVatKurus += group.vatKurus
    totals.totalExpenseKurus += group.expenseKurus
    totals.totalFieldPaidKurus += group.fieldPaidKurus
    totals.hotelExpenseKurus += group.hotelExpenseKurus
    totals.stationeryExpenseKurus += group.stationeryExpenseKurus
    totals.fuelExpenseKurus += group.fuelExpenseKurus
    totals.mealExpenseKurus += group.mealExpenseKurus
    totals.extraExpenseKurus += group.extraExpenseKurus
    totals.reporterEarningsKurus += group.reporterEarningsKurus
    totals.cameramanEarningsKurus += group.cameramanEarningsKurus
  }
  return totals
}

/** Inclusive `reportDate` window (yyyy-MM-dd). */
export function filterReportCashGroupsByReportDateRange(
  groups: readonly ReportCashGroup[],
  startDate: string,
  endDate: string,
): ReportCashGroup[] {
  return groups.filter(
    (g) => g.reportDate >= startDate && g.reportDate <= endDate,
  )
}

/** Filter groups and rebuild totals for one reporter (or pass-through). */
export function filterReportCashGroups(
  groups: ReportCashGroup[],
  createdByUid: string | null | undefined,
): { groups: ReportCashGroup[]; totals: ReportCashTotals } {
  const uid = createdByUid?.trim() || ''
  const filtered = uid
    ? groups.filter((g) => g.createdByUid === uid)
    : groups

  return { groups: filtered, totals: sumReportCashGroups(filtered) }
}
