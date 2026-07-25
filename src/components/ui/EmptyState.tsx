import { type LucideIcon, Inbox } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from '@/lib/classNames'

export type EmptyStateProps = {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Kayıt bulunamadı',
  description = 'Bu bölümde gösterilecek veri henüz yok.',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 rounded-full bg-brand-cyan/10 p-3.5 text-brand-blue">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
