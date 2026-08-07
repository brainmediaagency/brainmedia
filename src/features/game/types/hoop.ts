import type { Timestamp } from 'firebase/firestore'

/** hoopDailyScores/{yyyy-MM-dd_uid} — one doc per user per Istanbul day. */
export type HoopDailyScore = {
  id: string
  date: string
  uid: string
  fullName: string
  /**
   * Per-shot results in order: 1 = make, 0 = miss.
   * Length = shots taken today (0..MAX_DAILY_SHOTS). Source of truth — never trust only client state.
   */
  attempts: number[]
  /** sum(attempts); 0..MAX_DAILY_SHOTS */
  makes: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** hoopDailyWinners/{yyyy-MM-dd} */
export type HoopDailyWinner = {
  date: string
  uid: string
  fullName: string
  makes: number
  finalizedAt: Timestamp | null
}

export type HoopChampionStats = {
  champions: { uid: string; fullName: string; wins: number }[]
  recentWinners: HoopDailyWinner[]
}
