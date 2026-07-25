import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/classNames'

export type TabNavItem = {
  id: string
  label: string
  icon?: LucideIcon
  /** Optional small counter shown next to the label. */
  badge?: number
}

export type TabNavProps = {
  items: TabNavItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
  'aria-label'?: string
}

export function TabNav({
  items,
  activeId,
  onChange,
  className,
  'aria-label': ariaLabel,
}: TabNavProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex w-full gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface/95 p-1 shadow-[var(--shadow-xs)] backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              // shrink-0: allow horizontal scroll on narrow screens (do not flex-1 squash)
              'flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40 sm:flex-1 sm:px-4',
              active
                ? 'bg-[image:var(--gradient-primary)] text-white shadow-[0_2px_8px_-2px_rgba(6,182,212,0.5)]'
                : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
            )}
          >
            {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
            <span>{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-brand-pink/12 text-brand-pink',
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
