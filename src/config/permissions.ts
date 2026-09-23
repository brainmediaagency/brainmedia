import type { UserRole } from '@/config/roles'

export type AppRouteKey =
  | 'shooting-calendar'
  | 'job-approvals'
  | 'region-planning'
  | 'ops-ledger'
  | 'coordinator-share'
  | 'media-planning'
  | 'reporter'
  | 'human-resources'
  | 'coordinator'
  | 'management'
  | 'sef'
  | 'kameraman-field'
  | 'news-sites'
  | 'game'

export const rolePermissions: Record<UserRole, AppRouteKey[]> = {
  media_planning: ['media-planning', 'news-sites', 'game'],
  reporter: ['reporter', 'news-sites', 'game'],
  human_resources: [
    'human-resources',
    'media-planning',
    'reporter',
    'news-sites',
    'game',
  ],
  coordinator: [
    'coordinator',
    'shooting-calendar',
    'job-approvals',
    'region-planning',
    'ops-ledger',
    'coordinator-share',
    'media-planning',
    'reporter',
    'kameraman-field',
    'human-resources',
    'news-sites',
    'game',
  ],
  management: [
    'management',
    'shooting-calendar',
    'job-approvals',
    'region-planning',
    'ops-ledger',
    'coordinator-share',
    'media-planning',
    'reporter',
    'kameraman-field',
    'human-resources',
    'news-sites',
    'game',
  ],
  /** Çekim takvimi + Projelerimiz + Oyun (muhabir ile aynı yan menü yüzeyi). */
  kameraman: ['reporter', 'news-sites', 'game'],
  /**
   * Şef: iş konfirmeleri + çekim takvimi + ses.
   * Kameraman iş saatleri çekim takvimi iş detayında görünür.
   */
  sef: ['sef', 'news-sites', 'game'],
}

export function canAccessRoute(role: UserRole, routeKey: AppRouteKey): boolean {
  return rolePermissions[role].includes(routeKey)
}

export function getDefaultRouteForRole(role: UserRole): string {
  const first = rolePermissions[role][0]
  return `/${first}`
}
