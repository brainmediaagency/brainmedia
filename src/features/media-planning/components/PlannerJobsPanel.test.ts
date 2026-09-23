import { describe, expect, it } from 'vitest'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  filterJobsByPeriod,
  jobPlannedDateOnly,
  plannerScoreFromJobs,
} from '@/features/media-planning/utils/plannerJobsPeriod'

function job(
  partial: Pick<JobDocument, 'id' | 'plannedExecutionDate'> &
    Partial<Pick<JobDocument, 'status'>>,
): JobDocument {
  return {
    companyName: 'Test',
    companyNameNormalized: 'test',
    contactPersonName: 'A',
    contactPhone: '+905551112233',
    contactCount: 1,
    contacts: [],
    province: 'İstanbul',
    district: 'Kadıköy',
    fullAddress: 'x',
    instagram: null,
    acquiredDate: '2026-09-01',
    agreedAmountKurus: 1000,
    currency: 'TRY',
    status: partial.status ?? 'approved',
    statusVersion: 1,
    createdByUid: 'u1',
    createdByNameSnapshot: 'MPU',
    createdByEmailSnapshot: 'm@brain.local',
    createdByRole: 'media_planning',
    createdAt: null,
    updatedAt: null,
    reviewedByUid: null,
    reviewedByNameSnapshot: null,
    reviewedAt: null,
    reviewNote: null,
    callOutcome: null,
    forwardedToReporter: false,
    forwardedToReporterByUid: null,
    forwardedToReporterByNameSnapshot: null,
    forwardedToReporterAt: null,
    dailyReportId: null,
    idempotencyKey: partial.id,
    ...partial,
  }
}

describe('filterJobsByPeriod', () => {
  const jobs = [
    job({ id: 'a', plannedExecutionDate: '2026-09-05T11:00' }),
    job({ id: 'b', plannedExecutionDate: '2026-09-22' }),
    job({ id: 'c', plannedExecutionDate: '2026-08-10T09:00' }),
  ]

  it('extracts planned date-only', () => {
    expect(jobPlannedDateOnly(jobs[0]!)).toBe('2026-09-05')
    expect(jobPlannedDateOnly(jobs[1]!)).toBe('2026-09-22')
  })

  it('filters by month', () => {
    expect(
      filterJobsByPeriod(jobs, 'month', '2026-09', '2026-09-01').map((j) => j.id),
    ).toEqual(['a', 'b'])
  })

  it('filters by day', () => {
    expect(
      filterJobsByPeriod(jobs, 'day', '2026-09', '2026-09-22').map((j) => j.id),
    ).toEqual(['b'])
  })

  it('all mode keeps every job', () => {
    expect(
      filterJobsByPeriod(jobs, 'all', '2026-09', '2026-09-01').map((j) => j.id),
    ).toEqual(['a', 'b', 'c'])
  })
})

describe('plannerScoreFromJobs', () => {
  it('matches iş kayıtları status basis (alınan = approved+shot+cancelled)', () => {
    const jobs = [
      job({ id: '1', plannedExecutionDate: '2026-09-01', status: 'approved' }),
      job({ id: '2', plannedExecutionDate: '2026-09-02', status: 'shot' }),
      job({ id: '3', plannedExecutionDate: '2026-09-03', status: 'shot' }),
      job({ id: '4', plannedExecutionDate: '2026-09-04', status: 'cancelled' }),
      job({ id: '5', plannedExecutionDate: '2026-09-05', status: 'pending' }),
      job({ id: '6', plannedExecutionDate: '2026-09-06', status: 'rejected' }),
    ]
    expect(plannerScoreFromJobs(jobs)).toEqual({
      jobsReceived: 4,
      jobsShot: 2,
      jobsCancelled: 1,
    })
  })
})
