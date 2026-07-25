import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/classNames'

export type CollapsibleListItemProps = {
  title: string
  /** Small text under the title (e.g. author, date). */
  subtitle?: ReactNode
  /** Right-aligned meta shown next to the chevron (e.g. date). */
  meta?: ReactNode
  /** Action rendered in the header that should not toggle (e.g. edit button). */
  action?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

/**
 * Collapsed-by-default list row for long content (reports, notes).
 * Header click expands the body.
 */
export function CollapsibleListItem({
  title,
  subtitle,
  meta,
  action,
  defaultOpen = false,
  children,
  className,
}: CollapsibleListItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <li
      className={cn(
        'rounded-[var(--radius-md)] border border-border bg-surface-muted/40 transition-shadow duration-200',
        open && 'shadow-[var(--shadow-md)] ring-1 ring-brand-cyan/15',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
        >
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-text-secondary shadow-[var(--shadow-xs)] transition-transform duration-200',
              open && 'rotate-180 bg-brand-cyan/12 text-brand-blue',
            )}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-sm font-semibold text-text-primary sm:text-base">
              {title}
            </span>
            {subtitle ? (
              <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
                {subtitle}
              </span>
            ) : null}
          </span>
          {meta ? (
            <span className="hidden shrink-0 text-xs font-medium text-text-secondary sm:inline">
              {meta}
            </span>
          ) : null}
        </button>
        {action ? <span className="shrink-0">{action}</span> : null}
      </div>

      <div
        id={panelId}
        hidden={!open}
        className={cn(
          'border-t border-border px-3 py-3 sm:px-4',
          open && 'animate-[accordion-down_var(--motion-base)_var(--ease-out)]',
        )}
      >
        {open ? children : null}
      </div>
    </li>
  )
}
