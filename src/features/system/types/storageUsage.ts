import type { Timestamp } from 'firebase/firestore'

/** Firestore `system/storageUsage` document. */
export type StorageUsageDoc = {
  usedBytes: number
  quotaBytes: number
  objectCount: number
  updatedAt: Timestamp | null
  source?: string
}
