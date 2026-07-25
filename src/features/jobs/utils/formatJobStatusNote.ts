import type { JobStatus } from '@/config/roles'
import type { JobDocument } from '@/features/jobs/types/job'

/** Status-aware label for the shared `reviewNote` field. */
export function formatJobStatusNoteLabel(status: JobStatus): string {
  if (status === 'cancelled') return 'İptal Nedeni'
  if (status === 'rejected') return 'Red Nedeni'
  return 'İnceleme Notu'
}

/**
 * Display text for cancel/reject explanations (and optional review notes).
 * For cancelled/rejected, always returns a string so MPU can see whether a
 * reason was recorded.
 */
export function formatJobStatusNote(
  job: Pick<JobDocument, 'status' | 'reviewNote'>,
): string | null {
  const note = job.reviewNote?.trim() || null
  if (job.status === 'cancelled' || job.status === 'rejected') {
    return note ?? 'Açıklama belirtilmedi'
  }
  return note
}

export function shouldHighlightJobStatusNote(status: JobStatus): boolean {
  return status === 'cancelled' || status === 'rejected'
}
