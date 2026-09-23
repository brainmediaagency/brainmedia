import { describe, expect, it } from 'vitest'
import { isJobOnReporterShootingCalendar } from '@/features/jobs/utils/shootingCalendarVisibility'

describe('shootingCalendarVisibility', () => {
  it('shows approved and shot jobs immediately', () => {
    expect(isJobOnReporterShootingCalendar({ status: 'approved' })).toBe(true)
    expect(isJobOnReporterShootingCalendar({ status: 'shot' })).toBe(true)
  })

  it('hides pending, rejected and cancelled jobs', () => {
    expect(isJobOnReporterShootingCalendar({ status: 'pending' })).toBe(false)
    expect(isJobOnReporterShootingCalendar({ status: 'rejected' })).toBe(false)
    expect(isJobOnReporterShootingCalendar({ status: 'cancelled' })).toBe(false)
  })
})
