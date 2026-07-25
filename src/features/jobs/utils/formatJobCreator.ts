import type { JobDocument } from '@/features/jobs/types/job'

/** Display the actual submitting user (name + email), never a role label. */
export function formatJobCreator(job: Pick<JobDocument, 'createdByNameSnapshot' | 'createdByEmailSnapshot'>): string {
  const name = job.createdByNameSnapshot.trim()
  const email = job.createdByEmailSnapshot.trim()
  if (name && email) return `${name} (${email})`
  if (name) return name
  if (email) return email
  return 'Bilinmeyen kullanıcı'
}

export function formatJobCreatorPrimary(
  job: Pick<JobDocument, 'createdByNameSnapshot' | 'createdByEmailSnapshot'>,
): string {
  return job.createdByNameSnapshot.trim() || job.createdByEmailSnapshot.trim() || 'Bilinmeyen kullanıcı'
}

export function formatJobCreatorSecondary(
  job: Pick<JobDocument, 'createdByNameSnapshot' | 'createdByEmailSnapshot'>,
): string | null {
  const email = job.createdByEmailSnapshot.trim()
  if (!email) return null
  if (job.createdByNameSnapshot.trim() === email) return null
  return email
}
