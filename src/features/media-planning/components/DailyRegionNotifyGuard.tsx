import { useEffect } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  msUntilNextIstanbulMidnight,
  runDueDailyRegionDayNotify,
} from '@/features/media-planning/services/dailyRegionService'

/**
 * Yönetim / koordinatör oturumundayken bugünün bölgesini bir kez bildirir.
 * Tercihen İstanbul 00:00’da; uygulama gece açık değilse ilk uygun oturumda
 * (aynı gün için) catch-up yapar. Cloud Scheduler Blaze gerektirir — istemci yedek.
 */
export function DailyRegionNotifyGuard() {
  const { profile, claims, loading } = useAuth()

  useEffect(() => {
    if (loading || !profile) return
    const role = claims?.role ?? profile.role
    if (role !== 'management' && role !== 'coordinator') return

    let cancelled = false
    let midnightTimer: ReturnType<typeof setTimeout> | undefined

    const actor = {
      uid: profile.uid,
      fullName: profile.fullName,
      role,
    }

    const tick = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      void runDueDailyRegionDayNotify(actor)
    }

    const armMidnight = () => {
      if (midnightTimer) clearTimeout(midnightTimer)
      const delay = msUntilNextIstanbulMidnight() + 750
      midnightTimer = setTimeout(() => {
        tick()
        armMidnight()
      }, delay)
    }

    tick()
    armMidnight()
    const intervalId = window.setInterval(tick, 15 * 60 * 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      if (midnightTimer) clearTimeout(midnightTimer)
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loading, profile, claims])

  return null
}
