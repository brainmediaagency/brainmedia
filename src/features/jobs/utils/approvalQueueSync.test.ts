import { describe, expect, it } from 'vitest'
import type { JobDocument } from '@/features/jobs/types/job'
import type { JobStatus } from '@/config/roles'
import {
  syncJobIntoQueues,
  upsertFront,
  withoutJob,
  type ApprovalQueueBuckets,
} from '@/features/jobs/utils/approvalQueueSync'

function job(id: string, status: JobStatus, companyName = id): JobDocument {
  return {
    id,
    companyName,
    status,
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

describe('syncJobIntoQueues', () => {
  it('moves pending → approved on approve', () => {
    const pendingJob = job('j1', 'pending')
    const next = syncJobIntoQueues(
      buckets([pendingJob], [job('other', 'approved')]),
      job('j1', 'approved', 'Acme'),
    )
    expect(next.pending.map((j) => j.id)).toEqual([])
    expect(next.approved.map((j) => j.id)).toEqual(['j1', 'other'])
    expect(next.approved[0]?.companyName).toBe('Acme')
    expect(next.rejected).toEqual([])
  })

  it('moves pending → rejected on reject', () => {
    const pendingJob = job('j1', 'pending')
    const next = syncJobIntoQueues(buckets([pendingJob]), job('j1', 'rejected'))
    expect(next.pending).toEqual([])
    expect(next.approved).toEqual([])
    expect(next.rejected.map((j) => j.id)).toEqual(['j1'])
  })

  it('moves approved → pending on revert', () => {
    const approvedJob = job('j1', 'approved')
    const next = syncJobIntoQueues(
      buckets([], [approvedJob]),
      job('j1', 'pending'),
    )
    expect(next.pending.map((j) => j.id)).toEqual(['j1'])
    expect(next.approved).toEqual([])
  })

  it('keeps shot / cancelled in approved queue (çekim durumu)', () => {
    for (const status of ['shot', 'cancelled'] as const) {
      const next = syncJobIntoQueues(
        buckets([job('j1', 'pending')]),
        job('j1', status),
      )
      expect(next.pending).toEqual([])
      expect(next.approved.map((j) => j.id)).toEqual(['j1'])
      expect(next.rejected).toEqual([])
    }
  })

  it('updates in-place fields without leaving other queues stale', () => {
    const stale = job('j1', 'approved', 'Old Name')
    const fresh = job('j1', 'approved', 'New Name')
    const next = syncJobIntoQueues(
      buckets([job('p', 'pending')], [stale], [job('r', 'rejected')]),
      fresh,
    )
    expect(next.approved[0]?.companyName).toBe('New Name')
    expect(next.pending.map((j) => j.id)).toEqual(['p'])
    expect(next.rejected.map((j) => j.id)).toEqual(['r'])
    expect(next.approved).toHaveLength(1)
  })

  it('removes job from all queues for unknown status', () => {
    const weird = { ...job('j1', 'pending'), status: 'deleted' as JobStatus }
    const next = syncJobIntoQueues(
      buckets([job('j1', 'pending')], [job('j1', 'approved')], [job('j1', 'rejected')]),
      weird,
    )
    expect(next.pending).toEqual([])
    expect(next.approved).toEqual([])
    expect(next.rejected).toEqual([])
  })

  it('inserts brand-new approved job at front of approved queue', () => {
    const next = syncJobIntoQueues(
      buckets([], [job('older', 'approved')]),
      job('newer', 'approved'),
    )
    expect(next.approved.map((j) => j.id)).toEqual(['newer', 'older'])
  })
})
