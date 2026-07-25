import type { Timestamp } from 'firebase/firestore'
import type { ShiftRole } from '@/config/roles'

export interface ActiveShift {
  shiftId: string
  ownerUid: string
  ownerNameSnapshot: string
  roleSnapshot: ShiftRole
  status: 'active'
  startedAt: Timestamp | null
  timezone: 'Europe/Istanbul'
  createdAt: Timestamp | null
}

export interface AttendanceLog {
  shiftId: string
  ownerUid: string
  ownerNameSnapshot: string
  roleSnapshot: ShiftRole
  status: 'completed'
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  workedMinutes: number
  timezone: 'Europe/Istanbul'
  finalizedAt: Timestamp | null
  editVersion: number
  lastEditedByUid: string | null
  lastEditedByNameSnapshot: string | null
  lastEditedAt: Timestamp | null
  lastEditReason: string | null
}

export interface AttendanceLogHistoryEntry {
  id: string
  version: number
  actorUid: string
  actorNameSnapshot: string
  actorRole: 'human_resources' | 'management'
  reason: string
  previousStartedAt: Timestamp
  previousEndedAt: Timestamp
  previousWorkedMinutes: number
  newStartedAt: Timestamp
  newEndedAt: Timestamp
  newWorkedMinutes: number
  createdAt: Timestamp | null
}
