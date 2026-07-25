import { useEffect } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { runDueAutoForwardJobs } from '@/features/jobs/services/autoForwardJobsService'

/**
 * Yönetim / koordinatör oturumundayken İstanbul 09:00–21:00 arasında
 * konfirme ama iletilmemiş işleri periyodik olarak muhabire iletir.
 * (Cloud Scheduler Blaze gerektirir; bu istemci yedek / anlık yol.)
 */
export function AutoForwardJobsGuard() {
  const { profile, claims, loading } = useAuth()

  useEffect(() => {
    if (loading || !profile) return
    const role = claims?.role ?? profile.role
    if (role !== 'management' && role !== 'coordinator') return

    let cancelled = false

    const tick = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      void runDueAutoForwardJobs({
        uid: profile.uid,
        fullName: profile.fullName,
        role,
      })
    }

    tick()
    const id = window.setInterval(tick, 15 * 60 * 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loading, profile, claims])

  return null
}
