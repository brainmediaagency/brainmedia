/**
 * Role × route × nav tab product matrix (end-user access without a browser session).
 */
import { describe, expect, it } from 'vitest'
import {
  USER_ROLES,
  type UserRole,
  isVoiceRecordingViewerRole,
} from '@/config/roles'
import {
  canAccessRoute,
  getDefaultRouteForRole,
  type AppRouteKey,
  rolePermissions,
} from '@/config/permissions'
import {
  CALENDAR_ONLY_REPORTER_SECTIONS,
  COORDINATOR_SECTIONS,
  GAME_MANAGEMENT_SECTIONS,
  GAME_SECTIONS,
  getNavSections,
  KAMERAMAN_SECTIONS,
  MANAGEMENT_SECTIONS,
  REPORTER_SECTIONS,
  REPORTER_VIEWER_SECTIONS,
  SEF_SECTIONS,
} from '@/config/navSections'

const ROUTE_KEYS: AppRouteKey[] = [
  'shooting-calendar',
  'job-approvals',
  'region-planning',
  'ops-ledger',
  'coordinator-share',
  'media-planning',
  'reporter',
  'human-resources',
  'coordinator',
  'management',
  'sef',
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

  it('kameraman cannot view voice recordings; reporter and reviewers can', () => {
    expect(isVoiceRecordingViewerRole('kameraman')).toBe(false)
    expect(isVoiceRecordingViewerRole('reporter')).toBe(true)
    expect(isVoiceRecordingViewerRole('sef')).toBe(true)
    expect(isVoiceRecordingViewerRole('media_planning')).toBe(false)
  })

  it('only management+coordinator open kameraman-field (saha özeti)', () => {
    for (const role of USER_ROLES) {
      const allowed = role === 'management' || role === 'coordinator'
      expect(canAccessRoute(role, 'kameraman-field')).toBe(allowed)
    }
  })

  it('kameraman reporter nav has calendar + odometer; job clock lives in job detail', () => {
    expect(KAMERAMAN_SECTIONS.some((s) => s.id === 'jobs')).toBe(true)
    expect(KAMERAMAN_SECTIONS.some((s) => s.id === 'odometer')).toBe(true)
    expect(KAMERAMAN_SECTIONS.some((s) => s.id === 'job-clock')).toBe(false)
    expect(
      getNavSections('kameraman-field', 'management').some(
        (s) => s.id === 'job-clocks',
      ),
    ).toBe(false)
  })

  it('MPU cannot access management or coordinator paths', () => {
    expect(canAccessRoute('media_planning', 'management')).toBe(false)
    expect(canAccessRoute('media_planning', 'coordinator')).toBe(false)
    expect(canAccessRoute('media_planning', 'media-planning')).toBe(true)
  })

  it('management does not see coordinator desk in nav', () => {
    expect(canAccessRoute('management', 'coordinator')).toBe(false)
    expect(canAccessRoute('coordinator', 'coordinator')).toBe(true)
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

describe('QA · nav tab isolation (reporter / viewer cash)', () => {
  it('REPORTER_SECTIONS include Kasa; ops viewer and kameraman/HR calendar do not', () => {
    expect(REPORTER_SECTIONS.some((s) => s.id === 'cash')).toBe(true)
    expect(REPORTER_VIEWER_SECTIONS.some((s) => s.id === 'cash')).toBe(false)
    expect(KAMERAMAN_SECTIONS.some((s) => s.id === 'cash')).toBe(false)
    expect(CALENDAR_ONLY_REPORTER_SECTIONS.some((s) => s.id === 'cash')).toBe(
      false,
    )
    expect(MANAGEMENT_SECTIONS.some((s) => s.id === 'cash')).toBe(true)
  })

  it('ops muhabir viewer is daily reports + özet + notebook (calendar is top-level)', () => {
    expect(REPORTER_VIEWER_SECTIONS.map((s) => s.id)).toEqual([
      'daily-reports',
      'muhabir-ozet',
      'notebook',
    ])
    expect(REPORTER_VIEWER_SECTIONS.some((s) => s.id === 'jobs')).toBe(false)
    expect(REPORTER_VIEWER_SECTIONS.some((s) => s.id === 'z-reports')).toBe(
      false,
    )
    expect(REPORTER_VIEWER_SECTIONS.some((s) => s.id === 'cash')).toBe(false)
  })

  it('ops İK has no sidebar subsections — single page with in-page tabs', () => {
    expect(getNavSections('human-resources', 'management')).toEqual([])
    expect(getNavSections('human-resources', 'coordinator')).toEqual([])
    expect(
      getNavSections('human-resources', 'human_resources').some(
        (s) => s.id === 'reports',
      ),
    ).toBe(true)
  })

  it('ops shooting-calendar is a top-level route above media-planning', () => {
    expect(canAccessRoute('management', 'shooting-calendar')).toBe(true)
    expect(canAccessRoute('coordinator', 'shooting-calendar')).toBe(true)
    expect(canAccessRoute('reporter', 'shooting-calendar')).toBe(false)
    expect(canAccessRoute('sef', 'shooting-calendar')).toBe(false)
    expect(getNavSections('shooting-calendar', 'management')).toEqual([])
  })

  it('İş Konfirmeleri / Bölge / Operasyon Defteri are top-level ops routes only', () => {
    for (const key of [
      'job-approvals',
      'region-planning',
      'ops-ledger',
    ] as const) {
      for (const role of USER_ROLES) {
        const allowed = role === 'management' || role === 'coordinator'
        expect(canAccessRoute(role, key)).toBe(allowed)
      }
      expect(getNavSections(key, 'management')).toEqual([])
      expect(getNavSections(key, 'coordinator')).toEqual([])
    }

    expect(MANAGEMENT_SECTIONS.some((s) => s.id === 'approvals')).toBe(false)
    expect(MANAGEMENT_SECTIONS.some((s) => s.id === 'regions')).toBe(false)
    expect(MANAGEMENT_SECTIONS.some((s) => s.id === 'ops-ledger')).toBe(false)
    expect(COORDINATOR_SECTIONS.some((s) => s.id === 'approvals')).toBe(false)
    expect(COORDINATOR_SECTIONS.some((s) => s.id === 'regions')).toBe(false)
    expect(COORDINATOR_SECTIONS.some((s) => s.id === 'ops-ledger')).toBe(false)
    // Şef keeps approvals on own desk, not the top-level ops route.
    expect(SEF_SECTIONS.some((s) => s.id === 'approvals')).toBe(true)
    expect(canAccessRoute('sef', 'job-approvals')).toBe(false)
  })

  it('Koordinatör payı is a top-level route for management and coordinator only', () => {
    for (const role of USER_ROLES) {
      const allowed = role === 'management' || role === 'coordinator'
      expect(canAccessRoute(role, 'coordinator-share')).toBe(allowed)
    }
    expect(getNavSections('coordinator-share', 'management')).toEqual([])
    expect(getNavSections('coordinator-share', 'coordinator')).toEqual([])
  })

  it('REPORTER_SECTIONS include notebook after cash; ops viewer keeps notebook; kameraman/HR do not', () => {
    expect(REPORTER_SECTIONS.some((s) => s.id === 'notebook')).toBe(true)
    expect(REPORTER_VIEWER_SECTIONS.some((s) => s.id === 'notebook')).toBe(true)
    const reporterCashIdx = REPORTER_SECTIONS.findIndex((s) => s.id === 'cash')
    const reporterNoteIdx = REPORTER_SECTIONS.findIndex((s) => s.id === 'notebook')
    expect(reporterNoteIdx).toBe(reporterCashIdx + 1)
    expect(KAMERAMAN_SECTIONS.some((s) => s.id === 'notebook')).toBe(false)
    expect(CALENDAR_ONLY_REPORTER_SECTIONS.some((s) => s.id === 'notebook')).toBe(
      false,
    )
  })

  it('getNavSections(reporter) returns cash for muhabir only; not ops viewers', () => {
    const byRole: Record<UserRole, readonly { id: string }[]> = {
      reporter: getNavSections('reporter', 'reporter'),
      management: getNavSections('reporter', 'management'),
      coordinator: getNavSections('reporter', 'coordinator'),
      kameraman: getNavSections('reporter', 'kameraman'),
      human_resources: getNavSections('reporter', 'human_resources'),
      media_planning: getNavSections('reporter', 'media_planning'),
      sef: getNavSections('reporter', 'sef'),
    }
    expect(byRole.reporter.some((s) => s.id === 'cash')).toBe(true)
    expect(byRole.management.some((s) => s.id === 'cash')).toBe(false)
    expect(byRole.coordinator.some((s) => s.id === 'cash')).toBe(false)
    expect(byRole.management.some((s) => s.id === 'jobs')).toBe(false)
    expect(byRole.management.some((s) => s.id === 'daily-reports')).toBe(true)
    expect(byRole.management.some((s) => s.id === 'muhabir-ozet')).toBe(true)
    expect(byRole.management.some((s) => s.id === 'notebook')).toBe(true)
    expect(byRole.management.some((s) => s.id === 'z-reports')).toBe(false)
    expect(byRole.kameraman.some((s) => s.id === 'cash')).toBe(false)
    expect(byRole.human_resources.some((s) => s.id === 'cash')).toBe(false)
    expect(byRole.media_planning).toEqual([])
    expect(byRole.reporter.some((s) => s.id === 'notebook')).toBe(true)
    expect(byRole.coordinator.some((s) => s.id === 'notebook')).toBe(true)
    expect(byRole.kameraman.some((s) => s.id === 'notebook')).toBe(false)
  })

  it('management left nav has single Kasa tab under management route', () => {
    const mgmt = getNavSections('management', 'management')
    expect(mgmt.some((s) => s.id === 'cash')).toBe(true)
    expect(mgmt.some((s) => s.id === 'cash-total')).toBe(false)
    expect(mgmt.some((s) => s.id === 'cash-merve')).toBe(false)
    expect(mgmt.some((s) => s.id === 'cash-beste')).toBe(false)
  })

  it('Saha Özet is only under Kameraman field route, not management/coordinator desks', () => {
    expect(MANAGEMENT_SECTIONS.some((s) => s.id === 'field-ops')).toBe(false)
    expect(COORDINATOR_SECTIONS.some((s) => s.id === 'field-ops')).toBe(false)
    expect(
      getNavSections('kameraman-field', 'management').some(
        (s) => s.id === 'field-ops',
      ),
    ).toBe(true)

    for (const sections of [
      REPORTER_SECTIONS,
      REPORTER_VIEWER_SECTIONS,
      KAMERAMAN_SECTIONS,
      CALENDAR_ONLY_REPORTER_SECTIONS,
      SEF_SECTIONS,
    ]) {
      expect(sections.some((s) => s.id === 'field-ops')).toBe(false)
    }
  })

  it('named reporter cash registers are Merve and Beste only', async () => {
    const { REPORTER_CASH_REGISTERS } = await import(
      '@/features/cash/config/reporterCashRegisters'
    )
    expect(REPORTER_CASH_REGISTERS.map((r) => r.scopeId)).toEqual([
      'merve',
      'beste',
    ])
    expect(REPORTER_CASH_REGISTERS.map((r) => r.email)).toEqual([
      'muhabir@brain.com',
      'muhabir2@brain.com',
    ])
  })

  it('Kayıtlar tab is management-only', () => {
    const mgmt = getNavSections('management', 'management')
    expect(mgmt.some((s) => s.id === 'activity')).toBe(true)
    expect(MANAGEMENT_SECTIONS.some((s) => s.id === 'activity')).toBe(true)

    expect(
      getNavSections('coordinator', 'coordinator').some((s) => s.id === 'activity'),
    ).toBe(false)
    expect(getNavSections('sef', 'sef').some((s) => s.id === 'activity')).toBe(
      false,
    )
  })

  it('şef cannot open media-planning', () => {
    expect(canAccessRoute('sef', 'media-planning')).toBe(false)
    expect(getNavSections('media-planning', 'sef')).toEqual([])
  })

  it('ops media-planning has jobs (+employees); no Yeni iş / Çekim Durumu', () => {
    for (const role of ['management', 'coordinator'] as const) {
      const sections = getNavSections('media-planning', role)
      expect(sections.some((s) => s.id === 'jobs')).toBe(true)
      expect(sections.some((s) => s.id === 'overdue')).toBe(false)
      expect(sections.some((s) => s.id === 'new-job')).toBe(false)
      expect(sections.some((s) => s.id === 'score')).toBe(false)
    }
    expect(
      getNavSections('media-planning', 'management').some((s) => s.id === 'employees'),
    ).toBe(true)
    expect(
      getNavSections('media-planning', 'coordinator').some((s) => s.id === 'employees'),
    ).toBe(true)
  })

  it('Çalışanlar tab is media-planning ops only (management / coordinator)', () => {
    expect(
      getNavSections('media-planning', 'management').some((s) => s.id === 'employees'),
    ).toBe(true)
    expect(
      getNavSections('media-planning', 'coordinator').some((s) => s.id === 'employees'),
    ).toBe(true)
    expect(
      getNavSections('media-planning', 'media_planning').some(
        (s) => s.id === 'employees',
      ),
    ).toBe(false)
    expect(
      getNavSections('media-planning', 'human_resources').some(
        (s) => s.id === 'employees',
      ),
    ).toBe(false)
  })

  it('MPU Tablosu menu tab is planner-only; ops see it inside İş Kayıtları', () => {
    expect(
      getNavSections('media-planning', 'management').some((s) => s.id === 'score'),
    ).toBe(false)
    expect(
      getNavSections('media-planning', 'coordinator').some((s) => s.id === 'score'),
    ).toBe(false)
    expect(
      getNavSections('media-planning', 'media_planning').some((s) => s.id === 'score'),
    ).toBe(true)
  })

  it('Operasyon Defteri is coordinator and management only (not şef)', () => {
    expect(canAccessRoute('management', 'ops-ledger')).toBe(true)
    expect(canAccessRoute('coordinator', 'ops-ledger')).toBe(true)
    expect(canAccessRoute('sef', 'ops-ledger')).toBe(false)
    expect(
      getNavSections('management', 'management').some((s) => s.id === 'ops-ledger'),
    ).toBe(false)
    expect(
      getNavSections('coordinator', 'coordinator').some((s) => s.id === 'ops-ledger'),
    ).toBe(false)
    expect(getNavSections('sef', 'sef').some((s) => s.id === 'ops-ledger')).toBe(
      false,
    )
    expect(SEF_SECTIONS.some((s) => s.id === 'ops-ledger')).toBe(false)
  })

  it('Koordinatör payı is not a desk tab; lives on top-level coordinator-share route', () => {
    expect(
      getNavSections('management', 'management').some(
        (s) => s.id === 'coordinator-share',
      ),
    ).toBe(false)
    expect(
      getNavSections('coordinator', 'coordinator').some(
        (s) => s.id === 'coordinator-share',
      ),
    ).toBe(false)
    expect(MANAGEMENT_SECTIONS.some((s) => s.id === 'coordinator-share')).toBe(
      false,
    )
    expect(COORDINATOR_SECTIONS.some((s) => s.id === 'coordinator-share')).toBe(
      false,
    )
    expect(SEF_SECTIONS.some((s) => s.id === 'coordinator-share')).toBe(false)
  })

  it('Oyun: Test sekmesi yalnızca yönetim; diğer roller yalnızca 3’lük Atış', () => {
    expect(getNavSections('game', 'management')).toEqual([
      ...GAME_MANAGEMENT_SECTIONS,
    ])
    expect(
      getNavSections('game', 'management').some((s) => s.id === 'test'),
    ).toBe(true)
    for (const role of USER_ROLES) {
      if (role === 'management') continue
      if (!canAccessRoute(role, 'game')) {
        expect(getNavSections('game', role)).toEqual([])
        continue
      }
      expect(getNavSections('game', role)).toEqual([...GAME_SECTIONS])
      expect(getNavSections('game', role).some((s) => s.id === 'test')).toBe(
        false,
      )
    }
  })
})
