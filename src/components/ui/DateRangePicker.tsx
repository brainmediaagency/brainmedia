import { CalendarDays } from 'lucide-react'
import {
  addDaysDateOnly,
  currentYearMonthIstanbul,
  isValidDateOnly,
  statsMonthDateBounds,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { cn } from '@/lib/classNames'

export type DateRangeValue = {
  startDate: string
  endDate: string
}

export type DateRangePickerProps = {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  id?: string
  className?: string
  disabled?: boolean
  /** Inclusive earliest date (default: 36 months before today). */
  minDate?: string
  /** Inclusive latest date (default: today). */
  maxDate?: string
  /** Show Bu ay / 7 gün / 30 gün chips. */
  showPresets?: boolean
}

function clampDate(value: string, min: string, max: string): string {
  if (!isValidDateOnly(value)) return max
  if (value < min) return min
  if (value > max) return max
  return value
}

function normalizeRange(
  startDate: string,
  endDate: string,
  minDate: string,
  maxDate: string,
): DateRangeValue {
  let start = clampDate(startDate, minDate, maxDate)
  let end = clampDate(endDate, minDate, maxDate)
  if (start > end) end = start
  return { startDate: start, endDate: end }
}

/**
 * Compact start–end date control for filter bars.
 * Native date inputs keep mobile pickers; chrome stays minimal.
 */
export function DateRangePicker({
  value,
  onChange,
  id = 'date-range',
  className,
  disabled = false,
  minDate,
  maxDate,
  showPresets = true,
}: DateRangePickerProps) {
  const today = todayDateOnlyIstanbul()
  const max = maxDate && isValidDateOnly(maxDate) ? maxDate : today
  const min =
    minDate && isValidDateOnly(minDate)
      ? minDate
      : addDaysDateOnly(today, -365 * 3)

  const range = normalizeRange(value.startDate, value.endDate, min, max)

  const setRange = (startDate: string, endDate: string) => {
    onChange(normalizeRange(startDate, endDate, min, max))
  }

  const monthBounds = statsMonthDateBounds(currentYearMonthIstanbul())
  const presets = [
    {
      id: 'month',
      label: 'Bu ay',
      startDate: monthBounds.startDate,
      endDate: monthBounds.endDate > today ? today : monthBounds.endDate,
    },
    {
      id: '7d',
      label: '7 gün',
      startDate: addDaysDateOnly(today, -6),
      endDate: today,
    },
    {
      id: '30d',
      label: '30 gün',
      startDate: addDaysDateOnly(today, -29),
      endDate: today,
    },
  ] as const

  const activePresetId = presets.find(
    (preset) =>
      preset.startDate === range.startDate && preset.endDate === range.endDate,
  )?.id

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'inline-flex w-full max-w-md items-center gap-2 rounded-[var(--radius-md)]',
          'border border-border/80 bg-surface-muted/40 px-2.5 py-1.5',
          'focus-within:border-brand-cyan/50 focus-within:ring-2 focus-within:ring-brand-cyan/25',
          disabled && 'opacity-60',
        )}
      >
        <CalendarDays
          className="size-4 shrink-0 text-text-secondary"
          aria-hidden="true"
        />
        <label className="sr-only" htmlFor={`${id}-start`}>
          Başlangıç tarihi
        </label>
        <input
          id={`${id}-start`}
          type="date"
          value={range.startDate}
          min={min}
          max={range.endDate || max}
          disabled={disabled}
          onChange={(e) => setRange(e.target.value, range.endDate)}
          className={cn(
            'min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm tabular-nums text-text-primary',
            'scheme-light dark:scheme-dark',
            'focus-visible:outline-none',
            'disabled:cursor-not-allowed',
          )}
        />
        <span
          className="shrink-0 text-xs font-medium text-text-secondary"
          aria-hidden="true"
        >
          –
        </span>
        <label className="sr-only" htmlFor={`${id}-end`}>
          Bitiş tarihi
        </label>
        <input
          id={`${id}-end`}
          type="date"
          value={range.endDate}
          min={range.startDate || min}
          max={max}
          disabled={disabled}
          onChange={(e) => setRange(range.startDate, e.target.value)}
          className={cn(
            'min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm tabular-nums text-text-primary',
            'scheme-light dark:scheme-dark',
            'focus-visible:outline-none',
            'disabled:cursor-not-allowed',
          )}
        />
      </div>

      {showPresets ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hızlı aralık">
          {presets.map((preset) => {
            const active = activePresetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => setRange(preset.startDate, preset.endDate)}
                className={cn(
                  'rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
                  'disabled:cursor-not-allowed',
                  active
                    ? 'bg-brand-blue text-white'
                    : 'bg-surface text-text-secondary hover:bg-surface-muted hover:text-text-primary border border-border/70',
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
