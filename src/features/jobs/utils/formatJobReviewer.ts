import { ROLE_DISPLAY_NAMES, type UserRole } from '@/config/roles'
import type { JobDocument } from '@/features/jobs/types/job'

/**
 * Reviewer label for job lists / detail drawers.
 * Media planning specialists always see "Yönetim" (never the real
 * coordinator/management name). Other roles see the stored name.
 */
export function formatJobReviewer(
  job: Pick<JobDocument, 'reviewedByNameSnapshot'>,
  viewerRole: UserRole | null | undefined,
  empty = '—',
): string {
  const name = job.reviewedByNameSnapshot?.trim()
  if (!name) return empty
  if (viewerRole === 'media_planning') {
    return ROLE_DISPLAY_NAMES.management
  }
  return name
}
