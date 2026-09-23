import { describe, expect, it } from 'vitest'
import {
  buildCelebrationPayload,
  MPU_CELEBRATION_DURATION_MS,
} from '@/features/celebration/services/mpuCelebrationService'
import { CELEBRATION_DURATION_MS } from '@/features/celebration/utils/thirdShotCelebration'

describe('mpuCelebrationService helpers', () => {
  it('builds a payload with untilMs = startedAtMs + 24h (rules contract)', () => {
    const startedAtMs = 1_700_000_000_000
    const payload = buildCelebrationPayload('uid-1', startedAtMs)
    expect(payload).toEqual({
      uid: 'uid-1',
      startedAtMs,
      untilMs: startedAtMs + 86_400_000,
    })
    expect(MPU_CELEBRATION_DURATION_MS).toBe(CELEBRATION_DURATION_MS)
    expect(payload.untilMs - payload.startedAtMs).toBe(86_400_000)
  })
})
