import { ROLE_DISPLAY_NAMES, type UserRole } from '@/config/roles'
import { cn } from '@/lib/classNames'

export type RoleBadgeProps = {
  role: UserRole
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-brand-blue/25 bg-brand-blue/8 px-2.5 py-0.5 text-xs font-semibold text-brand-blue',
        className,
      )}
    >
      {ROLE_DISPLAY_NAMES[role]}
    </span>
  )
}
