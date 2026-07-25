import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/classNames'
import { SectionNumber } from '@/components/ui/SectionNumber'

export type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  number: number | string
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({
  number,
  title,
  description,
  action,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex animate-fade-in-up flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 font-display text-base font-semibold text-text-primary sm:text-lg">
          <SectionNumber value={number} />
          <h2>{title}</h2>
        </div>
        {description && (
          <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
