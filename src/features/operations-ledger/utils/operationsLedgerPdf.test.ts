import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'
import { buildOperationsLedgerPdf } from '@/features/operations-ledger/utils/operationsLedgerPdf'

function sampleRow(overrides: Partial<OperationsLedgerRow> = {}): OperationsLedgerRow {
  return {
    jobId: 'job-1',
    plannedDay: '2026-09-14',
    plannedExecutionDate: '2026-09-14T10:00:00.000Z',
    companyName: 'Özcanlar Yapı Hafriyat',
    contactPersonName: 'Hüseyin Şahin',
    contactPhone: '0555',
    province: 'Eskişehir',
    mpuName: 'Aslınur Sevinç',
    mpuUid: 'u1',
    status: 'approved',
    statusLabel: 'Konfirme',
    shootMinutes: 2,
    haberKurus: 100000,
    kazancKurus: 1000000,
    dailyReportId: 'r1',
    invoiceNote: 'Fatura notu',
    agreedAmountKurus: 0,
    ...overrides,
  }
}

describe('operationsLedgerPdf', () => {
  beforeEach(() => {
    const regular = readFileSync(
      resolve(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'),
    )
    const bold = readFileSync(
      resolve(process.cwd(), 'public/fonts/NotoSans-Bold.ttf'),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('NotoSans-Bold')) {
          return new Response(bold, { status: 200 })
        }
        if (url.includes('NotoSans-Regular')) {
          return new Response(regular, { status: 200 })
        }
        return new Response('not found', { status: 404 })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('builds a PDF with embedded Turkish-capable font', async () => {
    const pdf = await buildOperationsLedgerPdf([sampleRow()], '2026-09')
    expect(pdf.byteLength).toBeGreaterThan(20_000)
    const head = new TextDecoder('latin1').decode(pdf.slice(0, 8))
    expect(head.startsWith('%PDF')).toBe(true)
  })
})
