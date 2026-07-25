import { describe, expect, it } from 'vitest'
import { buildDailyReportFees } from '@/features/reporter/utils/feeCalc'

/**
 * Mirrors firestore.rules reporterCompaniesIncomeKurus /
 * dailyReportService reportContent earnings formula.
 */
function expectedEarnings(companies: ReturnType<typeof buildDailyReportFees>['companies']) {
  return companies.reduce((sum, c) => sum + c.vatBaseKurus + c.vatKurus, 0)
}

describe('reporter daily report rules alignment', () => {
  it('earnings equals matrah + KDV for shoot-only company', () => {
    const summary = buildDailyReportFees([
      {
        companyName: 'Firma A',
        hasNews: false,
        newsTotalKurus: null,
        shootMinutes: 3,
        vatRate: 20,
      },
    ])
    expect(summary.totalVatBaseKurus).toBe(1_500_000)
    expect(summary.totalVatKurus).toBe(300_000)
    expect(summary.totalIncomeKurus).toBe(1_800_000)
    expect(expectedEarnings(summary.companies)).toBe(summary.totalIncomeKurus)
    expect(summary.totalVatKurus).toBe(
      summary.companies.reduce((sum, c) => sum + c.vatKurus, 0),
    )
  })

  it('earnings equals matrah + KDV for news + shoot', () => {
    const summary = buildDailyReportFees([
      {
        companyName: 'Firma B',
        hasNews: true,
        newsTotalKurus: 1_000_000,
        shootMinutes: 3,
        vatRate: 20,
      },
    ])
    expect(summary.totalIncomeKurus).toBe(expectedEarnings(summary.companies))
    const employee =
      summary.totalReporterEarningsKurus + summary.totalCameramanEarningsKurus
    expect(employee).toBe(150_000 + 100_000 + 80_000 + 20_000)
    expect(summary.totalIncomeKurus).not.toBe(employee)
  })
})
