import type { LucideIcon } from 'lucide-react'
import {
  AudioLines,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  Gauge,
  History,
  NotebookPen,
  PlusCircle,
  Receipt,
  StickyNote,
  Target,
  Trophy,
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
  { id: 'voice', label: 'Ses kayıtları', icon: AudioLines },
  { id: 'cash', label: 'Kasa', icon: Wallet },
  { id: 'stats', label: 'Aylık Özet', icon: BarChart3 },
  { id: 'accounts', label: 'Hesaplar', icon: UserCog },
  { id: 'activity', label: 'Kayıtlar', icon: History },
] as const satisfies readonly NavSectionItem[]

export const COORDINATOR_SECTIONS = [
  { id: 'schedule', label: 'Günlük Takvim', icon: CalendarDays },
  { id: 'voice', label: 'Ses kayıtları', icon: AudioLines },
  { id: 'cash', label: 'Kasa', icon: Wallet },
  { id: 'stats', label: 'Aylık Özet', icon: BarChart3 },
] as const satisfies readonly NavSectionItem[]

/** Şef: yalnızca konfirme / takvim / ses (saat vererek onay + red). */
export const SEF_SECTIONS = [
  { id: 'approvals', label: 'İş Konfirmeleri', icon: CheckSquare },
  { id: 'schedule', label: 'Çekim Takvimi', icon: CalendarDays },
  { id: 'voice', label: 'Ses kayıtları', icon: AudioLines },
] as const satisfies readonly NavSectionItem[]

/**
 * Yönetim / koordinatör sol menü “Kameraman” — saha km / kadran özeti.
 * Kameraman rolünün Raporlarım sekmesinden ayrı yüzey.
 */
export const KAMERAMAN_FIELD_SECTIONS = [
  { id: 'field-ops', label: 'Saha Özeti', icon: Gauge },
] as const satisfies readonly NavSectionItem[]

/** İK kendi paneli. */
export const HR_OWN_SECTIONS = [
  { id: 'attendance', label: 'Mesai', icon: Clock },
  { id: 'jobs', label: 'İş Özeti', icon: BarChart3 },
  { id: 'reports', label: 'Raporlar', icon: FileText },
  { id: 'hiring', label: 'İşe Alım', icon: UserRound },
  { id: 'accounts', label: 'Hesaplar', icon: UserCog },
] as const satisfies readonly NavSectionItem[]

/**
 * Yönetim / koordinatör İK sayfası içi sekmeler (yan menü yok — route’a tıklanınca sayfa açılır).
 */
export const HR_VIEWER_PAGE_TABS = [
  { id: 'reports', label: 'İK Raporları', icon: FileText },
  { id: 'interviews', label: 'İş Görüşmeleri', icon: UserRound },
] as const satisfies readonly NavSectionItem[]

/** @deprecated Prefer HR_VIEWER_PAGE_TABS; ops İK sidebar artık boş. */
export const HR_VIEWER_SECTIONS = HR_VIEWER_PAGE_TABS

export const REPORTER_SECTIONS = [
  { id: 'jobs', label: 'Çekim Takvimi', icon: CalendarDays },
  { id: 'daily-report', label: 'Günlük Rapor', icon: NotebookPen },
  { id: 'my-reports', label: 'Raporlarım', icon: ClipboardList },
  { id: 'muhabir-ozet', label: 'Muhabir Özet', icon: BarChart3 },
  { id: 'z-report', label: 'Z Raporu', icon: Receipt },
  { id: 'cash', label: 'Kasa', icon: Wallet },
  { id: 'notebook', label: 'Not defteri', icon: StickyNote },
] as const satisfies readonly NavSectionItem[]

/** Yönetim / koordinatör Muhabir: günlük raporlar, özet, not defteri. */
export const REPORTER_VIEWER_SECTIONS = [
  { id: 'daily-reports', label: 'Günlük Raporlar', icon: ClipboardList },
  { id: 'muhabir-ozet', label: 'Muhabir Özet', icon: BarChart3 },
  { id: 'notebook', label: 'Not defteri', icon: StickyNote },
] as const satisfies readonly NavSectionItem[]

/** İK: yalnızca çekim takvimi. Kameraman: takvim + km raporları. */
export const CALENDAR_ONLY_REPORTER_SECTIONS = [
  { id: 'jobs', label: 'Çekim Takvimi', icon: CalendarDays },
] as const satisfies readonly NavSectionItem[]

export const KAMERAMAN_SECTIONS = [
  { id: 'jobs', label: 'Çekim Takvimi', icon: CalendarDays },
  { id: 'odometer', label: 'Km Raporu', icon: Gauge },
] as const satisfies readonly NavSectionItem[]

/** @deprecated Prefer CALENDAR_ONLY_REPORTER_SECTIONS */
export const HR_REPORTER_SECTIONS = CALENDAR_ONLY_REPORTER_SECTIONS

export const MEDIA_PLANNING_SECTIONS = [
  { id: 'overdue', label: 'Çekim Durumu', icon: CalendarCheck },
  { id: 'new-job', label: 'Yeni İş', icon: PlusCircle },
  { id: 'jobs', label: 'İş Kayıtları', icon: ClipboardList },
  { id: 'score', label: 'MPU Tablosu', icon: Trophy },
] as const satisfies readonly NavSectionItem[]

/** Yönetim / koordinatör: İş Kayıtları (MPU özeti içinde) + Çalışanlar. */
export const MEDIA_PLANNING_OPS_SECTIONS = [
  { id: 'jobs', label: 'İş Kayıtları', icon: ClipboardList },
  { id: 'employees', label: 'Çalışanlar', icon: Users },
] as const satisfies readonly NavSectionItem[]

/** @deprecated Unused — prefer role-specific media-planning section lists. */
export const MEDIA_PLANNING_VIEWER_SECTIONS = [
  { id: 'jobs', label: 'İş Kayıtları', icon: ClipboardList },
  { id: 'attendance', label: 'Mesai', icon: Clock },
  { id: 'score', label: 'MPU Tablosu', icon: Trophy },
] as const satisfies readonly NavSectionItem[]

/** Oyun: herkese 3’lük; Test yalnızca yönetim. */
export const GAME_SECTIONS = [
  { id: 'hoop', label: '3’lük Atış', icon: Target },
] as const satisfies readonly NavSectionItem[]

export const GAME_MANAGEMENT_SECTIONS = [
  { id: 'hoop', label: '3’lük Atış', icon: Target },
  { id: 'test', label: 'Test', icon: FlaskConical },
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
    case 'sef':
      return SEF_SECTIONS
    case 'kameraman-field':
      return KAMERAMAN_FIELD_SECTIONS
    case 'shooting-calendar':
      return []
    case 'job-approvals':
      return []
    case 'region-planning':
      return []
    case 'ops-ledger':
      return []
    case 'coordinator-share':
      return []
    case 'human-resources':
      // Yönetim / koordinatör: alt menü yok — tek İK sayfası (içeride sekme).
      return role === 'human_resources'
        ? visibleNavSections(HR_OWN_SECTIONS)
        : []
    case 'reporter':
      if (role === 'reporter') return REPORTER_SECTIONS
      if (role === 'management' || role === 'coordinator') return REPORTER_VIEWER_SECTIONS
      if (role === 'kameraman') return KAMERAMAN_SECTIONS
      if (role === 'human_resources') {
        return CALENDAR_ONLY_REPORTER_SECTIONS
      }
      return []
    case 'media-planning':
      if (role === 'management' || role === 'coordinator') {
        return MEDIA_PLANNING_OPS_SECTIONS
      }
      if (role === 'media_planning') {
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
      if (role === 'management') return GAME_MANAGEMENT_SECTIONS
      return GAME_SECTIONS
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
