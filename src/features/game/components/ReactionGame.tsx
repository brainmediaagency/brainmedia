import { useCallback, useEffect, useRef, useState } from 'react'
import { MousePointerClick, Timer, Zap } from 'lucide-react'
import { cn } from '@/lib/classNames'
import { MAX_DAILY_ATTEMPTS } from '@/features/game/services/reactionScoreService'

export const ROUNDS_PER_ATTEMPT = 5
/** Lambalar arası yanış aralığı (F1 start). */
const LIGHT_INTERVAL_MS = 700
/** 3. lamba yandıktan sonra sönme gecikmesi (rastgele). */
const MIN_HOLD_MS = 500
const MAX_HOLD_MS = 3000
/** Erken basışta tur harcanır; en iyi skora bu ceza ms yazılır. */
const EARLY_PENALTY_MS = 350

type GamePhase =
  | 'idle'
  | 'lighting'
  | 'ready'
  | 'early'
  | 'round-done'
  | 'saving'
  | 'attempt-done'

function StartLights({ litCount }: { litCount: number }) {
  return (
    <div
      className="flex items-center justify-center gap-4 sm:gap-6"
      aria-hidden="true"
    >
      {[1, 2, 3].map((n) => {
        const on = litCount >= n
        return (
          <div
            key={n}
            className={cn(
              'size-14 rounded-full border-4 transition-all duration-150 sm:size-20',
              on
                ? 'border-red-700 bg-red-500 shadow-[0_0_28px_rgba(239,68,68,0.85)]'
                : 'border-white/15 bg-black/40',
            )}
          />
        )
      })}
    </div>
  )
}

export type ReactionGameProps = {
  /** Bugün kullanılan deneme sayısı (Firestore'daki attempts.length). */
  attemptsUsed: number
  /** 5 tur tamamlanınca en iyi ms ile çağrılır; kaydetme sorumluluğu sayfada. */
  onAttemptComplete: (bestMs: number) => Promise<void>
}

export function ReactionGame({ attemptsUsed, onAttemptComplete }: ReactionGameProps) {
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [lightsLit, setLightsLit] = useState(0)
  const [roundResults, setRoundResults] = useState<number[]>([])
  const [lastRoundMs, setLastRoundMs] = useState<number | null>(null)
  const [attemptBest, setAttemptBest] = useState<number | null>(null)
  /** Firestore aboneliği gecikse bile ikinci denemeyi engelle. */
  const [localAttemptsCompleted, setLocalAttemptsCompleted] = useState(0)

  const timeoutsRef = useRef<number[]>([])
  const readyAtRef = useRef(0)
  /** lighting fazında erken basışı anında yakalamak için. */
  const phaseRef = useRef<GamePhase>('idle')

  const clearTimers = useCallback(() => {
    for (const id of timeoutsRef.current) window.clearTimeout(id)
    timeoutsRef.current = []
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  const effectiveAttemptsUsed = Math.max(attemptsUsed, localAttemptsCompleted)
  const outOfAttempts =
    effectiveAttemptsUsed >= MAX_DAILY_ATTEMPTS
    && (phase === 'idle' || phase === 'attempt-done')

  const startRound = useCallback(() => {
    clearTimers()
    setLastRoundMs(null)
    setLightsLit(0)
    setPhase('lighting')
    phaseRef.current = 'lighting'

    // 1 → 2 → 3 yanış, sonra rastgele bekle → hepsi sönsün (ready)
    const schedule = (delay: number, fn: () => void) => {
      const id = window.setTimeout(fn, delay)
      timeoutsRef.current.push(id)
    }

    schedule(LIGHT_INTERVAL_MS, () => {
      if (phaseRef.current !== 'lighting') return
      setLightsLit(1)
    })
    schedule(LIGHT_INTERVAL_MS * 2, () => {
      if (phaseRef.current !== 'lighting') return
      setLightsLit(2)
    })
    schedule(LIGHT_INTERVAL_MS * 3, () => {
      if (phaseRef.current !== 'lighting') return
      setLightsLit(3)
      const hold = MIN_HOLD_MS + Math.random() * (MAX_HOLD_MS - MIN_HOLD_MS)
      schedule(hold, () => {
        if (phaseRef.current !== 'lighting') return
        setLightsLit(0)
        readyAtRef.current = performance.now()
        setPhase('ready')
        phaseRef.current = 'ready'
      })
    })
  }, [clearTimers])

  const finishAttempt = useCallback(
    (results: number[]) => {
      const best = Math.min(...results)
      setRoundResults([])
      setAttemptBest(best)
      setLocalAttemptsCompleted((count) => count + 1)
      setPhase('saving')
      phaseRef.current = 'saving'

      void onAttemptComplete(best).finally(() => {
        setPhase('attempt-done')
        phaseRef.current = 'attempt-done'
      })
    },
    [onAttemptComplete],
  )

  const applyEarlyFail = useCallback(() => {
    clearTimers()
    setLightsLit(0)
    const nextResults = [...roundResults, EARLY_PENALTY_MS]
    setLastRoundMs(EARLY_PENALTY_MS)
    if (nextResults.length < ROUNDS_PER_ATTEMPT) {
      setRoundResults(nextResults)
      setPhase('early')
      phaseRef.current = 'early'
      return
    }
    finishAttempt(nextResults)
  }, [clearTimers, roundResults, finishAttempt])

  const handlePointerDown = useCallback(() => {
    if (outOfAttempts || phase === 'saving') return

    if (phase === 'idle' || phase === 'early' || phase === 'round-done') {
      startRound()
      return
    }

    if (phase === 'attempt-done') {
      if (effectiveAttemptsUsed >= MAX_DAILY_ATTEMPTS) return
      setRoundResults([])
      setAttemptBest(null)
      startRound()
      return
    }

    // Lambalar yanıyorken veya hepsi yanık beklerken basmak = jump start
    if (phase === 'lighting') {
      applyEarlyFail()
      return
    }

    if (phase === 'ready') {
      const ms = Math.round(performance.now() - readyAtRef.current)
      setLastRoundMs(ms)
      const nextResults = [...roundResults, ms]

      if (nextResults.length < ROUNDS_PER_ATTEMPT) {
        setRoundResults(nextResults)
        setPhase('round-done')
        phaseRef.current = 'round-done'
        return
      }

      finishAttempt(nextResults)
    }
  }, [
    outOfAttempts,
    phase,
    roundResults,
    startRound,
    applyEarlyFail,
    finishAttempt,
    effectiveAttemptsUsed,
  ])

  const currentRoundNumber = Math.min(roundResults.length + 1, ROUNDS_PER_ATTEMPT)
  const attemptNumber = Math.min(effectiveAttemptsUsed + 1, MAX_DAILY_ATTEMPTS)

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-secondary">
        {outOfAttempts ? (
          <>Deneme {MAX_DAILY_ATTEMPTS}/{MAX_DAILY_ATTEMPTS}</>
        ) : (
          <>Deneme {attemptNumber}/{MAX_DAILY_ATTEMPTS} · Tur {currentRoundNumber}/{ROUNDS_PER_ATTEMPT}</>
        )}
      </p>

      {outOfAttempts ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-8 text-center sm:min-h-[380px]">
          <div className="rounded-full bg-brand-cyan/10 p-3.5 text-brand-blue">
            <Timer className="size-6" aria-hidden="true" />
          </div>
          <h3 className="font-display text-lg font-semibold text-text-primary">
            Bugünlük bu kadar!
          </h3>
          <p className="max-w-sm text-sm text-text-secondary">
            Günlük deneme hakkını kullandın. Yarın yeni hakkınla tekrar
            yarışabilirsin.
          </p>
          {attemptBest !== null && (
            <p className="text-sm text-text-secondary">
              Bugünkü skorun:{' '}
              <span className="font-semibold tabular-nums text-text-primary">
                {attemptBest} ms
              </span>
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          className={cn(
            'flex min-h-[320px] w-full touch-none select-none flex-col items-center justify-center gap-5 rounded-[var(--radius-lg)] border p-8 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/50 sm:min-h-[380px]',
            phase === 'lighting' && 'border-border bg-[#0b1220]',
            phase === 'ready' && 'border-success/50 bg-[#062016]',
            phase === 'early' && 'border-warning/40 bg-surface',
            (phase === 'idle'
              || phase === 'round-done'
              || phase === 'saving'
              || phase === 'attempt-done')
              && 'border-border bg-surface hover:border-brand-cyan/40',
          )}
        >
          {phase === 'idle' && (
            <>
              <div className="rounded-full bg-brand-cyan/10 p-3.5 text-brand-blue">
                <Zap className="size-6" aria-hidden="true" />
              </div>
              <span className="font-display text-xl font-semibold text-text-primary">
                F1 Start Refleks
              </span>
              <StartLights litCount={0} />
              <span className="max-w-sm text-sm text-text-secondary">
                3 kırmızı lamba sırayla yanar. Hepsi sönünce hemen dokun.
                Lambalar yanıyorken basarsan o tur hakkın yanar (+{EARLY_PENALTY_MS}{' '}
                ms). {ROUNDS_PER_ATTEMPT} turun en iyisi skorun olur. Günde 1
                deneme.
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-cyan">
                <MousePointerClick className="size-4" aria-hidden="true" />
                Başlamak için dokun
              </span>
            </>
          )}

          {(phase === 'lighting' || phase === 'ready') && (
            <>
              <StartLights litCount={phase === 'ready' ? 0 : lightsLit} />
              <span
                className={cn(
                  'font-display text-2xl font-bold sm:text-3xl',
                  phase === 'ready' ? 'text-success' : 'text-white/80',
                )}
              >
                {phase === 'ready' ? 'TIKLA!' : 'Bekle…'}
              </span>
            </>
          )}

          {phase === 'early' && (
            <>
              <StartLights litCount={0} />
              <span className="font-display text-2xl font-bold text-danger">
                Erken start!
              </span>
              <span className="text-sm text-text-secondary">
                Lambalar sönmeden bastın — tur hakkın yandı (+{EARLY_PENALTY_MS}{' '}
                ms). Tur {roundResults.length}/{ROUNDS_PER_ATTEMPT} — devam için
                dokun.
              </span>
            </>
          )}

          {phase === 'round-done' && (
            <>
              <span className="font-display text-4xl font-bold tabular-nums text-text-primary sm:text-5xl">
                {lastRoundMs} ms
              </span>
              <span className="text-sm text-text-secondary">
                Tur {roundResults.length}/{ROUNDS_PER_ATTEMPT} tamamlandı — sonraki
                tur için dokun.
              </span>
            </>
          )}

          {phase === 'saving' && (
            <>
              <span
                className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent"
                aria-hidden="true"
              />
              <span className="font-display text-2xl font-bold tabular-nums text-text-primary">
                {attemptBest} ms
              </span>
              <span className="text-sm text-text-secondary">Skor kaydediliyor…</span>
            </>
          )}

          {phase === 'attempt-done' && (
            <>
              <span className="font-display text-4xl font-bold tabular-nums text-text-primary sm:text-5xl">
                {attemptBest} ms
              </span>
              <span className="text-sm text-text-secondary">
                5 turun en iyisi kaydedildi.
                {effectiveAttemptsUsed < MAX_DAILY_ATTEMPTS
                  ? ' Yeni deneme için dokun.'
                  : ''}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
