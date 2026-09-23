import { describe, expect, it } from 'vitest'
import { filterOperationsLedgerRows } from '@/features/operations-ledger/utils/filterOperationsLedgerRows'
import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'

function row(
  overrides: Partial<OperationsLedgerRow> &
    Pick<OperationsLedgerRow, 'jobId' | 'status' | 'mpuUid'>,
): OperationsLedgerRow {
  return {
    plannedDay: '2026-09-16',
    plannedExecutionDate: '2026-09-16T12:00',
    companyName: 'Firma',
    contactPersonName: 'Yetkili',
    contactPhone: '0555',
    province: 'İstanbul',
    mpuName: 'Planlamacı',
    statusLabel: overrides.status,
    shootMinutes: null,
    haberKurus: null,
    kazancKurus: null,
    dailyReportId: null,
    invoiceNote: '',
    agreedAmountKurus: 0,
    ...overrides,
  }
}

describe('filterOperationsLedgerRows', () => {
  const rows = [
    row({ jobId: '1', status: 'approved', mpuUid: 'a', mpuName: 'Aslı' }),
    row({ jobId: '2', status: 'shot', mpuUid: 'a', mpuName: 'Aslı' }),
    row({ jobId: '3', status: 'cancelled', mpuUid: 'a', mpuName: 'Aslı' }),
    row({ jobId: '4', status: 'shot', mpuUid: 'b', mpuName: 'Erkan' }),
  ]

  it('status=all + mpu keeps çekildi and iptal', () => {
    const visible = filterOperationsLedgerRows(rows, {
      status: 'all',
      mpuUid: 'a',
    })
    expect(visible.map((r) => r.jobId)).toEqual(['1', '2', '3'])
  })

  it('status=approved only returns konfirme', () => {
    const visible = filterOperationsLedgerRows(rows, {
      status: 'approved',
      mpuUid: 'all',
    })
    expect(visible.map((r) => r.jobId)).toEqual(['1'])
  })
})
