import { describe, expect, it } from 'vitest'
import {
  expandStatsQueryDateRange,
  isDateOnlyInStatsRange,
  statsAttributionDateOnly,
  statsMonthDateBounds,
} from '@/lib/date'

describe('stats month (calendar month inclusive)', () => {
  it('keeps each calendar day in its own month', () => {
    expect(statsAttributionDateOnly('2026-03-31')).toBe('2026-03-31')
    expect(statsAttributionDateOnly('2026-02-28')).toBe('2026-02-28')
    expect(statsAttributionDateOnly('2024-02-29')).toBe('2024-02-29')
    expect(statsAttributionDateOnly('2026-03-30')).toBe('2026-03-30')
  })

  it('builds inclusive calendar month windows', () => {
    expect(statsMonthDateBounds('2026-03')).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    })
    expect(statsMonthDateBounds('2024-02')).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    })
    expect(statsMonthDateBounds('2026-02')).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    })
    expect(statsMonthDateBounds('2026-01')).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })
  })

  it('passes through query ranges unchanged', () => {
    expect(expandStatsQueryDateRange('2026-03-01', '2026-03-31')).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    })
    expect(expandStatsQueryDateRange('2026-03-31', '2026-03-31')).toEqual({
      startDate: '2026-03-31',
      endDate: '2026-03-31',
    })
  })

  it('includes month-end day in that month', () => {
    expect(isDateOnlyInStatsRange('2026-03-31', '2026-03-01', '2026-03-31')).toBe(
      true,
    )
    expect(isDateOnlyInStatsRange('2026-03-31', '2026-04-01', '2026-04-30')).toBe(
      false,
    )
    expect(isDateOnlyInStatsRange('2026-02-28', '2026-03-01', '2026-03-31')).toBe(
      false,
    )
  })
})
