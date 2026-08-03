import { useEffect } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  msUntilNextIstanbulHour,
  runDueShootingCalendarNotify,
  SHOOTING_CALENDAR_NOTIFY_HOUR,
} from '@/features/jobs/services/shootingCalendarNotifyService'

/**
 * Yönetim / koordinatör oturumundayken İstanbul 00:00’dan itibaren
 * muhabir + kameraman’a “çekim takvimi hazır” push’unu günde bir kez gönderir.
 */
export function ShootingCalendarNotifyGuard() {
  const { profile, claims, loading } = useAuth()

  useEffect(() => {
    if (loading || !profile) return
    const role = claims?.role ?? profile.role
    if (role !== 'management' && role !== 'coordinator') return

    let cancelled = false
    let hourTimer: ReturnType<typeof setTimeout> | undefined

    const actor = {
      uid: profile.uid,
      fullName: profile.fullName,
      role,
    }

    const tick = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      void runDueShootingCalendarNotify(actor).catch((error) => {
        console.warn('[ShootingCalendarNotifyGuard]', error)
      })
    }

    const armNextHour = () => {
      if (hourTimer) clearTimeout(hourTimer)
      const delay = msUntilNextIstanbulHour(SHOOTING_CALENDAR_NOTIFY_HOUR) + 750
      hourTimer = setTimeout(() => {
        tick()
        armNextHour()
      }, delay)
    }

    tick()
    armNextHour()
    const intervalId = window.setInterval(tick, 15 * 60 * 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      if (hourTimer) clearTimeout(hourTimer)
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loading, profile, claims])

  return null
}
