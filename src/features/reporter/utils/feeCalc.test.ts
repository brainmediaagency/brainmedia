import { describe, expect, it } from 'vitest'
import {
  calcNewsFeesFromTry,
  calcShootFeesFromMinutes,
  calcVatKurus,
  calcCompanyVatBaseKurus,
  buildReporterCompany,
  buildDailyReportFees,
  formatShootReporterRatePercent,
  inferShootReporterRateFromFee,
  resolveFieldPaidKurusForWrite,
} from '@/features/reporter/utils/feeCalc'

describe('feeCalc', () => {
  it('news: 15% reporter and 10% cameraman', () => {
    const fees = calcNewsFeesFromTry(10_000)
    expect(fees.totalKurus).toBe(1_000_000)
    expect(fees.reporterFeeKurus).toBe(150_000)
    expect(fees.cameramanFeeKurus).toBe(100_000)
  })

  it('shoot: 1 minute all to kasa, zero fees', () => {
    const fees = calcShootFeesFromMinutes(1)
    expect(fees.billableMinutes).toBe(0)
    expect(fees.firstMinuteKasaKurus).toBe(500_000)
    expect(fees.reporterFeeKurus).toBe(0)
    expect(fees.cameramanFeeKurus).toBe(0)
  })

  it('shoot: 3 minutes bills 2 minutes', () => {
    const fees = calcShootFeesFromMinutes(3)
    expect(fees.billableMinutes).toBe(2)
    expect(fees.feeBaseKurus).toBe(1_000_000)
    expect(fees.grossTotalKurus).toBe(1_500_000)
    expect(fees.reporterFeeKurus).toBe(80_000)
    expect(fees.cameramanFeeKurus).toBe(20_000)
  })

  it('shoot: per-reporter override uses 10% without changing default', () => {
    const overridden = calcShootFeesFromMinutes(3, 0.1)
    expect(overridden.reporterFeeKurus).toBe(100_000)
    expect(calcShootFeesFromMinutes(3).reporterFeeKurus).toBe(80_000)

    const company = buildReporterCompany({
      companyName: 'Beste',
      hasNews: false,
      newsTotalKurus: null,
      shootMinutes: 3,
      vatRate: 20,
      shootReporterRate: 0.1,
    })
    expect(company.shootReporterFeeKurus).toBe(100_000)
  })

  it('infers stored shoot muhabir % from fee (8 vs 10)', () => {
    expect(inferShootReporterRateFromFee(3, 80_000)).toBeCloseTo(0.08)
    expect(inferShootReporterRateFromFee(3, 100_000)).toBeCloseTo(0.1)
    expect(inferShootReporterRateFromFee(1, 0)).toBeNull()
    expect(formatShootReporterRatePercent(inferShootReporterRateFromFee(3, 100_000))).toBe(
      '10',
    )
  })

  it('vat base: shoot only vs shoot + news', () => {
    expect(calcVatKurus(1_000_000, 20)).toBe(200_000)
    expect(
      calcCompanyVatBaseKurus({ hasNews: false, newsTotalKurus: 100_000, shootMinutes: 3 }),
    ).toBe(1_500_000)
    expect(
      calcCompanyVatBaseKurus({ hasNews: true, newsTotalKurus: 100_000, shootMinutes: 2 }),
    ).toBe(100_000 + 1_000_000)
  })

  it('builds company and report totals', () => {
    const company = buildReporterCompany({
      companyName: 'Firma A',
      hasNews: true,
      newsTotalKurus: 1_000_000,
      shootMinutes: 3,
      vatRate: 20,
    })
    expect(company.newsReporterFeeKurus).toBe(150_000)
    expect(company.shootReporterFeeKurus).toBe(80_000)
    expect(company.vatBaseKurus).toBe(1_000_000 + 1_500_000)

    const summary = buildDailyReportFees([
      {
        companyName: 'Firma A',
        hasNews: false,
        newsTotalKurus: null,
        shootMinutes: 3,
        vatRate: 20,
      },
    ])
    expect(summary.totalReporterEarningsKurus).toBe(80_000)
    expect(summary.totalCameramanEarningsKurus).toBe(20_000)
    expect(summary.totalVatBaseKurus).toBe(1_500_000)
    expect(summary.totalVatKurus).toBe(300_000)
    expect(summary.totalIncomeKurus).toBe(1_800_000)
  })

  it('10.000 TL haber: matrah 10.000, muhabir 1.500, kameraman 1.000, KDV 2.000', () => {
    const company = buildReporterCompany({
      companyName: 'Firma A',
      hasNews: true,
      newsTotalKurus: 1_000_000,
      shootMinutes: 0,
      vatRate: 20,
    })
    expect(company.newsTotalKurus).toBe(1_000_000)
    expect(company.newsReporterFeeKurus).toBe(150_000)
    expect(company.newsCameramanFeeKurus).toBe(100_000)
    expect(company.vatBaseKurus).toBe(1_000_000)
    expect(company.vatKurus).toBe(200_000)
  })

  it('cash chargeMode: vatKurus is 0 and income excludes VAT', () => {
    const company = buildReporterCompany({
      companyName: 'Firma Nakit',
      hasNews: true,
      newsTotalKurus: 1_000_000,
      shootMinutes: 3,
      vatRate: 20,
      chargeMode: 'cash',
    })
    expect(company.chargeMode).toBe('cash')
    expect(company.vatBaseKurus).toBe(1_000_000 + 1_500_000)
    expect(company.vatKurus).toBe(0)

    const summary = buildDailyReportFees([
      {
        companyName: 'Firma Nakit',
        hasNews: true,
        newsTotalKurus: 1_000_000,
        shootMinutes: 3,
        vatRate: 20,
        chargeMode: 'cash',
      },
    ])
    expect(summary.totalVatKurus).toBe(0)
    expect(summary.totalVatBaseKurus).toBe(2_500_000)
    expect(summary.totalIncomeKurus).toBe(2_500_000)
  })

  it('cancelled company contributes zero fees and income', () => {
    const company = buildReporterCompany({
      companyName: 'İptal Firma',
      cancelled: true,
      hasNews: true,
      newsTotalKurus: 1_000_000,
      shootMinutes: 10,
      vatRate: 20,
    })
    expect(company.cancelled).toBe(true)
    expect(company.vatBaseKurus).toBe(0)
    expect(company.vatKurus).toBe(0)
    expect(company.shootMinutes).toBe(0)

    const summary = buildDailyReportFees([
      {
        companyName: 'İptal Firma',
        cancelled: true,
        hasNews: false,
        newsTotalKurus: null,
        shootMinutes: 0,
        vatRate: 20,
      },
      {
        companyName: 'Aktif Firma',
        hasNews: false,
        newsTotalKurus: null,
        shootMinutes: 3,
        vatRate: 20,
        chargeMode: 'cash',
      },
    ])
    expect(summary.totalIncomeKurus).toBe(1_500_000)
    expect(summary.totalReporterEarningsKurus).toBe(80_000)
  })

  it('resolveFieldPaidKurusForWrite: empty create → 0, empty edit keeps previous, explicit 0 clears', () => {
    expect(resolveFieldPaidKurusForWrite('', null)).toBe(0)
    expect(resolveFieldPaidKurusForWrite('', undefined)).toBe(0)
    expect(resolveFieldPaidKurusForWrite('', 5_900_000)).toBe(5_900_000)
    expect(resolveFieldPaidKurusForWrite('0', 5_900_000)).toBe(0)
    expect(resolveFieldPaidKurusForWrite('59.000', 0)).toBe(5_900_000)
  })
})
