import { describe, expect, it } from 'vitest'
import {
  buildUpsertPayload,
  dailyReportSheetMatchDates,
  formatSheetKazanc,
  formatSheetDateOnly,
  formatSheetSonDurum,
  isSheetExportableSonDurum,
  isSheetsRowNotFoundError,
  SHEET_SON_DURUM,
} from '@/features/jobs/services/sheetsExport'
import type { JobDocument } from '@/features/jobs/types/job'

function minimalJob(overrides: Partial<JobDocument> = {}): JobDocument {
  return {
    id: 'job-1',
    companyName: 'Acme',
    contactPersonName: 'Ali',
    contactPhone: '05321234567',
    province: 'İstanbul',
    acquiredDate: '2026-07-24',
    createdByNameSnapshot: 'Planner',
    ...overrides,
  } as JobDocument
}

describe('isSheetsRowNotFoundError', () => {
  it('detects Apps Script and USER_ wrapped messages', () => {
    expect(isSheetsRowNotFoundError(new Error('Row not found (match JOB ID)'))).toBe(
      true,
    )
    expect(
      isSheetsRowNotFoundError(
        new Error(
          'USER_Sheets satırı bulunamadı (JOB ID veya FİRMA ADI + TARİH eşleşmedi).',
        ),
      ),
    ).toBe(true)
    expect(isSheetsRowNotFoundError(new Error('Unauthorized'))).toBe(false)
  })
})

describe('formatSheetDateOnly', () => {
  it('strips times so Excel TARİH never wraps into the next column', () => {
    expect(formatSheetDateOnly('2026-08-14T18:00')).toBe('14.08.2026')
    expect(formatSheetDateOnly('14.08.2026 18:00')).toBe('14.08.2026')
    expect(formatSheetDateOnly('2026-08-14')).toBe('14.08.2026')
  })
})

describe('formatSheetSonDurum', () => {
  it('maps review actions to fixed Excel labels', () => {
    expect(formatSheetSonDurum('approved')).toBe(SHEET_SON_DURUM.approved)
    expect(formatSheetSonDurum('cancelled')).toBe(SHEET_SON_DURUM.cancelled)
    expect(formatSheetSonDurum('rejected')).toBe(SHEET_SON_DURUM.rejected)
    expect(formatSheetSonDurum('shot')).toBe(SHEET_SON_DURUM.shot)
  })
})

describe('formatSheetKazanc', () => {
  it('formats kuruş as Turkish TL string', () => {
    expect(formatSheetKazanc(1_250_000)).toBe('12.500 TL')
  })
})

describe('buildUpsertPayload', () => {
  it('builds sheet row with jobId and without webhook secret', () => {
    const payload = buildUpsertPayload(minimalJob(), SHEET_SON_DURUM.approved)
    expect(payload).toMatchObject({
      action: 'upsertJobRow',
      jobId: 'job-1',
      isId: 'job-1',
      firmaAdi: 'Acme',
      sonDurum: 'Konfirme',
      islem: 'approved',
      fatura: '',
      kazanc: '',
      dk: '',
      haber: '',
      adres: 'İstanbul',
    })
    expect(payload).not.toHaveProperty('secret')
    expect(payload).not.toHaveProperty('idToken')
  })

  it('sets islem only for approved / cancelled (not shot)', () => {
    expect(
      buildUpsertPayload(minimalJob(), SHEET_SON_DURUM.shot),
    ).not.toHaveProperty('islem')
    expect(
      buildUpsertPayload(minimalJob(), SHEET_SON_DURUM.cancelled).islem,
    ).toBe('cancelled')
  })

  it('maps formatSheetSonDurum; rejected is not exportable to Excel', () => {
    expect(formatSheetSonDurum('rejected')).toBe(SHEET_SON_DURUM.rejected)
    expect(isSheetExportableSonDurum(SHEET_SON_DURUM.rejected)).toBe(false)
    expect(isSheetExportableSonDurum(SHEET_SON_DURUM.pending)).toBe(true)
    expect(isSheetExportableSonDurum(SHEET_SON_DURUM.approved)).toBe(true)
    expect(isSheetExportableSonDurum(SHEET_SON_DURUM.cancelled)).toBe(true)
    expect(isSheetExportableSonDurum(SHEET_SON_DURUM.shot)).toBe(true)
  })

  it('writes çekim günü date-only to TARİH and never includes a time', () => {
    const payload = buildUpsertPayload(
      minimalJob({
        acquiredDate: '2026-08-12T11:30',
        plannedExecutionDate: '2026-08-14T18:00',
      }),
      SHEET_SON_DURUM.approved,
    )
    expect(payload.tarih).toBe('14.08.2026')
    expect(payload.plannedTarih).toBe('14.08.2026')
    expect(payload.acquiredTarih).toBe('12.08.2026')
    expect(payload.tarih).not.toMatch(/:/)
    expect(payload.plannedTarih).not.toMatch(/:/)
  })

  it('writes Onay bekliyor on pending insert without islem', () => {
    const payload = buildUpsertPayload(minimalJob(), SHEET_SON_DURUM.pending)
    expect(payload.sonDurum).toBe('Onay bekliyor')
    expect(payload.jobId).toBe('job-1')
    expect(payload).not.toHaveProperty('islem')
  })

  it('leaves DK/HABER/KAZANÇ empty on status upsert so reporter money is not wiped', () => {
    const payload = buildUpsertPayload(minimalJob(), SHEET_SON_DURUM.shot)
    expect(payload.dk).toBe('')
    expect(payload.haber).toBe('')
    expect(payload.kazanc).toBe('')
    expect(payload.sonDurum).toBe('Çekildi')
    expect(payload).not.toHaveProperty('islem')
  })

  it('normalizes phone for Excel display', () => {
    const payload = buildUpsertPayload(
      minimalJob({ contactPhone: '0555 111 22 33' }),
      SHEET_SON_DURUM.approved,
    )
    expect(payload.telNo).toMatch(/555/)
  })
})

describe('dailyReportSheetMatchDates', () => {
  it('uses çekim günü as tarih (not iş alım) so month-tab match finds the row', () => {
    expect(
      dailyReportSheetMatchDates(
        minimalJob({
          acquiredDate: '2026-08-12',
          plannedExecutionDate: '2026-09-10',
        }),
      ),
    ).toEqual({
      tarih: '10.09.2026',
      plannedTarih: '10.09.2026',
      acquiredTarih: '12.08.2026',
    })
  })
})
