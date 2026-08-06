import { describe, expect, it } from 'vitest'
import {
  formatYearMonthLongTr,
  formatYearMonthRangeTr,
  isValidYearMonth,
  shiftYearMonth,
} from '@/lib/date'

describe('year-month helpers', () => {
  it('validates yyyy-MM', () => {
    expect(isValidYearMonth('2026-08')).toBe(true)
    expect(isValidYearMonth('2026-13')).toBe(false)
    expect(isValidYearMonth('2026-8')).toBe(false)
  })

  it('shifts months across year boundaries', () => {
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01')
  })

  it('formats Turkish long month labels', () => {
    expect(formatYearMonthLongTr('2026-08')).toMatch(/Ağustos\s+2026/)
    // Ops window: 31 Temmuz – 30 Ağustos (ay sonu sonraki aya)
    expect(formatYearMonthRangeTr('2026-08')).toMatch(
      /31\s+Temmuz\s+–\s+30\s+Ağustos\s+2026/,
    )
  })
})
