import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AppNotification } from '@/features/notifications/types'
import {
  isNotificationVisibleForRole,
  isOwnActionNotification,
  notifyBroadcast,
  notifyManagement,
  notifyUser,
} from '@/features/notifications/services/notificationService'

vi.mock('@/lib/firebase/firestore', () => ({
  getDb: vi.fn(() => ({})),
}))

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
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

function item(createdByUid: string): AppNotification {
  return {
    id: 'n1',
    type: 'job_created',
    title: 't',
    body: 'b',
    link: '/management',
    createdAt: null,
    createdByUid,
    readByUids: [],
    source: 'management',
  }
}

describe('isOwnActionNotification', () => {
  it('hides inbox rows created by the viewing user', () => {
    expect(isOwnActionNotification(item('uid-1'), 'uid-1')).toBe(true)
    expect(isOwnActionNotification(item('uid-1'), 'uid-2')).toBe(false)
    expect(isOwnActionNotification(item('uid-1'), '')).toBe(false)
  })

  it('keeps day-start region broadcasts visible to the triggering admin', () => {
    const regionItem = { ...item('uid-1'), type: 'region_created' as const }
    expect(isOwnActionNotification(regionItem, 'uid-1')).toBe(false)
  })
})

describe('isNotificationVisibleForRole', () => {
  const regionItem = { ...item('uid-1'), type: 'region_created' as const }

  it('hides günün bölgesi from reporters', () => {
    expect(isNotificationVisibleForRole(regionItem, 'reporter')).toBe(false)
  })

  it('hides all inbox noise from kameraman', () => {
    expect(isNotificationVisibleForRole(regionItem, 'kameraman')).toBe(false)
    expect(isNotificationVisibleForRole(item('uid-1'), 'kameraman')).toBe(false)
  })

  it('keeps günün bölgesi for the other roles', () => {
    for (const role of [
      'management',
      'coordinator',
      'media_planning',
      'human_resources',
    ] as const) {
      expect(isNotificationVisibleForRole(regionItem, role)).toBe(true)
    }
  })

  it('keeps unrelated types for reporters', () => {
    expect(isNotificationVisibleForRole(item('uid-1'), 'reporter')).toBe(true)
  })
})

describe('push role targeting', () => {
  beforeEach(async () => {
    const { addDoc } = await import('firebase/firestore')
    vi.mocked(addDoc).mockResolvedValue({ id: 'x' } as never)
    sendOneSignalPush.mockReset()
  })

  it('keeps İK reports to management only', async () => {
    await notifyManagement({
      type: 'hr_report',
      title: 'Yeni İK raporu',
      body: 'rapor',
      link: '/human-resources?tab=reports',
      createdByUid: 'hr-1',
      createdByNameSnapshot: 'İK',
      pushRoles: ['management'],
    })

    expect(sendOneSignalPush).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ['management'],
      }),
    )
  })

  it('keeps günün bölgesi push away from reporters', async () => {
    await notifyBroadcast({
      type: 'region_created',
      title: 'Günün bölgesi',
      body: 'bölge',
      link: '/media-planning',
      createdByUid: 'coord-1',
      createdByNameSnapshot: 'Koordinatör',
      notifyActor: true,
      pushRoles: [
        'management',
        'coordinator',
        'media_planning',
        'human_resources',
      ],
    })

    const call = sendOneSignalPush.mock.calls[0]?.[0] as { roles?: string[] }
    expect(call.roles).not.toContain('reporter')
  })

  it('still targets every role when pushRoles is omitted', async () => {
    await notifyManagement({
      type: 'job_created',
      title: 'Yeni iş',
      body: 'iş',
      link: '/management',
      createdByUid: 'mpu-1',
      createdByNameSnapshot: 'MPU',
    })

    expect(sendOneSignalPush).toHaveBeenCalledWith(
      expect.objectContaining({ roles: undefined, audience: 'all' }),
    )
  })
})

describe('notifyUser', () => {
  beforeEach(async () => {
    const { addDoc } = await import('firebase/firestore')
    vi.mocked(addDoc).mockReset()
    sendOneSignalPush.mockReset()
  })

  it('skips self notifications (no inbox, no push)', async () => {
    const { addDoc } = await import('firebase/firestore')
    await notifyUser({
      recipientUid: 'same',
      type: 'job_approved',
      title: 'Onay',
      body: 'İşin onaylandı',
      link: '/media-planning',
      createdByUid: 'same',
      createdByNameSnapshot: 'Ali',
    })
    expect(addDoc).not.toHaveBeenCalled()
    expect(sendOneSignalPush).not.toHaveBeenCalled()
  })

  it('notifies a different recipient', async () => {
    const { addDoc } = await import('firebase/firestore')
    vi.mocked(addDoc).mockResolvedValueOnce({ id: 'x' } as never)

    await notifyUser({
      recipientUid: 'reporter-1',
      type: 'job_approved',
      title: 'Onay',
      body: 'İşin onaylandı',
      link: '/media-planning',
      createdByUid: 'manager-1',
      createdByNameSnapshot: 'Yönetim',
    })

    expect(addDoc).toHaveBeenCalled()
    expect(sendOneSignalPush).toHaveBeenCalledWith(
      expect.objectContaining({
        externalIds: ['reporter-1'],
        title: 'Onay',
      }),
    )
  })
})
