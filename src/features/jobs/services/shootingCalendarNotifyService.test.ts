import { describe, expect, it } from 'vitest'
import {
  isAtOrAfterIstanbulHour,
  msUntilNextIstanbulHour,
} from '@/features/jobs/services/shootingCalendarNotifyService'
import { fromZonedTime } from 'date-fns-tz'

describe('shootingCalendarNotifyService time helpers', () => {
  it('treats 21:00 Istanbul as at-or-after notify hour', () => {
    const atNine = fromZonedTime('2026-08-03T21:00:00', 'Europe/Istanbul')
    const before = fromZonedTime('2026-08-03T20:59:00', 'Europe/Istanbul')
    expect(isAtOrAfterIstanbulHour(21, atNine)).toBe(true)
    expect(isAtOrAfterIstanbulHour(21, before)).toBe(false)
  })

  it('schedules the next 21:00 window', () => {
    const morning = fromZonedTime('2026-08-03T10:00:00', 'Europe/Istanbul')
    const ms = msUntilNextIstanbulHour(21, morning)
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(11 * 60 * 60 * 1000)
  })
})
