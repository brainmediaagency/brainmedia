import { cn } from '@/lib/classNames'

export type CountBadgeTone = 'neutral' | 'warning' | 'success'

export type CountBadgeProps = {
  count: number
  /** Appends "+" when more pages exist. */
  hasMore?: boolean
  loading?: boolean
  tone?: CountBadgeTone
  label?: string
  className?: string
}

const toneClass: Record<CountBadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
}

export function CountBadge({
  count,
  hasMore = false,
  loading = false,
  tone = 'neutral',
  label,
  className,
}: CountBadgeProps) {
  if (loading) {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-block h-5 w-7 animate-pulse rounded-full bg-surface-muted', className)}
      />
    )
  }
  const text = `${count}${hasMore ? '+' : ''}`
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-sans text-xs font-semibold tabular-nums',
        toneClass[count === 0 ? 'neutral' : tone],
        className,
      )}
      aria-label={label ? `${text} ${label}` : undefined}
    >
      {text}
    </span>
  )
}
