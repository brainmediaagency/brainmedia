import { describe, expect, it } from 'vitest'
import {
  MAX_HR_MPU_ATTENDANCES,
  HR_MPU_ATTENDANCE_LIMIT_MESSAGE,
} from '@/features/hr/types/hr'
import {
  assertHrMpuAttendanceLimit,
  foldHrMpuAttendances,
  mergeHrMpuAttendanceEntry,
} from '@/features/hr/utils/mergeHrMpuAttendance'

describe('assertHrMpuAttendanceLimit', () => {
  it('allows up to 20 entries', () => {
    const entries = Array.from({ length: MAX_HR_MPU_ATTENDANCES }, (_, i) => ({
      mpuUid: `u${i}`,
      mpuNameSnapshot: `N${i}`,
      clockInTime: '10:00',
      clockOutTime: '18:30',
      absent: false,
    }))
    expect(() => assertHrMpuAttendanceLimit(entries)).not.toThrow()
  })

  it('rejects more than 20 with an explanatory message', () => {
    const entries = Array.from({ length: MAX_HR_MPU_ATTENDANCES + 1 }, (_, i) => ({
      mpuUid: `u${i}`,
      mpuNameSnapshot: `N${i}`,
      clockInTime: '10:00',
      clockOutTime: '18:30',
      absent: false,
    }))
    expect(() => assertHrMpuAttendanceLimit(entries)).toThrow(
      `USER_${HR_MPU_ATTENDANCE_LIMIT_MESSAGE}`,
    )
  })
})

describe('mergeHrMpuAttendanceEntry', () => {
  it('merges clock-in from first report with clock-out from second', () => {
    const first = mergeHrMpuAttendanceEntry(undefined, {
      mpuUid: '1',
      mpuNameSnapshot: 'Ada',
      clockInTime: '10:00',
      clockOutTime: null,
      absent: false,
    })
    const merged = mergeHrMpuAttendanceEntry(first, {
      mpuUid: '1',
      mpuNameSnapshot: 'Ada',
      clockInTime: null,
      clockOutTime: '18:34',
      absent: false,
    })
    expect(merged).toEqual({
      mpuUid: '1',
      mpuNameSnapshot: 'Ada',
      clockInTime: '10:00',
      clockOutTime: '18:34',
      absent: false,
    })
  })

  it('lets explicit absent clear prior times', () => {
    const prior = {
      mpuUid: '1',
      mpuNameSnapshot: 'Ada',
      clockInTime: '10:00',
      clockOutTime: '18:30',
      absent: false,
    }
    expect(
      mergeHrMpuAttendanceEntry(prior, {
        mpuUid: '1',
        mpuNameSnapshot: 'Ada',
        clockInTime: null,
        clockOutTime: null,
        absent: true,
      }),
    ).toEqual({
      mpuUid: '1',
      mpuNameSnapshot: 'Ada',
      clockInTime: null,
      clockOutTime: null,
      absent: true,
    })
  })

  it('folds multiple same-day reports chronologically', () => {
    const map = foldHrMpuAttendances([
      {
        mpuAttendances: [
          {
            mpuUid: '1',
            mpuNameSnapshot: 'Ada',
            clockInTime: '10:00',
            clockOutTime: null,
            absent: false,
          },
        ],
      },
      {
        mpuAttendances: [
          {
            mpuUid: '1',
            mpuNameSnapshot: 'Ada',
            clockInTime: null,
            clockOutTime: '18:34',
            absent: false,
          },
        ],
      },
    ])
    expect(map.get('1')?.clockInTime).toBe('10:00')
    expect(map.get('1')?.clockOutTime).toBe('18:34')
  })
})
