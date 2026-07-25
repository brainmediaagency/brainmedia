import { Clock, Pause, Play } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/classNames'
import { useShiftTracker } from '@/features/media-planning/hooks/useShiftTracker'

export type ShiftTrackerWidgetProps = {
  uid: string
  className?: string
}

/**
 * Compact shift tracker pill intended for sticky placement in a page corner.
 * Shows live status plus a single start/end action.
 */
export function ShiftTrackerWidget({ uid, className }: ShiftTrackerWidgetProps) {
  const {
    loading,
    starting,
    ending,
    isActive,
    canStart,
    canEnd,
    disabledReason,
    handleStart,
    handleEnd,
    isOwnProfile,
  } = useShiftTracker({ uid })

  if (loading) {
    return (
      <div
        className={cn(
          'flex h-12 w-48 items-center rounded-full bg-[image:var(--gradient-sidebar)] px-4',
          className,
        )}
      >
        <Skeleton className="h-4 w-full bg-white/20" />
      </div>
    )
  }

  const busy = starting || ending
  const actionDisabled = busy || (isActive ? !canEnd : !canStart)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-full bg-[image:var(--gradient-sidebar)] py-2 pl-4 pr-2 text-white shadow-[var(--shadow-lg)]',
        className,
      )}
      title={disabledReason ?? undefined}
    >
      <Clock className="size-4 shrink-0 text-brand-cyan" aria-hidden="true" />

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 shrink-0 rounded-full',
            isActive ? 'animate-pulse bg-emerald-400' : 'bg-white/30',
          )}
        />
        <span className="whitespace-nowrap text-sm font-medium">
          {isActive ? 'Mesai aktif' : 'Mesai kapalı'}
        </span>
      </div>

      {isOwnProfile ? (
        <button
          type="button"
          onClick={() => void (isActive ? handleEnd() : handleStart())}
          disabled={actionDisabled}
          aria-busy={busy}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan disabled:cursor-not-allowed disabled:opacity-50',
            isActive
              ? 'bg-[image:var(--gradient-accent)] text-white hover:brightness-110'
              : 'bg-[image:var(--gradient-primary)] text-white hover:brightness-110',
          )}
        >
          {busy ? (
            <span
              className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : isActive ? (
            <Pause className="size-3" aria-hidden="true" />
          ) : (
            <Play className="size-3" aria-hidden="true" />
          )}
          {isActive ? 'Bitir' : 'Başlat'}
        </button>
      ) : null}
    </div>
  )
}
