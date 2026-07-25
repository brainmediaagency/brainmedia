import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/classNames'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[image:var(--gradient-primary)] text-white shadow-[0_2px_8px_-2px_rgba(6,182,212,0.5)] hover:brightness-110 hover:shadow-[0_4px_14px_-2px_rgba(6,182,212,0.55)] active:brightness-95 focus-visible:ring-brand-cyan',
  secondary:
    'bg-surface text-text-primary border border-border shadow-[var(--shadow-xs)] hover:border-brand-cyan/40 hover:bg-surface-muted focus-visible:ring-brand-cyan',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface-muted focus-visible:ring-brand-cyan',
  danger:
    'bg-danger text-white shadow-[0_2px_8px_-2px_rgba(239,68,68,0.5)] hover:brightness-110 active:brightness-95 focus-visible:ring-danger',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled ?? loading}
      aria-busy={loading}
      className={cn(
        'inline-flex touch-target items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  ),
)

Button.displayName = 'Button'
