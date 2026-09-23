import { describe, expect, it } from 'vitest'
import {
  reportCashGroupsForOpsMonth,
  reportExpenseKurus,
  reportExpenseParts,
  reportIncomeParts,
} from '@/features/cash/services/cashService'
import {
  filterReportCashGroups,
  filterReportCashGroupsByReportDateRange,
} from '@/features/cash/utils/filterReportCashGroups'
import type { ReportCashGroup } from '@/features/cash/types/cash'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import { statsMonthDateBounds } from '@/lib/date'

function base(
  overrides: Partial<ReporterDailyReport> = {},
): ReporterDailyReport {
  return {
    id: 'r1',
    reportDate: '2026-08-05',
    companyCount: 0,
    companies: [],
    leaveDayCash: false,
    note: '',
    hotelExpenseKurus: 0,
    stationeryExpenseKurus: 0,
    fuelExpenseKurus: 0,
    mealExpenseKurus: 0,
    extraExpenseKurus: 0,
    operatingExpenseKurus: 100_00,
    employeeExpenseKurus: 200_00,
    totalExpenseKurus: 380_00,
    earningsKurus: 0,
    fieldPaidKurus: 0,
    totalReporterEarningsKurus: 150_00,
    totalCameramanEarningsKurus: 50_00,
    totalVatKurus: 80_00,
    createdByUid: 'u1',
    createdByNameSnapshot: 'Test',
    createdByEmailSnapshot: 't@test.local',
    createdAt: null,
    updatedAt: null,
    editVersion: 1,
    updatedByUid: 'u1',
    updatedByNameSnapshot: 'Test',
    deletedAt: null,
    deletedByUid: null,
    deletedByNameSnapshot: null,
    ...overrides,
  }
}

function group(
  partial: Pick<
    ReportCashGroup,
    'createdByUid' | 'incomeKurus' | 'expenseKurus' | 'fieldPaidKurus'
  > &
    Partial<ReportCashGroup>,
): ReportCashGroup {
  const incomeKurus = partial.incomeKurus
  const vatBaseKurus = partial.vatBaseKurus ?? incomeKurus
  const vatKurus = partial.vatKurus ?? 0
  return {
    reportId: partial.reportId ?? 'r',
    reportDate: partial.reportDate ?? '2026-09-05',
    title: partial.title ?? 'rapor',
    reporterName: partial.reporterName ?? 'X',
    createdByUid: partial.createdByUid,
    createdAt: null,
    incomeKurus,
    vatBaseKurus,
    vatKurus,
    expenseKurus: partial.expenseKurus,
    fieldPaidKurus: partial.fieldPaidKurus,
    hotelExpenseKurus: partial.hotelExpenseKurus ?? 0,
    stationeryExpenseKurus: partial.stationeryExpenseKurus ?? 0,
    fuelExpenseKurus: partial.fuelExpenseKurus ?? 0,
    mealExpenseKurus: partial.mealExpenseKurus ?? 0,
    extraExpenseKurus: partial.extraExpenseKurus ?? 0,
    reporterEarningsKurus: partial.reporterEarningsKurus ?? 0,
    cameramanEarningsKurus: partial.cameramanEarningsKurus ?? 0,
  }
}

describe('reportIncomeParts', () => {
  it('splits company vatBase + vat', () => {
    expect(
      reportIncomeParts(
        base({
          companies: [
            {
              companyName: 'A',
              newsTotalKurus: 0,
              shootMinutes: 1,
              hasNews: false,
              reporterEarningsKurus: 0,
              cameramanEarningsKurus: 0,
              vatRate: 20,
              vatBaseKurus: 1_000_00,
              vatKurus: 200_00,
              chargeMode: 'vat',
            },
            {
              companyName: 'B',
              newsTotalKurus: 0,
              shootMinutes: 1,
              hasNews: false,
              reporterEarningsKurus: 0,
              cameramanEarningsKurus: 0,
              vatRate: 20,
              vatBaseKurus: 500_00,
              vatKurus: 0,
              chargeMode: 'cash',
            },
          ],
          earningsKurus: 9_999_00,
          totalVatKurus: 9_999_00,
        }),
      ),
    ).toEqual({
      vatBaseKurus: 1_500_00,
      vatKurus: 200_00,
      incomeKurus: 1_700_00,
    })
  })

  it('falls back to earnings − totalVat when companies empty', () => {
    expect(
      reportIncomeParts(
        base({
          companies: [],
          earningsKurus: 1_200_00,
          totalVatKurus: 200_00,
        }),
      ),
    ).toEqual({
      vatBaseKurus: 1_000_00,
      vatKurus: 200_00,
      incomeKurus: 1_200_00,
    })
  })
})

describe('reportExpenseKurus', () => {
  it('excludes VAT even when stored totalExpense includes it', () => {
    expect(reportExpenseKurus(base())).toBe(300_00)
  })

  it('sums operating + employee only', () => {
    expect(
      reportExpenseKurus(
        base({
          hotelExpenseKurus: 0,
          stationeryExpenseKurus: 0,
          fuelExpenseKurus: 0,
          mealExpenseKurus: 0,
          extraExpenseKurus: 0,
          totalReporterEarningsKurus: 0,
          totalCameramanEarningsKurus: 0,
          operatingExpenseKurus: 10_00,
          employeeExpenseKurus: 25_00,
          totalVatKurus: 99_00,
          totalExpenseKurus: 134_00,
        }),
      ),
    ).toBe(35_00)
  })

  it('exposes line items for kasa breakdown cards', () => {
    expect(
      reportExpenseParts(
        base({
          hotelExpenseKurus: 40_00,
          stationeryExpenseKurus: 5_00,
          fuelExpenseKurus: 20_00,
          mealExpenseKurus: 10_00,
          extraExpenseKurus: 3_00,
          operatingExpenseKurus: 78_00,
          totalReporterEarningsKurus: 60_00,
          totalCameramanEarningsKurus: 15_00,
          employeeExpenseKurus: 75_00,
        }),
      ),
    ).toEqual({
      hotelExpenseKurus: 40_00,
      stationeryExpenseKurus: 5_00,
      fuelExpenseKurus: 20_00,
      mealExpenseKurus: 10_00,
      extraExpenseKurus: 3_00,
      reporterEarningsKurus: 60_00,
      cameramanEarningsKurus: 15_00,
    })
  })
})

describe('filterReportCashGroups', () => {
  const all = [
    group({
      reportId: 'm1',
      createdByUid: 'merve-uid',
      incomeKurus: 100,
      expenseKurus: 40,
      fieldPaidKurus: 50,
    }),
    group({
      reportId: 'b1',
      createdByUid: 'beste-uid',
      incomeKurus: 200,
      expenseKurus: 60,
      fieldPaidKurus: 70,
    }),
  ]

  it('returns all when uid omitted', () => {
    const { groups, totals } = filterReportCashGroups(all, null)
    expect(groups).toHaveLength(2)
    expect(totals.reportCount).toBe(2)
    expect(totals.totalIncomeKurus).toBe(300)
    expect(totals.totalVatBaseKurus).toBe(300)
    expect(totals.totalVatKurus).toBe(0)
    expect(totals.totalExpenseKurus).toBe(100)
    expect(totals.totalFieldPaidKurus).toBe(120)
  })

  it('filters Merve-only', () => {
    const { groups, totals } = filterReportCashGroups(all, 'merve-uid')
    expect(groups.map((g) => g.reportId)).toEqual(['m1'])
    expect(totals.totalIncomeKurus).toBe(100)
    expect(totals.totalExpenseKurus).toBe(40)
    expect(totals.totalFieldPaidKurus).toBe(50)
  })

  it('filters Beste-only', () => {
    const { groups, totals } = filterReportCashGroups(all, 'beste-uid')
    expect(groups).toHaveLength(1)
    expect(totals.totalIncomeKurus).toBe(200)
  })
})

describe('filterReportCashGroupsByReportDateRange', () => {
  it('keeps inclusive reportDate window', () => {
    const groups = [
      group({
        reportId: 'a',
        reportDate: '2026-07-30',
        createdByUid: 'u',
        incomeKurus: 1,
        expenseKurus: 0,
        fieldPaidKurus: 0,
      }),
      group({
        reportId: 'b',
        reportDate: '2026-07-31',
        createdByUid: 'u',
        incomeKurus: 2,
        expenseKurus: 0,
        fieldPaidKurus: 0,
      }),
      group({
        reportId: 'c',
        reportDate: '2026-08-30',
        createdByUid: 'u',
        incomeKurus: 3,
        expenseKurus: 0,
        fieldPaidKurus: 0,
      }),
      group({
        reportId: 'd',
        reportDate: '2026-08-31',
        createdByUid: 'u',
        incomeKurus: 4,
        expenseKurus: 0,
        fieldPaidKurus: 0,
      }),
    ]
    const { startDate, endDate } = statsMonthDateBounds('2026-08')
    expect(
      filterReportCashGroupsByReportDateRange(groups, startDate, endDate).map(
        (g) => g.reportId,
      ),
    ).toEqual(['c', 'd'])
  })
})

describe('reportCashGroupsForOpsMonth', () => {
  /** Prefer stored operating/employee totals (zero line items). */
  const storedExpense = (operating: number, employee: number) => ({
    hotelExpenseKurus: 0,
    stationeryExpenseKurus: 0,
    fuelExpenseKurus: 0,
    mealExpenseKurus: 0,
    extraExpenseKurus: 0,
    totalReporterEarningsKurus: 0,
    totalCameramanEarningsKurus: 0,
    operatingExpenseKurus: operating,
    employeeExpenseKurus: employee,
  })

  const items = [
    {
      id: 'before',
      report: base({
        reportDate: '2026-07-30',
        createdByUid: 'merve-uid',
        earningsKurus: 100_00,
        fieldPaidKurus: 50_00,
        ...storedExpense(10_00, 5_00),
      }),
    },
    {
      id: 'prevMonthEnd',
      report: base({
        reportDate: '2026-07-31',
        createdByUid: 'merve-uid',
        earningsKurus: 200_00,
        fieldPaidKurus: 80_00,
        ...storedExpense(20_00, 10_00),
      }),
    },
    {
      id: 'mid',
      report: base({
        reportDate: '2026-08-15',
        createdByUid: 'beste-uid',
        earningsKurus: 300_00,
        fieldPaidKurus: 100_00,
        ...storedExpense(30_00, 15_00),
      }),
    },
    {
      id: 'end',
      report: base({
        reportDate: '2026-08-30',
        createdByUid: 'merve-uid',
        earningsKurus: 50_00,
        fieldPaidKurus: 40_00,
        ...storedExpense(5_00, 5_00),
      }),
    },
    {
      id: 'monthLastDay',
      report: base({
        reportDate: '2026-08-31',
        createdByUid: 'merve-uid',
        earningsKurus: 999_00,
        fieldPaidKurus: 999_00,
        ...storedExpense(1_00, 1_00),
      }),
    },
    {
      id: 'deleted',
      report: base({
        reportDate: '2026-08-10',
        createdByUid: 'merve-uid',
        deletedAt: { toMillis: () => 1 } as ReporterDailyReport['deletedAt'],
        earningsKurus: 500_00,
        ...storedExpense(0, 0),
      }),
    },
  ]

  it('uses August calendar window (1–31 Ağu) including month-end, skips deleted', () => {
    const { groups, totals } = reportCashGroupsForOpsMonth(items, '2026-08')
    expect(groups.map((g) => g.reportId)).toEqual([
      'monthLastDay',
      'end',
      'mid',
    ])
    expect(totals.reportCount).toBe(3)
    expect(totals.totalIncomeKurus).toBe(1_349_00)
    expect(totals.totalVatBaseKurus).toBe(1_139_00)
    expect(totals.totalVatKurus).toBe(210_00)
    expect(totals.totalExpenseKurus).toBe(57_00)
    expect(totals.totalFieldPaidKurus).toBe(1_139_00)
  })

  it('filters by reporter uid within the calendar month', () => {
    const { groups, totals } = reportCashGroupsForOpsMonth(
      items,
      '2026-08',
      'merve-uid',
    )
    expect(groups.map((g) => g.reportId)).toEqual(['monthLastDay', 'end'])
    expect(totals.totalIncomeKurus).toBe(1_049_00)
    expect(totals.totalFieldPaidKurus).toBe(1_039_00)
  })
})
