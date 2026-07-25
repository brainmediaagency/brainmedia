import { describe, expect, it } from 'vitest'
import { dailyReportSchema } from '@/features/reporter/schemas/dailyReportSchema'

function validCompany(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job-1',
    companyName: 'Acme Medya',
    hasNews: false,
    newsTotalTry: '',
    chargeMode: 'cash' as const,
    shootMinutes: '45',
    vatRate: 20 as const,
    ...overrides,
  }
}

function validReport(overrides: Record<string, unknown> = {}) {
  return {
    reportDate: '2026-07-24',
    companies: [validCompany()],
    note: '',
    hotelExpenseTry: '',
    stationeryExpenseTry: '',
    fuelExpenseTry: '',
    extraExpenseTry: '',
    fieldPaidTry: '',
    ...overrides,
  }
}

describe('dailyReportSchema', () => {
  it('accepts a minimal valid report', () => {
    expect(dailyReportSchema.safeParse(validReport()).success).toBe(true)
  })

  it('requires report date yyyy-MM-dd', () => {
    expect(
      dailyReportSchema.safeParse(validReport({ reportDate: '24.07.2026' }))
        .success,
    ).toBe(false)
  })

  it('requires at least one company', () => {
    expect(
      dailyReportSchema.safeParse(validReport({ companies: [] })).success,
    ).toBe(false)
  })

  it('rejects duplicate jobId in the same report', () => {
    const result = dailyReportSchema.safeParse(
      validReport({
        companies: [
          validCompany({ jobId: 'job-1' }),
          validCompany({ jobId: 'job-1', companyName: 'Acme 2' }),
        ],
      }),
    )
    expect(result.success).toBe(false)
  })

  it('allows two different firms', () => {
    expect(
      dailyReportSchema.safeParse(
        validReport({
          companies: [
            validCompany({ jobId: 'job-1' }),
            validCompany({ jobId: 'job-2', companyName: 'Beta' }),
          ],
        }),
      ).success,
    ).toBe(true)
  })

  it('requires news total when hasNews is true', () => {
    const result = dailyReportSchema.safeParse(
      validReport({
        companies: [validCompany({ hasNews: true, newsTotalTry: '' })],
      }),
    )
    expect(result.success).toBe(false)
  })

  it('accepts zero news total when hasNews is true', () => {
    expect(
      dailyReportSchema.safeParse(
        validReport({
          companies: [validCompany({ hasNews: true, newsTotalTry: '0' })],
        }),
      ).success,
    ).toBe(true)
  })

  it('rejects non-integer shoot minutes', () => {
    expect(
      dailyReportSchema.safeParse(
        validReport({
          companies: [validCompany({ shootMinutes: '12.5' })],
        }),
      ).success,
    ).toBe(false)
  })

  it('rejects shoot minutes over 1440', () => {
    expect(
      dailyReportSchema.safeParse(
        validReport({
          companies: [validCompany({ shootMinutes: '1441' })],
        }),
      ).success,
    ).toBe(false)
  })

  it('parses Turkish expense amounts and rejects invalid ones', () => {
    expect(
      dailyReportSchema.safeParse(
        validReport({ hotelExpenseTry: '1.250,50', fuelExpenseTry: '0' }),
      ).success,
    ).toBe(true)
    expect(
      dailyReportSchema.safeParse(validReport({ hotelExpenseTry: 'abc' }))
        .success,
    ).toBe(false)
  })

  it('requires jobId and companyName', () => {
    expect(
      dailyReportSchema.safeParse(
        validReport({
          companies: [validCompany({ jobId: '', companyName: '' })],
        }),
      ).success,
    ).toBe(false)
  })
})
