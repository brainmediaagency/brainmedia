import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/classNames'

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  error?: boolean
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { className, error = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="date"
      aria-invalid={error || undefined}
      className={cn(
        'w-full min-h-[44px] rounded-[var(--radius-sm)] border bg-surface px-3 py-2 text-sm text-text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
        // Keep full opacity — opacity on disabled date inputs makes values unreadable in dark mode.
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-text-primary',
        'read-only:cursor-default read-only:bg-surface-muted read-only:text-text-primary',
        error ? 'border-danger focus-visible:ring-danger/40' : 'border-border',
        className,
      )}
      {...props}
    />
  )
})
