import { formatTimer } from '@/lib/date'
import { cn } from '@/lib/classNames'

export type ShiftTimerProps = {
  totalSeconds: number
  finished?: boolean
  className?: string
}

export function ShiftTimer({ totalSeconds, finished = false, className }: ShiftTimerProps) {
  return (
    <div
      className={cn(
        'font-display text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl',
        finished ? 'text-brand-orange' : 'text-white',
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {formatTimer(totalSeconds)}
    </div>
  )
}
