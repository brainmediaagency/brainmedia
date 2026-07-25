import { cn } from '@/lib/classNames'

export type SkeletonProps = {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-[var(--radius-sm)] bg-surface-muted', className)}
      aria-hidden="true"
    />
  )
}
