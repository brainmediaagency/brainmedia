/**
 * Role × route × nav tab product matrix (end-user access without a browser session).
 */
import { describe, expect, it } from 'vitest'
import { USER_ROLES, type UserRole } from '@/config/roles'
import {
  canAccessRoute,
  getDefaultRouteForRole,
  type AppRouteKey,
  rolePermissions,
} from '@/config/permissions'
import {
  CALENDAR_ONLY_REPORTER_SECTIONS,
  getNavSections,
  KAMERAMAN_SECTIONS,
  MANAGEMENT_SECTIONS,
  REPORTER_SECTIONS,
  REPORTER_VIEWER_SECTIONS,
} from '@/config/navSections'

const ROUTE_KEYS: AppRouteKey[] = [
  'media-planning',
  'reporter',
  'human-resources',
  'coordinator',
  'management',
  'kameraman-field',
  'news-sites',
  'game',
]

describe('QA · role route matrix', () => {
  it('every role has at least one route and a default path', () => {
    for (const role of USER_ROLES) {
      expect(rolePermissions[role].length).toBeGreaterThan(0)
      expect(getDefaultRouteForRole(role)).toMatch(/^\//)
    }
  })

  it('muhabir cannot open management / coordinator / İK / saha özeti desk', () => {
    for (const key of [
      'management',
      'coordinator',
      'human-resources',
      'kameraman-field',
    ] as const) {
      expect(canAccessRoute('reporter', key)).toBe(false)
    }
  })

  it('kameraman shares reporter route surface but not management', () => {
    expect(canAccessRoute('kameraman', 'reporter')).toBe(true)
    expect(canAccessRoute('kameraman', 'management')).toBe(false)
    expect(canAccessRoute('kameraman', 'kameraman-field')).toBe(false)
  })

  it('only management+coordinator open kameraman-field (saha özeti)', () => {
    for (const role of USER_ROLES) {
      const allowed = role === 'management' || role === 'coordinator'
      expect(canAccessRoute(role, 'kameraman-field')).toBe(allowed)
    }
  })

  it('MPU cannot access management or coordinator paths', () => {
    expect(canAccessRoute('media_planning', 'management')).toBe(false)
    expect(canAccessRoute('media_planning', 'coordinator')).toBe(false)
    expect(canAccessRoute('media_planning', 'media-planning')).toBe(true)
  })

  it('full denial matrix: role cannot access keys outside allowlist', () => {
    for (const role of USER_ROLES) {
      for (const key of ROUTE_KEYS) {
        expect(canAccessRoute(role, key)).toBe(
          rolePermissions[role].includes(key),
        )
      }
    }
  })
})

describe('QA · nav tab isolation (reporter cash only for muhabir)', () => {
  it('REPORTER_SECTIONS includes Kasa; viewer and kameraman do not', () => {
    expect(REPORTER_SECTIONS.some((s) => s.id === 'cash')).toBe(true)
    expect(REPORTER_VIEWER_SECTIONS.some((s) => s.id === 'cash')).toBe(false)
    expect(KAMERAMAN_SECTIONS.some((s) => s.id === 'cash')).toBe(false)
    expect(CALENDAR_ONLY_REPORTER_SECTIONS.some((s) => s.id === 'cash')).toBe(
      false,
    )
    expect(MANAGEMENT_SECTIONS.some((s) => s.id === 'cash')).toBe(true)
  })

  it('getNavSections(reporter) returns cash only for role=reporter', () => {
    const byRole: Record<UserRole, readonly { id: string }[]> = {
      reporter: getNavSections('reporter', 'reporter'),
      management: getNavSections('reporter', 'management'),
      coordinator: getNavSections('reporter', 'coordinator'),
      kameraman: getNavSections('reporter', 'kameraman'),
      human_resources: getNavSections('reporter', 'human_resources'),
      media_planning: getNavSections('reporter', 'media_planning'),
    }
    expect(byRole.reporter.some((s) => s.id === 'cash')).toBe(true)
    expect(byRole.management.some((s) => s.id === 'cash')).toBe(false)
    expect(byRole.coordinator.some((s) => s.id === 'cash')).toBe(false)
    expect(byRole.kameraman.some((s) => s.id === 'cash')).toBe(false)
    expect(byRole.human_resources.some((s) => s.id === 'cash')).toBe(false)
    expect(byRole.media_planning).toEqual([])
  })

  it('management left nav has Kasa under management route', () => {
    const mgmt = getNavSections('management', 'management')
    expect(mgmt.some((s) => s.id === 'cash')).toBe(true)
  })
})
