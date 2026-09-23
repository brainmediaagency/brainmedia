import { describe, expect, it } from 'vitest'
import {
  aggregateJobCountsByMpu,
  aggregateReportFeesByMpu,
  buildEmployeeRows,
  companyNewsIncomeKurus,
  emptyEmployeeRow,
  indexReportFeesByJobId,
} from '@/features/media-planning/services/mediaPlannerEmployeesService'
import type { UserProfile } from '@/features/users/types/user'
import { Timestamp } from 'firebase/firestore'

function planner(
  partial: Partial<UserProfile> & Pick<UserProfile, 'uid' | 'fullName'>,
): UserProfile {
  return {
    uid: partial.uid,
    fullName: partial.fullName,
    email: partial.email ?? `${partial.uid}@brain.com`,
    role: 'media_planning',
    isActive: partial.isActive ?? true,
    deletedAt: partial.deletedAt ?? null,
    shiftDurationMinutes: null,
    shootReporterRate: null,
    timezone: 'Europe/Istanbul',
    stats: partial.stats ?? {
      jobsReceived: 0,
      jobsShot: 0,
      jobsCancelled: 0,
    },
    createdAt: Timestamp.fromMillis(0),
    updatedAt: Timestamp.fromMillis(0),
  }
}

describe('mediaPlannerEmployeesService', () => {
  it('indexes latest non-cancelled fees; cancelled rows never lock', () => {
    const map = indexReportFeesByJobId([
      {
        companies: [
          {
            jobId: 'j1',
            cancelled: true,
            shootMinutes: 99,
            hasNews: true,
            newsTotalKurus: 50_000,
          } as never,
          {
            jobId: 'j2',
            cancelled: false,
            shootMinutes: 12,
            hasNews: true,
            newsTotalKurus: 15_000,
          } as never,
        ],
      },
      {
        companies: [
          {
            jobId: 'j1',
            cancelled: false,
            shootMinutes: 40,
            hasNews: true,
            newsTotalKurus: 99_000,
          } as never,
          {
            jobId: 'j2',
            cancelled: false,
            shootMinutes: 5,
            hasNews: false,
            newsTotalKurus: null,
          } as never,
        ],
      },
    ])

    expect(map.get('j1')).toEqual({ shootMinutes: 40, newsIncomeKurus: 99_000 })
    expect(map.get('j2')).toEqual({ shootMinutes: 5, newsIncomeKurus: 0 })
    expect(map.has('j3')).toBe(false)
  })

  it('omits jobIds that only appear as cancelled', () => {
    const map = indexReportFeesByJobId([
      {
        companies: [
          {
            jobId: 'only-cancel',
            cancelled: true,
            shootMinutes: 10,
            hasNews: true,
            newsTotalKurus: 1000,
          } as never,
        ],
      },
    ])
    expect(map.has('only-cancel')).toBe(false)
  })

  it('companyNewsIncomeKurus requires hasNews and non-cancelled', () => {
    expect(
      companyNewsIncomeKurus({
        cancelled: false,
        hasNews: true,
        newsTotalKurus: 2500,
      }),
    ).toBe(2500)
    expect(
      companyNewsIncomeKurus({
        cancelled: false,
        hasNews: false,
        newsTotalKurus: 2500,
      }),
    ).toBe(0)
  })

  it('aggregates job status counts by MPU from live jobs; rejects excluded', () => {
    const counts = aggregateJobCountsByMpu([
      { createdByUid: 'a', status: 'approved' },
      { createdByUid: 'a', status: 'shot' },
      { createdByUid: 'a', status: 'shot' },
      { createdByUid: 'a', status: 'cancelled' },
      { createdByUid: 'b', status: 'shot' },
      { createdByUid: 'b', status: 'pending' },
      { createdByUid: 'b', status: 'rejected' },
    ])

    expect(counts.get('a')).toEqual({
      confirmedCount: 4,
      shotCount: 2,
      cancelledCount: 1,
    })
    expect(counts.get('b')).toEqual({
      confirmedCount: 1,
      shotCount: 1,
      cancelledCount: 0,
    })
  })

  it('aggregates minutes and news income by MPU uid', () => {
    const fees = new Map([
      ['j1', { shootMinutes: 10, newsIncomeKurus: 1000 }],
      ['j2', { shootMinutes: 5, newsIncomeKurus: 0 }],
      ['j3', { shootMinutes: 0, newsIncomeKurus: 4000 }],
    ])
    const byMpu = aggregateReportFeesByMpu(fees, [
      { id: 'j1', createdByUid: 'mpu-a' },
      { id: 'j2', createdByUid: 'mpu-a' },
      { id: 'j3', createdByUid: 'mpu-b' },
    ])

    expect(byMpu.get('mpu-a')).toEqual({ shootMinutes: 15, newsIncomeKurus: 1000 })
    expect(byMpu.get('mpu-b')).toEqual({ shootMinutes: 0, newsIncomeKurus: 4000 })
  })

  it('builds rows from live job counts; soft-deleted after frozen; orphans kept', () => {
    const rows = buildEmployeeRows(
      [
        planner({ uid: 'a', fullName: 'Ayşe' }),
        planner({
          uid: 'b',
          fullName: 'Berk',
          isActive: false,
          deletedAt: Timestamp.fromMillis(1),
        }),
        planner({ uid: 'c', fullName: 'Cem' }),
      ],
      new Map([
        ['b', { shootMinutes: 42, newsIncomeKurus: 12_000 }],
        ['c', { shootMinutes: 3, newsIncomeKurus: 500 }],
        ['orphan', { shootMinutes: 7, newsIncomeKurus: 100 }],
      ]),
      new Map([
        ['a', { confirmedCount: 2, shotCount: 1, cancelledCount: 0 }],
        ['b', { confirmedCount: 5, shotCount: 3, cancelledCount: 1 }],
        ['c', { confirmedCount: 8, shotCount: 4, cancelledCount: 0 }],
        ['orphan', { confirmedCount: 1, shotCount: 1, cancelledCount: 0 }],
      ]),
      new Map([
        ['orphan', { fullName: 'Eski MPU', email: 'eski@brain.com' }],
      ]),
    )

    // Aktif A→Z (Ayşe, Cem), sonra silinenler A→Z (Berk, Eski MPU)
    expect(rows.map((r) => r.uid)).toEqual(['a', 'c', 'b', 'orphan'])
    expect(rows[0]).toMatchObject({
      uid: 'a',
      fullName: 'Ayşe',
      confirmedCount: 2,
      shotCount: 1,
      isActive: true,
      isDeleted: false,
    })
    expect(rows[1]).toMatchObject({
      uid: 'c',
      fullName: 'Cem',
      confirmedCount: 8,
      isActive: true,
      isDeleted: false,
    })
    expect(rows.find((r) => r.uid === 'b')).toMatchObject({
      isActive: false,
      isDeleted: true,
    })
    expect(rows.find((r) => r.uid === 'orphan')).toMatchObject({
      fullName: 'Eski MPU',
      email: 'eski@brain.com',
      isDeleted: true,
      isActive: false,
      confirmedCount: 1,
      totalShootMinutes: 7,
    })
    expect(emptyEmployeeRow(planner({ uid: 'x', fullName: 'X' })).shotCount).toBe(0)
  })
})
