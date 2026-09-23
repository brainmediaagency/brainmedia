import { shouldArmThirdShotCelebration } from '@/features/celebration/utils/thirdShotCelebration'
import {
  CELEBRATION_DURATION_MS,
  THIRD_SHOT_MILESTONE,
  celebrationUntilMs,
  isCelebrationWindowActive,
  shouldShowThirdShotCelebration,
} from '@/features/celebration/utils/thirdShotCelebration'

describe('thirdShotCelebration', () => {
  describe('shouldArmThirdShotCelebration', () => {
    it('arms only when crossing to the 3rd shot for media_planning', () => {
      expect(
        shouldArmThirdShotCelebration({
          previousJobsShot: 2,
          nextJobsShot: 3,
          role: 'media_planning',
        }),
      ).toBe(true)
    })

    it('does not arm for other roles', () => {
      expect(
        shouldArmThirdShotCelebration({
          previousJobsShot: 2,
          nextJobsShot: 3,
          role: 'reporter',
        }),
      ).toBe(false)
      expect(
        shouldArmThirdShotCelebration({
          previousJobsShot: 2,
          nextJobsShot: 3,
          role: 'management',
        }),
      ).toBe(false)
    })

    it('does not arm before the 3rd shot', () => {
      expect(
        shouldArmThirdShotCelebration({
          previousJobsShot: 1,
          nextJobsShot: 2,
          role: 'media_planning',
        }),
      ).toBe(false)
    })

    it('does not arm after the milestone was already passed', () => {
      expect(
        shouldArmThirdShotCelebration({
          previousJobsShot: 3,
          nextJobsShot: 4,
          role: 'media_planning',
        }),
      ).toBe(false)
      expect(
        shouldArmThirdShotCelebration({
          previousJobsShot: 5,
          nextJobsShot: 6,
          role: 'media_planning',
        }),
      ).toBe(false)
    })

    it('arms if a batch jump crosses the milestone (2→4)', () => {
      expect(
        shouldArmThirdShotCelebration({
          previousJobsShot: 2,
          nextJobsShot: 4,
          role: 'media_planning',
        }),
      ).toBe(true)
    })
  })

  describe('celebrationUntilMs / isCelebrationWindowActive', () => {
    it('uses a 24h window', () => {
      expect(CELEBRATION_DURATION_MS).toBe(24 * 60 * 60 * 1000)
      expect(THIRD_SHOT_MILESTONE).toBe(3)
      const start = 1_700_000_000_000
      expect(celebrationUntilMs(start)).toBe(start + CELEBRATION_DURATION_MS)
    })

    it('is active strictly before untilMs', () => {
      const until = 1_000_000
      expect(isCelebrationWindowActive(until, until - 1)).toBe(true)
      expect(isCelebrationWindowActive(until, until)).toBe(false)
      expect(isCelebrationWindowActive(until, until + 1)).toBe(false)
      expect(isCelebrationWindowActive(null, 1)).toBe(false)
      expect(isCelebrationWindowActive(undefined, 1)).toBe(false)
    })
  })

  describe('shouldShowThirdShotCelebration', () => {
    const until = Date.now() + CELEBRATION_DURATION_MS

    it('shows for MPU inside the window when not dismissed', () => {
      expect(
        shouldShowThirdShotCelebration({
          role: 'media_planning',
          untilMs: until,
          nowMs: Date.now(),
          dismissedThisSession: false,
        }),
      ).toBe(true)
    })

    it('hides after dismiss in the same session', () => {
      expect(
        shouldShowThirdShotCelebration({
          role: 'media_planning',
          untilMs: until,
          nowMs: Date.now(),
          dismissedThisSession: true,
        }),
      ).toBe(false)
    })

    it('hides when the 24h window expired', () => {
      expect(
        shouldShowThirdShotCelebration({
          role: 'media_planning',
          untilMs: Date.now() - 1,
          nowMs: Date.now(),
          dismissedThisSession: false,
        }),
      ).toBe(false)
    })

    it('hides for non-MPU roles even inside the window', () => {
      expect(
        shouldShowThirdShotCelebration({
          role: 'coordinator',
          untilMs: until,
          nowMs: Date.now(),
          dismissedThisSession: false,
        }),
      ).toBe(false)
    })
  })
})
