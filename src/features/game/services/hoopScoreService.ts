import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import { todayDateOnlyIstanbul } from '@/lib/date'
import { UserFacingError, mapAppError } from '@/lib/errors'
import type {
  HoopChampionStats,
  HoopDailyScore,
  HoopDailyWinner,
} from '@/features/game/types/hoop'

/** Product: 6 shots per Istanbul calendar day; progress always from Firestore. */
export const MAX_DAILY_SHOTS = 6

const WINNER_FINALIZE_THROTTLE_MS = 15 * 60 * 1000
const WINNER_FINALIZE_STORAGE_KEY = 'brain.hoopWinnerFinalize.lastRunMs'
const WINNERS_FETCH_LIMIT = 400

const scoreConverter: FirestoreDataConverter<HoopDailyScore> = {
  toFirestore(score: HoopDailyScore): DocumentData {
    const { id: _id, ...rest } = score
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): HoopDailyScore {
    const data = snapshot.data(options)
    const attempts = Array.isArray(data.attempts)
      ? data.attempts
          .filter((n): n is number => typeof n === 'number')
          .map((n) => (n >= 1 ? 1 : 0))
      : []
    const makesFallback = attempts.reduce<number>((a, b) => a + b, 0)
    return {
      id: snapshot.id,
      date: String(data.date ?? ''),
      uid: String(data.uid ?? ''),
      fullName: String(data.fullName ?? ''),
      attempts,
      makes: Number(data.makes ?? makesFallback),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

const winnerConverter: FirestoreDataConverter<HoopDailyWinner> = {
  toFirestore(winner: HoopDailyWinner): DocumentData {
    return winner
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): HoopDailyWinner {
    const data = snapshot.data(options)
    return {
      date: String(data.date ?? snapshot.id),
      uid: String(data.uid ?? ''),
      fullName: String(data.fullName ?? ''),
      makes: Number(data.makes ?? 0),
      finalizedAt: data.finalizedAt ?? null,
    }
  },
}

function scoresCollection() {
  return collection(getDb(), 'hoopDailyScores').withConverter(scoreConverter)
}

function winnersCollection() {
  return collection(getDb(), 'hoopDailyWinners').withConverter(winnerConverter)
}

export function yesterdayDateOnlyIstanbul(now: Date = new Date()): string {
  const today = todayDateOnlyIstanbul(now)
  const [year, month, day] = today.split('-').map(Number)
  const yesterday = new Date(Date.UTC(year!, month! - 1, day!) - 86_400_000)
  const y = yesterday.getUTCFullYear()
  const m = String(yesterday.getUTCMonth() + 1).padStart(2, '0')
  const d = String(yesterday.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function scoreId(date: string, uid: string): string {
  return `${date}_${uid}`
}

/**
 * Append one shot (0 miss / 1 make). Transaction is the only authority —
 * remount / re-enter cannot invent or clear shots.
 */
export async function submitShot(input: {
  uid: string
  fullName: string
  hit: boolean
}): Promise<HoopDailyScore> {
  const uid = input.uid.trim()
  const fullName = input.fullName.trim().slice(0, 120)
  if (!uid || !fullName) {
    throw new UserFacingError('Oturum veya isim eksik.')
  }
  const shot = input.hit ? 1 : 0
  const date = todayDateOnlyIstanbul()
  const ref = doc(getDb(), 'hoopDailyScores', scoreId(date, uid))

  try {
    return await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref)

      if (!snap.exists()) {
        const attempts = [shot]
        tx.set(ref, {
          date,
          uid,
          fullName,
          attempts,
          makes: shot,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        return {
          id: ref.id,
          date,
          uid,
          fullName,
          attempts,
          makes: shot,
          createdAt: null,
          updatedAt: null,
        }
      }

      const data = snap.data() as DocumentData
      const prevAttempts: number[] = Array.isArray(data.attempts)
        ? data.attempts.filter((n): n is number => typeof n === 'number')
        : []
      if (prevAttempts.length >= MAX_DAILY_SHOTS) {
        throw new UserFacingError(
          `Bugünkü ${MAX_DAILY_SHOTS} şut hakkın doldu. Yarın tekrar dene!`,
        )
      }
      if (String(data.uid ?? '') !== uid) {
        throw new UserFacingError('Skor kaydı yetkisiz.')
      }
      if (String(data.date ?? '') !== date) {
        throw new UserFacingError('Tarih uyuşmazlığı. Sayfayı yenileyip tekrar dene.')
      }

      const attempts = [...prevAttempts, shot]
      const makes = attempts.reduce((a, b) => a + (b >= 1 ? 1 : 0), 0)
      tx.update(ref, {
        attempts,
        makes,
        updatedAt: serverTimestamp(),
      })
      return {
        id: ref.id,
        date,
        uid,
        fullName: String(data.fullName ?? fullName),
        attempts,
        makes,
        createdAt: data.createdAt ?? null,
        updatedAt: null,
      }
    })
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Şut kaydedilemedi.'))
  }
}

/** Today board: highest makes first; earlier finish wins ties. */
export function sortHoopScores(scores: HoopDailyScore[]): HoopDailyScore[] {
  return [...scores].sort(
    (a, b) =>
      b.makes - a.makes
      || (a.updatedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER)
        - (b.updatedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER)
      || (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0),
  )
}

export function subscribeTodayHoopScores(
  onData: (scores: HoopDailyScore[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    scoresCollection(),
    where('date', '==', todayDateOnlyIstanbul()),
    limit(100),
  )
  return onSnapshot(
    q,
    (snap) => {
      onData(sortHoopScores(snap.docs.map((d) => d.data())))
    },
    (err) => onError?.(err),
  )
}

export async function fetchHoopWinnerStats(): Promise<HoopChampionStats> {
  try {
    const snap = await getDocs(
      query(winnersCollection(), orderBy('date', 'desc'), limit(WINNERS_FETCH_LIMIT)),
    )
    const winners = snap.docs.map((d) => d.data())
    const byUid = new Map<string, { uid: string; fullName: string; wins: number }>()
    for (const winner of winners) {
      const entry = byUid.get(winner.uid)
      if (entry) {
        entry.wins += 1
      } else {
        byUid.set(winner.uid, {
          uid: winner.uid,
          fullName: winner.fullName,
          wins: 1,
        })
      }
    }
    return {
      champions: [...byUid.values()].sort((a, b) => b.wins - a.wins),
      recentWinners: winners.slice(0, 7),
    }
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Şampiyonluk tablosu yüklenemedi.'))
  }
}

function readLastFinalizeRunMs(): number {
  try {
    const raw = localStorage.getItem(WINNER_FINALIZE_STORAGE_KEY)
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeLastFinalizeRunMs(ms: number): void {
  try {
    localStorage.setItem(WINNER_FINALIZE_STORAGE_KEY, String(ms))
  } catch {
    /* ignore */
  }
}

export type FinalizeHoopWinnerResult = {
  skipped: boolean
  reason?: 'throttled' | 'already-finalized' | 'no-scores'
}

/**
 * Day winner = highest makes; ties → earlier updatedAt (finished first).
 * Idempotent on hoopDailyWinners/{date}.
 */
export async function finalizeYesterdayHoopWinner(options?: {
  force?: boolean
}): Promise<FinalizeHoopWinnerResult> {
  const now = Date.now()
  if (!options?.force && now - readLastFinalizeRunMs() < WINNER_FINALIZE_THROTTLE_MS) {
    return { skipped: true, reason: 'throttled' }
  }
  writeLastFinalizeRunMs(now)

  const yesterday = yesterdayDateOnlyIstanbul()
  const winnerRef = doc(getDb(), 'hoopDailyWinners', yesterday)
  const existing = await getDoc(winnerRef)
  if (existing.exists()) {
    return { skipped: true, reason: 'already-finalized' }
  }

  const scoresSnap = await getDocs(
    query(scoresCollection(), where('date', '==', yesterday), limit(200)),
  )
  if (scoresSnap.empty) {
    return { skipped: true, reason: 'no-scores' }
  }

  const scores = sortHoopScores(scoresSnap.docs.map((d) => d.data()))
  const winner = scores[0]!

  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(winnerRef)
    if (snap.exists()) return
    tx.set(winnerRef, {
      date: yesterday,
      uid: winner.uid,
      fullName: winner.fullName,
      makes: winner.makes,
      finalizedAt: serverTimestamp(),
    })
  })

  return { skipped: false }
}
