import { describe, expect, it } from 'vitest'
import { formatJobReviewer } from '@/features/jobs/utils/formatJobReviewer'

describe('formatJobReviewer', () => {
  const reviewed = { reviewedByNameSnapshot: 'Ayşe Koordinatör' }
  const pending = { reviewedByNameSnapshot: null }

  it('masks reviewer as Yönetim for media_planning viewers', () => {
    expect(formatJobReviewer(reviewed, 'media_planning')).toBe('Yönetim')
  })

  it('shows real reviewer name for management and coordinator', () => {
    expect(formatJobReviewer(reviewed, 'management')).toBe('Ayşe Koordinatör')
    expect(formatJobReviewer(reviewed, 'coordinator')).toBe('Ayşe Koordinatör')
  })

  it('returns empty placeholder when not reviewed', () => {
    expect(formatJobReviewer(pending, 'media_planning')).toBe('—')
    expect(formatJobReviewer(pending, 'management', '')).toBe('')
  })
})
