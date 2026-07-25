import { useCallback, useEffect, useState } from 'react'
import {
  endShift,
  startShift,
  subscribeActiveShift,
} from '@/features/attendance/services/attendanceService'
import type { ActiveShift } from '@/features/attendance/types/attendance'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'
import { isShiftRole } from '@/config/roles'

export interface UseShiftTrackerOptions {
  uid: string
  enabled?: boolean
}

export function useShiftTracker({ uid, enabled = true }: UseShiftTrackerOptions) {
  const { user, profile, isOnline } = useAuth()
  const [shift, setShift] = useState<ActiveShift | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)

  const isOwnProfile = user?.uid === uid
  const isActive = Boolean(shift?.startedAt)

  useEffect(() => {
    if (!uid || !enabled) {
      setShift(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeActiveShift(
      uid,
      (next) => {
        setShift(next)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [uid, enabled])

  const handleStart = useCallback(async () => {
    if (!user || !profile || !isOwnProfile) return

    setStarting(true)
    try {
      await startShift({
        uid: user.uid,
        fullName: profile.fullName,
        online: isOnline,
      })
      toast.success('Mesainiz başladı.')
    } catch (error) {
      toast.error(mapAppError(error, 'Mesai başlatılamadı. Lütfen tekrar deneyin.'))
    } finally {
      setStarting(false)
    }
  }, [user, profile, isOwnProfile, isOnline])

  const handleEnd = useCallback(async () => {
    if (!user || !isOwnProfile) return

    setEnding(true)
    try {
      await endShift({
        uid: user.uid,
        online: isOnline,
      })
      toast.success('Mesainiz bitirildi.')
    } catch (error) {
      toast.error(mapAppError(error, 'Mesai bitirilemedi. Lütfen tekrar deneyin.'))
    } finally {
      setEnding(false)
    }
  }, [user, isOwnProfile, isOnline])

  let canStart = false
  let canEnd = false
  let disabledReason: string | null = null

  if (!isOwnProfile) {
    disabledReason = 'Yalnızca kendi mesainizi yönetebilirsiniz.'
  } else if (!isOnline) {
    disabledReason = 'Bu işlem için internet bağlantısı gereklidir.'
  } else if (!profile || !isShiftRole(profile.role)) {
    disabledReason = 'Mesai işlemleri için yetkiniz bulunmuyor.'
  } else if (isActive) {
    canEnd = true
  } else {
    canStart = true
  }

  return {
    shift,
    loading,
    starting,
    ending,
    isActive,
    canStart,
    canEnd,
    disabledReason,
    handleStart,
    handleEnd,
    isOwnProfile,
    isOnline,
  }
}
