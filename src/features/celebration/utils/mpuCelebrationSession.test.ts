import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  clearMpuCelebrationSessionDismiss,
  readMpuCelebrationSessionDismissed,
  writeMpuCelebrationSessionDismissed,
} from '@/features/celebration/utils/mpuCelebrationSession'
import { mpuCelebrationDismissStorageKey } from '@/features/celebration/utils/thirdShotCelebration'

describe('mpuCelebrationSession', () => {
  const uid = 'mpu-1'

  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('tracks dismiss per uid in sessionStorage', () => {
    expect(readMpuCelebrationSessionDismissed(uid)).toBe(false)
    writeMpuCelebrationSessionDismissed(uid)
    expect(readMpuCelebrationSessionDismissed(uid)).toBe(true)
    expect(sessionStorage.getItem(mpuCelebrationDismissStorageKey(uid))).toBe('1')
  })

  it('clears dismiss on logout so the next session can show again', () => {
    writeMpuCelebrationSessionDismissed(uid)
    clearMpuCelebrationSessionDismiss(uid)
    expect(readMpuCelebrationSessionDismissed(uid)).toBe(false)
  })
})
