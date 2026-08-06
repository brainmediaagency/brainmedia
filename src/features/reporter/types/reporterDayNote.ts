import type { Timestamp } from 'firebase/firestore'

/** Muhabir günlük not defteri — bir gün + bir muhabir = en fazla bir not. */
export type ReporterDayNote = {
  id: string
  /** Gün `yyyy-MM-dd` (İstanbul). */
  noteDate: string
  body: string
  createdByUid: string
  createdByNameSnapshot: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export const REPORTER_DAY_NOTE_BODY_MAX = 8000
