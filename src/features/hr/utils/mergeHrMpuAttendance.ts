import {
  HR_MPU_ATTENDANCE_LIMIT_MESSAGE,
  MAX_HR_MPU_ATTENDANCES,
  type HrMpuAttendanceEntry,
} from '@/features/hr/types/hr'
import {
  isHrClockOutAfterIn,
  normalizeHrShiftTime,
} from '@/features/hr/utils/hrShiftTimes'

/** Throws USER_… when a report would exceed the 20-MPU attendance cap. */
export function assertHrMpuAttendanceLimit(
  entries: HrMpuAttendanceEntry[],
): void {
  if (entries.length > MAX_HR_MPU_ATTENDANCES) {
    throw new Error(`USER_${HR_MPU_ATTENDANCE_LIMIT_MESSAGE}`)
  }
}

/** Plain Firestore-safe attendance map (HH:mm only, no empty strings). */
export function toFirestoreAttendance(
  entry: HrMpuAttendanceEntry,
): HrMpuAttendanceEntry {
  const clockInRaw =
    typeof entry.clockInTime === 'string' ? entry.clockInTime.trim() : ''
  const clockOutRaw =
    typeof entry.clockOutTime === 'string' ? entry.clockOutTime.trim() : ''
  const clockIn = clockInRaw ? normalizeHrShiftTime(clockInRaw) : null
  const clockOut = clockOutRaw ? normalizeHrShiftTime(clockOutRaw) : null

  if (entry.absent) {
    return {
      mpuUid: entry.mpuUid,
      mpuNameSnapshot: entry.mpuNameSnapshot,
      clockInTime: null,
      clockOutTime: null,
      absent: true,
    }
  }
  return {
    mpuUid: entry.mpuUid,
    mpuNameSnapshot: entry.mpuNameSnapshot,
    clockInTime: clockIn,
    clockOutTime: clockOut,
    absent: false,
  }
}

/**
 * Merge same-MPU attendance across same-day reports.
 * New field values win when set; otherwise keep prior.
 * Explicit “işe gelmedi” clears times.
 */
export function mergeHrMpuAttendanceEntry(
  prior: HrMpuAttendanceEntry | undefined,
  next: HrMpuAttendanceEntry,
): HrMpuAttendanceEntry {
  if (next.absent) {
    return toFirestoreAttendance({
      mpuUid: next.mpuUid,
      mpuNameSnapshot: next.mpuNameSnapshot,
      clockInTime: null,
      clockOutTime: null,
      absent: true,
    })
  }

  if (prior?.absent) {
    return toFirestoreAttendance({
      mpuUid: next.mpuUid,
      mpuNameSnapshot: next.mpuNameSnapshot,
      clockInTime: next.clockInTime,
      clockOutTime: next.clockOutTime,
      absent: false,
    })
  }

  return toFirestoreAttendance({
    mpuUid: next.mpuUid,
    mpuNameSnapshot: next.mpuNameSnapshot || prior?.mpuNameSnapshot || '',
    clockInTime: next.clockInTime ?? prior?.clockInTime ?? null,
    clockOutTime: next.clockOutTime ?? prior?.clockOutTime ?? null,
    absent: false,
  })
}

/** Fold entries in chronological order into one map by mpuUid. */
export function foldHrMpuAttendances(
  reportsOldestFirst: Array<{ mpuAttendances: HrMpuAttendanceEntry[] }>,
): Map<string, HrMpuAttendanceEntry> {
  const map = new Map<string, HrMpuAttendanceEntry>()
  for (const report of reportsOldestFirst) {
    for (const entry of report.mpuAttendances) {
      map.set(entry.mpuUid, mergeHrMpuAttendanceEntry(map.get(entry.mpuUid), entry))
    }
  }
  return map
}

export function assertValidMergedAttendance(entry: HrMpuAttendanceEntry): void {
  if (entry.absent) return
  const inTime = entry.clockInTime ?? ''
  const outTime = entry.clockOutTime ?? ''
  if (!inTime && !outTime) {
    throw new Error('USER_Giriş veya çıkış saati gerekli.')
  }
  if (!isHrClockOutAfterIn(inTime, outTime)) {
    throw new Error('USER_Çıkış saati girişten sonra olmalı.')
  }
}
