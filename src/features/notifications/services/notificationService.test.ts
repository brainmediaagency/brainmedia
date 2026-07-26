import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AppNotification } from '@/features/notifications/types'
import {
  isOwnActionNotification,
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

describe('notifyUser', () => {
  beforeEach(() => {
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
