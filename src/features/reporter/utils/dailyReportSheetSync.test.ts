import { describe, expect, it } from 'vitest'
import { buildDailyReportCompanySheetFields } from '@/features/reporter/utils/dailyReportSheetSync'

describe('buildDailyReportCompanySheetFields', () => {
  it('writes DK and KAZANÇ from matrah + KDV', () => {
    const fields = buildDailyReportCompanySheetFields({
      hasNews: false,
      shootMinutes: 40,
      newsTotalKurus: null,
      vatBaseKurus: 100_000,
      vatKurus: 20_000,
    })
    expect(fields.dk).toBe('40')
    expect(fields.haber).toBe('')
    expect(fields.kazanc).toContain('1.200')
    expect(fields.kazanc).toContain('TL')
  })

  it('writes HABER only when news fee is positive', () => {
    const withNews = buildDailyReportCompanySheetFields({
      hasNews: true,
      shootMinutes: 10,
      newsTotalKurus: 50_000,
      vatBaseKurus: 0,
      vatKurus: 0,
    })
    expect(withNews.haber).toContain('500')
    expect(withNews.kazanc).toBe('')

    const zeroNews = buildDailyReportCompanySheetFields({
      hasNews: true,
      shootMinutes: 10,
      newsTotalKurus: 0,
      vatBaseKurus: 10_000,
      vatKurus: 0,
    })
    expect(zeroNews.haber).toBe('')
    expect(zeroNews.kazanc).toContain('100')
  })

  it('ignores news when hasNews is false', () => {
    const fields = buildDailyReportCompanySheetFields({
      hasNews: false,
      shootMinutes: 5,
      newsTotalKurus: 99_000,
      vatBaseKurus: 0,
      vatKurus: 0,
    })
    expect(fields.haber).toBe('')
  })

  it('coerces invalid minutes to 0', () => {
    expect(
      buildDailyReportCompanySheetFields({
        hasNews: false,
        shootMinutes: Number.NaN,
        newsTotalKurus: null,
        vatBaseKurus: 0,
        vatKurus: 0,
      }).dk,
    ).toBe('0')
  })
})
