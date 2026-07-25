import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWithinAutoForwardWindow } from '@/features/jobs/services/autoForwardJobsService'

describe('isWithinAutoForwardWindow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is open at 09:00 Istanbul', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T06:00:00.000Z')) // 09:00 TR
    expect(isWithinAutoForwardWindow()).toBe(true)
  })

  it('is closed before 09:00 Istanbul', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T05:59:00.000Z')) // 08:59 TR
    expect(isWithinAutoForwardWindow()).toBe(false)
  })

  it('is closed at 21:00 Istanbul (exclusive end)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T18:00:00.000Z')) // 21:00 TR
    expect(isWithinAutoForwardWindow()).toBe(false)
  })

  it('is open at 20:59 Istanbul', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T17:59:00.000Z')) // 20:59 TR
    expect(isWithinAutoForwardWindow()).toBe(true)
  })
})
