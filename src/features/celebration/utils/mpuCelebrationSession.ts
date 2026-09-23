import { mpuCelebrationDismissStorageKey } from '@/features/celebration/utils/thirdShotCelebration'

export function readMpuCelebrationSessionDismissed(uid: string): boolean {
  try {
    return sessionStorage.getItem(mpuCelebrationDismissStorageKey(uid)) === '1'
  } catch {
    return false
  }
}

export function writeMpuCelebrationSessionDismissed(uid: string) {
  try {
    sessionStorage.setItem(mpuCelebrationDismissStorageKey(uid), '1')
  } catch {
    /* private mode */
  }
}

/** Clears dismiss flag so the next login in this tab can show again. */
export function clearMpuCelebrationSessionDismiss(uid: string) {
  try {
    sessionStorage.removeItem(mpuCelebrationDismissStorageKey(uid))
  } catch {
    /* ignore */
  }
}
