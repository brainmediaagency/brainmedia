import type { JobStatus } from '@/config/roles'

export function getStatsDelta(
  from: JobStatus,
  to: JobStatus,
): { jobsReceived: number; jobsShot: number; jobsCancelled: number } {
  if (from === 'pending' && to === 'approved') {
    return { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 }
  }
  if (from === 'approved' && to === 'pending') {
    return { jobsReceived: -1, jobsShot: 0, jobsCancelled: 0 }
  }
  if (from === 'approved' && to === 'shot') {
    return { jobsReceived: 0, jobsShot: 1, jobsCancelled: 0 }
  }
  if (from === 'approved' && to === 'cancelled') {
    return { jobsReceived: 0, jobsShot: 0, jobsCancelled: 1 }
  }
  if (from === 'pending' && to === 'cancelled') {
    return { jobsReceived: 0, jobsShot: 0, jobsCancelled: 1 }
  }
  return { jobsReceived: 0, jobsShot: 0, jobsCancelled: 0 }
}

export function isAllowedTransition(
  from: JobStatus,
  to: JobStatus,
): boolean {
  const allowed: Array<[JobStatus, JobStatus]> = [
    ['pending', 'approved'],
    ['pending', 'rejected'],
    ['pending', 'cancelled'],
    ['approved', 'pending'],
    ['approved', 'shot'],
    ['approved', 'cancelled'],
  ]
  return allowed.some(([f, t]) => f === from && t === to)
}

export function normalizeCompanyName(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR')
}
