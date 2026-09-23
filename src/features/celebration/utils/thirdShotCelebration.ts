/** Medya planlama: 3. çekilen iş sonrası kutlama penceresi. */

export const THIRD_SHOT_MILESTONE = 3
export const CELEBRATION_DURATION_MS = 24 * 60 * 60 * 1000

export type CelebrationArmInput = {
  previousJobsShot: number
  nextJobsShot: number
  role: string | null | undefined
}

/** 3. çekilen işe geçişte (ve yalnızca media_planning) pencereyi başlat. */
export function shouldArmThirdShotCelebration(input: CelebrationArmInput): boolean {
  if (input.role !== 'media_planning') return false
  return (
    input.previousJobsShot < THIRD_SHOT_MILESTONE &&
    input.nextJobsShot >= THIRD_SHOT_MILESTONE
  )
}

export function celebrationUntilMs(startedAtMs: number): number {
  return startedAtMs + CELEBRATION_DURATION_MS
}

export function isCelebrationWindowActive(
  untilMs: number | null | undefined,
  nowMs: number,
): boolean {
  return typeof untilMs === 'number' && Number.isFinite(untilMs) && nowMs < untilMs
}

export type CelebrationShowInput = {
  role: string | null | undefined
  untilMs: number | null | undefined
  nowMs: number
  dismissedThisSession: boolean
}

/** Oturumda göster: yalnızca MPU + aktif pencere + bu oturumda kapatılmamış. */
export function shouldShowThirdShotCelebration(
  input: CelebrationShowInput,
): boolean {
  if (input.role !== 'media_planning') return false
  if (input.dismissedThisSession) return false
  return isCelebrationWindowActive(input.untilMs, input.nowMs)
}

export function mpuCelebrationDismissStorageKey(uid: string): string {
  return `mpu-celebration-dismissed:${uid}`
}
