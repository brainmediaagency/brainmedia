import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { subscribeTodayRegion } from '@/features/media-planning/services/dailyRegionService'

/**
 * Medya planlama: motivasyonun altında günün bölgesi (varsa).
 */
export function DailyRegionBanner() {
  const [region, setRegion] = useState<string | null>(null)

  useEffect(() => {
    return subscribeTodayRegion((doc) => {
      const value = doc?.region?.trim() ?? ''
      setRegion(value || null)
    })
  }, [])

  if (!region) return null

  return (
    <aside
      className="mx-auto w-full max-w-3xl animate-fade-in-up text-center"
      aria-label="Günün bölgesi"
    >
      <div className="flex flex-col items-center gap-2 px-5 pb-4 pt-1 sm:gap-3 sm:px-8 sm:pb-6">
        <div className="flex items-center justify-center gap-2">
          <MapPin
            className="size-5 shrink-0 text-brand-cyan sm:size-6"
            aria-hidden="true"
          />
          <p className="text-base font-semibold tracking-tight text-text-primary sm:text-lg md:text-xl">
            Günün bölgesi:
          </p>
        </div>
        <p className="font-display text-3xl font-extrabold leading-tight tracking-tight text-brand-blue sm:text-4xl sm:leading-tight md:text-5xl md:leading-[1.1]">
          {region}
        </p>
      </div>
    </aside>
  )
}
