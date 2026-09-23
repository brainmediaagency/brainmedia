import { useId, type KeyboardEvent } from 'react'
import { cn } from '@/lib/classNames'

export type SegmentedControlItem<T extends string> = {
  id: T
  label: string
}

export type SegmentedControlProps<T extends string> = {
  label: string
  items: readonly SegmentedControlItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}

/**
 * Compact filter toggle (radio group). Use for view filters that share one
 * panel; use `TabNav` when each option swaps a whole section.
 */
export function SegmentedControl<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const labelId = useId()

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    event.preventDefault()
    const index = items.findIndex((item) => item.id === value)
    const nextIndex = (index + step + items.length) % items.length
    const next = items[nextIndex]
    if (!next) return
    onChange(next.id)
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons[nextIndex]?.focus()
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span id={labelId} className="text-xs font-medium text-text-secondary">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={handleKeyDown}
        className="inline-flex h-11 max-w-full items-stretch gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface p-1 shadow-[var(--shadow-xs)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] px-3.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
                active
                  ? 'bg-[image:var(--gradient-primary)] text-white shadow-[0_2px_8px_-2px_rgba(6,182,212,0.5)]'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
