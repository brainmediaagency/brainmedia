import type { JobDocument } from '@/features/jobs/types/job'
import { kurusToTry } from '@/lib/currency'
import { formatDateTimeTr, formatJobScheduleTr } from '@/lib/date'
import { formatJobCreatorPrimary } from '@/features/jobs/utils/formatJobCreator'
import { formatPhoneDisplay, normalizeTurkishPhone } from '@/lib/phone'
import { UserFacingError } from '@/lib/errors'
import {
  getSheetsWebhookUrl,
  getWebhookIdToken,
  isSheetsWebhookConfigured,
  isSheetsWebhookVersionStale,
  SHEETS_WEBHOOK_MIN_VERSION,
  SHEETS_WEBHOOK_STALE_MESSAGE,
} from '@/lib/sheetsWebhook'

export {
  isSheetsWebhookConfigured,
  SHEETS_WEBHOOK_MIN_VERSION,
  SHEETS_WEBHOOK_STALE_MESSAGE,
}

/**
 * SON DURUM values written to the ops Excel (fixed template).
 * Do not invent extra labels without product approval.
 * Note: muhabire ilet does NOT write to the sheet.
 * Rejected jobs are never exported (Firestore-only).
 */
export const SHEET_SON_DURUM = {
  approved: 'Konfirme',
  /** @deprecated Not written — kept only so callers cannot typo into a new label. */
  rejected: 'Reddedildi',
  cancelled: 'İptal edildi',
  shot: 'Çekildi',
} as const

export type SheetSonDurum = (typeof SHEET_SON_DURUM)[keyof typeof SHEET_SON_DURUM]

/** Statuses that get an Excel row / SON DURUM update. */
export function isSheetExportableSonDurum(sonDurum: string): boolean {
  return (
    sonDurum === SHEET_SON_DURUM.approved
    || sonDurum === SHEET_SON_DURUM.cancelled
    || sonDurum === SHEET_SON_DURUM.shot
  )
}

/** @deprecated Prefer SheetSonDurum helpers. */
export type SheetReviewAction = 'approved' | 'cancelled'

export type SheetExportOverrides = {
  plannedExecutionDate?: string
  reviewedByName?: string | null
  reviewNote?: string | null
}

/**
 * Payload mirrors Apps Script row order for the ops template:
 * cols 1–12 fixed (TARİH … Fatura); col 13 = JOB ID (Firestore job id, v13+).
 * Row match: JOB ID preferred; FİRMA ADI + TARİH fallback for legacy rows.
 * Auth: Firebase ID token (idToken) — never a client webhook secret.
 */
export type SheetsWebhookPayload = {
  idToken: string
  action: 'upsertJobRow' | 'updateSonDurum'
  /** Firestore job id — written to JOB ID column; primary row key (v13+). */
  jobId: string
  /** @deprecated alias kept for older scripts; same as jobId. */
  isId: string
  sonDurum: SheetSonDurum | string
  islem?: SheetReviewAction
  tarih?: string
  firmaAdi?: string
  firmaSahibi?: string
  telNo?: string
  /** Province (il) only. */
  adres?: string
  /** Optional Instagram handle/URL from the job package. */
  instagram?: string
  mpu?: string
  dk?: string
  haber?: string
  /** Firma toplam gelir (matrah+KDV); filled by daily reporter, empty on status upsert. */
  kazanc?: string
  /** Always empty from the app. */
  fatura?: string
}

export async function pingSheetsWebhookVersion(): Promise<{
  ok: boolean
  service?: string
  version?: string
  stale: boolean
  configured: boolean
}> {
  const url = getSheetsWebhookUrl()
  if (!url) return { ok: false, stale: true, configured: false }
  try {
    const response = await fetch(url, { method: 'GET' })
    const text = await response.text()
    const parsed = JSON.parse(text) as {
      ok?: boolean
      service?: string
      version?: string
      features?: string[]
    }
    return {
      ok: parsed.ok === true,
      service: parsed.service,
      version: parsed.version,
      stale: isSheetsWebhookVersionStale(parsed),
      configured: true,
    }
  } catch {
    return { ok: false, stale: true, configured: true }
  }
}

/**
 * Throws when webhook is configured but stale/unreachable.
 * No-op when webhook env is not set (Firestore-only mode).
 */
export async function assertSheetsWebhookFresh(): Promise<void> {
  if (!isSheetsWebhookConfigured()) return
  const ping = await pingSheetsWebhookVersion()
  if (ping.stale || !ping.ok) {
    throw new UserFacingError(SHEETS_WEBHOOK_STALE_MESSAGE)
  }
}

export function formatSheetKazanc(kurus: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kurusToTry(kurus))
  return `${formatted} TL`
}

export function formatSheetSonDurum(
  action: SheetReviewAction | 'rejected' | 'shot',
): SheetSonDurum {
  if (action === 'cancelled') return SHEET_SON_DURUM.cancelled
  if (action === 'approved') return SHEET_SON_DURUM.approved
  if (action === 'rejected') return SHEET_SON_DURUM.rejected
  return SHEET_SON_DURUM.shot
}

function formatSheetPhone(raw: string): string {
  const normalized = normalizeTurkishPhone(raw)
  if (normalized) return formatPhoneDisplay(normalized)
  return raw.trim()
}

/** Build upsert body without auth — caller adds idToken. */
export function buildUpsertPayload(
  job: JobDocument,
  sonDurum: SheetSonDurum,
  _overrides?: SheetExportOverrides,
): Omit<SheetsWebhookPayload, 'idToken'> {
  const creatorName = formatJobCreatorPrimary(job)
  const phone = formatSheetPhone(job.contactPhone)
  const tarih = formatJobScheduleTr(job.acquiredDate)
  // KAZANÇ muhabir raporundan gelir; konfirme/iptal anında boş bırakılır.
  const kazanc = ''

  let islem: SheetReviewAction | undefined
  if (sonDurum === SHEET_SON_DURUM.approved) islem = 'approved'
  if (sonDurum === SHEET_SON_DURUM.cancelled) islem = 'cancelled'

  return {
    action: 'upsertJobRow',
    jobId: job.id,
    isId: job.id,
    ...(islem ? { islem } : {}),
    tarih,
    firmaAdi: job.companyName,
    firmaSahibi: job.contactPersonName,
    telNo: phone,
    adres: job.province,
    instagram: job.instagram?.trim() ? job.instagram.trim() : '',
    mpu: creatorName,
    dk: '',
    haber: '',
    sonDurum,
    kazanc,
    fatura: '',
  }
}

function sheetsWebhookErrorMessage(
  parsed: Record<string, unknown> | null,
  rawText: string,
): string {
  const err =
    parsed && typeof parsed.error === 'string' ? parsed.error : rawText
  const detail =
    parsed && typeof parsed.detail === 'string' ? parsed.detail : ''
  const combined = [err, detail].filter(Boolean).join(' — ')
  if (/FIREBASE_WEB_API_KEY/i.test(combined)) {
    return (
      'Sheets webhook: Apps Script Script properties’e FIREBASE_WEB_API_KEY ekleyin, New version yayınlayın.'
    )
  }
  if (/invalid islem/i.test(combined) || /invalid request/i.test(combined)) {
    return 'Sheets webhook güncel değil. Yeni Google hesabında Code.gs’i yapıştırıp New version yayınlayın.'
  }
  if (/row not found/i.test(combined)) {
    return 'Sheets satırı bulunamadı (JOB ID veya FİRMA ADI + TARİH eşleşmedi).'
  }
  if (/unauthorized|forbidden/i.test(combined)) {
    return (
      'Sheets webhook yetkisiz. Çıkış/giriş yapın; sürmezse FIREBASE_WEB_API_KEY ayarını kontrol edin.'
    )
  }
  if (combined.trim()) return `Sheets güncellenemedi: ${combined}`
  return 'Sheets güncellenemedi.'
}

async function postSheetsWebhook(payload: Record<string, unknown>): Promise<void> {
  const url = getSheetsWebhookUrl()
  if (!url) return

  const idToken = await getWebhookIdToken()
  const body = JSON.stringify({ ...payload, idToken })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })
    const text = await response.text()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = null
    }
    if (parsed && parsed.ok === false) {
      const message = sheetsWebhookErrorMessage(parsed, text)
      console.error('[sheetsExport]', message, parsed)
      throw new UserFacingError(message)
    }
    if (parsed && parsed.ok === true) return
    if (!response.ok) {
      const message = sheetsWebhookErrorMessage(parsed, text)
      console.error('[sheetsExport]', message, { status: response.status })
      throw new UserFacingError(message)
    }
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    console.warn(
      '[sheetsExport] Readable webhook POST failed; retrying no-cors (response opaque).',
      error,
    )
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })
  }
}

export async function upsertJobRowToSheet(
  job: JobDocument,
  sonDurum: SheetSonDurum,
  overrides?: SheetExportOverrides,
): Promise<void> {
  if (!isSheetsWebhookConfigured()) return
  // Product: rejected jobs stay in the app only — no Excel row / "Reddedildi" status.
  if (!isSheetExportableSonDurum(sonDurum)) return
  await assertSheetsWebhookFresh()
  await postSheetsWebhook(buildUpsertPayload(job, sonDurum, overrides))
}

/** Full-row upsert so SON DURUM + firma/tarih stay aligned. */
export async function updateJobSonDurumInSheet(
  job: JobDocument,
  sonDurum: SheetSonDurum,
): Promise<void> {
  await upsertJobRowToSheet(job, sonDurum)
}

export async function patchJobSonDurumInSheet(
  jobId: string,
  sonDurum: SheetSonDurum,
  match?: { firmaAdi: string; tarih: string },
): Promise<void> {
  if (!isSheetsWebhookConfigured()) return
  if (!isSheetExportableSonDurum(sonDurum)) return
  if (!match?.firmaAdi || !match?.tarih) return

  await assertSheetsWebhookFresh()
  await postSheetsWebhook({
    action: 'updateSonDurum',
    jobId,
    isId: jobId,
    sonDurum,
    firmaAdi: match.firmaAdi,
    tarih: match.tarih,
  })
}

/**
 * Patch DK + HABER + KAZANÇ for the row matched by JOB ID (preferred) or
 * FİRMA ADI + TARİH (TARİH = job `acquiredDate` as dd.MM.yyyy).
 * Used by the daily reporter report. Optional `sonDurum` is written in the same
 * Apps Script call (v10+) so Çekildi never races ahead of / clears KAZANÇ.
 */
export async function patchJobDkHaberInSheet(args: {
  jobId: string
  firmaAdi: string
  tarih: string
  dk: string
  haber: string
  /** Firma toplam gelir (matrah+KDV), e.g. "12.500 TL". */
  kazanc: string
  /** When set (e.g. Çekildi), patched atomically with DK/HABER/KAZANÇ. */
  sonDurum?: SheetSonDurum
}): Promise<void> {
  if (!isSheetsWebhookConfigured()) return
  if (!args.jobId.trim() && (!args.firmaAdi.trim() || !args.tarih.trim())) return

  await assertSheetsWebhookFresh()
  await postSheetsWebhook({
    action: 'updateDkHaber',
    jobId: args.jobId,
    isId: args.jobId,
    firmaAdi: args.firmaAdi,
    tarih: args.tarih,
    dk: args.dk,
    haber: args.haber,
    kazanc: args.kazanc,
    ...(args.sonDurum ? { sonDurum: args.sonDurum } : {}),
  })
}

export async function exportJobReviewToSheet(
  job: JobDocument,
  action: SheetReviewAction,
  overrides?: SheetExportOverrides,
): Promise<void> {
  await upsertJobRowToSheet(job, formatSheetSonDurum(action), overrides)
}

/** @deprecated unused helper kept for call-site clarity */
export function formatSheetTimestamp(): string {
  return formatDateTimeTr(new Date())
}

export function formatSheetPlanned(job: JobDocument, override?: string): string {
  const planned = override?.trim() || job.plannedExecutionDate?.trim() || ''
  return planned ? formatJobScheduleTr(planned) : ''
}
