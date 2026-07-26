import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  msUntilNextIstanbulMidnight,
  shiftDateOnlyDays,
} from '@/features/media-planning/services/dailyRegionService'
import { todayDateOnlyIstanbul } from '@/lib/date'

describe('msUntilNextIstanbulMidnight', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is under 24h and positive before midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T12:00:00+03:00'))
    const ms = msUntilNextIstanbulMidnight()
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })

  it('lands on the next Istanbul calendar day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T23:30:00+03:00'))
    const ms = msUntilNextIstanbulMidnight()
    const target = Date.now() + ms
    expect(todayDateOnlyIstanbul(new Date(target))).toBe(
      shiftDateOnlyDays('2026-07-26', 1),
    )
  })
})
