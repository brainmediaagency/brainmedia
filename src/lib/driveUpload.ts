import { UserFacingError } from '@/lib/errors'
import {
  compressImageForDrive,
  jpegDriveFileName,
} from '@/lib/compressImageForDrive'
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

/**
 * Raw binary per resumable chunk (~256 KB).
 * Fallback path only (webhook uploadFileInit/Chunk) when the direct
 * browser → Drive PUT is unavailable (blocked CORS).
 */
export const DRIVE_CHUNK_BYTES = 256 * 1024

/** Hard ceiling: protects tab memory + Apps Script / Drive sessions. */
export const DRIVE_HARD_MAX_BYTES = 80 * 1024 * 1024

/**
 * Browser → Drive binary slice size for v28 direct path.
 * Small enough that progress ticks often and a failed slice can re-start quickly.
 */
export const DRIVE_DIRECT_CHUNK_BYTES = 512 * 1024

/** Full re-init of resumable when session drops mid long voice. */
const RESUMABLE_FULL_RESTARTS = 3

/** Direct path: one CORS-failed first chunk aborts the whole direct path. */
const DIRECT_SESSION_ATTEMPTS = 2

/** Retries for a single 512 KB slice before marking the session lost. */
const DIRECT_CHUNK_ATTEMPTS = 3

const WEBHOOK_POST_ATTEMPTS = 5
const WEBHOOK_CHUNK_ATTEMPTS = 5

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
      'Dosya çok büyük veya yükleme oturumu düştü. Kayıt hâlâ bu cihazda; İndir ile bilgisayara alın, sonra tekrar yükleyin. Apps Script v24+ (uploadFileInit) gerekir.'
    )
  }
  if (/Chunk failed HTTP|Drive resumable|No resumable|Drive direct session/i.test(combined)) {
    return (
      'Drive’a yükleme başarısız (ağ). Bağlantıyı kontrol edip tekrar deneyin; ' +
      'kararsız LTE’de Wi‑Fi daha güvenilir. Sürmezse Yönetime bildirin.'
    )
  }
  return raw || detail || fallback
}

function looksLikeJson_(text: string): boolean {
  const t = text.trim()
  return t.startsWith('{') || t.startsWith('[')
}

function extractJsonObject_(text: string): string | null {
  const t = text.trim()
  if (looksLikeJson_(t)) return t
  // Some error pages wrap JSON — try outermost object.
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return t.slice(start, end + 1)
  }
  return null
}

function extractMovedLocation_(html: string): string | null {
  const patterns = [
    /href=["'](https:\/\/script\.googleusercontent\.com[^"']+)["']/i,
    /HREF=["'](https:\/\/script\.googleusercontent\.com[^"']+)["']/i,
    /"(https:\/\/script\.googleusercontent\.com\/macros\/echo[^"]+)"/i,
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match?.[1]) return match[1]
  }
  return null
}

function unreadableWebhookMessage(text: string, httpStatus: number): string {
  const t = text.trim()
  if (!t) {
    return (
      'Drive webhook boş yanıt verdi (sık: zaman aşımı veya ağ koptu). ' +
      'Ses kaydı bu cihazda; İndir ile yedekleyip tekrar kaydedin.'
    )
  }
  if (/took too long|timed out|timeout|Exceeded maximum execution/i.test(t)) {
    return (
      'Apps Script zaman aşımı (uzun ses yüklemesi). Kayıt bu cihazda; İndir ile alın ve tekrar deneyin.'
    )
  }
  if (
    /<!DOCTYPE|<html|Moved Temporarily|Error|Exception|Script function not found/i.test(
      t,
    )
  ) {
    return (
      'Drive webhook HTML hata sayfası döndü (uzun yüklemede sık). ' +
      'Kayıt bu cihazda; İndir ile yedekleyip tekrar deneyin. Script v26+ ve ağ kararlı olmalı.'
    )
  }
  if (httpStatus === 0 || httpStatus >= 500) {
    return (
      `Drive webhook yanıt veremedi (HTTP ${httpStatus || 'ağ'}). ` +
      'Kayıt bu cihazda; kısa süre sonra tekrar deneyin.'
    )
  }
  return (
    'Webhook yanıtı okunamadı. Uzun ses kayıtlarında ağ/Apps Script kesintisi olabilir — ' +
    'İndir ile yedekleyip tekrar kaydedin. Sürmezse Apps Script New version yayınlayın.'
  )
}

/** doGet ping looks like ok:true without upload fields — POST was lost to a redirect GET. */
function isWebhookVersionPing_(parsed: Record<string, unknown>): boolean {
  return (
    parsed.ok === true &&
    Array.isArray(parsed.features) &&
    typeof parsed.version === 'string' &&
    parsed.fileId == null &&
    parsed.resumed == null &&
    parsed.pending == null &&
    parsed.done == null &&
    parsed.error == null
  )
}

/**
 * Readable Apps Script calls via POST JSON body (idToken never in the URL).
 * text/plain avoids CORS preflight; Apps Script may 302 →
 * script.googleusercontent.com — re-POST body to Location when needed.
 * Retries cover empty/HTML blips on multi-minute voice uploads.
 */
export async function postWebhookForm(
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = getSheetsWebhookUrl()
  if (!url) {
    throw new UserFacingError('Drive webhook yapılandırılmamış.')
  }

  let lastUnreadable = ''
  let lastStatus = 0

  for (let attempt = 0; attempt < WEBHOOK_POST_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(400 * attempt + Math.floor(Math.random() * 200))
    }

    let idToken: string
    try {
      idToken = await getWebhookIdToken()
    } catch {
      throw new UserFacingError(
        'Oturum jetonu alınamadı. Tekrar giriş yapıp ses kaydını yeniden yükleyin (İndir ile yedekleyin).',
      )
    }

    const body = JSON.stringify({ ...params, idToken })
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
    }

    let response: Response
    try {
      response = await fetch(url, init)
    } catch {
      lastUnreadable = ''
      lastStatus = 0
      continue
    }

    let text = await response.text()
    lastStatus = response.status

    if (!looksLikeJson_(text)) {
      const location =
        response.headers.get('Location') ||
        response.headers.get('location') ||
        extractMovedLocation_(text)
      if (location) {
        try {
          response = await fetch(location, { ...init, redirect: 'follow' })
          text = await response.text()
          lastStatus = response.status
        } catch {
          lastUnreadable = text
          continue
        }
      }
    }

    const jsonText = extractJsonObject_(text)
    if (!jsonText) {
      lastUnreadable = text
      continue
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonText) as Record<string, unknown>
    } catch {
      lastUnreadable = text
      continue
    }

    // POST accidentally became GET after a 302 — retry so upload actions work.
    if (isWebhookVersionPing_(parsed) && params.action && params.action !== '') {
      lastUnreadable = jsonText
      continue
    }

    return parsed
  }

  throw new UserFacingError(unreadableWebhookMessage(lastUnreadable, lastStatus))
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
 * Requires webhook v24+ (uploadFileInit / uploadFileChunk); v27+ session props.
 * On session drop, restarts from byte 0 (new Drive session) up to RESUMABLE_FULL_RESTARTS.
 */
async function uploadFileResumable(input: {
  file: Blob
  fileName: string
  mimeType: string
  folder: DriveUploadFolder
  folderPath?: string
  onProgress?: (progress: DriveUploadProgress) => void
}): Promise<DriveUploadResult> {
  let lastError: unknown = null
  for (let round = 0; round < RESUMABLE_FULL_RESTARTS; round += 1) {
    if (round > 0) {
      await sleep(800 * round)
      input.onProgress?.({
        phase: 'uploading',
        ratio: 0.02,
        fileName: input.fileName,
      })
    }
    try {
      return await uploadFileResumableOnce(input)
    } catch (error) {
      lastError = error
      if (!isResumableRestartableError_(error) || round === RESUMABLE_FULL_RESTARTS - 1) {
        throw error
      }
    }
  }
  if (lastError instanceof UserFacingError) throw lastError
  throw new UserFacingError(
    'Uzun ses yüklemesi oturumu düştü. Kayıt bu cihazda; İndir ile yedekleyip tekrar deneyin.',
  )
}

function isResumableRestartableError_(error: unknown): boolean {
  const msg =
    error instanceof UserFacingError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error ?? '')
  return /session expired|chunk order|Corrupt|oturumu düştü|Retry|resumable|parça|Chunk failed|Drive’a yükleme/i.test(
    msg,
  )
}

async function uploadFileResumableOnce(input: {
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

  if (!init.ok || init.resumed !== true) {
    throw new UserFacingError(
      webhookErrorMessage(
        init,
        'Büyük dosya yükleme oturumu açılamadı. Apps Script v27+ (uploadFileInit) yayınlayın.',
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

    let parsed: Record<string, unknown> | null = null
    let lastChunkError: unknown = null
    for (let attempt = 0; attempt < WEBHOOK_CHUNK_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await sleep(600 * attempt)
      }
      try {
        parsed = await postWebhookForm({
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
        // Order/session errors: force full re-init (outer restart)
        if (
          parsed.ok === false &&
          /session expired|chunk order|Corrupt/i.test(
            String(parsed.error ?? ''),
          )
        ) {
          throw new UserFacingError(
            webhookErrorMessage(
              parsed,
              'Yükleme oturumu düştü. Otomatik yeniden denenecek…',
            ),
          )
        }
        if (parsed.ok) break
        lastChunkError = parsed
      } catch (error) {
        if (
          error instanceof UserFacingError &&
          /oturumu düştü|session expired|chunk order|Corrupt/i.test(
            error.message,
          )
        ) {
          throw error
        }
        lastChunkError = error
        parsed = null
      }
    }

    if (!parsed) {
      if (lastChunkError instanceof UserFacingError) throw lastChunkError
      throw new UserFacingError(
        mapUnknownChunkError_(lastChunkError) ||
          'Dosya parçası yüklenemedi. Kayıt bu cihazda; İndir ile yedekleyip tekrar deneyin.',
      )
    }

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
      // Prefer server-reported next byte when present (Drive Range end).
      const next = Number(parsed.next)
      offset =
        Number.isFinite(next) && next > offset ? next : endExclusive
      chunkIndex += 1
      continue
    }

    throw new UserFacingError(
      webhookErrorMessage(parsed, 'Dosya Google Drive’a yüklenemedi.'),
    )
  }

  throw new UserFacingError(
    'Yükleme tamamlanamadı (son parça yanıtı yok). Apps Script v27+ kontrol edin.',
  )
}

/**
 * "Range: bytes=0-12345" → 12345 (last committed byte). Null when missing —
 * cross-origin the header may not be exposed; caller then uses known end.
 */
export function parseResumableRangeEnd(header: string | null | undefined): number | null {
  const match = String(header ?? '').match(/bytes=\d+-(\d+)/)
  if (!match) return null
  const end = Number(match[1])
  return Number.isFinite(end) && end >= 0 ? end : null
}

/**
 * Stall guard per slice. Short enough that CORS / dead sessions fall back
 * quickly instead of sitting on the UI at 2% for many minutes.
 */
export function directPutTimeoutMs(bytes: number): number {
  // Never under 45s, about ≥16 KB/s, hard ceiling 3 minutes for one slice.
  return Math.min(
    180_000,
    Math.max(45_000, Math.ceil(bytes / (16 * 1024)) * 1000),
  )
}

type DirectPutResponse = {
  status: number
  text: string
  rangeHeader: string | null
}

/**
 * One PUT to the Drive resumable session URL. XMLHttpRequest (not fetch)
 * for upload progress events. Rejects only on network error / timeout.
 */
function putToDriveSession(input: {
  sessionUrl: string
  body: Blob | null
  contentRange: string | null
  mimeType: string
  timeoutMs: number
  onProgress?: (loadedBytes: number) => void
}): Promise<DirectPutResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', input.sessionUrl)
    xhr.timeout = input.timeoutMs
    // Only set Content-Type when uploading bytes (status-query uses empty body).
    if (input.body) {
      xhr.setRequestHeader(
        'Content-Type',
        input.mimeType || 'application/octet-stream',
      )
    }
    if (input.contentRange) {
      xhr.setRequestHeader('Content-Range', input.contentRange)
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) input.onProgress?.(event.loaded)
    }
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        text: xhr.responseText || '',
        rangeHeader: xhr.getResponseHeader('Range'),
      })
    }
    xhr.onerror = () => reject(new Error('network'))
    xhr.ontimeout = () => reject(new Error('timeout'))
    xhr.send(input.body)
  })
}

function directResultFromFileJson(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as { id?: unknown }
    const id = String(parsed.id ?? '').trim()
    return id || null
  } catch {
    return null
  }
}

/**
 * Quick CORS / session health check. Empty PUT with Content-Range: bytes * /N
 * should return 308 before any bytes leave the phone. Network error here means
 * the browser cannot talk to Drive’s session URL — skip the direct path.
 */
async function probeDirectSession(
  sessionUrl: string,
  totalBytes: number,
  mimeType: string,
): Promise<'ok' | 'blocked' | 'dead'> {
  try {
    const probe = await putToDriveSession({
      sessionUrl,
      body: null,
      contentRange: `bytes */${totalBytes}`,
      mimeType,
      timeoutMs: 20_000,
    })
    if (probe.status === 308) return 'ok'
    if (probe.status >= 200 && probe.status < 300) return 'ok'
    if (probe.status === 404 || probe.status === 410) return 'dead'
    // Unexpected statuses usually mean the session is not CORS-usable.
    return 'blocked'
  } catch {
    return 'blocked'
  }
}

/**
 * Slice-by-slice binary upload into one Drive resumable session.
 * Tracks offset from known sent ranges (does not depend on CORS exposing Range).
 * Throws Error('blocked') when the first slice cannot leave the device (CORS).
 * Throws Error('session_lost') when the session must be re-opened.
 */
async function putBlobWithResume(input: {
  sessionUrl: string
  file: Blob
  mimeType: string
  onBytes?: (sentBytes: number) => void
}): Promise<string> {
  const total = input.file.size
  let offset = 0

  while (offset < total) {
    const endExclusive = Math.min(offset + DRIVE_DIRECT_CHUNK_BYTES, total)
    const endInclusive = endExclusive - 1
    const slice = input.file.slice(offset, endExclusive)
    let lastError: 'network' | 'timeout' | 'bad' | null = null

    for (let attempt = 0; attempt < DIRECT_CHUNK_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await sleep(400 * attempt)

      input.onBytes?.(offset)

      let response: DirectPutResponse
      try {
        response = await putToDriveSession({
          sessionUrl: input.sessionUrl,
          body: slice,
          contentRange: `bytes ${offset}-${endInclusive}/${total}`,
          mimeType: input.mimeType,
          timeoutMs: directPutTimeoutMs(slice.size),
          onProgress: (loaded) => input.onBytes?.(offset + loaded),
        })
      } catch (error) {
        lastError =
          error instanceof Error && error.message === 'timeout'
            ? 'timeout'
            : 'network'
        continue
      }

      lastError = null

      if (response.status >= 200 && response.status < 300) {
        const fileId = directResultFromFileJson(response.text)
        if (fileId) {
          input.onBytes?.(total)
          return fileId
        }
        // 2xx body without id — treat as lost session.
        throw new Error('session_lost')
      }

      if (response.status === 308) {
        // Drive accepted this slice. Prefer header offset; otherwise advance
        // by the range we just sent (works when Range is hidden by CORS).
        const committedEnd = parseResumableRangeEnd(response.rangeHeader)
        offset = committedEnd !== null ? committedEnd + 1 : endExclusive
        input.onBytes?.(Math.min(offset, total))
        lastError = null
        break
      }

      if (response.status === 404 || response.status === 410) {
        throw new Error('session_lost')
      }

      lastError = 'bad'
    }

    if (lastError === null && offset >= endExclusive) {
      // Advanced via 308 — keep going.
      continue
    }

    // First slice never left the phone → CORS / network block. Bail fast.
    if (offset === 0) {
      throw new Error('blocked')
    }

    // Mid-upload: try status probe once, then re-open session.
    try {
      const probe = await putToDriveSession({
        sessionUrl: input.sessionUrl,
        body: null,
        contentRange: `bytes */${total}`,
        mimeType: input.mimeType,
        timeoutMs: 15_000,
      })
      if (probe.status >= 200 && probe.status < 300) {
        const fileId = directResultFromFileJson(probe.text)
        if (fileId) return fileId
      }
      if (probe.status === 308) {
        const committedEnd = parseResumableRangeEnd(probe.rangeHeader)
        if (committedEnd !== null) {
          offset = committedEnd + 1
          input.onBytes?.(offset)
          continue
        }
      }
    } catch {
      /* force new session */
    }
    throw new Error('session_lost')
  }

  throw new Error('session_lost')
}

/**
 * v28 direct path: webhook opens the Drive resumable session (with this
 * page's Origin for CORS), browser PUTs raw 512 KB slices to googleapis.com,
 * webhook then sets link sharing. Returns null when CORS/old webhook prevents
 * it so the chunked Apps Script path can take over.
 */
async function uploadFileDirect(input: {
  file: Blob
  fileName: string
  mimeType: string
  folder: DriveUploadFolder
  folderPath?: string
  onProgress?: (progress: DriveUploadProgress) => void
}): Promise<DriveUploadResult | null> {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') {
    return null
  }
  const total = input.file.size
  if (!(total > 0)) return null
  const folderPath = input.folderPath?.trim() || ''
  const report = (ratio: number, phase: DriveUploadProgress['phase'] = 'uploading') => {
    input.onProgress?.({
      phase,
      ratio,
      fileName: input.fileName,
    })
  }

  let fileId: string | null = null
  for (let round = 0; round < DIRECT_SESSION_ATTEMPTS && !fileId; round += 1) {
    if (round > 0) await sleep(500 * round)

    report(0.03)

    let init: Record<string, unknown>
    try {
      init = await postWebhookForm({
        action: 'uploadDirectInit',
        uploadToken: crypto.randomUUID(),
        folder: input.folder,
        ...(folderPath ? { folderPath } : {}),
        fileName: input.fileName,
        mimeType: input.mimeType,
        totalBytes: String(total),
        origin: window.location.origin,
      })
    } catch {
      // Webhook unreachable/unreadable — let the outer caller try legacy path.
      return null
    }

    const sessionUrl = String(init.sessionUrl ?? '')
    if (init.ok !== true || !sessionUrl.startsWith('https://')) {
      // Old webhook or Drive init error.
      return null
    }

    report(0.05)

    const health = await probeDirectSession(sessionUrl, total, input.mimeType)
    if (health === 'blocked') {
      // Browser cannot reach googleapis session (CORS / network). Fall back.
      return null
    }
    if (health === 'dead') {
      continue
    }

    try {
      fileId = await putBlobWithResume({
        sessionUrl,
        file: input.file,
        mimeType: input.mimeType,
        onBytes: (sent) => {
          const safe = Math.min(total, Math.max(0, sent))
          report(0.06 + (safe / total) * 0.9)
        },
      })
    } catch (error) {
      fileId = null
      const code = error instanceof Error ? error.message : ''
      // CORS/blocked or any first-session failure → fall back immediately.
      if (code === 'blocked' || round === 0) return null
    }
  }

  if (!fileId) return null

  report(0.97, 'finishing')

  try {
    const finish = await postWebhookForm({
      action: 'uploadDirectFinish',
      fileId,
    })
    const result = resultFromParsed(finish)
    report(1, 'finishing')
    return result
  } catch {
    // File is already on Drive; still surface success if finish fails.
    return {
      fileId,
      url: `https://drive.google.com/uc?export=view&id=${fileId}`,
      webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    }
  }
}

function mapUnknownChunkError_(error: unknown): string {
  if (error instanceof UserFacingError) {
    return error.message.replace(/^USER_/, '')
  }
  if (error && typeof error === 'object' && 'error' in error) {
    return webhookErrorMessage(
      error as Record<string, unknown>,
      'Dosya Google Drive’a yüklenemedi.',
    )
  }
  return ''
}

/**
 * Upload a file to Google Drive via the free Apps Script webhook.
 * Does not use Firebase Storage.
 *
 * Images: compressed client-side toward single-shot size (mobile-friendly).
 * Small files: single base64 POST.
 * Large files (voice up to 30 dk): direct browser → Drive binary PUT
 * (webhook v28 uploadDirectInit); falls back to webhook chunked resumable
 * (v27 uploadFileInit/Chunk) when direct is unavailable.
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

  let file = input.file
  let fileName = input.fileName
  let mimeType = input.mimeType || file.type || 'application/octet-stream'
  const looksImage =
    mimeType.startsWith('image/')
    || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(fileName)

  // Phone camera originals (2–5 MB) often fail multi-chunk on LTE. Shrink first.
  if (looksImage && file.size > Math.floor(DRIVE_SINGLE_SHOT_MAX_BYTES * 0.75)) {
    input.onProgress?.({
      phase: 'encoding',
      ratio: 0.04,
      fileName,
    })
    try {
      const compressed = await compressImageForDrive(file, {
        maxBytes: Math.floor(DRIVE_SINGLE_SHOT_MAX_BYTES * 0.92),
        maxEdge: 1920,
        onProgress: (ratio) => {
          input.onProgress?.({
            phase: 'encoding',
            ratio: 0.04 + ratio * 0.28,
            fileName,
          })
        },
      })
      if (compressed && compressed.blob.size > 0) {
        file = compressed.blob
        mimeType = compressed.mimeType
        fileName = jpegDriveFileName(fileName)
      }
    } catch {
      // Keep original; resumable path may still work
    }
  }

  if (file.size <= DRIVE_SINGLE_SHOT_MAX_BYTES) {
    return uploadFileSingleShot({
      ...input,
      file,
      fileName,
      mimeType,
    })
  }

  // Preferred large-file path (v28): raw binary straight to Drive's servers.
  // One fast PUT instead of dozens of base64 webhook chunks.
  const direct = await uploadFileDirect({
    ...input,
    file,
    fileName,
    mimeType,
  })
  if (direct) return direct

  // Fallback: chunked upload through the Apps Script webhook (v27 path).
  return uploadFileResumable({
    ...input,
    file,
    fileName,
    mimeType,
  })
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
