import { describe, expect, it } from 'vitest'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  buildOperationsLedgerRow,
  calendarMonthBounds,
  sortLedgerRowsNewestFirst,
} from '@/features/operations-ledger/services/operationsLedgerService'
import { operationsLedgerToCsv } from '@/features/operations-ledger/utils/operationsLedgerCsv'
import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'
import type { ReporterDailyCompany } from '@/features/reporter/types/reporter'

function job(overrides: Partial<JobDocument> = {}): JobDocument {
  return {
    id: 'job-1',
    companyName: 'Özcanlar Yapı Hafriyat',
    companyNameNormalized: 'ozcanlar yapi hafriyat',
    contactPersonName: 'Metin Özcan',
    contactPhone: '05078320557',
    contactCount: 1,
    contacts: [{ name: 'Metin Özcan', mobilePhone: '05078320557', workPhone: null }],
    province: 'İzmir',
    district: 'Konak',
    fullAddress: 'İzmir Konak',
    instagram: null,
    acquiredDate: '2026-09-10',
    plannedExecutionDate: '2026-09-14T15:00',
    agreedAmountKurus: 500_000,
    currency: 'TRY',
    status: 'approved',
    statusVersion: 2,
    createdByUid: 'mpu-1',
    createdByNameSnapshot: 'Özkan',
    createdByEmailSnapshot: 'mpuozkan@brain.com',
    createdByRole: 'media_planning',
    createdAt: null,
    updatedAt: null,
    reviewedByUid: null,
    reviewedByNameSnapshot: null,
    reviewedAt: null,
    reviewNote: null,
    callOutcome: null,
    forwardedToReporter: true,
    forwardedToReporterByUid: null,
    forwardedToReporterByNameSnapshot: null,
    forwardedToReporterAt: null,
    dailyReportId: null,
    idempotencyKey: 'key-1',
    ...overrides,
  } as JobDocument
}

function company(overrides: Partial<ReporterDailyCompany> = {}): ReporterDailyCompany {
  return {
    jobId: 'job-1',
    companyName: 'Özcanlar Yapı Hafriyat',
    cancelled: false,
    hasNews: false,
    newsTotalKurus: null,
    newsReporterFeeKurus: null,
    newsCameramanFeeKurus: null,
    shootMinutes: 2,
    shootReporterFeeKurus: 40_000,
    shootCameramanFeeKurus: 10_000,
    vatRate: 20,
    vatBaseKurus: 1_000_000,
    vatKurus: 0,
    chargeMode: 'cash',
    ...overrides,
  }
}

describe('operationsLedger', () => {
  it('maps calendar month bounds inclusively for shoot days', () => {
    expect(calendarMonthBounds('2026-09')).toEqual({
      startDate: '2026-09-01',
      endExclusive: '2026-10-01',
      endInclusive: '2026-09-30',
    })
  })

  it('labels approved as Konfirme and joins report fees', () => {
    const row = buildOperationsLedgerRow(job(), company())
    expect(row.statusLabel).toBe('Konfirme')
    expect(row.shootMinutes).toBe(2)
    expect(row.kazancKurus).toBe(1_000_000)
    expect(row.plannedDay).toBe('2026-09-14')
  })

  it('clears fees for cancelled report companies', () => {
    const row = buildOperationsLedgerRow(
      job({ status: 'cancelled' }),
      company({ cancelled: true, shootMinutes: 5, vatBaseKurus: 500_000 }),
    )
    expect(row.statusLabel).toBe('İptal edildi')
    expect(row.shootMinutes).toBeNull()
    expect(row.kazancKurus).toBeNull()
  })

  it('exports UTF-8 BOM CSV with Turkish headers', () => {
    const csv = operationsLedgerToCsv([
      buildOperationsLedgerRow(job(), company({ hasNews: true, newsTotalKurus: 250_000 })),
    ])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('TARİH,FİRMA ADI')
    expect(csv).toContain('Özcanlar Yapı Hafriyat')
    expect(csv).toContain('Konfirme')
    expect(csv).toContain('job-1')
  })

  it('sorts newest planned day first', () => {
    const older = buildOperationsLedgerRow(
      job({ id: 'old', plannedExecutionDate: '2026-09-10T10:00' }),
      null,
    )
    const newer = buildOperationsLedgerRow(
      job({ id: 'new', plannedExecutionDate: '2026-09-14T15:00' }),
      null,
    )
    const sorted = sortLedgerRowsNewestFirst([older, newer])
    expect(sorted.map((r: OperationsLedgerRow) => r.jobId)).toEqual(['new', 'old'])
  })
})
