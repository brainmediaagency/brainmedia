import { UserFacingError } from '@/lib/errors'
import {
  getSheetsWebhookUrl,
  getWebhookIdToken,
  isSheetsWebhookConfigured,
} from '@/lib/sheetsWebhook'

export type DriveUploadResult = {
  fileId: string
  url: string
  webViewLink: string
}

export type DriveUploadFolder =
  | 'hiring'
  | 'z-reports'
  | 'voice-recordings'
  | 'hr-reports'
  | 'kameraman-km'

export type DriveUploadProgress = {
  phase: 'encoding' | 'uploading' | 'finishing'
  /** 0–1 overall progress for this file */
  ratio: number
  fileName?: string
}

/**
 * Whole-body base64 POST is only safe below this size (Apps Script request body).
 * Larger files use Drive resumable chunks.
 */
export const DRIVE_SINGLE_SHOT_MAX_BYTES = 1.5 * 1024 * 1024

/** Raw binary per resumable chunk (~1 MB base64 after encode). */
export const DRIVE_CHUNK_BYTES = 768 * 1024

/** Hard ceiling: protects tab memory + Apps Script / Drive sessions. */
export const DRIVE_HARD_MAX_BYTES = 80 * 1024 * 1024

function fileToBase64(
  file: Blob,
  onEncodingProgress?: (ratio: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return
      onEncodingProgress?.(Math.min(1, event.loaded / event.total))
    }
    reader.onload = () => {
      onEncodingProgress?.(1)
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
}

/** Binary slice → base64 (no data: URL prefix). */
export function uint8ToBase64(bytes: Uint8Array): string {
  // Stay under engine apply-argument limits (avoid 32k+ spread).
  const chunk = 0x2000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length))
    binary += String.fromCharCode.apply(null, Array.from(slice))
  }
  return btoa(binary)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function webhookErrorMessage(parsed: Record<string, unknown>, fallback: string): string {
  const raw = String(parsed.error ?? '').trim()
  const detail = String(parsed.detail ?? '').trim()
  const combined = [raw, detail].filter(Boolean).join(' — ')
  if (!raw && !detail) return fallback
  if (/is not valid JSON/i.test(combined) || /Unexpected token/i.test(combined)) {
    return (
      'Drive webhook eski sürümde. Apps Script’e güncel Code.gs yapıştırıp New version yayınlayın.'
    )
  }
  if (/invalid islem/i.test(combined)) {
    return (
      'Drive webhook action desteklemiyor. Apps Script’e güncel Code.gs yapıştırıp New version yayınlayın.'
    )
  }
  if (/FIREBASE_WEB_API_KEY/i.test(combined)) {
    return (
      'Drive webhook yapılandırması eksik: Apps Script → Project Settings → Script properties içine FIREBASE_WEB_API_KEY ekleyin (VITE_FIREBASE_API_KEY ile aynı), sonra New version yayınlayın.'
    )
  }
  if (/unauthorized|forbidden/i.test(combined)) {
    return (
      'Drive webhook yetkisiz. Çıkış yapıp tekrar giriş edin; sürmezse Apps Script’te FIREBASE_WEB_API_KEY ve rol claim’lerini kontrol edin.'
    )
  }
  if (/Content-Length|Header:Content-Length|invalid value: Header/i.test(combined)) {
    return (
      'Drive yükleme (webhook) Content-Length hatası. Apps Script Code.gs v25+ yayınlayın (Deploy → New version).'
    )
  }
  if (/session expired|chunk order|resumable|too large|Invalid size|payload/i.test(combined)) {
    return (
      'Dosya çok büyük veya yükleme oturumu düştü. Kayıt hâlâ bu cihazda; İndir ile bilgisayara alın, sonra daha kısa parçalar halinde tekrar yükleyin. Apps Script v24+ (uploadFileInit) gerekir.'
    )
  }
  return raw || detail || fallback
}

/**
 * Readable Apps Script calls via POST JSON body (idToken never in the URL).
 * text/plain avoids CORS preflight; Apps Script may 302 →
 * script.googleusercontent.com — follow once if the first body is HTML.
 */
export async function postWebhookForm(
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = getSheetsWebhookUrl()
  if (!url) {
    throw new UserFacingError('Drive webhook yapılandırılmamış.')
  }

  const idToken = await getWebhookIdToken()
  const body = JSON.stringify({ ...params, idToken })
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  }

  let response = await fetch(url, init)
  let text = await response.text()

  if (!looksLikeJson_(text)) {
    const location =
      response.headers.get('Location')
      || response.headers.get('location')
      || extractMovedLocation_(text)
    if (location) {
      response = await fetch(location, { ...init, redirect: 'follow' })
      text = await response.text()
    }
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new UserFacingError(
      'Webhook yanıtı okunamadı. Apps Script’e güncel Code.gs yapıştırıp New version yayınlayın.',
    )
  }
}

function looksLikeJson_(text: string): boolean {
  const t = text.trim()
  return t.startsWith('{') || t.startsWith('[')
}

function extractMovedLocation_(html: string): string | null {
  const match = html.match(/href=["'](https:\/\/script\.googleusercontent\.com[^"']+)["']/i)
  return match?.[1] ?? null
}

/** @deprecated use postWebhookForm — kept for call sites */
export async function getWebhookJson(
  params: Record<string, string>,
): Promise<unknown> {
  return postWebhookForm(params)
}

async function pollUploadResult(
  uploadToken: string,
  onProgress?: (ratio: number) => void,
): Promise<DriveUploadResult> {
  const maxAttempts = 90
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    onProgress?.(Math.min(0.98, 0.2 + (attempt / maxAttempts) * 0.75))

    const parsed = await postWebhookForm({
      action: 'uploadResult',
      token: uploadToken,
    })

    if (parsed.pending) {
      await sleep(700)
      continue
    }

    if (!parsed.ok || !parsed.fileId || !parsed.url) {
      throw new UserFacingError(
        webhookErrorMessage(parsed, 'Dosya Google Drive’a yüklenemedi.'),
      )
    }

    return {
      fileId: String(parsed.fileId),
      url: String(parsed.url),
      webViewLink: String(parsed.webViewLink ?? parsed.url),
    }
  }

  throw new UserFacingError(
    'Yükleme zaman aşımına uğradı. Apps Script’i güncelleyip tekrar deneyin.',
  )
}

function resultFromParsed(parsed: Record<string, unknown>): DriveUploadResult {
  if (!parsed.ok || !parsed.fileId || !parsed.url) {
    throw new UserFacingError(
      webhookErrorMessage(parsed, 'Dosya Google Drive’a yüklenemedi.'),
    )
  }
  return {
    fileId: String(parsed.fileId),
    url: String(parsed.url),
    webViewLink: String(parsed.webViewLink ?? parsed.url),
  }
}

async function uploadFileSingleShot(input: {
  file: Blob
  fileName: string
  mimeType: string
  folder: DriveUploadFolder
  folderPath?: string
  onProgress?: (progress: DriveUploadProgress) => void
}): Promise<DriveUploadResult> {
  input.onProgress?.({
    phase: 'encoding',
    ratio: 0,
    fileName: input.fileName,
  })

  const base64 = await fileToBase64(input.file, (encodingRatio) => {
    input.onProgress?.({
      phase: 'encoding',
      ratio: encodingRatio * 0.2,
      fileName: input.fileName,
    })
  })

  const uploadToken = crypto.randomUUID()
  const folderPath = input.folderPath?.trim() || ''

  input.onProgress?.({
    phase: 'uploading',
    ratio: 0.25,
    fileName: input.fileName,
  })

  const parsed = await postWebhookForm({
    action: 'uploadFile',
    folder: input.folder,
    ...(folderPath ? { folderPath } : {}),
    fileName: input.fileName,
    mimeType: input.mimeType,
    base64,
    uploadToken,
  })

  if (parsed.pending) {
    input.onProgress?.({
      phase: 'finishing',
      ratio: 0.35,
      fileName: input.fileName,
    })
    return pollUploadResult(uploadToken, (ratio) => {
      input.onProgress?.({
        phase: 'finishing',
        ratio,
        fileName: input.fileName,
      })
    })
  }

  const result = resultFromParsed(parsed)
  input.onProgress?.({
    phase: 'finishing',
    ratio: 1,
    fileName: input.fileName,
  })
  return result
}

/**
 * Drive resumable upload via Apps Script (one chunk at a time — no huge body).
 * Requires webhook v24+ (uploadFileInit / uploadFileChunk).
 */
async function uploadFileResumable(input: {
  file: Blob
  fileName: string
  mimeType: string
  folder: DriveUploadFolder
  folderPath?: string
  onProgress?: (progress: DriveUploadProgress) => void
}): Promise<DriveUploadResult> {
  const totalBytes = input.file.size
  const uploadToken = crypto.randomUUID()
  const folderPath = input.folderPath?.trim() || ''

  input.onProgress?.({
    phase: 'uploading',
    ratio: 0.02,
    fileName: input.fileName,
  })

  const init = await postWebhookForm({
    action: 'uploadFileInit',
    uploadToken,
    folder: input.folder,
    ...(folderPath ? { folderPath } : {}),
    fileName: input.fileName,
    mimeType: input.mimeType,
    totalBytes: String(totalBytes),
  })

  if (!init.ok) {
    throw new UserFacingError(
      webhookErrorMessage(
        init,
        'Büyük dosya yükleme oturumu açılamadı. Apps Script v24 (uploadFileInit) yayınlayın.',
      ),
    )
  }

  const buffer = new Uint8Array(await input.file.arrayBuffer())
  let offset = 0
  let chunkIndex = 0
  const approxChunks = Math.max(1, Math.ceil(totalBytes / DRIVE_CHUNK_BYTES))

  while (offset < totalBytes) {
    const endExclusive = Math.min(offset + DRIVE_CHUNK_BYTES, totalBytes)
    const endInclusive = endExclusive - 1
    const slice = buffer.subarray(offset, endExclusive)
    const base64 = uint8ToBase64(slice)

    input.onProgress?.({
      phase: 'uploading',
      ratio: 0.05 + (offset / totalBytes) * 0.9,
      fileName: input.fileName,
    })

    const parsed = await postWebhookForm({
      action: 'uploadFileChunk',
      uploadToken,
      base64,
      byteStart: String(offset),
      byteEnd: String(endInclusive),
      totalBytes: String(totalBytes),
      mimeType: input.mimeType,
      chunkIndex: String(chunkIndex),
      approxChunks: String(approxChunks),
    })

    if (!parsed.ok) {
      throw new UserFacingError(
        webhookErrorMessage(parsed, 'Dosya Google Drive’a yüklenemedi.'),
      )
    }

    if (parsed.done || (parsed.fileId && parsed.url)) {
      input.onProgress?.({
        phase: 'finishing',
        ratio: 1,
        fileName: input.fileName,
      })
      return resultFromParsed(parsed)
    }

    if (parsed.pending) {
      offset = endExclusive
      chunkIndex += 1
      continue
    }

    throw new UserFacingError(
      webhookErrorMessage(parsed, 'Dosya Google Drive’a yüklenemedi.'),
    )
  }

  throw new UserFacingError(
    'Yükleme tamamlanamadı (son parça yanıtı yok). Apps Script v24 kontrol edin.',
  )
}

/**
 * Upload a file to Google Drive via the free Apps Script webhook.
 * Does not use Firebase Storage.
 *
 * Small files: single base64 POST.
 * Large files (voice ~25 dk): Drive resumable chunks (webhook v24+).
 */
export async function uploadFileToDrive(input: {
  file: Blob
  fileName: string
  mimeType: string
  folder: DriveUploadFolder
  /**
   * Optional nested folder under the feature root
   * (e.g. "Ali_Veli_2026-05-19" under Kameraman KM Raporları).
   */
  folderPath?: string
  onProgress?: (progress: DriveUploadProgress) => void
}): Promise<DriveUploadResult> {
  const url = getSheetsWebhookUrl()
  if (!url) {
    throw new UserFacingError(
      'Dosya yükleme yapılandırılmamış. Apps Script webhook URL eksik.',
    )
  }

  if (input.file.size <= 0) {
    throw new UserFacingError('Dosya boş.')
  }

  if (input.file.size > DRIVE_HARD_MAX_BYTES) {
    const mb = Math.round(DRIVE_HARD_MAX_BYTES / (1024 * 1024))
    throw new UserFacingError(
      `Dosya çok büyük (en fazla ~${mb} MB). Kayıt bu cihazda kalır — İndir ile alın veya daha kısa parçalara bölün.`,
    )
  }

  if (input.file.size <= DRIVE_SINGLE_SHOT_MAX_BYTES) {
    return uploadFileSingleShot(input)
  }

  return uploadFileResumable(input)
}

/**
 * Soft-delete a Google Drive file by id (trash). Best-effort for photo replace.
 * Failures are swallowed by callers so the primary write is not blocked.
 */
export async function trashDriveFile(fileId: string): Promise<void> {
  const id = fileId.trim()
  if (!id || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return
  }
  if (!isSheetsWebhookConfigured()) return

  try {
    const parsed = await postWebhookForm({
      action: 'trashDriveFile',
      fileId: id,
    })
    if (!parsed.ok) {
      console.warn('[trashDriveFile]', parsed.error || parsed.detail || 'failed')
    }
  } catch (error) {
    console.warn('[trashDriveFile]', error)
  }
}

export function isDriveUploadConfigured(): boolean {
  return isSheetsWebhookConfigured()
}

export function driveUploadPhaseLabel(phase: DriveUploadProgress['phase']): string {
  if (phase === 'encoding') return 'Dosya hazırlanıyor…'
  if (phase === 'uploading') return 'Yükleniyor…'
  return 'Tamamlanıyor…'
}
