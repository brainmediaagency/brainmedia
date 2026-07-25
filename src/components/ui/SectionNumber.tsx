import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/classNames'

export type SectionNumberProps = HTMLAttributes<HTMLSpanElement> & {
  value: number | string
}

export function SectionNumber({ value, className, ...props }: SectionNumberProps) {
  const formatted = typeof value === 'number' ? String(value).padStart(2, '0') : value

  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center rounded-[8px] bg-[image:var(--gradient-primary)] px-1.5 font-display text-xs font-bold tracking-wide text-white shadow-[0_2px_6px_-2px_rgba(6,182,212,0.6)]',
        className,
      )}
      {...props}
    >
      {formatted}
    </span>
  )
}
