import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase,
  Camera,
  Clock3,
  Newspaper,
  Wallet,
  XCircle,
} from 'lucide-react'
import { CASH_METRIC_VISUAL, cashBalanceFooter, cashBalanceVisual } from '@/features/cash/config/cashMetricVisuals'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { MetricCard } from '@/components/ui/MetricCard'
import { MonthPicker } from '@/components/ui/MonthPicker'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/Table'
import {
  currentYearMonthIstanbul,
  fetchMonthlyStats,
  type MonthlyStatsResult,
  type YearMonth,
} from '@/features/stats/services/monthlyStatsService'
import { subscribeMediaPlanners } from '@/features/users/services/userService'
import type { UserProfile } from '@/features/users/types/user'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'

export type MonthlyStatsPanelProps = {
  defaultOpen?: boolean
}

export function MonthlyStatsPanel({
  defaultOpen = true,
}: MonthlyStatsPanelProps) {
  const [yearMonth, setYearMonth] = useState<YearMonth>(() => currentYearMonthIstanbul())
  const [planners, setPlanners] = useState<UserProfile[]>([])
  const [plannersReady, setPlannersReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<MonthlyStatsResult | null>(null)

  useEffect(() => {
    return subscribeMediaPlanners(
      (users) => {
        setPlanners(users)
        setPlannersReady(true)
      },
      (error) => {
        toast.error(mapAppError(error, 'Planlamacı listesi yüklenemedi.'))
        setPlannersReady(true)
      },
    )
  }, [])

  const load = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      toast.error('Geçerli bir ay seçin.')
      return
    }
    setLoading(true)
    try {
      const result = await fetchMonthlyStats(yearMonth, planners)
      setStats(result)
    } catch (error) {
      toast.error(mapAppError(error, 'Aylık özet yüklenemedi.'))
    } finally {
      setLoading(false)
    }
  }, [yearMonth, planners])

  useEffect(() => {
    if (!plannersReady) return
    void load()
  }, [plannersReady, load])

  return (
    <AccordionSection
      title="Aylık Özet"
      description="Seçilen aydaki işler, çekim dakikası, kasa ve medya planlama performansı. Rapor / çekim günü kendi takvim ayına yazılır (ayın son günü dahil)."
      defaultOpen={defaultOpen}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <MonthPicker
            id="monthly-stats-month"
            value={yearMonth}
            onChange={(next) => setYearMonth(next as YearMonth)}
            disabled={loading}
            className="sm:min-w-[18rem]"
          />
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            Yenile
          </Button>
        </div>

        {loading && !stats ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-[var(--radius-md)]" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-text-primary">
                Organizasyon
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                <MetricCard
                  label="Yapılan iş (çekilen)"
                  value={stats.org.jobsShot}
                  icon={Camera}
                  accent="yellow"
                  topBar="yellow"
                  animate
                  footer={`Girilen ${stats.org.jobsEntered} · Onaylanan ${stats.org.jobsReceived}`}
                />
                <MetricCard
                  label="İptal edilen iş"
                  value={stats.org.jobsCancelled}
                  icon={XCircle}
                  accent="navy"
                  topBar="navy"
                  animate
                />
                <MetricCard
                  label="Çekim dakikası"
                  value={stats.org.shootMinutes}
                  icon={Clock3}
                  accent="violet"
                  topBar="violet"
                  suffix="dk"
                  animate
                  footer={`${stats.org.reportCount} muhabir raporu`}
                />
                <MetricCard
                  label="Girilen iş"
                  value={stats.org.jobsEntered}
                  icon={Briefcase}
                  accent="green"
                  topBar="green"
                  animate
                />
                <MetricCard
                  label="Haber geliri"
                  valueText={formatTryFromKurus(stats.org.totalNewsIncomeKurus)}
                  icon={Newspaper}
                  accent="pink"
                  topBar="pink"
                  footer="Formlardaki haber tutarları toplamı"
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-text-primary">
                Aylık kasa
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Toplam gelir"
                  valueText={formatTryFromKurus(stats.org.totalIncomeKurus)}
                  {...CASH_METRIC_VISUAL.income}
                  footer="Matrah + KDV"
                />
                <MetricCard
                  label="Toplam gider"
                  valueText={formatTryFromKurus(stats.org.totalExpenseKurus)}
                  {...CASH_METRIC_VISUAL.expense}
                  footer="Saha giderleri + ücretler"
                />
                <MetricCard
                  label="Sahaya ödenen"
                  valueText={formatTryFromKurus(stats.org.totalFieldPaidKurus)}
                  {...CASH_METRIC_VISUAL.fieldPaid}
                  footer="Muhabir formları"
                />
                <MetricCard
                  label="Kasa"
                  valueText={formatTryFromKurus(stats.org.cashBalanceKurus)}
                  {...cashBalanceVisual(stats.org.cashBalanceKurus)}
                  footer={cashBalanceFooter(stats.org.cashBalanceKurus, 'Sahaya ödenen − gider')}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-text-primary">
                <Wallet className="size-4 text-brand-blue" aria-hidden="true" />
                Medya planlama
              </h3>
              {stats.planners.length === 0 ? (
                <EmptyState
                  title="Planlamacı bulunamadı"
                  description="Aktif medya planlama hesabı veya bu aya ait iş kaydı yok."
                />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell header>Planlamacı</TableCell>
                      <TableCell header className="text-right">
                        Girilen
                      </TableCell>
                      <TableCell header className="text-right">
                        Çekilen
                      </TableCell>
                      <TableCell header className="text-right">
                        İptal
                      </TableCell>
                      <TableCell header className="text-right">
                        Anlaşılan tutar
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.planners.map((row) => (
                      <TableRow key={row.uid}>
                        <TableCell className="font-medium text-text-primary">
                          {row.fullName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.entered}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.shot}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.cancelled}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTryFromKurus(row.agreedAmountKurus)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-surface-muted/60 font-semibold">
                      <TableCell>Toplam</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stats.totals.entered}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{stats.totals.shot}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stats.totals.cancelled}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTryFromKurus(stats.totals.agreedAmountKurus)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        ) : (
          <EmptyState
            title="Özet yüklenemedi"
            description="Ay seçip Yenile’ye basın."
          />
        )}
      </div>
    </AccordionSection>
  )
}
