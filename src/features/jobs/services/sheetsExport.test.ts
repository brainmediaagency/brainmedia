import { describe, expect, it } from 'vitest'
import {
  buildUpsertPayload,
  formatSheetKazanc,
  formatSheetSonDurum,
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

  it('sets islem only for approved / cancelled (not rejected / shot)', () => {
    expect(
      buildUpsertPayload(minimalJob(), SHEET_SON_DURUM.rejected),
    ).not.toHaveProperty('islem')
    expect(
      buildUpsertPayload(minimalJob(), SHEET_SON_DURUM.shot),
    ).not.toHaveProperty('islem')
    expect(
      buildUpsertPayload(minimalJob(), SHEET_SON_DURUM.cancelled).islem,
    ).toBe('cancelled')
  })

  it('normalizes phone for Excel display', () => {
    const payload = buildUpsertPayload(
      minimalJob({ contactPhone: '0555 111 22 33' }),
      SHEET_SON_DURUM.approved,
    )
    expect(payload.telNo).toMatch(/555/)
  })
})
