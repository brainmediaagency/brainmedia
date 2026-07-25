import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Camera, Target, XCircle } from 'lucide-react'
import { subscribeUserProfile } from '@/features/users/services/userService'
import type { UserStats } from '@/features/users/types/user'
import { MetricCard } from '@/components/ui/MetricCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/classNames'

export type PlannerScoreOverviewProps = {
  uid: string
}

const emptyStats: UserStats = {
  jobsReceived: 0,
  jobsShot: 0,
  jobsCancelled: 0,
}

const formatCount = (value: number) => new Intl.NumberFormat('tr-TR').format(value)

type LegendItemProps = {
  label: string
  count: number
  percent: number
  swatch: string
}

function LegendItem({ label, count, percent, swatch }: LegendItemProps) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', swatch)} />
        <span className="truncate text-sm text-text-secondary">{label}</span>
      </div>
      <p className="shrink-0 tabular-nums text-sm text-text-primary">
        <span className="font-display font-semibold">{formatCount(count)}</span>
        <span className="ml-1.5 text-text-secondary">%{percent}</span>
      </p>
    </div>
  )
}

export function PlannerScoreOverview({ uid }: PlannerScoreOverviewProps) {
  const [stats, setStats] = useState<UserStats>(emptyStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return

    setLoading(true)
    const unsubscribe = subscribeUserProfile(
      uid,
      (profile) => {
        setStats(profile?.stats ?? emptyStats)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [uid])

  const rates = useMemo(() => {
    const received = stats.jobsReceived
    if (received <= 0) {
      return { shot: 0, cancelled: 0, active: 0 }
    }
    const shot = Math.round((stats.jobsShot / received) * 100)
    const cancelled = Math.round((stats.jobsCancelled / received) * 100)
    const active = Math.max(0, 100 - shot - cancelled)
    return { shot, cancelled, active }
  }, [stats])

  const pendingCount = useMemo(
    () => Math.max(0, stats.jobsReceived - stats.jobsShot - stats.jobsCancelled),
    [stats],
  )

  const hasVolume = stats.jobsReceived > 0

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-[var(--radius-md)]" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Primary performans composition — one surface, not a card grid */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-primary)]"
        />

        <div className="grid gap-6 p-5 pt-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-end lg:gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-[var(--radius-sm)] bg-brand-cyan/12 p-2 text-brand-blue">
                <Target className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                  Performans
                </p>
                <p className="text-sm text-text-secondary">Alınan işlere göre dağılım</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-text-secondary">Çekim oranı</p>
              <p className="mt-1 font-display text-5xl font-semibold tracking-tight tabular-nums text-brand-blue sm:text-6xl">
                %{rates.shot}
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                {hasVolume ? (
                  <>
                    {formatCount(stats.jobsShot)} çekilen · {formatCount(stats.jobsReceived)} alınan
                  </>
                ) : (
                  'Henüz iş kaydı yok'
                )}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div
              className="flex h-3 overflow-hidden rounded-full bg-surface-muted"
              role="img"
              aria-label={`Çekim %${rates.shot}, iptal %${rates.cancelled}, bekleyen %${rates.active}`}
            >
              {hasVolume ? (
                <>
                  <span
                    className="bg-brand-pink transition-[width] duration-500"
                    style={{ width: `${rates.shot}%` }}
                  />
                  <span
                    className="bg-brand-orange transition-[width] duration-500"
                    style={{ width: `${rates.cancelled}%` }}
                  />
                  <span
                    className="bg-brand-cyan transition-[width] duration-500"
                    style={{ width: `${rates.active}%` }}
                  />
                </>
              ) : (
                <span className="w-full bg-border/70" />
              )}
            </div>

            <div className="space-y-2.5 border-t border-border pt-4">
              <LegendItem
                label="Çekilen"
                count={stats.jobsShot}
                percent={rates.shot}
                swatch="bg-brand-pink"
              />
              <LegendItem
                label="İptal"
                count={stats.jobsCancelled}
                percent={rates.cancelled}
                swatch="bg-brand-orange"
              />
              <LegendItem
                label="Bekleyen / diğer"
                count={pendingCount}
                percent={rates.active}
                swatch="bg-brand-cyan"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Alınan İş"
          value={stats.jobsReceived}
          icon={Briefcase}
          accent="cyan"
          animate
          footer="Toplam iş kaydı"
        />
        <MetricCard
          label="Çekilen İş"
          value={stats.jobsShot}
          icon={Camera}
          accent="pink"
          animate
          footer="Tamamlanan çekimler"
        />
        <MetricCard
          label="İptal Edilen"
          value={stats.jobsCancelled}
          icon={XCircle}
          accent="orange"
          animate
          footer="İptal edilen kayıtlar"
        />
      </div>
    </div>
  )
}
