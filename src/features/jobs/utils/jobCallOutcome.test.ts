import { describe, expect, it } from 'vitest'
import {
  isManualJobCallOutcome,
  jobCallOutcomeLabel,
  parseJobCallOutcome,
} from '@/features/jobs/utils/jobCallOutcome'

describe('jobCallOutcome', () => {
  it('parses known values and rejects others', () => {
    expect(parseJobCallOutcome('busy')).toBe('busy')
    expect(parseJobCallOutcome('reached')).toBe('reached')
    expect(parseJobCallOutcome('meşgul')).toBeNull()
    expect(parseJobCallOutcome(null)).toBeNull()
  })

  it('only Meşgul / Ulaşılamıyor / Cevapsız are manual', () => {
    expect(isManualJobCallOutcome('busy')).toBe(true)
    expect(isManualJobCallOutcome('unreachable')).toBe(true)
    expect(isManualJobCallOutcome('unanswered')).toBe(true)
    expect(isManualJobCallOutcome('reached')).toBe(false)
  })

  it('labels Turkish statuses', () => {
    expect(jobCallOutcomeLabel('busy')).toBe('Meşgul')
    expect(jobCallOutcomeLabel('unreachable')).toBe('Ulaşılamıyor')
    expect(jobCallOutcomeLabel('unanswered')).toBe('Cevapsız')
    expect(jobCallOutcomeLabel('reached')).toBe('Ulaşıldı')
    expect(jobCallOutcomeLabel(null)).toBe('Belirtilmedi')
  })
})
