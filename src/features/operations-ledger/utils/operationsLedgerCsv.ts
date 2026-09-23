import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'
import {
  LEDGER_EXPORT_HEADERS,
  ledgerExportRowCells,
} from '@/features/operations-ledger/utils/operationsLedgerExport'

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function operationsLedgerToCsv(rows: OperationsLedgerRow[]): string {
  const lines = [LEDGER_EXPORT_HEADERS.join(',')]
  for (const row of rows) {
    lines.push(ledgerExportRowCells(row).map(csvEscape).join(','))
  }
  // UTF-8 BOM so Excel opens Turkish characters correctly.
  return `\uFEFF${lines.join('\n')}`
}

export function downloadOperationsLedgerCsv(
  rows: OperationsLedgerRow[],
  yearMonth: string,
): void {
  const csv = operationsLedgerToCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `operasyon-defteri-${yearMonth}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
