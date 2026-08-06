/**
 * Push targeting matrix — notification bugs class (MPU/İK, kameraman drop, audience=all).
 * Offline; mirrors webhook allowlist + client target resolution.
 */
import { describe, expect, it } from 'vitest'
import { USER_ROLES } from '@/config/roles'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertPushRoleAllowlistComplete,
  normalizePushRoles,
  resolveClientPushTarget,
  WEBHOOK_PUSH_ROLES,
} from './helpers/pushRolesNormalize'
import { NOTIFY_CONTRACTS } from './contracts/notifyContracts'
import {
  notifyBroadcast,
  notifyManagement,
  notifyUser,
  isNotificationVisibleForRole,
} from '@/features/notifications/services/notificationService'
import type { AppNotification } from '@/features/notifications/types'
import { beforeEach, vi } from 'vitest'

vi.mock('@/lib/firebase/firestore', () => ({
  getDb: vi.fn(() => ({})),
}))

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  collection: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => 'ts'),
  arrayUnion: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
}))

const sendOneSignalPush = vi.fn()
vi.mock('@/features/notifications/services/oneSignalPush', () => ({
  sendOneSignalPush: (...args: unknown[]) => sendOneSignalPush(...args),
}))

describe('QA · push allowlist (apps script contract)', () => {
  it('includes every app role including kameraman', () => {
    assertPushRoleAllowlistComplete()
    expect(WEBHOOK_PUSH_ROLES).toContain('kameraman')
    expect(WEBHOOK_PUSH_ROLES).toHaveLength(USER_ROLES.length)
  })

  it('keeps kameraman when roles=[kameraman,reporter] (shoot calendar regression)', () => {
    const resolved = normalizePushRoles(
      ['kameraman', 'reporter'],
      undefined,
      WEBHOOK_PUSH_ROLES,
    )
    expect(resolved).toEqual(['kameraman', 'reporter'])
  })

  it('does not expand to all roles when explicit roles are present even if audience is all', () => {
    const resolved = normalizePushRoles(
      ['management'],
      'all',
      WEBHOOK_PUSH_ROLES,
    )
    expect(resolved).toEqual(['management'])
    expect(resolved).not.toContain('media_planning')
  })

  it('drops unknown tags and keeps valid subset', () => {
    expect(
      normalizePushRoles(['management', 'admin', 'reporter'], null),
    ).toEqual(['management', 'reporter'])
  })

  it('Code.gs v23 uses Object.keys(ROLES_PUSH) for allowlist', () => {
    const gs = readFileSync(
      join(process.cwd(), 'scripts/sheets-webhook/Code.gs'),
      'utf8',
    )
    expect(gs).toMatch(/SCRIPT_VERSION\s*=\s*'v23'/)
    expect(gs).toMatch(/kameraman:\s*true/)
    expect(gs).toMatch(/ALL_PUSH_ROLES\s*=\s*Object\.keys\(ROLES_PUSH\)/)
    // Old hard-coded five-role list must not reappear as sole allowlist
    expect(gs).not.toMatch(
      /var ALL_PUSH_ROLES = \[\s*'management',\s*'coordinator',\s*'media_planning',\s*'reporter',\s*'human_resources',\s*\]/,
    )
  })
})

describe('QA · client push target resolution', () => {
  it('prefers roles over audience when both would otherwise conflict', () => {
    const t = resolveClientPushTarget({
      roles: ['management'],
      audience: 'all',
    })
    expect(t.mode).toBe('roles')
    expect(t.roles).toEqual(['management'])
    expect(t.audience).toBeUndefined()
  })

  it('uses externalIds exclusively and filters exclude list', () => {
    const t = resolveClientPushTarget({
      externalIds: ['u1', 'u2'],
      excludeExternalIds: ['u1'],
      roles: ['management'],
    })
    expect(t.mode).toBe('external')
    expect(t.externalIds).toEqual(['u2'])
  })

  it('no-ops when all externalIds are excluded', () => {
    const t = resolveClientPushTarget({
      externalIds: ['u1'],
      excludeExternalIds: ['u1'],
    })
    expect(t.externalIds).toEqual([])
  })
})

describe('QA · notify* audience safety (runtime)', () => {
  beforeEach(async () => {
    sendOneSignalPush.mockReset()
    const { addDoc } = await import('firebase/firestore')
    vi.mocked(addDoc).mockResolvedValue({ id: 'x' } as never)
  })

  it('never sends audience=all together with non-empty pushRoles', async () => {
    await notifyManagement({
      type: 'hr_report',
      title: 'İK',
      body: 'r',
      link: '/human-resources',
      createdByUid: 'hr',
      createdByNameSnapshot: 'İK',
      pushRoles: ['management'],
    })
    const call = sendOneSignalPush.mock.calls[0]?.[0] as {
      roles?: string[]
      audience?: string
    }
    expect(call.roles?.length).toBeGreaterThan(0)
    expect(call.audience).toBeUndefined()
  })

  it('excludes the actor from push when not notifyActor', async () => {
    await notifyManagement({
      type: 'daily_report',
      title: 'Rapor',
      body: 'x',
      link: '/management',
      createdByUid: 'rep-1',
      createdByNameSnapshot: 'Muhabir',
      pushRoles: ['management', 'coordinator'],
    })
    expect(sendOneSignalPush).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeExternalIds: ['rep-1'],
        roles: ['management', 'coordinator'],
      }),
    )
  })

  it('notifies actor for day region when notifyActor true', async () => {
    await notifyBroadcast({
      type: 'region_created',
      title: 'Bölge',
      body: 'x',
      link: '/media-planning',
      createdByUid: 'coord-1',
      createdByNameSnapshot: 'K',
      notifyActor: true,
      pushRoles: ['management', 'coordinator'],
    })
    const call = sendOneSignalPush.mock.calls[0]?.[0] as {
      excludeExternalIds?: string[]
    }
    expect(call.excludeExternalIds).toBeUndefined()
  })

  it('skips self on notifyUser', async () => {
    await notifyUser({
      recipientUid: 'same',
      type: 'job_rejected',
      title: 'x',
      body: '',
      link: '/media-planning',
      createdByUid: 'same',
      createdByNameSnapshot: 'A',
    })
    expect(sendOneSignalPush).not.toHaveBeenCalled()
  })
})

describe('QA · contract matrix · inbox visibility', () => {
  function note(
    type: AppNotification['type'],
    extra: Partial<AppNotification> = {},
  ): AppNotification {
    return {
      id: 'n',
      type,
      title: 't',
      body: 'b',
      link: '/management',
      createdAt: null,
      createdByUid: 'actor',
      readByUids: [],
      source: 'management',
      ...extra,
    }
  }

  for (const contract of NOTIFY_CONTRACTS) {
    it(`${contract.id}: hide rules match contract`, () => {
      for (const role of USER_ROLES) {
        const visible = isNotificationVisibleForRole(
          note(contract.type),
          role,
        )
        if (contract.hideInboxForRoles.includes(role)) {
          expect(visible, `${contract.id} should hide for ${role}`).toBe(false)
        }
      }
    })

    it(`${contract.id}: push never-list disjoint from push roles`, () => {
      if (contract.pushRoles === 'external_id' || contract.pushRoles === 'all') {
        return
      }
      for (const role of contract.neverPush) {
        expect(contract.pushRoles.includes(role)).toBe(false)
      }
      // Webhook would keep every push role (kameraman included)
      expect(
        normalizePushRoles(contract.pushRoles, undefined),
      ).toEqual(expect.arrayContaining(contract.pushRoles))
      expect(
        normalizePushRoles(contract.pushRoles, undefined).length,
      ).toBe(contract.pushRoles.length)
    })
  }

  it('management is sole role that sees hr_report / hiring_note in UI filter', () => {
    for (const type of ['hr_report', 'hiring_note'] as const) {
      for (const role of USER_ROLES) {
        expect(isNotificationVisibleForRole(note(type), role)).toBe(
          role === 'management',
        )
      }
    }
  })
})
