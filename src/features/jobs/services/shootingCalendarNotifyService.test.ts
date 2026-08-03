import { describe, expect, it } from 'vitest'
import {
  isAtOrAfterIstanbulHour,
  msUntilNextIstanbulHour,
} from '@/features/jobs/services/shootingCalendarNotifyService'
import { fromZonedTime } from 'date-fns-tz'

describe('shootingCalendarNotifyService time helpers', () => {
  it('treats midnight hour as always in-window (catch-up)', () => {
    const morning = fromZonedTime('2026-08-03T10:00:00', 'Europe/Istanbul')
    expect(isAtOrAfterIstanbulHour(0, morning)).toBe(true)
  })

  it('schedules the next midnight window', () => {
    const morning = fromZonedTime('2026-08-03T10:00:00', 'Europe/Istanbul')
    const ms = msUntilNextIstanbulHour(0, morning)
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })
})
