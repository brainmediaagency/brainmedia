import { cn } from '@/lib/classNames'

export type StatusBadgeStatus =
  | 'pending'
  | 'approved'
  | 'shot'
  | 'cancelled'
  | 'rejected'
  | 'active'
  | 'completed'

export type StatusBadgeProps = {
  status: StatusBadgeStatus
  label?: string
  className?: string
}

const statusLabels: Record<StatusBadgeStatus, string> = {
  pending: 'Beklemede',
  approved: 'Konfirme',
  shot: 'Çekildi',
  cancelled: 'İptal',
  rejected: 'Reddedildi',
  active: 'Aktif',
  completed: 'Tamamlandı',
}

const statusClasses: Record<StatusBadgeStatus, string> = {
  pending: 'border-warning/30 bg-warning/10 text-warning',
  approved: 'border-success/30 bg-success/10 text-success',
  shot: 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-blue',
  cancelled: 'border-border bg-surface-muted text-text-secondary',
  rejected: 'border-danger/30 bg-danger/10 text-danger',
  active: 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-blue',
  completed: 'border-success/30 bg-success/10 text-success',
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        statusClasses[status],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label ?? statusLabels[status]}
    </span>
  )
}
