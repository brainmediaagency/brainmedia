import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { MetricCard } from '@/components/ui/MetricCard'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  emptyReportCashTotals,
  subscribeReportCashGroups,
} from '@/features/cash/services/cashService'
import {
  CASH_METRIC_VISUAL,
  cashBalanceFooter,
  cashBalanceVisual,
} from '@/features/cash/config/cashMetricVisuals'
import type { ReportCashTotals } from '@/features/cash/types/cash'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'

/**
 * Muhabir paneli: yalnızca giriş yapan muhabirin kendi kasası.
 * Yönetim/koordinatör Muhabir → Kasa için `ManagementCashTab` kullanılır
 * (Merve / Beste / Toplam); bu panel muhabir rolüne özeldir.
 */
export function ReporterCashPanel() {
  const { profile } = useAuth()
  const [totals, setTotals] = useState<ReportCashTotals | undefined>(undefined)

  useEffect(() => {
    // Defense-in-depth: never subscribe without a reporter uid filter.
    if (profile?.role !== 'reporter') {
      setTotals(emptyReportCashTotals())
      return
    }
    const uid = profile?.uid?.trim()
    if (!uid) {
      setTotals(emptyReportCashTotals())
      return
    }
    return subscribeReportCashGroups(
      (_groups, nextTotals) => setTotals(nextTotals),
      (error) => {
        toast.error(mapAppError(error, 'Kasa bakiyesi yüklenemedi.'))
        setTotals(emptyReportCashTotals())
      },
      { createdByUid: uid },
    )
  }, [profile?.role, profile?.uid])

  const loading = totals === undefined
  const safe = totals ?? emptyReportCashTotals()
  const cashBalanceKurus = safe.totalFieldPaidKurus - safe.totalExpenseKurus

  return (
    <AccordionSection title="Kasa" defaultOpen>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Toplam gider"
            valueText={formatTryFromKurus(safe.totalExpenseKurus)}
            {...CASH_METRIC_VISUAL.expense}
            footer="Saha giderleri + ücretler"
          />
          <MetricCard
            label="Sahaya ödenen"
            valueText={formatTryFromKurus(safe.totalFieldPaidKurus)}
            {...CASH_METRIC_VISUAL.fieldPaid}
            footer="Kasadan sahaya verilen tutar"
          />
          <MetricCard
            label="Kasa"
            valueText={formatTryFromKurus(cashBalanceKurus)}
            {...cashBalanceVisual(cashBalanceKurus)}
            footer={cashBalanceFooter(cashBalanceKurus, 'Sahaya ödenen − toplam gider')}
          />
        </div>
      )}
    </AccordionSection>
  )
}
