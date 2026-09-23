import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'
import { formatDateOnlyShortTr, formatYearMonthLongTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'

export const LEDGER_EXPORT_HEADERS = [
  'TARİH',
  'FİRMA ADI',
  'FİRMA SAHİBİ',
  'TEL NO',
  'ADRES',
  'MPU',
  'DK',
  'HABER',
  'SON DURUM',
  'KAZANÇ',
  'FATURA',
  'JOB ID',
] as const

/** PDF dışa aktarımında JOB ID yok. */
export const LEDGER_PDF_HEADERS = [
  'TARİH',
  'FİRMA ADI',
  'FİRMA SAHİBİ',
  'TEL NO',
  'ADRES',
  'MPU',
  'DK',
  'HABER',
  'SON DURUM',
  'KAZANÇ',
  'FATURA',
] as const

export function ledgerMoneyCell(kurus: number | null): string {
  if (kurus == null || kurus <= 0) return ''
  return formatTryFromKurus(kurus).replace(/\s*₺\s*/g, '').trim() + ' TL'
}

export function ledgerExportRowCells(row: OperationsLedgerRow): string[] {
  return [
    formatDateOnlyShortTr(row.plannedDay),
    row.companyName,
    row.contactPersonName,
    row.contactPhone,
    row.province,
    row.mpuName,
    row.shootMinutes == null ? '' : String(row.shootMinutes),
    ledgerMoneyCell(row.haberKurus),
    row.statusLabel,
    ledgerMoneyCell(row.kazancKurus),
    row.invoiceNote,
    row.jobId,
  ]
}

export function ledgerPdfRowCells(row: OperationsLedgerRow): string[] {
  return ledgerExportRowCells(row).slice(0, -1)
}

export function ledgerExportTitle(yearMonth: string): string {
  const month = formatYearMonthLongTr(yearMonth)
  return `Operasyon Defteri — ${month}`
}
