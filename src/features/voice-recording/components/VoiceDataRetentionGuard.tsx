import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { purgeExpiredVoiceRecordings } from '@/features/voice-recording/services/voiceRetentionService'
import { mapAppError } from '@/lib/errors'

function canPurgeVoice(role: string | undefined): boolean {
  return role === 'management' || role === 'coordinator'
}

/**
 * When yönetim/koordinatör oturum açar, 3 günden eski ses kayıtlarını
 * eskiden yeniye siler.
 */
export function VoiceDataRetentionGuard() {
  const { user, profile, loading } = useAuth()
  const ranForUid = useRef<string | null>(null)

  useEffect(() => {
    if (loading || !user || !profile || !canPurgeVoice(profile.role)) return
    if (ranForUid.current === user.uid) return
    ranForUid.current = user.uid

    let cancelled = false

    void (async () => {
      try {
        const result = await purgeExpiredVoiceRecordings()
        if (!cancelled && result.deleted > 0) {
          toast.message(
            `${result.deleted} eski ses kaydı silindi (3 günden eski).`,
          )
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(mapAppError(error, 'Eski ses kayıtları temizlenemedi.'))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loading, user, profile])

  return null
}
