import type { Timestamp } from 'firebase/firestore'

/** dailyRegions/{yyyy-MM-dd} */
export type DailyRegion = {
  id: string
  /** Istanbul wall-clock day, `yyyy-MM-dd`. */
  date: string
  region: string
  updatedByUid: string
  updatedByNameSnapshot: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
