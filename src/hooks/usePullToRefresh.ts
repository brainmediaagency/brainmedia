import { useEffect, useRef, useState } from 'react'
import {
  dampenPullDistance,
  findVerticalScrollParent,
  isAtScrollTop,
  isIgnoredPullTarget,
  isPullArmed,
} from '@/lib/pullToRefresh'

export type PullToRefreshStatus = 'idle' | 'pulling' | 'armed' | 'refreshing'

type Session = {
  startY: number
  startX: number
  tracking: boolean
  pullPx: number
  refreshing: boolean
}

export function usePullToRefresh(onRefresh: () => void): {
  pullPx: number
  status: PullToRefreshStatus
} {
  const [pullPx, setPullPx] = useState(0)
  const [status, setStatus] = useState<PullToRefreshStatus>('idle')
  const sessionRef = useRef<Session>({
    startY: 0,
    startX: 0,
    tracking: false,
    pullPx: 0,
    refreshing: false,
  })
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const session = sessionRef.current

    function setPull(next: number, nextStatus: PullToRefreshStatus) {
      session.pullPx = next
      setPullPx(next)
      setStatus(nextStatus)
    }

    function resetPull() {
      session.tracking = false
      session.pullPx = 0
      setPull(0, session.refreshing ? 'refreshing' : 'idle')
    }

    function onTouchStart(event: TouchEvent) {
      if (session.refreshing) return
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (!touch || isIgnoredPullTarget(event.target)) return
      const scroller = findVerticalScrollParent(event.target)
      if (!isAtScrollTop(scroller)) return
      session.startY = touch.clientY
      session.startX = touch.clientX
      session.tracking = true
      session.pullPx = 0
    }

    function onTouchMove(event: TouchEvent) {
      if (!session.tracking || session.refreshing) return
      const touch = event.touches[0]
      if (!touch) return
      const dy = touch.clientY - session.startY
      const dx = touch.clientX - session.startX
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        resetPull()
        return
      }
      if (dy <= 0) {
        setPull(0, 'idle')
        return
      }
      const scroller = findVerticalScrollParent(event.target)
      if (!isAtScrollTop(scroller)) {
        resetPull()
        return
      }
      const next = dampenPullDistance(dy)
      if (next > 0 && event.cancelable) event.preventDefault()
      setPull(next, isPullArmed(next) ? 'armed' : 'pulling')
    }

    function onTouchEnd() {
      if (!session.tracking || session.refreshing) return
      session.tracking = false
      if (!isPullArmed(session.pullPx)) {
        setPull(0, 'idle')
        return
      }
      session.refreshing = true
      setStatus('refreshing')
      onRefreshRef.current()
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', resetPull)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', resetPull)
    }
  }, [])

  return { pullPx, status }
}
