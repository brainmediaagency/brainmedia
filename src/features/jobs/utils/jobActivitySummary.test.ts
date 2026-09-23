import { describe, expect, it } from 'vitest'
import { activitySummaryForJobField } from '@/features/jobs/utils/jobActivitySummary'

describe('activitySummaryForJobField', () => {
  it('labels inline job review edits', () => {
    expect(activitySummaryForJobField('contactName:0')).toBe('yetkili adı')
    expect(activitySummaryForJobField('contactPhone:1')).toBe('yetkili telefonu')
    expect(activitySummaryForJobField('location')).toBe('il / ilçe')
    expect(activitySummaryForJobField('agreedAmount')).toBe('anlaşılan tutar')
  })
})
