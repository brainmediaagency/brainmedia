import { describe, expect, it } from 'vitest'
import { aggregateReporterSummary } from '@/features/reporter/services/reporterSummaryService'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'

function report(
  overrides: Partial<ReporterDailyReport> &
    Pick<ReporterDailyReport, 'id' | 'reportDate' | 'createdByUid'>,
): ReporterDailyReport {
  return {
    companyCount: 0,
    companies: [],
    note: '',
    hotelExpenseKurus: 0,
    stationeryExpenseKurus: 0,
    fuelExpenseKurus: 0,
    extraExpenseKurus: 0,
    operatingExpenseKurus: 0,
    employeeExpenseKurus: 0,
    totalExpenseKurus: 0,
    earningsKurus: 0,
    fieldPaidKurus: 0,
    totalReporterEarningsKurus: 0,
    totalCameramanEarningsKurus: 0,
    totalVatKurus: 0,
    createdByNameSnapshot: 'Test Muhabir',
    createdByEmailSnapshot: 'm@test.local',
    createdAt: null,
    updatedAt: null,
    editVersion: 0,
    updatedByUid: overrides.createdByUid,
    updatedByNameSnapshot: 'Test Muhabir',
    deletedAt: null,
    deletedByUid: null,
    deletedByNameSnapshot: null,
    ...overrides,
  }
}

describe('aggregateReporterSummary', () => {
  it('aggregates news, minutes, companies and earnings', () => {
    const result = aggregateReporterSummary([
      report({
        id: 'r1',
        reportDate: '2026-07-01',
        createdByUid: 'u1',
        createdByNameSnapshot: 'Ali',
        companyCount: 2,
        companies: [
          {
            jobId: 'j1',
            companyName: 'A',
            hasNews: true,
            newsTotalKurus: 100_00,
            newsReporterFeeKurus: 15_00,
            newsCameramanFeeKurus: 10_00,
            shootMinutes: 5,
            shootReporterFeeKurus: 40_00,
            shootCameramanFeeKurus: 10_00,
            vatRate: 20,
            vatBaseKurus: 200_00,
            vatKurus: 40_00,
            chargeMode: 'vat',
          },
          {
            jobId: 'j2',
            companyName: 'B',
            hasNews: false,
            newsTotalKurus: null,
            newsReporterFeeKurus: null,
            newsCameramanFeeKurus: null,
            shootMinutes: 3,
            shootReporterFeeKurus: 24_00,
            shootCameramanFeeKurus: 6_00,
            vatRate: 20,
            vatBaseKurus: 100_00,
            vatKurus: 0,
            chargeMode: 'cash',
          },
        ],
        totalReporterEarningsKurus: 79_00,
        totalCameramanEarningsKurus: 26_00,
        totalVatKurus: 40_00,
        fieldPaidKurus: 50_00,
        hotelExpenseKurus: 10_00,
        operatingExpenseKurus: 10_00,
        employeeExpenseKurus: 105_00,
        totalExpenseKurus: 155_00,
      }),
      report({
        id: 'r2',
        reportDate: '2026-07-02',
        createdByUid: 'u2',
        createdByNameSnapshot: 'Ayşe',
        companyCount: 1,
        companies: [
          {
            jobId: 'j3',
            companyName: 'C',
            hasNews: true,
            newsTotalKurus: 50_00,
            newsReporterFeeKurus: 7_50,
            newsCameramanFeeKurus: 5_00,
            shootMinutes: 2,
            shootReporterFeeKurus: 16_00,
            shootCameramanFeeKurus: 4_00,
            vatRate: 20,
            vatBaseKurus: 80_00,
            vatKurus: 16_00,
            chargeMode: 'vat',
          },
        ],
        totalReporterEarningsKurus: 23_50,
        totalCameramanEarningsKurus: 9_00,
        totalVatKurus: 16_00,
        earningsKurus: 96_00,
      }),
    ])

    expect(result.totals.reportCount).toBe(2)
    expect(result.totals.companyCount).toBe(3)
    expect(result.totals.newsCount).toBe(2)
    expect(result.totals.shootMinutes).toBe(10)
    expect(result.totals.incomeKurus).toBe(200_00 + 40_00 + 100_00 + 0 + 80_00 + 16_00)
    expect(result.totals.newsIncomeKurus).toBe(150_00)
    expect(result.totals.reporterEarningsKurus).toBe(79_00 + 23_50)
    expect(result.totals.cameramanEarningsKurus).toBe(26_00 + 9_00)
    expect(result.totals.vatChargeCount).toBe(2)
    expect(result.totals.cashChargeCount).toBe(1)
    expect(result.totals.uniqueReporterCount).toBe(2)
    expect(result.byDay).toHaveLength(2)
    expect(result.byReporter).toHaveLength(2)
  })
})
