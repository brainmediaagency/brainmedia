import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import {
  currentYearMonthIstanbul,
  formatYearMonthLongTr,
  formatYearMonthRangeTr,
  isValidYearMonth,
  shiftYearMonth,
} from '@/lib/date'
import { cn } from '@/lib/classNames'

const MONTH_OPTIONS: { value: string; label: string }[] = [
  { value: '01', label: 'Ocak' },
  { value: '02', label: 'Şubat' },
  { value: '03', label: 'Mart' },
  { value: '04', label: 'Nisan' },
  { value: '05', label: 'Mayıs' },
  { value: '06', label: 'Haziran' },
  { value: '07', label: 'Temmuz' },
  { value: '08', label: 'Ağustos' },
  { value: '09', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
]

export type MonthPickerProps = {
  value: string
  onChange: (yearMonth: string) => void
  id?: string
  className?: string
  /** Inclusive earliest `yyyy-MM` (default: 24 months back). */
  minYearMonth?: string
  /** Inclusive latest `yyyy-MM` (default: current month). */
  maxYearMonth?: string
  disabled?: boolean
}

function buildYearOptions(minYm: string, maxYm: string): number[] {
  const minY = Number(minYm.slice(0, 4))
  const maxY = Number(maxYm.slice(0, 4))
  const years: number[] = []
  for (let y = maxY; y >= minY; y -= 1) years.push(y)
  return years
}

function clampYearMonth(ym: string, minYm: string, maxYm: string): string {
  if (!isValidYearMonth(ym)) return maxYm
  if (ym < minYm) return minYm
  if (ym > maxYm) return maxYm
  return ym
}

/**
 * Month period control: prev/next, “Bu ay”, and month/year selects.
 * Prefer over native `type="month"` (weak mobile UX, opaque `yyyy-MM` value).
 */
export function MonthPicker({
  value,
  onChange,
  id = 'month-picker',
  className,
  minYearMonth,
  maxYearMonth,
  disabled = false,
}: MonthPickerProps) {
  const current = currentYearMonthIstanbul()
  const maxYm = maxYearMonth && isValidYearMonth(maxYearMonth) ? maxYearMonth : current
  const minYm =
    minYearMonth && isValidYearMonth(minYearMonth)
      ? minYearMonth
      : shiftYearMonth(maxYm, -36)

  const yearMonth = clampYearMonth(
    isValidYearMonth(value) ? value : current,
    minYm,
    maxYm,
  )
  const year = yearMonth.slice(0, 4)
  const month = yearMonth.slice(5, 7)
  const years = buildYearOptions(minYm, maxYm)
  const isCurrent = yearMonth === current
  const canGoPrev = yearMonth > minYm
  const canGoNext = yearMonth < maxYm

  const setSafe = (next: string) => {
    onChange(clampYearMonth(next, minYm, maxYm))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label="Önceki ay"
          className="shrink-0 px-2.5"
          disabled={disabled || !canGoPrev}
          onClick={() => setSafe(shiftYearMonth(yearMonth, -1))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1 text-center sm:flex-none sm:px-2">
          <p
            id={`${id}-label`}
            className="font-display text-base font-semibold capitalize text-text-primary sm:text-lg"
          >
            {formatYearMonthLongTr(yearMonth)}
          </p>
          <p className="text-xs text-text-secondary">
            {formatYearMonthRangeTr(yearMonth)}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label="Sonraki ay"
          className="shrink-0 px-2.5"
          disabled={disabled || !canGoNext}
          onClick={() => setSafe(shiftYearMonth(yearMonth, 1))}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>

        {!isCurrent ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 whitespace-nowrap px-3.5"
            disabled={disabled}
            onClick={() => setSafe(current)}
          >
            Bu ay
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
        <div>
          <label
            htmlFor={`${id}-month`}
            className="mb-1 block text-xs font-medium text-text-secondary"
          >
            Ay
          </label>
          <Select
            id={`${id}-month`}
            aria-labelledby={`${id}-label`}
            value={month}
            disabled={disabled}
            onChange={(e) => setSafe(`${year}-${e.target.value}`)}
          >
            {MONTH_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={
                  `${year}-${opt.value}` < minYm || `${year}-${opt.value}` > maxYm
                }
              >
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            htmlFor={`${id}-year`}
            className="mb-1 block text-xs font-medium text-text-secondary"
          >
            Yıl
          </label>
          <Select
            id={`${id}-year`}
            value={year}
            disabled={disabled}
            onChange={(e) => setSafe(`${e.target.value}-${month}`)}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  )
}
