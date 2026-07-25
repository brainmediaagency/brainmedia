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
  ReactionChampionStats,
  ReactionDailyScore,
  ReactionDailyWinner,
} from '@/features/game/types/game'

export const MAX_DAILY_ATTEMPTS = 1
/** Rules accept bestMs 100..3000; clamp attempt best-of-rounds into that range. */
export const MIN_ATTEMPT_MS = 100
export const MAX_ATTEMPT_MS = 3000

const WINNER_FINALIZE_THROTTLE_MS = 15 * 60 * 1000
const WINNER_FINALIZE_STORAGE_KEY = 'brain.reactionWinnerFinalize.lastRunMs'
const WINNERS_FETCH_LIMIT = 400

const scoreConverter: FirestoreDataConverter<ReactionDailyScore> = {
  toFirestore(score: ReactionDailyScore): DocumentData {
    const { id: _id, ...rest } = score
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): ReactionDailyScore {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      date: String(data.date ?? ''),
      uid: String(data.uid ?? ''),
      fullName: String(data.fullName ?? ''),
      attempts: Array.isArray(data.attempts)
        ? data.attempts.filter((n): n is number => typeof n === 'number')
        : [],
      bestMs: Number(data.bestMs ?? 0),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

const winnerConverter: FirestoreDataConverter<ReactionDailyWinner> = {
  toFirestore(winner: ReactionDailyWinner): DocumentData {
    return winner
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): ReactionDailyWinner {
    const data = snapshot.data(options)
    return {
      date: String(data.date ?? snapshot.id),
      uid: String(data.uid ?? ''),
      fullName: String(data.fullName ?? ''),
      bestMs: Number(data.bestMs ?? 0),
      finalizedAt: data.finalizedAt ?? null,
    }
  },
}

function scoresCollection() {
  return collection(getDb(), 'reactionDailyScores').withConverter(scoreConverter)
}

function winnersCollection() {
  return collection(getDb(), 'reactionDailyWinners').withConverter(winnerConverter)
}

/** Istanbul wall-clock `yyyy-MM-dd` for yesterday. */
export function yesterdayDateOnlyIstanbul(now: Date = new Date()): string {
  const today = todayDateOnlyIstanbul(now)
  const [year, month, day] = today.split('-').map(Number)
  const yesterday = new Date(Date.UTC(year!, month! - 1, day!) - 86_400_000)
  const y = yesterday.getUTCFullYear()
  const m = String(yesterday.getUTCMonth() + 1).padStart(2, '0')
  const d = String(yesterday.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Bir denemenin (5 turun en iyisi) skorunu bugünün dokümanına ekler.
 * Günde en fazla 1 deneme; bestMs = o denemenin skoru.
 */
export async function submitAttempt(
  uid: string,
  fullName: string,
  ms: number,
): Promise<ReactionDailyScore> {
  const clamped = Math.min(
    MAX_ATTEMPT_MS,
    Math.max(MIN_ATTEMPT_MS, Math.round(ms)),
  )
  const date = todayDateOnlyIstanbul()
  const ref = doc(getDb(), 'reactionDailyScores', `${date}_${uid}`)

  try {
    return await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref)

      if (!snap.exists()) {
        tx.set(ref, {
          date,
          uid,
          fullName,
          attempts: [clamped],
          bestMs: clamped,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        return {
          id: ref.id,
          date,
          uid,
          fullName,
          attempts: [clamped],
          bestMs: clamped,
          createdAt: null,
          updatedAt: null,
        }
      }

      const data = snap.data()
      const attempts: number[] = Array.isArray(data.attempts) ? data.attempts : []
      if (attempts.length >= MAX_DAILY_ATTEMPTS) {
        throw new UserFacingError('Bugünkü deneme hakkın doldu. Yarın tekrar dene!')
      }

      const nextAttempts = [...attempts, clamped]
      const bestMs = Math.min(...nextAttempts)
      tx.update(ref, {
        attempts: nextAttempts,
        bestMs,
        updatedAt: serverTimestamp(),
      })
      return {
        id: ref.id,
        date,
        uid,
        fullName,
        attempts: nextAttempts,
        bestMs,
        createdAt: data.createdAt ?? null,
        updatedAt: null,
      }
    })
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Skor kaydedilemedi.'))
  }
}

/** Bugünün skorlarını canlı dinler; istemci tarafında bestMs artan sıralar. */
export function subscribeTodayScores(
  onData: (scores: ReactionDailyScore[]) => void,
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
      const scores = snap.docs.map((d) => d.data())
      scores.sort(
        (a, b) =>
          a.bestMs - b.bestMs
          || (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0),
      )
      onData(scores)
    },
    (err) => onError?.(err),
  )
}

/** Şampiyonluk tablosu: kazanılan gün sayıları + son günlük şampiyonlar. */
export async function fetchWinnerStats(): Promise<ReactionChampionStats> {
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
    // ignore quota / private mode
  }
}

export type FinalizeWinnerResult = {
  skipped: boolean
  reason?: 'throttled' | 'already-finalized' | 'no-scores'
}

/**
 * Dünün şampiyonunu (en düşük bestMs; eşitlikte en erken createdAt) belirleyip
 * reactionDailyWinners/{yyyy-MM-dd} dokümanını oluşturur. Doküman zaten varsa
 * hiçbir şey yapmaz (idempotent); 15 dk localStorage throttle uygular.
 */
export async function finalizeYesterdayWinner(
  options?: { force?: boolean },
): Promise<FinalizeWinnerResult> {
  const now = Date.now()
  if (!options?.force && now - readLastFinalizeRunMs() < WINNER_FINALIZE_THROTTLE_MS) {
    return { skipped: true, reason: 'throttled' }
  }
  writeLastFinalizeRunMs(now)

  const yesterday = yesterdayDateOnlyIstanbul()
  const winnerRef = doc(getDb(), 'reactionDailyWinners', yesterday)

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

  const scores = scoresSnap.docs.map((d) => d.data())
  scores.sort(
    (a, b) =>
      a.bestMs - b.bestMs
      || (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0),
  )
  const winner = scores[0]!

  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(winnerRef)
    if (snap.exists()) return
    tx.set(winnerRef, {
      date: yesterday,
      uid: winner.uid,
      fullName: winner.fullName,
      bestMs: winner.bestMs,
      finalizedAt: serverTimestamp(),
    })
  })

  return { skipped: false }
}
