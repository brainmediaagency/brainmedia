import { useEffect, useRef } from 'react'

/** Sign out after this long with no user activity while authenticated. */
export const IDLE_SESSION_TIMEOUT_MS = 30 * 60 * 1000

const ACTIVITY_THROTTLE_MS = 1000

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'touchmove',
  'scroll',
  'wheel',
  'focus',
] as const

interface UseIdleSessionTimeoutOptions {
  enabled: boolean
  onIdle: () => void | Promise<void>
  idleMs?: number
}

/**
 * While `enabled`, resets an idle timer on user activity and invokes `onIdle`
 * after `idleMs` with no activity. Clears listeners/timers on disable/unmount.
 */
export function useIdleSessionTimeout({
  enabled,
  onIdle,
  idleMs = IDLE_SESSION_TIMEOUT_MS,
}: UseIdleSessionTimeoutOptions): void {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled) return

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let lastResetAt = 0
    let idleFired = false

    const clearTimer = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
    }

    const scheduleIdle = () => {
      clearTimer()
      timeoutId = setTimeout(() => {
        if (idleFired) return
        idleFired = true
        clearTimer()
        void onIdleRef.current()
      }, idleMs)
    }

    const resetOnActivity = () => {
      if (idleFired) return
      const now = Date.now()
      if (now - lastResetAt < ACTIVITY_THROTTLE_MS) return
      lastResetAt = now
      scheduleIdle()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetOnActivity()
      }
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetOnActivity, {
        capture: true,
        passive: true,
      })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    scheduleIdle()

    return () => {
      clearTimer()
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetOnActivity, {
          capture: true,
        })
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, idleMs])
}
