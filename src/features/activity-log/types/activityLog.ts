import type { Timestamp } from 'firebase/firestore'
import type { UserRole } from '@/config/roles'

export const ACTIVITY_LOG_CATEGORIES = [
  'job',
  'report',
  'field',
  'account',
  'system',
] as const

export type ActivityLogCategory = (typeof ACTIVITY_LOG_CATEGORIES)[number]

export const ACTIVITY_LOG_ACTIONS = [
  'job.created',
  'job.updated',
  'job.approved',
  'job.rejected',
  'job.cancelled',
  'job.reverted',
  'job.shot',
  'job.forwarded',
  'job.auto_forwarded',
  'job.auto_cancelled',
  'job.auto_rejected',
  'job.region_updated',
  'job.region_deleted',
  'report.created',
  'report.updated',
  'report.deleted',
  'report.z_created',
  'report.z_updated',
  'report.z_deleted',
  'report.note_updated',
  'report.note_deleted',
  'report.hr_created',
  'report.hr_updated',
  'report.hiring_created',
  'report.hiring_updated',
  'field.voice_created',
  'field.voice_deleted',
  'field.odometer_created',
  'field.odometer_updated',
  'field.odometer_deleted',
  'field.job_clock_created',
  'field.job_clock_updated',
  'field.job_clock_deleted',
  'field.attendance_updated',
  'account.created',
  'account.frozen',
  'account.unfrozen',
  'account.deleted',
  'account.password_reset',
] as const

export type ActivityLogAction = (typeof ACTIVITY_LOG_ACTIONS)[number]

export const ACTIVITY_LOG_TITLES: Record<ActivityLogAction, string> = {
  'job.created': 'İş oluşturuldu',
  'job.updated': 'İş düzenlendi',
  'job.approved': 'İş konfirme edildi',
  'job.rejected': 'İş reddedildi',
  'job.cancelled': 'İş iptal edildi',
  'job.reverted': 'İş konfirme beklemeye alındı',
  'job.shot': 'İş çekildi',
  'job.forwarded': 'İş muhabire iletildi',
  'job.auto_forwarded': 'İş otomatik iletildi',
  'job.auto_cancelled': 'İş otomatik iptal edildi',
  'job.auto_rejected': 'İş otomatik reddedildi',
  'job.region_updated': 'Günlük bölge güncellendi',
  'job.region_deleted': 'Günlük bölge silindi',
  'report.created': 'Günlük rapor gönderildi',
  'report.updated': 'Günlük rapor güncellendi',
  'report.deleted': 'Günlük rapor silindi',
  'report.z_created': 'Z raporu gönderildi',
  'report.z_updated': 'Z raporu güncellendi',
  'report.z_deleted': 'Z raporu silindi',
  'report.note_updated': 'Günlük not kaydedildi',
  'report.note_deleted': 'Günlük not silindi',
  'report.hr_created': 'İK raporu gönderildi',
  'report.hr_updated': 'İK raporu güncellendi',
  'report.hiring_created': 'İşe alım notu eklendi',
  'report.hiring_updated': 'İşe alım notu güncellendi',
  'field.voice_created': 'Ses kaydı eklendi',
  'field.voice_deleted': 'Ses kaydı silindi',
  'field.odometer_created': 'Kadran raporu girildi',
  'field.odometer_updated': 'Kadran raporu güncellendi',
  'field.odometer_deleted': 'Kadran raporu silindi',
  'field.job_clock_created': 'İş saati girildi',
  'field.job_clock_updated': 'İş saati güncellendi',
  'field.job_clock_deleted': 'İş saati silindi',
  'field.attendance_updated': 'Mesai saati düzeltildi',
  'account.created': 'Hesap oluşturuldu',
  'account.frozen': 'Hesap donduruldu',
  'account.unfrozen': 'Hesap aktifleştirildi',
  'account.deleted': 'Hesap silindi',
  'account.password_reset': 'Şifre sıfırlandı',
}

export const ACTIVITY_LOG_CATEGORY_FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'job', label: 'İşler' },
  { id: 'report', label: 'Raporlar' },
  { id: 'field', label: 'Saha' },
  { id: 'account', label: 'Hesaplar' },
  { id: 'system', label: 'Sistem' },
] as const

export type ActivityLogCategoryFilter =
  (typeof ACTIVITY_LOG_CATEGORY_FILTERS)[number]['id']

export type ActivityLogActor = {
  uid: string
  fullName: string
  role: UserRole
}

export type ActivityLog = {
  id: string
  actorUid: string
  actorNameSnapshot: string
  actorRole: UserRole
  category: ActivityLogCategory
  action: ActivityLogAction
  title: string
  summary: string
  jobId: string | null
  jobCompanyName: string | null
  entityType: string | null
  entityId: string | null
  createdAt: Timestamp | null
}

export function isActivityLogCategory(
  value: unknown,
): value is ActivityLogCategory {
  return (
    typeof value === 'string' &&
    (ACTIVITY_LOG_CATEGORIES as readonly string[]).includes(value)
  )
}

export function isActivityLogAction(value: unknown): value is ActivityLogAction {
  return (
    typeof value === 'string' &&
    (ACTIVITY_LOG_ACTIONS as readonly string[]).includes(value)
  )
}
