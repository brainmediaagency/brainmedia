import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check'
import { getFirebaseApp, isEmulatorMode } from '@/lib/firebase/app'

let appCheckInstance: AppCheck | null = null

export function initAppCheck(): AppCheck | null {
  if (appCheckInstance) return appCheckInstance
  if (isEmulatorMode()) return null

  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as
    | string
    | undefined
  if (!siteKey) return null

  if (import.meta.env.DEV) {
    const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as
      | string
      | undefined
    if (debugToken) {
      // Debug token only in development builds
      ;(
        globalThis as unknown as {
          FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean
        }
      ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken
    }
  }

  appCheckInstance = initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })

  return appCheckInstance
}
