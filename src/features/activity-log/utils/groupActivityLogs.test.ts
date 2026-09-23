import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import type { ActivityLog } from '@/features/activity-log/types/activityLog'
import {
  groupActivityLogsByDay,
  groupActivityLogsByJob,
} from '@/features/activity-log/utils/groupActivityLogs'

function log(
  overrides: Partial<ActivityLog> & Pick<ActivityLog, 'id' | 'createdAt'>,
): ActivityLog {
  return {
    actorUid: 'u1',
    actorNameSnapshot: 'Ali',
    actorRole: 'media_planning',
    category: 'job',
    action: 'job.created',
    title: 'İş oluşturuldu',
    summary: 'Payidar',
    jobId: null,
    jobCompanyName: null,
    entityType: 'job',
    entityId: null,
    ...overrides,
  }
}

describe('groupActivityLogsByDay', () => {
  it('splits logs onto Istanbul calendar days', () => {
    const a = log({
      id: '1',
      createdAt: Timestamp.fromDate(new Date('2026-08-20T10:00:00+03:00')),
    })
    const b = log({
      id: '2',
      createdAt: Timestamp.fromDate(new Date('2026-08-20T22:00:00+03:00')),
    })
    const c = log({
      id: '3',
      createdAt: Timestamp.fromDate(new Date('2026-08-19T23:30:00+03:00')),
    })

    const groups = groupActivityLogsByDay([a, b, c])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.label).toBe('20.08.2026')
    expect(groups[0]?.logs.map((item) => item.id)).toEqual(['1', '2'])
    expect(groups[1]?.label).toBe('19.08.2026')
  })
})

describe('groupActivityLogsByJob', () => {
  it('groups by jobId and keeps rows without a job ungrouped', () => {
    const first = log({
      id: 'a',
      jobId: 'job-1',
      jobCompanyName: 'Payidar Hurma',
      action: 'job.approved',
      title: 'İş konfirme edildi',
      createdAt: Timestamp.fromMillis(2000),
    })
    const second = log({
      id: 'b',
      jobId: 'job-1',
      jobCompanyName: 'Payidar Hurma',
      action: 'job.created',
      createdAt: Timestamp.fromMillis(1000),
    })
    const other = log({
      id: 'c',
      jobId: 'job-2',
      jobCompanyName: 'Diğer',
      createdAt: Timestamp.fromMillis(1500),
    })
    const loose = log({
      id: 'd',
      jobId: null,
      createdAt: Timestamp.fromMillis(3000),
    })

    const { groups, ungrouped } = groupActivityLogsByJob([
      first,
      other,
      second,
      loose,
    ])

    expect(ungrouped.map((item) => item.id)).toEqual(['d'])
    expect(groups.map((g) => g.jobId)).toEqual(['job-1', 'job-2'])
    expect(groups[0]?.companyName).toBe('Payidar Hurma')
    expect(groups[0]?.events.map((item) => item.id)).toEqual(['a', 'b'])
  })
})
