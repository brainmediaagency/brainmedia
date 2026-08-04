import { describe, expect, it } from 'vitest'
import {
  jobPlannedDay,
  nextDateOnly,
} from '@/features/jobs/services/jobService'

describe('job calendar day helpers', () => {
  it('extracts the calendar day from date-only and datetime schedules', () => {
    expect(jobPlannedDay({ plannedExecutionDate: '2026-08-06' })).toBe(
      '2026-08-06',
    )
    expect(jobPlannedDay({ plannedExecutionDate: '2026-08-06T17:30' })).toBe(
      '2026-08-06',
    )
  })

  it('builds exclusive day upper bound for range queries', () => {
    expect(nextDateOnly('2026-08-06')).toBe('2026-08-07')
    expect(nextDateOnly('2026-08-31')).toBe('2026-09-01')
  })

  it('range bounds cover both date-only and same-day datetime', () => {
    const day = '2026-08-06'
    const end = nextDateOnly(day)
    const samples = ['2026-08-06', '2026-08-06T09:00', '2026-08-06T21:30']
    for (const planned of samples) {
      expect(planned >= day && planned < end).toBe(true)
    }
    expect('2026-08-07T09:00' >= day && '2026-08-07T09:00' < end).toBe(false)
    expect('2026-08-05T09:00' >= day && '2026-08-05T09:00' < end).toBe(false)
  })
})
