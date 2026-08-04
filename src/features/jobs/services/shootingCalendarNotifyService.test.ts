import { describe, expect, it } from 'vitest'
import {
  isAtOrAfterIstanbulHour,
  msUntilNextIstanbulHour,
  SHOOTING_CALENDAR_NOTIFY_HOUR,
} from '@/features/jobs/services/shootingCalendarNotifyService'
import { fromZonedTime } from 'date-fns-tz'

describe('shootingCalendarNotifyService time helpers', () => {
  it('fires the calendar push only from 21:00 Istanbul onward', () => {
    const afternoon = fromZonedTime('2026-08-03T20:59:00', 'Europe/Istanbul')
    const evening = fromZonedTime('2026-08-03T21:00:00', 'Europe/Istanbul')
    expect(isAtOrAfterIstanbulHour(SHOOTING_CALENDAR_NOTIFY_HOUR, afternoon)).toBe(
      false,
    )
    expect(isAtOrAfterIstanbulHour(SHOOTING_CALENDAR_NOTIFY_HOUR, evening)).toBe(
      true,
    )
  })

  it('schedules the next 21:00 window', () => {
    const morning = fromZonedTime('2026-08-03T10:00:00', 'Europe/Istanbul')
    const ms = msUntilNextIstanbulHour(SHOOTING_CALENDAR_NOTIFY_HOUR, morning)
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })
})
