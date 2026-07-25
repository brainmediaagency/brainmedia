import { describe, expect, it } from 'vitest'
import {
  getStatsDelta,
  isAllowedTransition,
  normalizeCompanyName,
} from '@/features/jobs/utils/jobTransitions'
import type { JobStatus } from '@/config/roles'

describe('normalizeCompanyName', () => {
  it('trims and lowercases with Turkish locale', () => {
    expect(normalizeCompanyName('  İSTANBUL MEDYA  ')).toBe('istanbul medya')
    expect(normalizeCompanyName('Iğdır')).toBe('ığdır')
  })
})

describe('isAllowedTransition', () => {
  const cases: Array<[JobStatus, JobStatus, boolean]> = [
    ['pending', 'approved', true],
    ['pending', 'rejected', true],
    ['pending', 'cancelled', true],
    ['pending', 'shot', false],
    ['approved', 'pending', true],
    ['approved', 'shot', true],
    ['approved', 'cancelled', true],
    ['approved', 'rejected', false],
    ['shot', 'approved', false],
    ['rejected', 'pending', false],
    ['cancelled', 'pending', false],
  ]

  it.each(cases)('%s → %s = %s', (from, to, allowed) => {
    expect(isAllowedTransition(from, to)).toBe(allowed)
  })
})

describe('getStatsDelta', () => {
  it('counts received only on pending→approved', () => {
    expect(getStatsDelta('pending', 'approved').jobsReceived).toBe(1)
    expect(getStatsDelta('pending', 'rejected').jobsReceived).toBe(0)
  })

  it('counts shot and cancelled from approved', () => {
    expect(getStatsDelta('approved', 'shot')).toEqual({
      jobsReceived: 0,
      jobsShot: 1,
      jobsCancelled: 0,
    })
    expect(getStatsDelta('approved', 'cancelled').jobsCancelled).toBe(1)
  })

  it('reverses received on approved→pending', () => {
    expect(getStatsDelta('approved', 'pending').jobsReceived).toBe(-1)
  })
})
