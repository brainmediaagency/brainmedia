import { BellRing, Share, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  initOneSignal,
  isIosDevice,
  isOneSignalConfigured,
  isOneSignalPushRole,
  isStandaloneDisplayMode,
  loginOneSignalWithRole,
  requestOneSignalPushPermission,
} from '@/lib/onesignal'

const DISMISS_KEY = 'brain-onesignal-banner-dismissed'

/**
 * OneSignal Web Push opt-in for every authenticated app role
 * (works when site is closed). iPhone: requires Add to Home Screen (PWA) first.
 */
export function OneSignalSubscribeBanner() {
  const { claims, profile } = useAuth()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const configured = isOneSignalConfigured()
  const isIos = isIosDevice()
  const isStandalone = isStandaloneDisplayMode()
  const needsHomeScreen = isIos && !isStandalone
  const pushRole = isOneSignalPushRole(claims?.role) ? claims.role : null

  useEffect(() => {
    if (!pushRole || !profile?.uid || !configured) return
    void (async () => {
      await initOneSignal()
      await loginOneSignalWithRole(profile.uid, pushRole)
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        !needsHomeScreen
      ) {
        const ok = await requestOneSignalPushPermission()
        if (ok) setSubscribed(true)
      }
    })()
  }, [pushRole, profile?.uid, configured, needsHomeScreen])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  const enable = useCallback(async () => {
    if (!profile?.uid || !pushRole) return
    if (needsHomeScreen) {
      toast.message(
        'iPhone’da Safari → Paylaş → Ana Ekrana Ekle, sonra B’RAIN ikonundan açın.',
      )
      return
    }
    setBusy(true)
    try {
      await initOneSignal()
      await loginOneSignalWithRole(profile.uid, pushRole)
      const ok = await requestOneSignalPushPermission()
      if (ok) {
        setSubscribed(true)
        toast.success('OneSignal bildirimleri açıldı.')
        dismiss()
      } else {
        toast.error('Bildirim izni verilmedi.')
      }
    } finally {
      setBusy(false)
    }
  }, [profile?.uid, pushRole, needsHomeScreen, dismiss])

  if (!pushRole) return null
  if (!configured) return null
  if (dismissed || subscribed) return null

  return (
    <div className="border-b border-border bg-surface-muted/80 px-4 py-3 sm:px-4 lg:px-6">
      <div className="content-shell flex max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <BellRing className="size-4 shrink-0 text-brand-cyan" aria-hidden="true" />
            Push bildirimleri (OneSignal)
          </p>
          {needsHomeScreen ? (
            <p className="text-sm text-text-secondary">
              iPhone’da site kapalıyken bildirim için Safari’de{' '}
              <strong className="font-medium text-text-primary">Paylaş</strong>{' '}
              <Share className="inline size-3.5 align-text-bottom" aria-hidden="true" /> →{' '}
              <strong className="font-medium text-text-primary">Ana Ekrana Ekle</strong>,
              ardından uygulamayı ikondan açıp bildirim izni verin.
            </p>
          ) : (
            <p className="text-sm text-text-secondary">
              Site kapalıyken bile iş durumu, konfirme, Z/kasa ve İK/CV olaylarında
              telefon veya bilgisayarınıza bildirim gelir.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!needsHomeScreen ? (
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
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
