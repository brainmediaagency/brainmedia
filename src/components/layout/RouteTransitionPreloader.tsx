import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/BrandLogo'

/** Matches brainmedya.com route overlay timing. */
const ROUTE_HOLD_MS = 600
const INITIAL_HOLD_MS = 300

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Full-screen logo + spinner overlay on route changes — same pattern as
 * https://www.brainmedya.com (pathname preloader ~600ms).
 */
export function RouteTransitionPreloader() {
  const location = useLocation()
  const [visible, setVisible] = useState(() => !prefersReducedMotion())
  const firstPaintRef = useRef(true)
  const pathRef = useRef(location.pathname)

  // Initial load hide (customer site: 300ms after ready).
  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(false)
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const hide = () => {
      timer = setTimeout(() => setVisible(false), INITIAL_HOLD_MS)
    }

    if (document.readyState === 'complete') {
      hide()
    } else {
      window.addEventListener('load', hide)
    }

    return () => {
      window.removeEventListener('load', hide)
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Pathname change (customer site: show 600ms). Query/tab changes skipped.
  useEffect(() => {
    if (firstPaintRef.current) {
      firstPaintRef.current = false
      pathRef.current = location.pathname
      return
    }
    if (pathRef.current === location.pathname) return
    pathRef.current = location.pathname

    if (prefersReducedMotion()) return

    setVisible(true)
    const timer = setTimeout(() => setVisible(false), ROUTE_HOLD_MS)
    return () => clearTimeout(timer)
  }, [location.pathname])

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="route-preloader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Sayfa yükleniyor"
    >
      <div className="route-preloader__spinner-wrap">
        <div className="route-preloader__logo">
          <BrandLogo
            variant="white"
            themeAdaptive={false}
            className="h-auto w-[75%] max-w-[140px]"
          />
        </div>
        <div className="route-preloader__spinner" aria-hidden="true" />
      </div>
    </div>,
    document.body,
  )
}
