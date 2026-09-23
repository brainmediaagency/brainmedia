/**
 * Minimal OneSignal Web SDK v16 typings used by B'RAIN.
 * Loaded via CDN (`OneSignalSDK.page.js`) — see index.html.
 */
import { isUserRole, type UserRole } from '@/config/roles'

export type OneSignalSdk = {
  init: (options: Record<string, unknown>) => Promise<void>
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  User: {
    addTag: (key: string, value: string) => void
    addTags: (tags: Record<string, string>) => void
    PushSubscription: {
      optedIn: boolean
      optIn: () => Promise<void>
      optOut: () => Promise<void>
    }
  }
  Notifications: {
    permission: boolean | NotificationPermission
    requestPermission: () => Promise<boolean | NotificationPermission | void>
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(onesignal: OneSignalSdk) => void | Promise<void>>
    OneSignal?: OneSignalSdk
  }
}

let initPromise: Promise<OneSignalSdk | null> | null = null
let cachedSdk: OneSignalSdk | null = null

export function getOneSignalAppId(): string | null {
  const id = (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined)?.trim()
  return id && id.length > 8 ? id : null
}

export function isOneSignalConfigured(): boolean {
  return Boolean(getOneSignalAppId())
}

/** Native browser Notification permission (`denied` cannot be re-prompted). */
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * Ask the browser for Notification permission while the user-gesture is still
 * valid. Must run before other awaits (init/login), or Chrome silently denies.
 */
export async function ensureBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  const current = getBrowserNotificationPermission()
  if (current !== 'default') return current
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return getBrowserNotificationPermission()
  }
}

function withOneSignal<T>(fn: (os: OneSignalSdk) => Promise<T> | T): Promise<T | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null)
      return
    }

    // SDK already loaded — run immediately (do not wait on Deferred again).
    if (cachedSdk) {
      void Promise.resolve(fn(cachedSdk))
        .then(resolve)
        .catch(() => resolve(null))
      return
    }
    if (window.OneSignal) {
      cachedSdk = window.OneSignal
      void Promise.resolve(fn(window.OneSignal))
        .then(resolve)
        .catch(() => resolve(null))
      return
    }

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      cachedSdk = OneSignal
      try {
        resolve(await fn(OneSignal))
      } catch {
        resolve(null)
      }
    })
  })
}

/** Idempotent init. Safe to call multiple times. */
export function initOneSignal(): Promise<OneSignalSdk | null> {
  const appId = getOneSignalAppId()
  if (!appId) return Promise.resolve(null)
  if (initPromise) return initPromise

  initPromise = withOneSignal(async (OneSignal) => {
    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: import.meta.env.DEV === true,
      // Absolute path — relative resolves against /reporter etc. and hits SPA HTML.
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      serviceWorkerParam: { scope: '/' },
      notifyButton: { enable: false },
      autoResubscribe: true,
    })
    cachedSdk = OneSignal
    return OneSignal
  }).then((os) => {
    if (!os) {
      // Allow a later retry if first init failed (SDK not ready yet).
      initPromise = null
    }
    return os
  })

  return initPromise
}

/** All app roles may subscribe to OneSignal Web Push. */
export type OneSignalPushRole = UserRole

export function isOneSignalPushRole(
  role: string | undefined | null,
): role is OneSignalPushRole {
  return isUserRole(role)
}

/** Login + tag with the user's actual role so push filters can target by role tag. */
export async function loginOneSignalWithRole(
  uid: string,
  role: OneSignalPushRole,
): Promise<boolean> {
  const os = await initOneSignal()
  if (!os) return false
  try {
    await os.login(uid)
    // Overwrite tag so a device that previously logged in under another role
    // cannot keep a stale `role` value that broadens push targeting.
    os.User.addTags({ role })
    return true
  } catch {
    return false
  }
}

function isGrantedPermissionResult(
  value: boolean | NotificationPermission | void,
): boolean {
  return value === true || value === 'granted'
}

/**
 * Enable Web Push. Call from a click handler; browser permission is requested
 * first (user-gesture), then OneSignal opt-in.
 */
export async function requestOneSignalPushPermission(): Promise<boolean> {
  const browser = await ensureBrowserNotificationPermission()
  if (browser === 'unsupported' || browser === 'denied') return false
  if (browser !== 'granted') return false

  const os = await initOneSignal()
  if (!os) return false

  try {
    // Extra prompt path for OneSignal internals (no-op if already granted).
    const result = await os.Notifications.requestPermission()
    if (
      result !== undefined &&
      result !== null &&
      !isGrantedPermissionResult(result) &&
      getBrowserNotificationPermission() !== 'granted'
    ) {
      return false
    }
  } catch {
    if (getBrowserNotificationPermission() !== 'granted') return false
  }

  try {
    await os.User.PushSubscription.optIn()
    return Boolean(os.User.PushSubscription.optedIn)
  } catch {
    return false
  }
}

/** Current Web Push subscription state (false if SDK unavailable). */
export async function isOneSignalPushOptedIn(): Promise<boolean> {
  if (getBrowserNotificationPermission() !== 'granted') return false
  const os = await initOneSignal()
  if (!os) return false
  try {
    return Boolean(os.User.PushSubscription.optedIn)
  } catch {
    return false
  }
}

/**
 * Turn Web Push on/off for this device.
 * Opt-in may show the browser permission prompt (must stay gesture-safe).
 */
export async function setOneSignalPushOptedIn(
  enabled: boolean,
): Promise<boolean> {
  if (enabled) {
    return requestOneSignalPushPermission()
  }
  const os = await initOneSignal()
  if (!os) return false
  try {
    await os.User.PushSubscription.optOut()
    return true
  } catch {
    return false
  }
}

export async function logoutOneSignal(): Promise<void> {
  if (!getOneSignalAppId()) return
  await withOneSignal(async (OneSignal) => {
    try {
      await OneSignal.logout()
    } catch {
      /* ignore */
    }
  })
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOS || iPadOs
}

/**
 * Chrome / Firefox / in-app browsers on iOS. Web Push only works in
 * Safari Home Screen PWA (iOS 16.4+). A Chrome bookmark icon is not enough.
 */
export function isIosNonSafariBrowser(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Instagram|FBAN|FBAV|Line\//i.test(
    ua,
  )
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  const mqStandalone = window.matchMedia('(display-mode: standalone)').matches
  const mqFullscreen = window.matchMedia('(display-mode: fullscreen)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mqStandalone || mqFullscreen || iosStandalone
}

/** iOS Safari in a tab (not the Home Screen icon). */
export function needsIosHomeScreenForPush(): boolean {
  return isIosDevice() && !isStandaloneDisplayMode() && !isIosNonSafariBrowser()
}

export function iosPushBlockedInThisBrowser(): boolean {
  return isIosDevice() && isIosNonSafariBrowser()
}

export const ONESIGNAL_BANNER_DISMISS_HINT = 'brain-onesignal-banner-dismissed'
export const ONESIGNAL_BANNER_DISMISS_ENABLE =
  'brain-onesignal-banner-dismissed-enable'

export const IOS_PUSH_SETUP_HINT =
  'Yer imi (bookmark) yetmez. Safari’de Paylaş → Ana Ekrana Ekle, sonra ana ekrandaki B’RAIN ikonundan açın. App Store uygulaması olmadığı için Ayarlar → Bildirimler’de Brain görünmez; izin ikondan açınca çıkan pencereden verilir.'

export const IOS_PUSH_DENIED_HINT =
  'App Store uygulaması yok; Ayarlar’da Brain aramayın. Safari’den Ana Ekrana Ekle ile ekleyip ikondan açın, Bildirimleri aç’a basın ve İzin Ver’i seçin.'

/** A2HS hint dismiss must not hide the PWA “Bildirimleri aç” prompt. */
export function onesignalBannerDismissKey(
  kind: 'homescreen-hint' | 'enable',
): string {
  return kind === 'enable'
    ? ONESIGNAL_BANNER_DISMISS_ENABLE
    : ONESIGNAL_BANNER_DISMISS_HINT
}
