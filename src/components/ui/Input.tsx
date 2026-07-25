import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/classNames'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError = false, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-[var(--radius-md)] border bg-surface px-3 text-sm text-text-primary shadow-[var(--shadow-xs)] placeholder:text-text-secondary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/35 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-text-primary',
        hasError
          ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/30'
          : 'border-border hover:border-brand-cyan/40 focus-visible:border-brand-cyan',
        className,
      )}
      {...props}
    />
  ),
)

Input.displayName = 'Input'
