import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  subscribeCompanyCashBalance,
  type CompanyCashSnapshot,
} from '@/features/cash/services/companyCashService'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'

/**
 * Yalnızca muhabir: şirket devreden kasa bakiyesi (sahaya ödenen − toplam gider).
 * Detay / diğer raporlar gösterilmez.
 */
export function ReporterCashPanel() {
  const [snapshot, setSnapshot] = useState<CompanyCashSnapshot | null | undefined>(
    undefined,
  )

  useEffect(() => {
    return subscribeCompanyCashBalance(
      (next) => setSnapshot(next),
      (error) => {
        toast.error(mapAppError(error, 'Kasa bakiyesi yüklenemedi.'))
        setSnapshot(null)
      },
    )
  }, [])

  const loading = snapshot === undefined
  const balanceKurus = snapshot?.cashBalanceKurus ?? 0

  return (
    <AccordionSection
      number="01"
      title="Kasa"
      description="Devreden kasa bakiyesi — sahaya ödenen eksi toplam gider."
      defaultOpen
    >
      {loading ? (
        <Skeleton className="h-28 w-full max-w-md" />
      ) : (
        <div className="max-w-md rounded-[var(--radius-md)] border border-brand-blue/30 bg-brand-blue/5 p-5">
          <p className="text-sm text-text-secondary">Devreden kasa</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-text-primary">
            {formatTryFromKurus(balanceKurus)}
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            Sahaya ödenen − toplam gider (tüm muhabir raporları)
          </p>
        </div>
      )}
    </AccordionSection>
  )
}
