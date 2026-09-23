import type { AppRouteKey } from '@/config/permissions'
import type { UserRole } from '@/config/roles'
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Crown,
  Gamepad2,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Mic,
  Newspaper,
  PieChart,
  Shield,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'

export const APP_ROUTES = {
  login: '/login',
  shootingCalendar: '/shooting-calendar',
  jobApprovals: '/job-approvals',
  regionPlanning: '/region-planning',
  opsLedger: '/ops-ledger',
  /** Yönetim/koordinatör — aylık ciro payı (masa sekmelerinden ayrı). */
  coordinatorShare: '/coordinator-share',
  mediaPlanning: '/media-planning',
  reporter: '/reporter',
  humanResources: '/human-resources',
  coordinator: '/coordinator',
  management: '/management',
  sef: '/sef',
  /** Yönetim/koordinatör saha özeti — solda “Kameraman” menüsü. */
  kameramanField: '/kameraman',
  newsSites: '/news-sites',
  game: '/game',
  unauthorized: '/unauthorized',
} as const

export interface NavItem {
  key: AppRouteKey
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'shooting-calendar',
    path: APP_ROUTES.shootingCalendar,
    label: 'Çekim Takvimi',
    icon: CalendarDays,
  },
  {
    key: 'job-approvals',
    path: APP_ROUTES.jobApprovals,
    label: 'İş Konfirmeleri',
    icon: ClipboardCheck,
  },
  {
    key: 'region-planning',
    path: APP_ROUTES.regionPlanning,
    label: 'Bölge Seçimi',
    icon: MapPin,
  },
  {
    key: 'ops-ledger',
    path: APP_ROUTES.opsLedger,
    label: 'Operasyon Defteri',
    icon: BookOpen,
  },
  {
    key: 'coordinator-share',
    path: APP_ROUTES.coordinatorShare,
    label: 'Koordinatör',
    icon: PieChart,
  },
  {
    key: 'media-planning',
    path: APP_ROUTES.mediaPlanning,
    label: 'Medya Planlama',
    icon: Megaphone,
  },
  {
    key: 'reporter',
    path: APP_ROUTES.reporter,
    label: 'Muhabir',
    icon: Mic,
  },
  {
    key: 'kameraman-field',
    path: APP_ROUTES.kameramanField,
    label: 'Kameraman',
    icon: Video,
  },
  {
    key: 'human-resources',
    path: APP_ROUTES.humanResources,
    label: 'İnsan Kaynakları',
    icon: Users,
  },
  {
    key: 'coordinator',
    path: APP_ROUTES.coordinator,
    label: 'Koordinatör',
    icon: LayoutDashboard,
  },
  {
    key: 'management',
    path: APP_ROUTES.management,
    label: 'Yönetim',
    icon: Shield,
  },
  {
    key: 'sef',
    path: APP_ROUTES.sef,
    label: 'Şef',
    icon: Crown,
  },
  {
    key: 'news-sites',
    path: APP_ROUTES.newsSites,
    label: 'Projelerimiz',
    icon: Newspaper,
  },
  {
    key: 'game',
    path: APP_ROUTES.game,
    label: 'Oyun',
    icon: Gamepad2,
  },
]

/** Sidebar / mobile nav label; kameraman shares the reporter route. */
export function resolveNavItemLabel(item: NavItem, role: UserRole): string {
  if (item.key === 'reporter' && role === 'kameraman') return 'Kameraman'
  return item.label
}

export function resolveNavItemIcon(item: NavItem, role: UserRole): LucideIcon {
  if (item.key === 'reporter' && role === 'kameraman') return Video
  return item.icon
}
