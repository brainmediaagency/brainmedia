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

function SummaryCard({
  label,
  valueKurus,
  hint,
  tone,
}: {
  label: string
  valueKurus: number
  hint: string
  tone: 'income' | 'expense' | 'field' | 'cash'
}) {
  const toneClass =
    tone === 'income'
      ? 'border-success/30 bg-success/5'
      : tone === 'expense'
        ? 'border-danger/30 bg-danger/5'
        : tone === 'field'
          ? 'border-warning/30 bg-warning/5'
          : 'border-brand-blue/30 bg-brand-blue/5'

  return (
    <div className={`rounded-[var(--radius-md)] border p-4 ${toneClass}`}>
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-text-primary">
        {formatTryFromKurus(valueKurus)}
      </p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </div>
  )
}

/**
 * Yalnızca muhabir + yönetim/koordinatör (muhabir paneli): şirket kasa özeti.
 * Aynı 4 kalem; rapor listesi yok. İK / kameraman / MPU bu sekmeyi görmez.
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
  const totals = snapshot ?? {
    cashBalanceKurus: 0,
    totalFieldPaidKurus: 0,
    totalExpenseKurus: 0,
    totalIncomeKurus: 0,
    reportCount: 0,
  }

  return (
    <AccordionSection
      number="01"
      title="Kasa"
      description="Günlük raporlardan gider, sahaya ödenen ve kasa bakiyesi."
      defaultOpen
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label="Toplam gider"
            valueKurus={totals.totalExpenseKurus}
            hint="Saha giderleri + ücretler (KDV hariç)"
            tone="expense"
          />
          <SummaryCard
            label="Sahaya ödenen"
            valueKurus={totals.totalFieldPaidKurus}
            hint="Kasadan sahaya verilen tutar"
            tone="field"
          />
          <SummaryCard
            label="Kasa"
            valueKurus={totals.cashBalanceKurus}
            hint="Sahaya ödenen − toplam gider"
            tone="cash"
          />
        </div>
      )}
    </AccordionSection>
  )
}
