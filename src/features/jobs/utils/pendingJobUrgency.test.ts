import { describe, expect, it } from 'vitest'
import { pendingJobUrgency } from '@/features/jobs/utils/pendingJobUrgency'

describe('pendingJobUrgency', () => {
  const today = '2026-09-23'

  it('flags past days as overdue', () => {
    expect(pendingJobUrgency('2026-09-22', today)).toBe('overdue')
  })

  it('flags today, including datetime values', () => {
    expect(pendingJobUrgency('2026-09-23', today)).toBe('today')
    expect(pendingJobUrgency('2026-09-23T14:00', today)).toBe('today')
  })

  it('flags tomorrow across month boundaries', () => {
    expect(pendingJobUrgency('2026-09-24', today)).toBe('tomorrow')
    expect(pendingJobUrgency('2026-10-01', '2026-09-30')).toBe('tomorrow')
  })

  it('returns null for later or invalid dates', () => {
    expect(pendingJobUrgency('2026-09-25', today)).toBeNull()
    expect(pendingJobUrgency('', today)).toBeNull()
    expect(pendingJobUrgency('bad', today)).toBeNull()
  })
})
