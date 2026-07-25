import { type ReactNode } from 'react'
import { cn } from '@/lib/classNames'

export type PageHeaderProps = {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex animate-fade-in-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          {title}
        </h1>
        <span
          aria-hidden="true"
          className="block h-1 w-14 rounded-full bg-[image:var(--gradient-primary)]"
        />
        {subtitle ? (
          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="w-full shrink-0 sm:w-auto sm:self-end">{action}</div>
      ) : null}
    </div>
  )
}
