import type { AppRouteKey } from '@/config/permissions'
import type { UserRole } from '@/config/roles'
import {
  Briefcase,
  Camera,
  Car,
  LayoutDashboard,
  Newspaper,
  Shield,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export const APP_ROUTES = {
  login: '/login',
  mediaPlanning: '/media-planning',
  reporter: '/reporter',
  humanResources: '/human-resources',
  coordinator: '/coordinator',
  management: '/management',
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
    key: 'media-planning',
    path: APP_ROUTES.mediaPlanning,
    label: 'Medya Planlama',
    icon: Briefcase,
  },
  {
    key: 'reporter',
    path: APP_ROUTES.reporter,
    label: 'Muhabir',
    icon: Camera,
  },
  {
    key: 'kameraman-field',
    path: APP_ROUTES.kameramanField,
    label: 'Kameraman',
    icon: Car,
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
    key: 'news-sites',
    path: APP_ROUTES.newsSites,
    label: 'Projelerimiz',
    icon: Newspaper,
  },
  {
    key: 'game',
    path: APP_ROUTES.game,
    label: 'Oyun',
    icon: Zap,
  },
]

/** Sidebar / mobile nav label; kameraman shares the reporter route. */
export function resolveNavItemLabel(item: NavItem, role: UserRole): string {
  if (item.key === 'reporter' && role === 'kameraman') return 'Kameraman'
  return item.label
}
