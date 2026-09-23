import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { MonthPicker } from '@/components/ui/MonthPicker'
import { Skeleton } from '@/components/ui/Skeleton'
import { coordinatorShareFromVatBaseKurus } from '@/features/coordinator-share/utils/coordinatorShare'
import {
  currentYearMonthIstanbul,
  fetchMonthlyStats,
  type YearMonth,
} from '@/features/stats/services/monthlyStatsService'
import { formatTryFromKurus } from '@/lib/currency'
import { formatYearMonthLongTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'

/** Slot-machine counter: ~2.5s, fast stepped rolls early, settle on final. */
function useSlotAnimatedKurus(targetKurus: number, enabled: boolean): number {
  const [display, setDisplay] = useState(enabled ? 0 : targetKurus)
  const displayRef = useRef(display)

  useEffect(() => {
    displayRef.current = display
  }, [display])

  useEffect(() => {
    if (!enabled) {
      setDisplay(targetKurus)
      return
    }
    const durationMs = 2500
    const startValue = displayRef.current
    const delta = targetKurus - startValue
    const startTime = performance.now()
    const magnitude = Math.max(Math.abs(delta), Math.abs(targetKurus), 100)
    let frameId = 0

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / durationMs, 1)
      // Ease-out quart: quick early motion, long settle.
      const eased = 1 - (1 - t) ** 4
      let value = startValue + delta * eased

      // Reel spin: dampened oscillation while spinning.
      if (t < 0.88) {
        const spinAmp = magnitude * 0.12 * (1 - t) ** 2
        value += Math.sin(t * Math.PI * 28) * spinAmp
      }

      // Coarse → fine steps for a ticking slot feel.
      if (t < 0.92) {
        const stepPower = 1 + (1 - t) * 3.5
        const step = Math.max(1, Math.round(10 ** stepPower))
        value = Math.round(value / step) * step
      } else {
        value = Math.round(value)
      }

      setDisplay(Math.max(0, Math.round(value)))
      if (t < 1) frameId = requestAnimationFrame(tick)
      else setDisplay(targetKurus)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [targetKurus, enabled])

  return display
}

export function CoordinatorSharePanel() {
  const [yearMonth, setYearMonth] = useState<YearMonth>(() =>
    currentYearMonthIstanbul(),
  )
  const [loading, setLoading] = useState(true)
  const [vatBaseKurus, setVatBaseKurus] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchMonthlyStats(yearMonth, [])
      .then((stats) => {
        if (cancelled) return
        setVatBaseKurus(stats.org.totalVatBaseKurus)
      })
      .catch((error) => {
        if (cancelled) return
        setVatBaseKurus(0)
        toast.error(mapAppError(error, 'Aylık matrah yüklenemedi.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [yearMonth])

  const shareKurus = coordinatorShareFromVatBaseKurus(vatBaseKurus)
  const animatedShare = useSlotAnimatedKurus(shareKurus, !loading)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <MonthPicker
          id="coordinator-share-month"
          value={yearMonth}
          onChange={setYearMonth}
          variant="compact"
        />
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full max-w-xl" />
      ) : vatBaseKurus <= 0 ? (
        <EmptyState
          title="Bu ayda kayıt yok"
          description={`${formatYearMonthLongTr(yearMonth)} için gösterilecek tutar bulunmuyor.`}
        />
      ) : (
        <div className="relative max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1.5 bg-[image:var(--gradient-primary)]"
          />
          <p className="text-sm font-medium text-text-secondary">
            {formatYearMonthLongTr(yearMonth)}
          </p>
          <p
            className="mt-6 font-display text-4xl font-semibold tracking-tight tabular-nums text-brand-blue sm:text-5xl"
            aria-live="polite"
          >
            {formatTryFromKurus(animatedShare)}
          </p>
        </div>
      )}
    </div>
  )
}
