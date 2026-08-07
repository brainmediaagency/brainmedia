import { useEffect } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { finalizeYesterdayHoopWinner } from '@/features/game/services/hoopScoreService'

/**
 * Uygulama açıkken dünün 3’lük şampiyonunu belirler
 * (hoopDailyWinners dokümanı yoksa oluşturur).
 */
export function ReactionWinnerGuard() {
  const { profile, loading } = useAuth()

  useEffect(() => {
    if (loading || !profile) return

    let cancelled = false

    const tick = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      finalizeYesterdayHoopWinner().catch(() => {
        // Best-effort
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
  }, [loading, profile])

  return null
}
