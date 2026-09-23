import { useEffect, useState } from 'react'
import { MapPin, Quote } from 'lucide-react'
import { subscribeTodayRegion } from '@/features/media-planning/services/dailyRegionService'
import { getDailyMotivationQuote } from '@/features/media-planning/utils/dailyMotivation'
import { cn } from '@/lib/classNames'

/** Medya planlama: günün bölgesi + motivasyon tek, öne çıkan kartta. */
export function DailyBriefingCard() {
  const quote = getDailyMotivationQuote()
  const [region, setRegion] = useState<string | null>(null)

  useEffect(() => {
    return subscribeTodayRegion((doc) => {
      const value = doc?.region?.trim() ?? ''
      setRegion(value || null)
    })
  }, [])

  if (!quote && !region) return null

  return (
    <section
      aria-label="Günün özeti"
      className="relative animate-fade-in-up overflow-hidden rounded-[var(--radius-lg)] bg-[image:linear-gradient(135deg,#0d1b3d_0%,#1e3a8a_55%,#2563eb_100%)] text-white shadow-[var(--shadow-md)]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-brand-cyan/30 blur-3xl"
      />
      <div
        className={cn(
          'relative grid gap-4 p-4 sm:p-6',
          region && quote && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center md:gap-8',
        )}
      >
        {region ? (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <MapPin className="size-3.5" aria-hidden="true" />
              Günün bölgesi
            </p>
            <p className="mt-1 font-display text-2xl leading-tight font-extrabold tracking-tight break-words sm:text-3xl lg:text-4xl">
              {region}
            </p>
          </div>
        ) : null}

        {quote ? (
          <figure
            className={cn(
              'min-w-0',
              region && 'border-t border-white/15 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8',
            )}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Quote className="size-3.5" aria-hidden="true" />
              Günün motivasyonu
            </p>
            <blockquote className="mt-1.5 font-display text-base leading-snug font-semibold text-white/95 sm:text-lg md:text-xl">
              “{quote}”
            </blockquote>
          </figure>
        ) : null}
      </div>
    </section>
  )
}
