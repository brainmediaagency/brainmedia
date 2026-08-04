import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase,
  Camera,
  Clock3,
  Wallet,
  XCircle,
} from 'lucide-react'
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

function MoneyCard({
  label,
  valueKurus,
  hint,
  tone,
  topBar,
}: {
  label: string
  valueKurus: number
  hint: string
  tone: 'income' | 'expense' | 'field' | 'cash'
  topBar?: 'yellow' | 'navy' | 'violet' | 'green' | 'pink'
}) {
  const toneClass =
    tone === 'income'
      ? 'border-success/30 bg-success/5'
      : tone === 'expense'
        ? 'border-danger/30 bg-danger/5'
        : tone === 'field'
          ? 'border-warning/30 bg-warning/5'
          : 'border-brand-blue/30 bg-brand-blue/5'

  const barClass =
    topBar === 'yellow'
      ? 'bg-[#f7c600]'
      : topBar === 'navy'
        ? 'bg-brand-navy'
        : topBar === 'violet'
          ? 'bg-[#7c3aed]'
          : topBar === 'green'
            ? 'bg-success'
            : topBar === 'pink'
              ? 'bg-brand-pink'
              : null

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-md)] border p-4 ${toneClass}`}>
      {barClass ? (
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${barClass}`} />
      ) : null}
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-text-primary">
        {formatTryFromKurus(valueKurus)}
      </p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </div>
  )
}

export type MonthlyStatsPanelProps = {
  sectionNumber?: string
  defaultOpen?: boolean
}

export function MonthlyStatsPanel({
  sectionNumber = '01',
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
      number={sectionNumber}
      title="Aylık Özet"
      description="Seçilen aydaki işler, çekim dakikası, kasa ve medya planlama performansı."
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
                <MoneyCard
                  label="Haber geliri"
                  valueKurus={stats.org.totalNewsIncomeKurus}
                  hint="Formlardaki haber tutarları toplamı"
                  tone="cash"
                  topBar="pink"
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-text-primary">
                Aylık kasa
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MoneyCard
                  label="Toplam gelir"
                  valueKurus={stats.org.totalIncomeKurus}
                  hint="Matrah + KDV"
                  tone="income"
                />
                <MoneyCard
                  label="Toplam gider"
                  valueKurus={stats.org.totalExpenseKurus}
                  hint="Saha + ücret + KDV"
                  tone="expense"
                />
                <MoneyCard
                  label="Sahaya ödenen"
                  valueKurus={stats.org.totalFieldPaidKurus}
                  hint="Muhabir formları"
                  tone="field"
                />
                <MoneyCard
                  label="Kasa"
                  valueKurus={stats.org.cashBalanceKurus}
                  hint="Sahaya ödenen − gider"
                  tone="cash"
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
