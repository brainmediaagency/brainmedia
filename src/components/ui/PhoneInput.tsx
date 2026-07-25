import { forwardRef, useEffect, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { digitsOnly, formatPhoneDisplay, normalizeTurkishPhone } from '@/lib/phone'
import { cn } from '@/lib/classNames'

export type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  error?: boolean
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, error = false, className, onBlur, onFocus, ...props },
  ref,
) {
  const [display, setDisplay] = useState(() => formatDisplayValue(value))

  useEffect(() => {
    setDisplay(formatDisplayValue(value))
  }, [value])

  function formatDisplayValue(raw: string): string {
    const normalized = normalizeTurkishPhone(raw)
    if (normalized) return formatPhoneDisplay(normalized)
    const digits = digitsOnly(raw)
    if (!digits) return ''
    if (digits.startsWith('0')) return formatPartialLocal(digits)
    if (digits.startsWith('5')) return formatPartialLocal(`0${digits}`)
    return digits
  }

  function formatPartialLocal(digits: string): string {
    const parts = [
      digits.slice(0, 4),
      digits.slice(4, 7),
      digits.slice(7, 9),
      digits.slice(9, 11),
    ].filter(Boolean)
    return parts.join(' ')
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextDisplay = formatDisplayValue(event.target.value)
    setDisplay(nextDisplay)
    const normalized = normalizeTurkishPhone(event.target.value)
    onChange(normalized ?? digitsOnly(event.target.value))
  }

  const handleFocus: InputHTMLAttributes<HTMLInputElement>['onFocus'] = (event) => {
    setDisplay(formatDisplayValue(value))
    onFocus?.(event)
  }

  const handleBlur: InputHTMLAttributes<HTMLInputElement>['onBlur'] = (event) => {
    const normalized = normalizeTurkishPhone(value)
    setDisplay(normalized ? formatPhoneDisplay(normalized) : formatDisplayValue(value))
    onBlur?.(event)
  }

  return (
    <input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      aria-invalid={error || undefined}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder="0 5XX XXX XX XX"
      className={cn(
        'w-full min-h-[44px] rounded-[var(--radius-sm)] border bg-surface px-3 py-2 text-text-primary',
        'placeholder:text-text-secondary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-text-primary',
        error ? 'border-danger focus-visible:ring-danger/40' : 'border-border',
        className,
      )}
      {...props}
    />
  )
})
