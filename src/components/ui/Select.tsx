import { ChevronDown } from 'lucide-react'
import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/classNames'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error = false, children, ...props },
  ref,
) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        aria-invalid={error || undefined}
        className={cn(
          'w-full min-h-[44px] appearance-none rounded-[var(--radius-sm)] border bg-surface px-3 py-2 pr-10 text-text-primary shadow-[var(--shadow-xs)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/35',
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-text-primary',
          error
            ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/30'
            : 'border-border hover:border-brand-cyan/40 focus-visible:border-brand-cyan',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
        aria-hidden="true"
      />
    </div>
  )
})
