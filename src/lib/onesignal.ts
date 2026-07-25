/**
 * Minimal OneSignal Web SDK v16 typings used by B'RAIN.
 * Loaded via CDN (`OneSignalSDK.page.js`) — see index.html.
 */
export type OneSignalSdk = {
  init: (options: Record<string, unknown>) => Promise<void>
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  User: {
    addTag: (key: string, value: string) => void
    PushSubscription: {
      optedIn: boolean
      optIn: () => Promise<void>
      optOut: () => Promise<void>
    }
  }
  Notifications: {
    permission: boolean | NotificationPermission
    requestPermission: () => Promise<boolean>
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(onesignal: OneSignalSdk) => void | Promise<void>>
  }
}

let initPromise: Promise<OneSignalSdk | null> | null = null

export function getOneSignalAppId(): string | null {
  const id = (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined)?.trim()
  return id && id.length > 8 ? id : null
}

export function isOneSignalConfigured(): boolean {
  return Boolean(getOneSignalAppId())
}

function withOneSignal<T>(fn: (os: OneSignalSdk) => Promise<T> | T): Promise<T | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null)
      return
    }
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
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
      serviceWorkerPath: 'OneSignalSDKWorker.js',
      serviceWorkerParam: { scope: '/' },
      notifyButton: { enable: false },
    })
    return OneSignal
  })

  return initPromise
}

import { isUserRole, type UserRole } from '@/config/roles'

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
  await os.login(uid)
  os.User.addTag('role', role)
  return true
}

export async function requestOneSignalPushPermission(): Promise<boolean> {
  const os = await initOneSignal()
  if (!os) return false
  try {
    const granted = await os.Notifications.requestPermission()
    if (granted) {
      await os.User.PushSubscription.optIn()
      return true
    }
  } catch {
    /* fall through */
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
 * Opt-in may show the browser permission prompt.
 */
export async function setOneSignalPushOptedIn(
  enabled: boolean,
): Promise<boolean> {
  const os = await initOneSignal()
  if (!os) return false
  try {
    if (enabled) {
      return requestOneSignalPushPermission()
    }
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

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || iosStandalone
}
