import { describe, expect, it } from 'vitest'
import {
  JOB_DECISION_NOTE_MIN_CHARS,
  requireJobDecisionNote,
  roleRequiresJobDecisionNote,
} from '@/features/jobs/utils/jobDecisionNote'

describe('jobDecisionNote', () => {
  it('requires note for coordinator and şef only', () => {
    expect(roleRequiresJobDecisionNote('coordinator')).toBe(true)
    expect(roleRequiresJobDecisionNote('sef')).toBe(true)
    expect(roleRequiresJobDecisionNote('management')).toBe(false)
    expect(roleRequiresJobDecisionNote('reporter')).toBe(false)
  })

  it('enforces 10 chars for şef/coordinator reject and cancel', () => {
    expect(() =>
      requireJobDecisionNote('kısa', 'sef', 'reject'),
    ).toThrow(/10 karakter/)
    expect(() =>
      requireJobDecisionNote('123456789', 'coordinator', 'cancel'),
    ).toThrow(/10 karakter/)
    expect(requireJobDecisionNote('1234567890', 'sef', 'reject')).toBe(
      '1234567890',
    )
    expect(JOB_DECISION_NOTE_MIN_CHARS).toBe(10)
  })

  it('keeps management reject optional and cancel min 3', () => {
    expect(requireJobDecisionNote('', 'management', 'reject')).toBe('')
    expect(() =>
      requireJobDecisionNote('ab', 'management', 'cancel'),
    ).toThrow(/3 karakter/)
    expect(requireJobDecisionNote('abc', 'management', 'cancel')).toBe('abc')
  })
})
