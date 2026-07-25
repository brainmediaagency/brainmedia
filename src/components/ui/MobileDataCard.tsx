import { ChevronRight } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from '@/lib/classNames'

export type MobileDataCardRow = {
  label: string
  value: ReactNode
}

export type MobileDataCardProps = {
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  rows: MobileDataCardRow[]
  onClick?: () => void
  footer?: ReactNode
  className?: string
}

export function MobileDataCard({
  title,
  subtitle,
  badge,
  rows,
  onClick,
  footer,
  className,
}: MobileDataCardProps) {
  const isInteractive = Boolean(onClick)

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-border bg-surface p-4',
        isInteractive && 'cursor-pointer transition-colors hover:bg-surface-muted/50',
        className,
      )}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-text-primary">{title}</div>
          {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {isInteractive && (
            <ChevronRight className="size-4 text-text-secondary" aria-hidden="true" />
          )}
        </div>
      </div>
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="text-right font-medium text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-3 border-t border-border pt-3">{footer}</div>}
    </div>
  )
}
