import { UserFacingError } from '@/lib/errors'
import { postWebhookForm } from '@/lib/driveUpload'
import { DEFAULT_STORAGE_QUOTA_BYTES } from '@/lib/formatBytes'
import { isSheetsWebhookConfigured } from '@/lib/sheetsWebhook'

export type StorageUsageSnapshot = {
  usedBytes: number
  quotaBytes: number
  /** BrainUploads altındaki dosya sayısı (varsa). */
  objectCount: number
  /** Yalnızca BrainUploads klasörü boyutu (varsa). */
  brainUsedBytes: number
  updatedAt: Date | null
  exists: boolean
  source: 'google-drive' | 'unavailable'
}

export function defaultStorageUsageSnapshot(): StorageUsageSnapshot {
  return {
    usedBytes: 0,
    quotaBytes: DEFAULT_STORAGE_QUOTA_BYTES,
    objectCount: 0,
    brainUsedBytes: 0,
    updatedAt: null,
    exists: false,
    source: 'unavailable',
  }
}

/**
 * Google Drive hesap kotası (Apps Script `driveStorageUsage`).
 * Firebase Storage kullanılmaz. POST body (idToken; never in URL).
 */
export async function fetchDriveStorageUsage(): Promise<StorageUsageSnapshot> {
  if (!isSheetsWebhookConfigured()) {
    return defaultStorageUsageSnapshot()
  }

  const parsed = (await postWebhookForm({
    action: 'driveStorageUsage',
  })) as {
    ok?: boolean
    error?: string
    detail?: string
    usedBytes?: number
    quotaBytes?: number
    objectCount?: number
    brainUsedBytes?: number
  }

  if (!parsed.ok) {
    const err = String(parsed.error ?? '').trim()
    const detail = String(parsed.detail ?? '').trim()
    const combined = [err, detail].filter(Boolean).join(' — ')
    if (/FIREBASE_WEB_API_KEY/i.test(combined)) {
      throw new UserFacingError(
        'Drive kotası: Apps Script Script properties’e FIREBASE_WEB_API_KEY ekleyin (Firebase Web API Key), New version yayınlayın.',
      )
    }
    if (/unauthorized|forbidden/i.test(combined)) {
      throw new UserFacingError(
        'Drive kotası yetkisiz. Çıkış/giriş yapın; sürmezse webhook FIREBASE_WEB_API_KEY ayarını kontrol edin.',
      )
    }
    throw new UserFacingError(
      err ||
        detail ||
        'Google Drive kotası alınamadı. Apps Script Code.gs’i güncelleyip New version yayınlayın.',
    )
  }

  const usedBytes = Number(parsed.usedBytes)
  const quotaBytes = Number(parsed.quotaBytes)
  const objectCount = Number(parsed.objectCount)
  const brainUsedBytes = Number(parsed.brainUsedBytes)

  return {
    usedBytes: Number.isFinite(usedBytes) && usedBytes >= 0 ? usedBytes : 0,
    quotaBytes:
      Number.isFinite(quotaBytes) && quotaBytes > 0
        ? quotaBytes
        : DEFAULT_STORAGE_QUOTA_BYTES,
    objectCount:
      Number.isFinite(objectCount) && objectCount >= 0 ? objectCount : 0,
    brainUsedBytes:
      Number.isFinite(brainUsedBytes) && brainUsedBytes >= 0
        ? brainUsedBytes
        : 0,
    updatedAt: new Date(),
    exists: true,
    source: 'google-drive',
  }
}

/**
 * Poll Drive usage. Returns a cleanup function (same shape as Firestore unsubscribe).
 */
export function subscribeStorageUsage(
  onData: (usage: StorageUsageSnapshot) => void,
  onError?: (error: Error) => void,
  intervalMs = 60_000,
): () => void {
  let cancelled = false

  const tick = async () => {
    try {
      const next = await fetchDriveStorageUsage()
      if (!cancelled) onData(next)
    } catch (error) {
      if (!cancelled) {
        onError?.(
          error instanceof Error ? error : new Error('Drive kotası alınamadı.'),
        )
      }
    }
  }

  void tick()
  const timer = window.setInterval(() => void tick(), intervalMs)

  const onFocus = () => void tick()
  window.addEventListener('focus', onFocus)

  return () => {
    cancelled = true
    window.clearInterval(timer)
    window.removeEventListener('focus', onFocus)
  }
}
