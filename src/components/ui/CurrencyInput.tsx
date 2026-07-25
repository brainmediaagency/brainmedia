import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { formatTryInput, parseTryInput } from '@/lib/currency'
import { cn } from '@/lib/classNames'

export type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null
  onChange: (value: number | null) => void
  error?: boolean
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput({ value, onChange, error = false, className, onBlur, onFocus, ...props }, ref) {
    const [isFocused, setIsFocused] = useState(false)
    const [draft, setDraft] = useState('')

    const displayValue = isFocused ? draft : formatTryInput(value)

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const nextDraft = event.target.value
      setDraft(nextDraft)
      onChange(parseTryInput(nextDraft))
    }

    const handleFocus: InputHTMLAttributes<HTMLInputElement>['onFocus'] = (event) => {
      setIsFocused(true)
      setDraft(value !== null ? formatTryInput(value) : '')
      onFocus?.(event)
    }

    const handleBlur: InputHTMLAttributes<HTMLInputElement>['onBlur'] = (event) => {
      setIsFocused(false)
      setDraft('')
      onBlur?.(event)
    }

    return (
      <div className="relative w-full">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        >
          ₺
        </span>
        <input
          ref={ref}
          inputMode="decimal"
          aria-invalid={error || undefined}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="0"
          className={cn(
            'w-full min-h-[44px] rounded-[var(--radius-sm)] border bg-surface py-2 pl-8 pr-3 text-text-primary',
            'placeholder:text-text-secondary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
            'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-text-primary',
            error ? 'border-danger focus-visible:ring-danger/40' : 'border-border',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)
