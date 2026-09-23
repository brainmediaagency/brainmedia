import { describe, expect, it } from 'vitest'
import {
  buildActivityLogFields,
  isTransientFirestoreListenError,
  resolveActivityLogRole,
} from '@/features/activity-log/services/activityLogService'

describe('buildActivityLogFields', () => {
  it('writes the rules-shaped keys and nulls empty optionals', () => {
    const fields = buildActivityLogFields({
      actor: {
        uid: ' media1 ',
        fullName: '  Ali Veli  ',
        role: 'media_planning',
      },
      category: 'job',
      action: 'job.created',
      summary: ' Payidar ',
      jobId: '',
      jobCompanyName: '  ',
      entityType: 'job',
      entityId: 'abc',
    })

    expect(Object.keys(fields).sort()).toEqual(
      [
        'action',
        'actorNameSnapshot',
        'actorRole',
        'actorUid',
        'category',
        'entityId',
        'entityType',
        'jobCompanyName',
        'jobId',
        'summary',
        'title',
      ].sort(),
    )
    expect(fields.actorUid).toBe('media1')
    expect(fields.actorNameSnapshot).toBe('Ali Veli')
    expect(fields.title).toBe('İş oluşturuldu')
    expect(fields.summary).toBe('Payidar')
    expect(fields.jobId).toBeNull()
    expect(fields.jobCompanyName).toBeNull()
    expect(fields.entityType).toBe('job')
    expect(fields.entityId).toBe('abc')
  })
})

describe('isTransientFirestoreListenError', () => {
  it('treats aborted/cancelled listen codes as transient', () => {
    expect(
      isTransientFirestoreListenError({ code: 'aborted', message: '409' }),
    ).toBe(true)
    expect(
      isTransientFirestoreListenError({ code: 'firestore/cancelled' }),
    ).toBe(true)
    expect(
      isTransientFirestoreListenError({ code: 'permission-denied' }),
    ).toBe(false)
  })
})

describe('resolveActivityLogRole', () => {
  it('prefers profile role over claims so Firestore rules match', () => {
    expect(resolveActivityLogRole('kameraman', 'management')).toBe('kameraman')
    expect(resolveActivityLogRole(undefined, 'kameraman')).toBe('kameraman')
    expect(resolveActivityLogRole('nope', 'nope')).toBeNull()
  })
})
