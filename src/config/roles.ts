export const USER_ROLES = [
  'media_planning',
  'reporter',
  'human_resources',
  'coordinator',
  'management',
  'kameraman',
] as const

export type UserRole = (typeof USER_ROLES)[number]

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  media_planning: 'Medya Planlama',
  reporter: 'Muhabir',
  human_resources: 'İnsan Kaynakları',
  coordinator: 'Koordinatör',
  management: 'Yönetim',
  kameraman: 'Kameraman',
}

/** Roles that can start/end attendance shifts. */
export const SHIFT_ROLES = [
  'media_planning',
  'human_resources',
] as const

export type ShiftRole = (typeof SHIFT_ROLES)[number]

export function isShiftRole(value: unknown): value is ShiftRole {
  return typeof value === 'string' && (SHIFT_ROLES as readonly string[]).includes(value)
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

export const JOB_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'shot',
  'cancelled',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export const ATTENDANCE_STATUSES = ['active', 'completed'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const COMPANY_TIMEZONE = 'Europe/Istanbul' as const
export const DEFAULT_LIST_LIMIT = 25
