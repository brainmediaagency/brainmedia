import { describe, expect, it } from 'vitest'
import { operationsLedgerToCsv } from '@/features/operations-ledger/utils/operationsLedgerCsv'
import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'

function sampleRow(overrides: Partial<OperationsLedgerRow> = {}): OperationsLedgerRow {
  return {
    jobId: 'job-1',
    plannedDay: '2026-09-14',
    plannedExecutionDate: '2026-09-14T10:00:00.000Z',
    companyName: 'Özcanlar Yapı Hafriyat',
    contactPersonName: 'Ali',
    contactPhone: '0555',
    province: 'İstanbul',
    mpuName: 'MPU',
    mpuUid: 'u1',
    status: 'approved',
    statusLabel: 'Konfirme',
    shootMinutes: 2,
    haberKurus: 100000,
    kazancKurus: 1000000,
    dailyReportId: 'r1',
    invoiceNote: 'Fatura, "bekliyor"',
    agreedAmountKurus: 0,
    ...overrides,
  }
}

describe('operationsLedgerToCsv', () => {
  it('prefixes UTF-8 BOM and keeps Turkish headers/status', () => {
    const csv = operationsLedgerToCsv([sampleRow()])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('TARİH,FİRMA ADI')
    expect(csv).toContain('Özcanlar Yapı Hafriyat')
    expect(csv).toContain('Konfirme')
    expect(csv).toContain('İstanbul')
  })

  it('escapes commas and quotes in fatura notes', () => {
    const csv = operationsLedgerToCsv([sampleRow()])
    expect(csv).toContain('"Fatura, ""bekliyor"""')
  })
})
