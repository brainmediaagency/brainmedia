import { describe, expect, it } from 'vitest'
import { isJobScheduleOnOrAfter } from '@/lib/date'

describe('isJobScheduleOnOrAfter', () => {
  it('allows datetime planned on same calendar day as date-only acquired', () => {
    expect(isJobScheduleOnOrAfter('2026-07-18T08:00', '2026-07-18')).toBe(true)
    expect(isJobScheduleOnOrAfter('2026-07-18T00:00', '2026-07-18')).toBe(true)
  })

  it('rejects planned calendar day before date-only acquired', () => {
    expect(isJobScheduleOnOrAfter('2026-07-17T23:59', '2026-07-18')).toBe(false)
  })

  it('compares full datetimes when acquired includes time', () => {
    expect(isJobScheduleOnOrAfter('2026-07-18T10:00', '2026-07-18T09:00')).toBe(true)
    expect(isJobScheduleOnOrAfter('2026-07-18T08:00', '2026-07-18T09:00')).toBe(false)
  })
})
