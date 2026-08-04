import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CalendarDays,
  Car,
  CheckSquare,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  FileText,
  MapPin,
  Mic,
  NotebookPen,
  PlusCircle,
  Star,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { SHOW_MESAI_UI } from '@/config/featureFlags'
import type { AppRouteKey } from '@/config/permissions'
import type { UserRole } from '@/config/roles'

export type NavSectionItem = {
  id: string
  label: string
  icon?: LucideIcon
}

/** Hide mesai/attendance nav entries when SHOW_MESAI_UI is false. */
export function visibleNavSections<T extends NavSectionItem>(
  sections: readonly T[],
): readonly T[] {
  if (SHOW_MESAI_UI) return sections
  return sections.filter((section) => section.id !== 'attendance')
}

export const MANAGEMENT_SECTIONS = [
  { id: 'approvals', label: 'İş Konfirmeleri', icon: CheckSquare },
  { id: 'schedule', label: 'Günlük Takvim', icon: CalendarDays },
  { id: 'regions', label: 'Bölge Seçimi', icon: MapPin },
  { id: 'voice', label: 'Ses kayıtları', icon: Mic },
  { id: 'cash', label: 'Kasa', icon: Wallet },
  { id: 'field-ops', label: 'Saha Özeti', icon: Car },
  { id: 'stats', label: 'Aylık Özet', icon: BarChart3 },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { id: 'accounts', label: 'Hesaplar', icon: UserCog },
] as const satisfies readonly NavSectionItem[]

export const COORDINATOR_SECTIONS = [
  { id: 'approvals', label: 'İş Konfirmeleri', icon: CheckSquare },
  { id: 'schedule', label: 'Günlük Takvim', icon: CalendarDays },
  { id: 'regions', label: 'Bölge Seçimi', icon: MapPin },
  { id: 'voice', label: 'Ses kayıtları', icon: Mic },
  { id: 'cash', label: 'Kasa', icon: Wallet },
  { id: 'field-ops', label: 'Saha Özeti', icon: Car },
  { id: 'stats', label: 'Aylık Özet', icon: BarChart3 },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
] as const satisfies readonly NavSectionItem[]

export const HR_OWN_SECTIONS = [
  { id: 'attendance', label: 'Mesai', icon: Clock },
  { id: 'jobs', label: 'İş Özeti', icon: BarChart3 },
  { id: 'reports', label: 'Raporlar', icon: FileText },
  { id: 'hiring', label: 'İşe Alım', icon: UserRound },
  { id: 'accounts', label: 'Hesaplar', icon: Users },
] as const satisfies readonly NavSectionItem[]

export const HR_VIEWER_SECTIONS = [
  { id: 'attendance', label: 'Mesai', icon: Clock },
  { id: 'reports', label: 'İK Raporları', icon: FileText },
  { id: 'interviews', label: 'İş Görüşmeleri', icon: UserRound },
] as const satisfies readonly NavSectionItem[]

export const REPORTER_SECTIONS = [
  { id: 'jobs', label: 'Çekim Takvimi', icon: CalendarDays },
  { id: 'daily-report', label: 'Günlük Rapor', icon: NotebookPen },
  { id: 'my-reports', label: 'Raporlarım', icon: ClipboardList },
  { id: 'muhabir-ozet', label: 'Muhabir Özet', icon: BarChart3 },
  { id: 'z-report', label: 'Z Raporu', icon: FileText },
] as const satisfies readonly NavSectionItem[]

export const REPORTER_VIEWER_SECTIONS = [
  { id: 'jobs', label: 'Çekim Takvimi', icon: CalendarDays },
  { id: 'daily-reports', label: 'Günlük Raporlar', icon: ClipboardList },
  { id: 'muhabir-ozet', label: 'Muhabir Özet', icon: BarChart3 },
  { id: 'z-reports', label: 'Z Raporları', icon: FileText },
] as const satisfies readonly NavSectionItem[]

/** İK: yalnızca çekim takvimi. Kameraman: takvim + km raporları. */
export const CALENDAR_ONLY_REPORTER_SECTIONS = [
  { id: 'jobs', label: 'Çekim Takvimi', icon: CalendarDays },
] as const satisfies readonly NavSectionItem[]

export const KAMERAMAN_SECTIONS = [
  { id: 'jobs', label: 'Çekim Takvimi', icon: CalendarDays },
  { id: 'odometer', label: 'Raporlarım', icon: Car },
] as const satisfies readonly NavSectionItem[]

/** @deprecated Prefer CALENDAR_ONLY_REPORTER_SECTIONS */
export const HR_REPORTER_SECTIONS = CALENDAR_ONLY_REPORTER_SECTIONS

export const MEDIA_PLANNING_SECTIONS = [
  { id: 'overdue', label: 'Çekim Durumu', icon: CheckSquare },
  { id: 'new-job', label: 'Yeni İş', icon: PlusCircle },
  { id: 'jobs', label: 'İş Kayıtları', icon: ClipboardList },
  { id: 'score', label: 'MPU Tablosu', icon: Star },
] as const satisfies readonly NavSectionItem[]

export const MEDIA_PLANNING_VIEWER_SECTIONS = [
  { id: 'jobs', label: 'İş Kayıtları', icon: ClipboardList },
  { id: 'attendance', label: 'Mesai', icon: Clock },
  { id: 'score', label: 'MPU Tablosu', icon: Star },
] as const satisfies readonly NavSectionItem[]

export function getNavSections(
  routeKey: AppRouteKey,
  role: UserRole,
): readonly NavSectionItem[] {
  switch (routeKey) {
    case 'management':
      return MANAGEMENT_SECTIONS
    case 'coordinator':
      return COORDINATOR_SECTIONS
    case 'human-resources':
      return role === 'human_resources'
        ? visibleNavSections(HR_OWN_SECTIONS)
        : visibleNavSections(HR_VIEWER_SECTIONS)
    case 'reporter':
      if (role === 'reporter') return REPORTER_SECTIONS
      if (role === 'management' || role === 'coordinator') return REPORTER_VIEWER_SECTIONS
      if (role === 'kameraman') return KAMERAMAN_SECTIONS
      if (role === 'human_resources') {
        return CALENDAR_ONLY_REPORTER_SECTIONS
      }
      return []
    case 'media-planning':
      if (
        role === 'media_planning' ||
        role === 'management' ||
        role === 'coordinator'
      ) {
        return MEDIA_PLANNING_SECTIONS
      }
      // İK: Yeni İş sekmesi gizli (yalnızca MPU oluşturabilir)
      if (role === 'human_resources') {
        return MEDIA_PLANNING_SECTIONS.filter(
          (section) => section.id !== 'new-job',
        )
      }
      return []
    case 'news-sites':
      return []
    case 'game':
      return []
    default:
      return []
  }
}

export function getDefaultSectionId(
  routeKey: AppRouteKey,
  role: UserRole,
): string | null {
  return getNavSections(routeKey, role)[0]?.id ?? null
}

export function buildSectionPath(path: string, sectionId: string): string {
  return `${path}?tab=${sectionId}`
}
