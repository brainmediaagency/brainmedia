import type { JobStatus } from '@/config/roles'
import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'

export function filterOperationsLedgerRows(
  rows: OperationsLedgerRow[],
  filters: {
    status: JobStatus | 'all'
    mpuUid: string | 'all'
    search?: string
  },
): OperationsLedgerRow[] {
  const q = filters.search?.trim().toLocaleLowerCase('tr-TR') ?? ''
  return rows.filter((row) => {
    if (filters.status !== 'all' && row.status !== filters.status) return false
    if (filters.mpuUid !== 'all' && row.mpuUid !== filters.mpuUid) return false
    if (!q) return true
    const hay =
      `${row.companyName} ${row.contactPersonName} ${row.contactPhone} ${row.province} ${row.mpuName}`
        .toLocaleLowerCase('tr-TR')
    return hay.includes(q)
  })
}
