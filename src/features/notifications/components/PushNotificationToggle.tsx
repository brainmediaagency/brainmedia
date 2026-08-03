import { useCallback, useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { Toggle } from '@/components/ui/Toggle'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  ensureBrowserNotificationPermission,
  getBrowserNotificationPermission,
  initOneSignal,
  isIosDevice,
  isOneSignalConfigured,
  isOneSignalPushOptedIn,
  isOneSignalPushRole,
  isStandaloneDisplayMode,
  loginOneSignalWithRole,
  setOneSignalPushOptedIn,
} from '@/lib/onesignal'

type PushNotificationToggleProps = {
  /** Refresh when the parent panel opens. */
  active?: boolean
  className?: string
}

const DENIED_HELP =
  'Tarayıcı bu site için bildirimi engellemiş. Adres çubuğundaki kilit / site ayarı → Bildirimler → İzin ver, sonra sayfayı yenileyin.'

/**
 * Open / close Web Push from the notification inbox.
 * Requests browser permission first (user-gesture), then OneSignal opt-in.
 */
export function PushNotificationToggle({
  active = true,
  className,
}: PushNotificationToggleProps) {
  const { profile, claims } = useAuth()
  const labelId = useId()
  const helpId = useId()
  const [optedIn, setOptedIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [permission, setPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default')

  const configured = isOneSignalConfigured()
  const pushRole = isOneSignalPushRole(claims?.role) ? claims.role : null
  const canUse = Boolean(configured && pushRole && profile?.uid)
  const needsHomeScreen = isIosDevice() && !isStandaloneDisplayMode()
  const browserDenied = permission === 'denied'
  const unsupported = permission === 'unsupported'

  const refresh = useCallback(async () => {
    if (!canUse || !profile?.uid || !pushRole) {
      setReady(false)
      setOptedIn(false)
      return
    }
    setPermission(getBrowserNotificationPermission())
    await initOneSignal()
    await loginOneSignalWithRole(profile.uid, pushRole)
    const subscribed = await isOneSignalPushOptedIn()
    setOptedIn(subscribed)
    setPermission(getBrowserNotificationPermission())
    setReady(true)
  }, [canUse, profile?.uid, pushRole])

  useEffect(() => {
    if (!active || !canUse) return
    void refresh()
  }, [active, canUse, refresh])

  const onChange = useCallback(
    async (next: boolean) => {
      if (!profile?.uid || !pushRole || busy) return

      if (needsHomeScreen) {
        toast.message(
          'iPhone’da Safari → Paylaş → Ana Ekrana Ekle, sonra B’RAIN ikonundan açın.',
        )
        return
      }

      if (unsupported) {
        toast.error('Bu tarayıcı Web Push desteklemiyor.')
        return
      }

      // Permission prompt MUST be first — before init/login awaits.
      if (next) {
        const browser = await ensureBrowserNotificationPermission()
        setPermission(browser)
        if (browser === 'denied') {
          toast.error(DENIED_HELP)
          return
        }
        if (browser !== 'granted') {
          toast.error('Bildirim izni verilmedi.')
          return
        }
      }

      setBusy(true)
      try {
        await initOneSignal()
        await loginOneSignalWithRole(profile.uid, pushRole)
        const ok = await setOneSignalPushOptedIn(next)
        setPermission(getBrowserNotificationPermission())
        if (!ok) {
          toast.error(
            next
              ? getBrowserNotificationPermission() === 'denied'
                ? DENIED_HELP
                : 'Bildirimler açılamadı. Sayfayı yenileyip tekrar deneyin.'
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
    [
      profile?.uid,
      pushRole,
      busy,
      refresh,
      needsHomeScreen,
      unsupported,
    ],
  )

  if (!canUse) return null

  const statusText = needsHomeScreen
    ? 'iPhone’da önce Ana Ekrana Ekle gerekir.'
    : browserDenied
      ? DENIED_HELP
      : unsupported
        ? 'Bu tarayıcı Web Push desteklemiyor.'
        : optedIn
          ? 'Açık — site kapalıyken de gelir.'
          : 'Kapalı — açmak için anahtarı kullanın.'

  return (
    <div
      className={
        className ??
        'space-y-2 border-t border-border bg-surface-muted/40 px-3 py-3'
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p id={labelId} className="text-sm font-medium text-text-primary">
            Push bildirimleri
          </p>
          <p id={helpId} className="text-xs text-text-secondary">
            {statusText}
          </p>
        </div>
        <Toggle
          checked={optedIn}
          onChange={(v) => void onChange(v)}
          disabled={busy || !ready || needsHomeScreen || unsupported}
          aria-labelledby={labelId}
          aria-describedby={helpId}
        />
      </div>
    </div>
  )
}
