import type { JobDocument } from '@/features/jobs/types/job'

export type ApprovalQueueBuckets = {
  pending: JobDocument[]
  approved: JobDocument[]
  rejected: JobDocument[]
}

export function withoutJob(jobs: JobDocument[], jobId: string): JobDocument[] {
  return jobs.filter((j) => j.id !== jobId)
}

export function upsertFront(jobs: JobDocument[], job: JobDocument): JobDocument[] {
  return [job, ...withoutJob(jobs, job.id)]
}

/**
 * Route a fresh job into the correct one-shot queue after any mutation
 * (approve / reject / revert / forward / shot / cancel / field edit).
 */
export function syncJobIntoQueues(
  queues: ApprovalQueueBuckets,
  job: JobDocument,
): ApprovalQueueBuckets {
  const id = job.id

  if (job.status === 'pending') {
    return {
      pending: upsertFront(queues.pending, job),
      approved: withoutJob(queues.approved, id),
      rejected: withoutJob(queues.rejected, id),
    }
  }

  if (job.status === 'rejected') {
    return {
      pending: withoutJob(queues.pending, id),
      approved: withoutJob(queues.approved, id),
      rejected: upsertFront(queues.rejected, job),
    }
  }

  if (
    job.status === 'approved' ||
    job.status === 'shot' ||
    job.status === 'cancelled'
  ) {
    return {
      pending: withoutJob(queues.pending, id),
      approved: upsertFront(queues.approved, job),
      rejected: withoutJob(queues.rejected, id),
    }
  }

  return {
    pending: withoutJob(queues.pending, id),
    approved: withoutJob(queues.approved, id),
    rejected: withoutJob(queues.rejected, id),
  }
}
