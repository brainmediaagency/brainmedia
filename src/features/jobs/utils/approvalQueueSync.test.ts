import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import type { JobDocument } from '@/features/jobs/types/job'
import type { JobStatus } from '@/config/roles'
import {
  isApprovedReviewedOnDay,
  sortJobsByDecisionTimeDesc,
  syncJobIntoQueues,
  upsertFront,
  withoutJob,
  type ApprovalQueueBuckets,
} from '@/features/jobs/utils/approvalQueueSync'

const TODAY = '2026-09-22'
const OTHER_DAY = '2026-09-21'

function reviewedAtForDay(day: string): Timestamp {
  // Midday UTC ≈ afternoon TR; dateToDateOnlyIstanbul maps correctly for these fixtures.
  return Timestamp.fromDate(new Date(`${day}T12:00:00+03:00`))
}

function job(
  id: string,
  status: JobStatus,
  companyName = id,
  reviewedDay: string | null = TODAY,
): JobDocument {
  return {
    id,
    companyName,
    status,
    reviewedAt: reviewedDay ? reviewedAtForDay(reviewedDay) : null,
  } as JobDocument
}

function buckets(
  pending: JobDocument[] = [],
  approved: JobDocument[] = [],
  rejected: JobDocument[] = [],
): ApprovalQueueBuckets {
  return { pending, approved, rejected }
}

describe('withoutJob / upsertFront', () => {
  it('removes by id', () => {
    const a = job('a', 'pending')
    const b = job('b', 'pending')
    expect(withoutJob([a, b], 'a').map((j) => j.id)).toEqual(['b'])
  })

  it('upserts to front and replaces existing', () => {
    const old = job('a', 'pending', 'Old')
    const next = job('a', 'pending', 'New')
    const other = job('b', 'pending')
    const result = upsertFront([old, other], next)
    expect(result.map((j) => j.companyName)).toEqual(['New', 'b'])
  })
})

describe('isApprovedReviewedOnDay', () => {
  it('matches approved jobs confirmed on that day', () => {
    expect(isApprovedReviewedOnDay(job('a', 'approved', 'a', TODAY), TODAY)).toBe(
      true,
    )
  })

  it('rejects other-day confirmations, missing reviewedAt, and non-approved', () => {
    expect(
      isApprovedReviewedOnDay(job('a', 'approved', 'a', OTHER_DAY), TODAY),
    ).toBe(false)
    expect(isApprovedReviewedOnDay(job('a', 'approved', 'a', null), TODAY)).toBe(
      false,
    )
    expect(isApprovedReviewedOnDay(job('a', 'pending', 'a', TODAY), TODAY)).toBe(
      false,
    )
  })
})

describe('sortJobsByDecisionTimeDesc', () => {
  it('orders by reviewedAt newest first', () => {
    const older = job('old', 'rejected', 'old', OTHER_DAY)
    const newer = job('new', 'rejected', 'new', TODAY)
    expect(sortJobsByDecisionTimeDesc([older, newer]).map((j) => j.id)).toEqual([
      'new',
      'old',
    ])
  })
})

describe('syncJobIntoQueues', () => {
  it('moves pending → approved when confirmed today', () => {
    const pendingJob = job('j1', 'pending')
    const next = syncJobIntoQueues(
      buckets([pendingJob], [job('other', 'approved')]),
      job('j1', 'approved', 'Acme', TODAY),
      TODAY,
    )
    expect(next.pending.map((j) => j.id)).toEqual([])
    expect(next.approved.map((j) => j.id)).toEqual(['j1', 'other'])
    expect(next.approved[0]?.companyName).toBe('Acme')
  })

  it('does not insert jobs confirmed on another day into konfirme', () => {
    const pendingJob = job('j1', 'pending')
    const next = syncJobIntoQueues(
      buckets([pendingJob], [job('today', 'approved')]),
      job('j1', 'approved', 'Yesterday', OTHER_DAY),
      TODAY,
    )
    expect(next.pending).toEqual([])
    expect(next.approved.map((j) => j.id)).toEqual(['today'])
  })

  it('moves pending → rejected on reject', () => {
    const next = syncJobIntoQueues(
      buckets([job('j1', 'pending')]),
      job('j1', 'rejected'),
      TODAY,
    )
    expect(next.pending).toEqual([])
    expect(next.approved).toEqual([])
    expect(next.rejected.map((j) => j.id)).toEqual(['j1'])
  })

  it('removes shot / cancelled from approved queue', () => {
    for (const status of ['shot', 'cancelled'] as const) {
      const next = syncJobIntoQueues(
        buckets([], [job('j1', 'approved')]),
        job('j1', status),
        TODAY,
      )
      expect(next.approved).toEqual([])
    }
  })

  it('inserts brand-new today-confirmed job at front', () => {
    const next = syncJobIntoQueues(
      buckets([], [job('older', 'approved')]),
      job('newer', 'approved'),
      TODAY,
    )
    expect(next.approved.map((j) => j.id)).toEqual(['newer', 'older'])
  })
})
