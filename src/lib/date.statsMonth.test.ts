import { describe, expect, it } from 'vitest'
import {
  expandStatsQueryDateRange,
  isDateOnlyInStatsRange,
  statsAttributionDateOnly,
  statsMonthDateBounds,
} from '@/lib/date'

describe('stats month attribution (month-end → next month)', () => {
  it('moves last calendar day of the month to the next day', () => {
    expect(statsAttributionDateOnly('2026-03-31')).toBe('2026-04-01')
    expect(statsAttributionDateOnly('2026-02-28')).toBe('2026-03-01')
    expect(statsAttributionDateOnly('2024-02-29')).toBe('2024-03-01')
    expect(statsAttributionDateOnly('2026-03-30')).toBe('2026-03-30')
  })

  it('builds ops month window: prev last day … this month penultimate day', () => {
    expect(statsMonthDateBounds('2026-03')).toEqual({
      startDate: '2026-02-28',
      endDate: '2026-03-30',
    })
    expect(statsMonthDateBounds('2024-03')).toEqual({
      startDate: '2024-02-29',
      endDate: '2024-03-30',
    })
    expect(statsMonthDateBounds('2026-02')).toEqual({
      startDate: '2026-01-31',
      endDate: '2026-02-27',
    })
    expect(statsMonthDateBounds('2026-01')).toEqual({
      startDate: '2025-12-31',
      endDate: '2026-01-30',
    })
  })

  it('expands UI full-month range to the same ops window', () => {
    expect(expandStatsQueryDateRange('2026-03-01', '2026-03-31')).toEqual({
      startDate: '2026-02-28',
      endDate: '2026-03-30',
    })
    expect(expandStatsQueryDateRange('2026-03-31', '2026-03-31')).toBeNull()
  })

  it('includes month-end day only in the next month range', () => {
    expect(isDateOnlyInStatsRange('2026-03-31', '2026-03-01', '2026-03-31')).toBe(
      false,
    )
    expect(isDateOnlyInStatsRange('2026-03-31', '2026-04-01', '2026-04-30')).toBe(
      true,
    )
    expect(isDateOnlyInStatsRange('2026-02-28', '2026-03-01', '2026-03-31')).toBe(
      true,
    )
  })
})
