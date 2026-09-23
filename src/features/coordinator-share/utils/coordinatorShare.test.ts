import { describe, expect, it } from 'vitest'
import {
  COORDINATOR_SHARE_RATE,
  coordinatorShareFromVatBaseKurus,
} from '@/features/coordinator-share/utils/coordinatorShare'

describe('coordinatorShareFromVatBaseKurus', () => {
  it('uses 5% of matrah (VAT base)', () => {
    expect(COORDINATOR_SHARE_RATE).toBe(0.05)
    expect(coordinatorShareFromVatBaseKurus(1_000_000_00)).toBe(5_000_000)
  })

  it('floors invalid / negative base to 0', () => {
    expect(coordinatorShareFromVatBaseKurus(-100)).toBe(0)
    expect(coordinatorShareFromVatBaseKurus(Number.NaN)).toBe(0)
  })

  it('rounds fractional kuruş', () => {
    // 12345 * 0.05 = 617.25 → 617
    expect(coordinatorShareFromVatBaseKurus(12_345)).toBe(617)
  })
})
