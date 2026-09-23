import { BellRing, Share, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  ensureBrowserNotificationPermission,
  getBrowserNotificationPermission,
  initOneSignal,
  IOS_PUSH_DENIED_HINT,
  IOS_PUSH_SETUP_HINT,
  iosPushBlockedInThisBrowser,
  isOneSignalConfigured,
  isOneSignalPushRole,
  loginOneSignalWithRole,
  needsIosHomeScreenForPush,
  onesignalBannerDismissKey,
  requestOneSignalPushPermission,
} from '@/lib/onesignal'

/**
 * OneSignal Web Push opt-in. iPhone: Safari Home Screen PWA, then enable.
 * Dismissing the A2HS hint in Safari must not hide enable inside the icon app.
 */
export function OneSignalSubscribeBanner() {
  const { claims, profile } = useAuth()
  const needsHomeScreen = needsIosHomeScreenForPush()
  const blockedBrowser = iosPushBlockedInThisBrowser()
  const dismissKind = needsHomeScreen || blockedBrowser ? 'homescreen-hint' : 'enable'
  const dismissKey = onesignalBannerDismissKey(dismissKind)

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissKey) === '1'
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const configured = isOneSignalConfigured()
  const pushRole = isOneSignalPushRole(claims?.role) ? claims.role : null
  const canEnable = !needsHomeScreen && !blockedBrowser

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [dismissKey])

  useEffect(() => {
    if (!pushRole || !profile?.uid || !configured) return
    void (async () => {
      await initOneSignal()
      await loginOneSignalWithRole(profile.uid, pushRole)
      if (
        canEnable &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        const ok = await requestOneSignalPushPermission()
        if (ok) setSubscribed(true)
      }
    })()
  }, [pushRole, profile?.uid, configured, canEnable])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(dismissKey, '1')
    } catch {
      /* ignore */
    }
  }, [dismissKey])

  const enable = useCallback(async () => {
    if (!profile?.uid || !pushRole) return
    if (blockedBrowser) {
      toast.message(IOS_PUSH_SETUP_HINT)
      return
    }
    if (needsHomeScreen) {
      toast.message(IOS_PUSH_SETUP_HINT)
      return
    }
    setBusy(true)
    try {
      const browser = await ensureBrowserNotificationPermission()
      if (browser === 'denied') {
        toast.error(IOS_PUSH_DENIED_HINT)
        return
      }
      if (browser !== 'granted') {
        toast.error('Bildirim izni verilmedi. Ekranda çıkan pencerede İzin Ver’e basın.')
        return
      }
      await initOneSignal()
      await loginOneSignalWithRole(profile.uid, pushRole)
      const ok = await requestOneSignalPushPermission()
      if (ok) {
        setSubscribed(true)
        toast.success('Push bildirimleri açıldı.')
        dismiss()
      } else if (getBrowserNotificationPermission() === 'denied') {
        toast.error(IOS_PUSH_DENIED_HINT)
      } else {
        toast.error(
          'Bildirimler açılamadı. Ana ekran ikonundan açtığınızdan emin olun, sonra tekrar deneyin.',
        )
      }
    } finally {
      setBusy(false)
    }
  }, [profile?.uid, pushRole, needsHomeScreen, blockedBrowser, dismiss])

  if (!pushRole) return null
  if (!configured) return null
  if (dismissed || subscribed) return null

  return (
    <div className="border-b border-border bg-surface-muted/80 px-4 py-2 lg:px-6">
      <div className="content-shell flex max-w-full items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
          <BellRing className="size-4 shrink-0 text-brand-cyan" aria-hidden="true" />
          {blockedBrowser ? (
            <span>
              Bildirim için Safari’de{' '}
              <strong className="font-medium text-text-primary">Ana Ekrana Ekle</strong>{' '}
              kullanın.
            </span>
          ) : needsHomeScreen ? (
            <span>
              Safari’de{' '}
              <strong className="font-medium text-text-primary">Paylaş</strong>{' '}
              <Share className="inline size-3.5 align-text-bottom" aria-hidden="true" /> →{' '}
              <strong className="font-medium text-text-primary">Ana Ekrana Ekle</strong>
              , ikondan açın.
            </span>
          ) : (
            <span>Önemli güncellemeleri kaçırmayın.</span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {canEnable ? (
            <Button size="sm" loading={busy} onClick={() => void enable()}>
              Bildirimleri aç
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Kapat"
            onClick={dismiss}
            className="px-2"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
