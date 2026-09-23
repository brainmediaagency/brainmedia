import type { JobStatus } from '@/config/roles'

/** Firestore-backed ops ledger row (replaces Excel mirror). */
export type OperationsLedgerRow = {
  jobId: string
  plannedDay: string
  plannedExecutionDate: string
  companyName: string
  contactPersonName: string
  contactPhone: string
  province: string
  mpuName: string
  mpuUid: string
  status: JobStatus
  statusLabel: string
  shootMinutes: number | null
  haberKurus: number | null
  kazancKurus: number | null
  dailyReportId: string | null
  invoiceNote: string
  agreedAmountKurus: number
}

export type OperationsLedgerFilters = {
  yearMonth: string
  status?: JobStatus | 'all'
  mpuUid?: string | 'all'
  search?: string
}

export const LEDGER_STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'Onay bekliyor',
  approved: 'Konfirme',
  shot: 'Çekildi',
  cancelled: 'İptal edildi',
  rejected: 'Reddedildi',
}

/** Statuses shown in Operasyon Defteri (rejected jobs are hidden). */
export const LEDGER_VISIBLE_STATUSES: JobStatus[] = [
  'pending',
  'approved',
  'shot',
  'cancelled',
]
