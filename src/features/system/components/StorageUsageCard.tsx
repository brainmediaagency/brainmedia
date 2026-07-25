import { HardDrive, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/classNames'
import { formatDateTimeTr } from '@/lib/date'
import { formatBytesTr, formatStorageUsageTr } from '@/lib/formatBytes'
import { mapAppError } from '@/lib/errors'
import {
  defaultStorageUsageSnapshot,
  fetchDriveStorageUsage,
  subscribeStorageUsage,
  type StorageUsageSnapshot,
} from '@/features/system/services/storageUsageService'
import { Skeleton } from '@/components/ui/Skeleton'

export type StorageUsageCardProps = {
  className?: string
}

export function StorageUsageCard({ className }: StorageUsageCardProps) {
  const [usage, setUsage] = useState<StorageUsageSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    return subscribeStorageUsage(
      (next) => {
        setUsage(next)
        setError(null)
      },
      (err) => {
        setError(mapAppError(err, 'Google Drive kotası yüklenemedi.'))
        setUsage((prev) => prev ?? defaultStorageUsageSnapshot())
      },
    )
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const next = await fetchDriveStorageUsage()
      setUsage(next)
      setError(null)
    } catch (err) {
      setError(mapAppError(err, 'Google Drive kotası yüklenemedi.'))
    } finally {
      setRefreshing(false)
    }
  }, [])

  if (!usage) {
    return <Skeleton className={cn('h-[7.5rem] w-full max-w-sm', className)} />
  }

  const display = formatStorageUsageTr(usage.usedBytes, usage.quotaBytes)
  const ratio =
    usage.quotaBytes > 0 ? Math.min(1, usage.usedBytes / usage.quotaBytes) : 0
  const percentLabel = new Intl.NumberFormat('tr-TR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(ratio)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-primary)]"
      />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-text-secondary">Google Drive</p>
          <p className="font-display text-2xl font-semibold tracking-tight text-brand-blue tabular-nums sm:text-3xl">
            {display}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="rounded-[var(--radius-sm)] border border-border bg-surface p-2 text-text-secondary transition-colors hover:border-brand-cyan/40 hover:text-brand-blue disabled:opacity-50"
            aria-label="Drive kotasını yenile"
            title="Yenile"
          >
            <RefreshCw
              className={cn('size-4', refreshing && 'animate-spin')}
              aria-hidden
            />
          </button>
          <div className="rounded-[var(--radius-sm)] bg-brand-cyan/12 p-2.5 text-brand-blue">
            <HardDrive className="size-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm text-text-secondary">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-border/60"
          role="progressbar"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Google Drive doluluk oranı"
        >
          <div
            className="h-full rounded-full bg-brand-blue transition-[width] duration-500"
            style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 2 : 0)}%` }}
          />
        </div>
        <p>
          {usage.exists ? (
            <>
              {percentLabel} dolu
              {usage.brainUsedBytes > 0 ? (
                <>
                  {' '}
                  · Brain {formatBytesTr(usage.brainUsedBytes)}
                  {usage.objectCount > 0
                    ? ` (${usage.objectCount.toLocaleString('tr-TR')} dosya)`
                    : null}
                </>
              ) : null}
              {usage.updatedAt ? <> · {formatDateTimeTr(usage.updatedAt)}</> : null}
            </>
          ) : (
            <>
              {error
                ? 'Drive kotası alınamadı'
                : 'Drive kotası henüz yüklenmedi — yenile’ye bas'}
            </>
          )}
        </p>
        {error ? <p className="text-danger">{error}</p> : null}
      </div>
    </div>
  )
}
