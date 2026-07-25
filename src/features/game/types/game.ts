import type { Timestamp } from 'firebase/firestore'

/** reactionDailyScores/{yyyy-MM-dd_uid} */
export interface ReactionDailyScore {
  /** Doc ID: `${date}_${uid}` */
  id: string
  /** Istanbul wall-clock day, `yyyy-MM-dd`. */
  date: string
  uid: string
  fullName: string
  /** Attempt best-of-rounds scores in ms; max 1 per day. */
  attempts: number[]
  /** Best attempt score of the day (lowest ms). */
  bestMs: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** reactionDailyWinners/{yyyy-MM-dd} */
export interface ReactionDailyWinner {
  /** Istanbul wall-clock day, `yyyy-MM-dd`; equals doc ID. */
  date: string
  uid: string
  fullName: string
  bestMs: number
  finalizedAt: Timestamp | null
}

export interface ReactionChampionStats {
  /** Win counts per user, ordered by wins desc. */
  champions: { uid: string; fullName: string; wins: number }[]
  /** Most recent daily winners, newest first. */
  recentWinners: ReactionDailyWinner[]
}
