import { describe, expect, it } from 'vitest'
import {
  isHrClockOutAfterIn,
  isOptionalHrShiftTime,
  isValidHrShiftTime,
} from '@/features/hr/utils/hrShiftTimes'
import {
  formatHrMpuAttendance,
  formatHrMpuAttendanceEntry,
  summarizeHrMpuAttendances,
} from '@/features/hr/types/hr'

describe('hrShiftTimes', () => {
  it('accepts any valid HH:mm including odd minutes', () => {
    expect(isValidHrShiftTime('06:57')).toBe(true)
    expect(isValidHrShiftTime('09:00')).toBe(true)
    expect(isValidHrShiftTime('23:59')).toBe(true)
    expect(isValidHrShiftTime('24:00')).toBe(false)
    expect(isValidHrShiftTime('9:00')).toBe(false)
    expect(isOptionalHrShiftTime('')).toBe(true)
    expect(isOptionalHrShiftTime('06:57')).toBe(true)
  })

  it('allows one-sided times and requires out after in when both set', () => {
    expect(isHrClockOutAfterIn('06:57', '')).toBe(true)
    expect(isHrClockOutAfterIn('', '18:03')).toBe(true)
    expect(isHrClockOutAfterIn('06:57', '18:03')).toBe(true)
    expect(isHrClockOutAfterIn('18:00', '09:00')).toBe(false)
    expect(isHrClockOutAfterIn('09:00', '09:00')).toBe(false)
  })
})

describe('formatHrMpuAttendance', () => {
  it('formats in, out, or both', () => {
    expect(formatHrMpuAttendance('06:57', null)).toBe('Giriş 06:57')
    expect(formatHrMpuAttendance(null, '18:03')).toBe('Çıkış 18:03')
    expect(formatHrMpuAttendance('06:57', '18:03')).toBe('Giriş 06:57 · Çıkış 18:03')
  })

  it('returns null when neither set', () => {
    expect(formatHrMpuAttendance(null, null)).toBeNull()
  })

  it('summarizes one or many entries', () => {
    expect(
      formatHrMpuAttendanceEntry({
        mpuNameSnapshot: 'Ada',
        clockInTime: '06:57',
        clockOutTime: '18:03',
        absent: false,
      }),
    ).toBe('Ada · Giriş 06:57 · Çıkış 18:03')
    expect(
      formatHrMpuAttendanceEntry({
        mpuNameSnapshot: 'Can',
        clockInTime: null,
        clockOutTime: null,
        absent: true,
      }),
    ).toBe('Can · İşe gelmedi')
    expect(
      summarizeHrMpuAttendances([
        {
          mpuUid: '1',
          mpuNameSnapshot: 'Ada',
          clockInTime: '06:57',
          clockOutTime: null,
          absent: false,
        },
        {
          mpuUid: '2',
          mpuNameSnapshot: 'Can',
          clockInTime: null,
          clockOutTime: null,
          absent: true,
        },
      ]),
    ).toBe('2 MPU mesai kaydı')
  })
})
