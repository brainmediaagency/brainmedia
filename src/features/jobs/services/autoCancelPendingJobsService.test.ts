import { describe, expect, it } from 'vitest'
import {
  isStalePendingJob,
  STALE_PENDING_AFTER_MS,
} from '@/features/jobs/services/autoCancelPendingJobsService'

describe('isStalePendingJob', () => {
  const now = Date.parse('2026-07-25T12:00:00+03:00')

  it('is false when createdAt is missing', () => {
    expect(isStalePendingJob(null, now)).toBe(false)
    expect(isStalePendingJob(undefined, now)).toBe(false)
  })

  it('is false under 48 hours', () => {
    expect(isStalePendingJob(now - STALE_PENDING_AFTER_MS + 1, now)).toBe(false)
  })

  it('is true at exactly 48 hours', () => {
    expect(isStalePendingJob(now - STALE_PENDING_AFTER_MS, now)).toBe(true)
  })

  it('is true after 48 hours', () => {
    expect(isStalePendingJob(now - STALE_PENDING_AFTER_MS - 60_000, now)).toBe(
      true,
    )
  })
})
