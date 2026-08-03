/**
 * Screen Wake Lock helpers — keep the phone display on during long
 * foreground tasks (e.g. voice recording).
 *
 * The browser drops the lock whenever the page is hidden, so callers must
 * re-request it when the document becomes visible again.
 */

type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

export type ScreenWakeLock = WakeLockSentinelLike

export function isScreenWakeLockSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  return Boolean((navigator as WakeLockNavigator).wakeLock?.request)
}

/** Returns null when unsupported or when the browser refuses (hidden page). */
export async function requestScreenWakeLock(): Promise<ScreenWakeLock | null> {
  if (!isScreenWakeLockSupported()) return null
  try {
    return await (navigator as WakeLockNavigator).wakeLock!.request('screen')
  } catch {
    return null
  }
}

export async function releaseScreenWakeLock(
  lock: ScreenWakeLock | null,
): Promise<void> {
  if (!lock || lock.released) return
  try {
    await lock.release()
  } catch {
    // Already gone (tab hidden / navigated) — nothing to clean up.
  }
}
