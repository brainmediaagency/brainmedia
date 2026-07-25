import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from '@/lib/classNames'

export type CategoryTone =
  | 'cyan'
  | 'blue'
  | 'pink'
  | 'orange'
  | 'violet'
  | 'navy'
  | 'success'

export type CategoryPanelProps = {
  title: string
  description?: string
  icon?: LucideIcon
  tone?: CategoryTone
  children: ReactNode
  className?: string
  /** Compact padding for dense mobile layouts */
  compact?: boolean
}

const toneStyles: Record<
  CategoryTone,
  { panel: string; icon: string; title: string; bar: string }
> = {
  cyan: {
    panel: 'border-[color:var(--cat-cyan-border)] bg-[color:var(--cat-cyan-bg)]',
    icon: 'bg-brand-cyan/15 text-brand-blue',
    title: 'text-[color:var(--cat-cyan-text)]',
    bar: 'bg-[image:var(--gradient-primary)]',
  },
  blue: {
    panel: 'border-[color:var(--cat-blue-border)] bg-[color:var(--cat-blue-bg)]',
    icon: 'bg-brand-blue/12 text-brand-blue',
    title: 'text-[color:var(--cat-blue-text)]',
    bar: 'bg-brand-blue',
  },
  pink: {
    panel: 'border-[color:var(--cat-pink-border)] bg-[color:var(--cat-pink-bg)]',
    icon: 'bg-brand-pink/12 text-brand-pink',
    title: 'text-[color:var(--cat-pink-text)]',
    bar: 'bg-[image:var(--gradient-accent)]',
  },
  orange: {
    panel: 'border-[color:var(--cat-orange-border)] bg-[color:var(--cat-orange-bg)]',
    icon: 'bg-brand-orange/12 text-brand-orange',
    title: 'text-[color:var(--cat-orange-text)]',
    bar: 'bg-[image:var(--gradient-warm)]',
  },
  violet: {
    panel: 'border-[color:var(--cat-violet-border)] bg-[color:var(--cat-violet-bg)]',
    icon: 'bg-brand-violet/12 text-brand-violet',
    title: 'text-[color:var(--cat-violet-text)]',
    bar: 'bg-brand-violet',
  },
  navy: {
    panel: 'border-[color:var(--cat-navy-border)] bg-[color:var(--cat-navy-bg)]',
    icon: 'bg-brand-navy/10 text-brand-navy',
    title: 'text-[color:var(--cat-navy-text)]',
    bar: 'bg-brand-navy',
  },
  success: {
    panel: 'border-[color:var(--cat-success-border)] bg-[color:var(--cat-success-bg)]',
    icon: 'bg-success/12 text-success',
    title: 'text-[color:var(--cat-success-text)]',
    bar: 'bg-success',
  },
}

/**
 * Colored category block for forms and readable report sections.
 */
export function CategoryPanel({
  title,
  description,
  icon: Icon,
  tone = 'cyan',
  children,
  className,
  compact = false,
}: CategoryPanelProps) {
  const styles = toneStyles[tone]

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-md)] border animate-fade-in-up',
        styles.panel,
        compact ? 'p-3' : 'p-3.5 sm:p-4',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute inset-x-0 top-0 h-0.5', styles.bar)}
      />
      <header className="mb-3 flex items-start gap-2.5">
        {Icon ? (
          <div
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]',
              styles.icon,
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3
            className={cn(
              'font-display text-sm font-semibold tracking-tight sm:text-base',
              styles.title,
            )}
          >
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
