import type { Timestamp } from 'firebase/firestore'
import type { JobStatus } from '@/config/roles'

export interface JobContact {
  name: string
  mobilePhone: string
  workPhone: string | null
}

export interface JobDocument {
  id: string
  companyName: string
  companyNameNormalized: string
  /** Denormalized first contact for list views */
  contactPersonName: string
  contactPhone: string
  contactCount: 1 | 2 | 3
  contacts: JobContact[]
  province: string
  district: string
  fullAddress: string
  /** Optional Instagram handle or profile URL. */
  instagram: string | null
  acquiredDate: string
  plannedExecutionDate: string
  agreedAmountKurus: number
  currency: 'TRY'
  status: JobStatus
  statusVersion: number
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
  createdByRole: 'media_planning'
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  reviewedByUid: string | null
  reviewedByNameSnapshot: string | null
  reviewedAt: Timestamp | null
  reviewNote: string | null
  /** Yönetim/koordinatör muhabir çekim takvimine iletti mi */
  forwardedToReporter: boolean
  forwardedToReporterByUid: string | null
  forwardedToReporterByNameSnapshot: string | null
  forwardedToReporterAt: Timestamp | null
  /**
   * Once set, this job is claimed by a `reporterDailyReports` doc and cannot
   * appear on another daily report (any reporter). Cleared on soft-delete /
   * when removed from the claiming report.
   */
  dailyReportId: string | null
  idempotencyKey: string
}

export interface JobHistoryEntry {
  id: string
  version: number
  fromStatus: JobStatus | null
  toStatus: JobStatus
  actorUid: string
  actorNameSnapshot: string
  actorRole: string
  note: string | null
  createdAt: Timestamp | null
}

export type AllowedJobTransition =
  | { from: 'pending'; to: 'approved' }
  | { from: 'pending'; to: 'rejected' }
  | { from: 'pending'; to: 'cancelled' }
  | { from: 'approved'; to: 'pending' }
  | { from: 'approved'; to: 'shot' }
  | { from: 'approved'; to: 'cancelled' }
