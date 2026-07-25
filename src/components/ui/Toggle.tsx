import { cn } from '@/lib/classNames'

export type ToggleProps = {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-labelledby'?: string
  className?: string
}

export function Toggle({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  className,
  ...aria
}: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group inline-flex items-center gap-3 rounded-[var(--radius-md)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200',
          checked
            ? 'border-transparent bg-[image:var(--gradient-primary)] shadow-[0_2px_6px_-2px_rgba(6,182,212,0.55)]'
            : 'border-border bg-surface-muted',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
      {label ? (
        <span className="text-sm font-medium text-text-primary">{label}</span>
      ) : (
        <span className="sr-only">{checked ? 'Açık' : 'Kapalı'}</span>
      )}
    </button>
  )
}
