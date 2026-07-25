import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/classNames'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean
  children: ReactNode
}

export function Card({ padded = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-border bg-surface/95 shadow-[var(--shadow-sm)] backdrop-blur-[2px] transition-shadow duration-200 hover:shadow-[var(--shadow-md)]',
        padded && 'p-4 sm:p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
