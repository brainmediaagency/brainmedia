import { cn } from '@/lib/classNames'

export function SectionTitleMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'h-5 w-1 shrink-0 rounded-full bg-[image:var(--gradient-primary)]',
        className,
      )}
    />
  )
}
