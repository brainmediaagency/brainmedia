import { describe, expect, it } from 'vitest'
import { buildUpsertPayload, SHEET_SON_DURUM } from '@/features/jobs/services/sheetsExport'
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
    })
    expect(payload).not.toHaveProperty('secret')
    expect(payload).not.toHaveProperty('idToken')
  })
})
