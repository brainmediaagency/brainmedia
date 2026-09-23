import { describe, expect, it } from 'vitest'
import { buildCalendarRows } from '@/features/jobs/utils/calendarRows'

describe('buildCalendarRows', () => {
  const slots = ['09:00', '10:00', '11:00', '11:30', '12:00', '13:00', '14:00']

  it('merges consecutive empty slots and keeps filled ones', () => {
    const map = new Map([
      ['11:00', ['a']],
      ['12:00', ['b', 'c']],
    ])
    expect(buildCalendarRows(slots, map)).toEqual([
      { kind: 'empty', from: '09:00', to: '10:00' },
      { kind: 'slot', slot: '11:00', items: ['a'] },
      { kind: 'empty', from: '11:30', to: '11:30' },
      { kind: 'slot', slot: '12:00', items: ['b', 'c'] },
      { kind: 'empty', from: '13:00', to: '14:00' },
    ])
  })

  it('returns one empty row for an empty day', () => {
    expect(buildCalendarRows(slots, new Map())).toEqual([
      { kind: 'empty', from: '09:00', to: '14:00' },
    ])
  })
})
