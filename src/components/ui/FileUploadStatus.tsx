import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/classNames'

export type FileUploadStatusProps = {
  label: string
  detail?: string
  /** 0–100; omit for indeterminate */
  percent?: number | null
  className?: string
  compact?: boolean
}

export function FileUploadStatus({
  label,
  detail,
  percent = null,
  className,
  compact = false,
}: FileUploadStatusProps) {
  const determinate =
    typeof percent === 'number' && Number.isFinite(percent) && percent >= 0
  const clamped = determinate ? Math.min(100, Math.max(0, percent)) : 0

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-[var(--radius-md)] border border-brand-cyan/35 bg-brand-cyan/10',
        compact ? 'px-3 py-2.5' : 'px-4 py-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Loader2
          className={cn(
            'shrink-0 animate-spin text-brand-blue',
            compact ? 'mt-0.5 size-4' : 'mt-0.5 size-5',
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-0.5">
            <p
              className={cn(
                'font-medium text-text-primary',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              {label}
              {determinate ? (
                <span className="tabular-nums text-text-secondary">
                  {' '}
                  · %{Math.round(clamped)}
                </span>
              ) : null}
            </p>
            {detail ? (
              <p
                className={cn(
                  'truncate text-text-secondary',
                  compact ? 'text-[11px]' : 'text-xs',
                )}
              >
                {detail}
              </p>
            ) : null}
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
            aria-hidden
          >
            {determinate ? (
              <div
                className="h-full rounded-full bg-brand-blue transition-[width] duration-200 ease-out"
                style={{ width: `${clamped}%` }}
              />
            ) : (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-blue/80" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
