import { describe, expect, it } from 'vitest'
import { reporterAllowsPartialDayCompanies } from '@/features/reporter/config/reporterDailyReportRules'

describe('reporterDailyReportRules', () => {
  it('allows partial day companies for test.muhabir only', () => {
    expect(
      reporterAllowsPartialDayCompanies('test.muhabir@brain.com'),
    ).toBe(true)
    expect(
      reporterAllowsPartialDayCompanies({
        email: 'Test.Muhabir@brain.com',
      }),
    ).toBe(true)
    expect(reporterAllowsPartialDayCompanies('muhabir@brain.com')).toBe(false)
    expect(reporterAllowsPartialDayCompanies('muhabir2@brain.com')).toBe(false)
    expect(reporterAllowsPartialDayCompanies(null)).toBe(false)
  })
})
