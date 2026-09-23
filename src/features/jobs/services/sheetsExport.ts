import type { JobDocument } from '@/features/jobs/types/job'
import { kurusToTry } from '@/lib/currency'
import { formatDateTimeTr } from '@/lib/date'
import { formatJobCreatorPrimary } from '@/features/jobs/utils/formatJobCreator'
import { formatPhoneDisplay, normalizeTurkishPhone } from '@/lib/phone'
import { tarihDayKey } from '@/features/jobs/utils/sheetRowMatch'
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
 * Reddet deletes the pending row (never writes “Reddedildi”).
 */
export const SHEET_SON_DURUM = {
  pending: 'Onay bekliyor',
  approved: 'Konfirme',
  /** @deprecated Not written — reject deletes the Excel row instead. */
  rejected: 'Reddedildi',
  cancelled: 'İptal edildi',
  shot: 'Çekildi',
} as const

export type SheetSonDurum = (typeof SHEET_SON_DURUM)[keyof typeof SHEET_SON_DURUM]

/** Statuses that get an Excel row / SON DURUM update. */
export function isSheetExportableSonDurum(sonDurum: string): boolean {
  return (
    sonDurum === SHEET_SON_DURUM.pending
    || sonDurum === SHEET_SON_DURUM.approved
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
 * cols 1–12 fixed (TARİH … Fatura); JOB ID written to column V (header / col 22, v35+).
 * Monthly tabs (v36+): sheet name = çekim ayı, e.g. "Eylül 2026".
 * Row match: JOB ID preferred (V then legacy M, across nearby month tabs); else firma + iş alım/çekim günü (never insert on Çekildi).
 * Auth: Firebase ID token (idToken) — never a client webhook secret.
 */
export type SheetsWebhookPayload = {
  idToken: string
  action: 'upsertJobRow' | 'updateSonDurum' | 'deleteJobRow'
  /** Firestore job id — written to JOB ID column (V); primary row key (v13+). */
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
  /** Planned shoot day — extra findRow candidate (updateDkHaber). */
  plannedTarih?: string
  /** İş alım günü — extra findRow candidate for legacy TARİH cells. */
  acquiredTarih?: string
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

/** Excel TARİH cell: always `dd.MM.yyyy`, never a time (avoids wrap/overflow). */
export function formatSheetDateOnly(value: string): string {
  const iso = tarihDayKey(value)
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year}`
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
  const acquiredTarih = formatSheetDateOnly(job.acquiredDate)
  const plannedTarih = formatSheetDateOnly(
    _overrides?.plannedExecutionDate || job.plannedExecutionDate || '',
  )
  // Excel TARİH = çekim günü (saat yok). İş alım tarihi yalnızca eşleşme için gider.
  const tarih = plannedTarih || acquiredTarih
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
    ...(plannedTarih ? { plannedTarih } : {}),
    ...(acquiredTarih ? { acquiredTarih } : {}),
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

/** True when Apps Script could not match JOB ID or FİRMA ADI + TARİH. */
export function isSheetsRowNotFoundError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  return /satırı bulunamadı|row not found/i.test(raw)
}

async function postSheetsWebhook(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const url = getSheetsWebhookUrl()
  if (!url) return null

  const idToken = await getWebhookIdToken()
  const body = JSON.stringify({ ...payload, idToken })

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })
  } catch {
    throw new UserFacingError(
      'Sheets güncellenemedi. Ağ hatası — tekrar deneyin.',
    )
  }

  const text = await response.text()
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    parsed = null
  }
  if (parsed && parsed.ok === true) return parsed

  const message = sheetsWebhookErrorMessage(parsed, text.slice(0, 280))
  console.error('[sheetsExport]', message, parsed)
  throw new UserFacingError(message)
}

export async function upsertJobRowToSheet(
  job: JobDocument,
  sonDurum: SheetSonDurum,
  overrides?: SheetExportOverrides,
): Promise<void> {
  if (!isSheetsWebhookConfigured()) return
  // Reddet is not a SON DURUM — caller deletes the row instead.
  if (!isSheetExportableSonDurum(sonDurum)) return
  await assertSheetsWebhookFresh()
  await postSheetsWebhook(buildUpsertPayload(job, sonDurum, overrides))
}

export type DeleteJobRowMatch = {
  /** Çekim günü — aylık sekme araması için (dd.MM.yyyy veya ISO). */
  tarih?: string
  plannedTarih?: string
}

/**
 * Remove the Excel row for this Firestore job (revert / reject).
 * JOB ID only (plus optional çekim tarihi for month-tab targeting).
 * Returns whether a row was actually deleted.
 */
export async function deleteJobRowFromSheet(
  jobId: string,
  match?: DeleteJobRowMatch,
): Promise<boolean> {
  if (!isSheetsWebhookConfigured()) return false
  const id = jobId.trim()
  if (!id) return false
  await assertSheetsWebhookFresh()
  const planned = (match?.plannedTarih ?? match?.tarih ?? '').trim()
  const parsed = await postSheetsWebhook({
    action: 'deleteJobRow',
    jobId: id,
    isId: id,
    ...(planned
      ? { tarih: planned, plannedTarih: planned }
      : {}),
  })
  return parsed?.deleted === true
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
 * Patch DK + HABER + KAZANÇ on the existing Excel row (never inserts).
 * Match: JOB ID, then firma/phone + iş alım or çekim günü.
 * Optional `sonDurum` is written in the same Apps Script call (v10+).
 */
export async function patchJobDkHaberInSheet(args: {
  jobId: string
  firmaAdi: string
  tarih: string
  plannedTarih?: string
  acquiredTarih?: string
  telNo?: string
  firmaSahibi?: string
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
    ...(args.plannedTarih?.trim() ? { plannedTarih: args.plannedTarih.trim() } : {}),
    ...(args.acquiredTarih?.trim() ? { acquiredTarih: args.acquiredTarih.trim() } : {}),
    ...(args.telNo?.trim() ? { telNo: args.telNo.trim() } : {}),
    ...(args.firmaSahibi?.trim() ? { firmaSahibi: args.firmaSahibi.trim() } : {}),
    dk: args.dk,
    haber: args.haber,
    kazanc: args.kazanc,
    ...(args.sonDurum ? { sonDurum: args.sonDurum } : {}),
  })
}

/**
 * Dates for daily-report → Excel DK/HABER match.
 * `tarih` = çekim günü (same rule as upsertJobRow), not iş alım.
 */
export function dailyReportSheetMatchDates(
  job: Pick<JobDocument, 'acquiredDate' | 'plannedExecutionDate'>,
): {
  tarih: string
  plannedTarih: string
  acquiredTarih: string
} {
  const acquiredTarih = formatSheetDateOnly(job.acquiredDate)
  const plannedTarih = formatSheetDateOnly(job.plannedExecutionDate)
  return {
    tarih: plannedTarih || acquiredTarih,
    plannedTarih,
    acquiredTarih,
  }
}

/**
 * Daily report → Excel: patch DK/HABER/KAZANÇ + Çekildi on the existing row.
 * Never appends a second Excel row. Match miss throws (caller toasts).
 */
export async function syncDailyReportCompanyToSheet(
  job: JobDocument,
  fields: { dk: string; haber: string; kazanc: string },
): Promise<void> {
  if (!isSheetsWebhookConfigured()) return
  const dates = dailyReportSheetMatchDates(job)
  await patchJobDkHaberInSheet({
    jobId: job.id,
    firmaAdi: job.companyName,
    tarih: dates.tarih,
    ...(dates.plannedTarih ? { plannedTarih: dates.plannedTarih } : {}),
    ...(dates.acquiredTarih ? { acquiredTarih: dates.acquiredTarih } : {}),
    telNo: formatSheetPhone(job.contactPhone),
    firmaSahibi: job.contactPersonName,
    ...fields,
    sonDurum: SHEET_SON_DURUM.shot,
  })
}

/** MPU create / pending edit / revert → Excel row with JOB ID and Onay bekliyor. */
export async function exportPendingJobToSheet(job: JobDocument): Promise<void> {
  await upsertJobRowToSheet(job, SHEET_SON_DURUM.pending)
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
  return planned ? formatSheetDateOnly(planned) : ''
}
