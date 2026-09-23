import type { JobDocument } from '@/features/jobs/types/job'
import { dateToDateOnlyIstanbul, todayDateOnlyIstanbul } from '@/lib/date'

export type ApprovalQueueBuckets = {
  pending: JobDocument[]
  /** Bugün konfirme edilen (`reviewedAt` günü = bugün) approved işler. */
  approved: JobDocument[]
  rejected: JobDocument[]
}

export function withoutJob(jobs: JobDocument[], jobId: string): JobDocument[] {
  return jobs.filter((j) => j.id !== jobId)
}

export function upsertFront(jobs: JobDocument[], job: JobDocument): JobDocument[] {
  return [job, ...withoutJob(jobs, job.id)]
}

/** Red / inceleme anı (ms); yoksa updatedAt / createdAt. */
export function jobDecisionTimeMs(job: JobDocument): number {
  return (
    job.reviewedAt?.toMillis?.() ??
    job.updatedAt?.toMillis?.() ??
    job.createdAt?.toMillis?.() ??
    0
  )
}

/** Reddedilen işler: en yeni red en üstte. */
export function sortJobsByDecisionTimeDesc(
  jobs: readonly JobDocument[],
): JobDocument[] {
  return [...jobs].sort((a, b) => jobDecisionTimeMs(b) - jobDecisionTimeMs(a))
}

/**
 * Konfirme İşler: status approved ve konfirme anı (`reviewedAt`) seçilen günde.
 * Planlanan çekim günü dikkate alınmaz.
 */
export function isApprovedReviewedOnDay(
  job: Pick<JobDocument, 'status' | 'reviewedAt'>,
  day: string = todayDateOnlyIstanbul(),
): boolean {
  if (job.status !== 'approved') return false
  if (!job.reviewedAt) return false
  return dateToDateOnlyIstanbul(job.reviewedAt.toDate()) === day
}

/**
 * Route a fresh job into the Konfirme / pending / rejected queues.
 * Shot / cancelled leave the konfirme list. Approved jobs only stay if
 * they were confirmed on `day` (default: today).
 */
export function syncJobIntoQueues(
  queues: ApprovalQueueBuckets,
  job: JobDocument,
  day: string = todayDateOnlyIstanbul(),
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

  if (job.status === 'approved') {
    return {
      pending: withoutJob(queues.pending, id),
      approved: isApprovedReviewedOnDay(job, day)
        ? upsertFront(queues.approved, job)
        : withoutJob(queues.approved, id),
      rejected: withoutJob(queues.rejected, id),
    }
  }

  return {
    pending: withoutJob(queues.pending, id),
    approved: withoutJob(queues.approved, id),
    rejected: withoutJob(queues.rejected, id),
  }
}
