import { getFirebaseAuth } from '@/lib/firebase/auth'
import { UserFacingError } from '@/lib/errors'

/** Minimum Apps Script that writes KAZANÇ on updateDkHaber (+ pushNotify). */
export const SHEETS_WEBHOOK_MIN_VERSION = 10

export const SHEETS_WEBHOOK_STALE_MESSAGE =
  'Sheets webhook eski sürümde. Apps Script’e güncel Code.gs yapıştırıp New version yayınlayın.'

export function getSheetsWebhookUrl(): string | null {
  const url = (import.meta.env.VITE_SHEETS_WEBHOOK_URL as string | undefined)?.trim()
  return url || null
}

/** True when Apps Script webhook URL is configured (sheet/drive/push expected). */
export function isSheetsWebhookConfigured(): boolean {
  return getSheetsWebhookUrl() != null
}

/**
 * Firebase ID token for the signed-in user (Apps Script verifies via accounts:lookup).
 * Never put WEBHOOK_SECRET in the client.
 */
export async function getWebhookIdToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new UserFacingError('Oturum bulunamadı. Tekrar giriş yapın.')
  }
  return user.getIdToken()
}

export type SheetsWebhookPingInfo = {
  ok?: boolean
  service?: string
  version?: string
  features?: string[]
}

/** Pure OPS-04 / stale check — v12+ satisfies MIN_VERSION 10. */
export function isSheetsWebhookVersionStale(
  parsed: SheetsWebhookPingInfo,
): boolean {
  const service = parsed.service
  const versionNum = Number(String(parsed.version || '').replace(/^v/i, ''))
  const features = parsed.features
  const hasDkHaber = features?.includes('updateDkHaber') === true
  const hasPushNotify = features?.includes('pushNotify') === true
  return (
    !Array.isArray(features) ||
    !service?.includes('webhook-v') ||
    !hasDkHaber ||
    !hasPushNotify ||
    !Number.isFinite(versionNum) ||
    versionNum < SHEETS_WEBHOOK_MIN_VERSION
  )
}
