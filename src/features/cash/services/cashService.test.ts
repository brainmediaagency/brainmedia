import { describe, expect, it } from 'vitest'
import { reportExpenseKurus } from '@/features/cash/services/cashService'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'

function base(
  overrides: Partial<ReporterDailyReport> = {},
): ReporterDailyReport {
  return {
    id: 'r1',
    reportDate: '2026-08-05',
    companyCount: 0,
    companies: [],
    note: '',
    hotelExpenseKurus: 0,
    stationeryExpenseKurus: 0,
    fuelExpenseKurus: 0,
    extraExpenseKurus: 0,
    operatingExpenseKurus: 100_00,
    employeeExpenseKurus: 200_00,
    totalExpenseKurus: 380_00, // wrongly includes 80 VAT historically
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

describe('reportExpenseKurus', () => {
  it('excludes VAT even when stored totalExpense includes it', () => {
    expect(reportExpenseKurus(base())).toBe(300_00)
  })

  it('sums operating + employee only', () => {
    expect(
      reportExpenseKurus(
        base({
          operatingExpenseKurus: 10_00,
          employeeExpenseKurus: 25_00,
          totalVatKurus: 99_00,
          totalExpenseKurus: 134_00,
        }),
      ),
    ).toBe(35_00)
  })
})
