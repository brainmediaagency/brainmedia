import type { Timestamp } from 'firebase/firestore'
import type { UserRole } from '@/config/roles'

export interface UserStats {
  jobsReceived: number
  jobsShot: number
  jobsCancelled: number
}

export interface UserProfile {
  uid: string
  fullName: string
  email: string
  role: UserRole
  isActive: boolean
  /** Soft-delete marker; null when account is not deleted. */
  deletedAt: Timestamp | null
  shiftDurationMinutes: number | null
  timezone: 'Europe/Istanbul'
  stats: UserStats
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface AuthClaims {
  role: UserRole
  active: boolean
  emailVerified: boolean
}
