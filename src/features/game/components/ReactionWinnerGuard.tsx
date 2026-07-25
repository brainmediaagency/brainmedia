import { useEffect } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { finalizeYesterdayWinner } from '@/features/game/services/reactionScoreService'

/**
 * Uygulama açıkken dünün refleks oyunu şampiyonunu belirler
 * (reactionDailyWinners dokümanı yoksa oluşturur). Tüm giriş yapmış
 * kullanıcılar için çalışır; servis 15 dk localStorage throttle uygular
 * ve işlem tarih ID'li transaction ile idempotenttir.
 */
export function ReactionWinnerGuard() {
  const { profile, loading } = useAuth()

  useEffect(() => {
    if (loading || !profile) return

    let cancelled = false

    const tick = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      finalizeYesterdayWinner().catch(() => {
        // Best-effort: başka bir istemci kazanabilir veya ağ hatası olabilir.
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
