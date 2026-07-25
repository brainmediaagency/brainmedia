import { useEffect } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { autoCancelStalePendingJobs } from '@/features/jobs/services/autoCancelPendingJobsService'

/**
 * Yönetim / koordinatör oturumundayken 48 saat içinde konfirme edilmeyen
 * bekleyen işleri periyodik olarak otomatik iptal eder.
 * (Cloud Scheduler Blaze gerektirir; bu istemci yedek / anlık yol.)
 */
export function AutoCancelPendingJobsGuard() {
  const { profile, claims, loading } = useAuth()

  useEffect(() => {
    if (loading || !profile) return
    const role = claims?.role ?? profile.role
    if (role !== 'management' && role !== 'coordinator') return

    let cancelled = false

    const tick = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      void autoCancelStalePendingJobs({
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
