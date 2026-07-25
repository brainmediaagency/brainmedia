import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Toggle } from '@/components/ui/Toggle'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  initOneSignal,
  isOneSignalConfigured,
  isOneSignalPushOptedIn,
  isOneSignalPushRole,
  loginOneSignalWithRole,
  setOneSignalPushOptedIn,
} from '@/lib/onesignal'

type PushNotificationToggleProps = {
  /** Refresh when the parent panel opens. */
  active?: boolean
  className?: string
}

export function PushNotificationToggle({
  active = true,
  className,
}: PushNotificationToggleProps) {
  const { profile, claims } = useAuth()
  const [optedIn, setOptedIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  const configured = isOneSignalConfigured()
  const pushRole = isOneSignalPushRole(claims?.role) ? claims.role : null
  const canUse = Boolean(configured && pushRole && profile?.uid)

  const refresh = useCallback(async () => {
    if (!canUse || !profile?.uid || !pushRole) {
      setReady(false)
      setOptedIn(false)
      return
    }
    await initOneSignal()
    await loginOneSignalWithRole(profile.uid, pushRole)
    setOptedIn(await isOneSignalPushOptedIn())
    setReady(true)
  }, [canUse, profile?.uid, pushRole])

  useEffect(() => {
    if (!active || !canUse) return
    void refresh()
  }, [active, canUse, refresh])

  const onChange = useCallback(
    async (next: boolean) => {
      if (!profile?.uid || !pushRole || busy) return
      setBusy(true)
      try {
        await initOneSignal()
        await loginOneSignalWithRole(profile.uid, pushRole)
        const ok = await setOneSignalPushOptedIn(next)
        if (!ok) {
          toast.error(
            next
              ? 'Bildirim izni verilmedi veya açılamadı.'
              : 'Bildirimler kapatılamadı.',
          )
          await refresh()
          return
        }
        setOptedIn(next)
        toast.success(
          next ? 'Push bildirimleri açıldı.' : 'Push bildirimleri kapatıldı.',
        )
      } finally {
        setBusy(false)
      }
    },
    [profile?.uid, pushRole, busy, refresh],
  )

  if (!canUse) return null

  return (
    <div
      className={
        className ??
        'flex items-center justify-between gap-3 border-t border-border px-1 py-3 sm:px-3'
      }
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">Push bildirimleri</p>
        <p className="text-xs text-text-secondary">
          Site kapalıyken cihaz bildirimleri
        </p>
      </div>
      <Toggle
        checked={optedIn}
        onChange={(v) => void onChange(v)}
        disabled={busy || !ready}
        label="Push bildirimleri"
        aria-label={
          optedIn ? 'Push bildirimlerini kapat' : 'Push bildirimlerini aç'
        }
      />
    </div>
  )
}
