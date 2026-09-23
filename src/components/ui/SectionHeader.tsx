import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/classNames'
import { SectionTitleMark } from '@/components/ui/SectionTitleMark'

export type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({
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
        <div className="flex items-center gap-2.5 font-display text-base font-semibold sm:text-lg">
          <SectionTitleMark />
          <h2 className="section-header__title">{title}</h2>
        </div>
        {description && (
          <p className="pl-[calc(0.25rem+0.625rem)] text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
