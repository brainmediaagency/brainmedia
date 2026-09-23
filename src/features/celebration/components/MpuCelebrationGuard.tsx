import { useEffect, useState } from 'react'
import { CelebrationEffectModal } from '@/features/celebration/components/CelebrationEffectModal'
import { subscribeMpuCelebration } from '@/features/celebration/services/mpuCelebrationService'
import {
  clearMpuCelebrationSessionDismiss,
  readMpuCelebrationSessionDismissed,
  writeMpuCelebrationSessionDismissed,
} from '@/features/celebration/utils/mpuCelebrationSession'
import { shouldShowThirdShotCelebration } from '@/features/celebration/utils/thirdShotCelebration'
import { useAuth } from '@/features/auth/hooks/useAuth'

export { clearMpuCelebrationSessionDismiss }

/**
 * Medya planlama: 3. iş çekildikten sonraki 24 saat içinde her oturumda
 * kutlama ekranını gösterir.
 */
export function MpuCelebrationGuard() {
  const { profile, claims, loading, user } = useAuth()
  const role = claims?.role ?? profile?.role
  const uid = user?.uid ?? profile?.uid
  const [untilMs, setUntilMs] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (loading || !uid || role !== 'media_planning') {
      setUntilMs(null)
      return
    }
    setDismissed(readMpuCelebrationSessionDismissed(uid))
    return subscribeMpuCelebration(
      uid,
      (doc) => setUntilMs(doc?.untilMs ?? null),
      () => setUntilMs(null),
    )
  }, [loading, uid, role])

  // Tick so the modal auto-hides when the 24h window ends while the tab is open.
  useEffect(() => {
    if (untilMs == null) return
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [untilMs])

  const open = shouldShowThirdShotCelebration({
    role,
    untilMs,
    nowMs,
    dismissedThisSession: dismissed,
  })

  const handleClose = () => {
    if (uid) writeMpuCelebrationSessionDismissed(uid)
    setDismissed(true)
  }

  return <CelebrationEffectModal open={open} onClose={handleClose} />
}
