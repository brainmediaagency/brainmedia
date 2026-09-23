import { describe, expect, it } from 'vitest'
import {
  formatJobClockRangeTr,
  formatJobClockStaffSummaryTr,
  isJobClockOutAfterIn,
  isOptionalJobClockTime,
  isValidJobClockTime,
  normalizeJobClockTime,
  parseOptionalJobClockTimes,
} from '@/features/kameraman/utils/jobClockTimes'

describe('jobClockTimes', () => {
  it('normalizes HH:mm:ss to HH:mm', () => {
    expect(normalizeJobClockTime('09:30:00')).toBe('09:30')
    expect(normalizeJobClockTime(' 18:05 ')).toBe('18:05')
  })

  it('validates wall-clock times', () => {
    expect(isValidJobClockTime('00:00')).toBe(true)
    expect(isValidJobClockTime('23:59')).toBe(true)
    expect(isValidJobClockTime('24:00')).toBe(false)
    expect(isValidJobClockTime('9:30')).toBe(false)
  })

  it('allows empty optional times', () => {
    expect(isOptionalJobClockTime('')).toBe(true)
    expect(isOptionalJobClockTime('09:00')).toBe(true)
    expect(isOptionalJobClockTime('25:00')).toBe(false)
  })

  it('requires çıkış after giriş only when both set', () => {
    expect(isJobClockOutAfterIn('09:00', '17:30')).toBe(true)
    expect(isJobClockOutAfterIn('09:00', '')).toBe(true)
    expect(isJobClockOutAfterIn('', '17:30')).toBe(true)
    expect(isJobClockOutAfterIn('09:00', '09:00')).toBe(false)
    expect(isJobClockOutAfterIn('17:00', '09:00')).toBe(false)
  })

  it('parses partial pairs', () => {
    expect(parseOptionalJobClockTimes('09:00', '')).toEqual({
      clockInTime: '09:00',
      clockOutTime: null,
    })
    expect(parseOptionalJobClockTimes('', '18:00')).toEqual({
      clockInTime: null,
      clockOutTime: '18:00',
    })
  })

  it('formats range for display including partial', () => {
    expect(formatJobClockRangeTr('09:00', '12:15')).toBe('09:00 – 12:15')
    expect(formatJobClockRangeTr('09:00', null)).toBe('Giriş 09:00')
    expect(formatJobClockRangeTr(null, '18:00')).toBe('Çıkış 18:00')
  })

  it('formats staff summary with declared + submitted times', () => {
    expect(
      formatJobClockStaffSummaryTr({
        clockInTime: '13:00',
        clockOutTime: '18:00',
        clockInSubmittedAtHHmm: '13:05',
        clockOutSubmittedAtHHmm: '18:02',
      }),
    ).toBe('Giriş 13:00 (işlem 13:05) · Çıkış 18:00 (işlem 18:02)')
  })
})
