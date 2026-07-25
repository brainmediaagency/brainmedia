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

export type DriveUploadProgress = {
  phase: 'encoding' | 'uploading' | 'finishing'
  /** 0–1 overall progress for this file */
  ratio: number
  fileName?: string
}

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
  // Older deployments JSON.parse form bodies and surface this V8 message.
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
    // Some environments leave a 302 HTML body; retry Location once.
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

/**
 * Upload a file to Google Drive via the free Apps Script webhook.
 * Does not use Firebase Storage.
 */
export async function uploadFileToDrive(input: {
  file: Blob
  fileName: string
  mimeType: string
  folder: DriveUploadFolder
  onProgress?: (progress: DriveUploadProgress) => void
}): Promise<DriveUploadResult> {
  const url = getSheetsWebhookUrl()
  if (!url) {
    throw new UserFacingError(
      'Dosya yükleme yapılandırılmamış. Apps Script webhook URL eksik.',
    )
  }

  input.onProgress?.({
    phase: 'encoding',
    ratio: 0,
    fileName: input.fileName,
  })

  const base64 = await fileToBase64(input.file, (encodingRatio) => {
    input.onProgress?.({
      phase: 'encoding',
      ratio: encodingRatio * 0.15,
      fileName: input.fileName,
    })
  })

  const uploadToken = crypto.randomUUID()
  const idToken = await getWebhookIdToken()

  input.onProgress?.({
    phase: 'uploading',
    ratio: 0.15,
    fileName: input.fileName,
  })

  // no-cors avoids Safari OPTIONS preflight (Apps Script returns 405).
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'uploadFile',
      idToken,
      folder: input.folder,
      fileName: input.fileName,
      mimeType: input.mimeType,
      base64,
      uploadToken,
    }),
  })

  input.onProgress?.({
    phase: 'finishing',
    ratio: 0.2,
    fileName: input.fileName,
  })

  const result = await pollUploadResult(uploadToken, (ratio) => {
    input.onProgress?.({
      phase: 'finishing',
      ratio,
      fileName: input.fileName,
    })
  })

  input.onProgress?.({
    phase: 'finishing',
    ratio: 1,
    fileName: input.fileName,
  })

  return result
}

export function isDriveUploadConfigured(): boolean {
  return isSheetsWebhookConfigured()
}

export function driveUploadPhaseLabel(phase: DriveUploadProgress['phase']): string {
  if (phase === 'encoding') return 'Dosya hazırlanıyor…'
  if (phase === 'uploading') return 'Yükleniyor…'
  return 'Tamamlanıyor…'
}
