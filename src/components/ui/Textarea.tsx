import { forwardRef, type TextareaHTMLAttributes, useId } from 'react'
import { cn } from '@/lib/classNames'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean
  showCounter?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error = false, showCounter = false, maxLength, value, defaultValue, id, ...props },
  ref,
) {
  const generatedId = useId()
  const counterId = `${id ?? generatedId}-counter`
  const currentLength = String(value ?? defaultValue ?? '').length

  return (
    <div className="relative w-full">
      <textarea
        ref={ref}
        id={id ?? generatedId}
        aria-invalid={error || undefined}
        aria-describedby={showCounter && maxLength !== undefined ? counterId : undefined}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        className={cn(
          'w-full min-h-[120px] resize-y rounded-[var(--radius-sm)] border bg-surface px-3 py-2 text-text-primary shadow-[var(--shadow-xs)] transition-colors',
          'placeholder:text-text-secondary/80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/35',
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-text-primary',
          showCounter && maxLength !== undefined && 'pb-8',
          error
            ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/30'
            : 'border-border hover:border-brand-cyan/40 focus-visible:border-brand-cyan',
          className,
        )}
        {...props}
      />
      {showCounter && maxLength !== undefined && (
        <p
          id={counterId}
          className="pointer-events-none absolute bottom-2 right-3 text-xs text-text-secondary"
          aria-live="polite"
        >
          {currentLength}/{maxLength}
        </p>
      )}
    </div>
  )
})
