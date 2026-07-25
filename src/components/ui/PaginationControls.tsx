import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/classNames'

export type PaginationControlsProps = {
  page: number
  totalPages: number
  totalCount: number
  rangeStart: number
  rangeEnd: number
  onPageChange: (page: number) => void
  /** When false, renders nothing (e.g. single page). Default true. */
  visible?: boolean
  className?: string
  'aria-label'?: string
}

export function PaginationControls({
  page,
  totalPages,
  totalCount,
  rangeStart,
  rangeEnd,
  onPageChange,
  visible = true,
  className,
  'aria-label': ariaLabel = 'Sayfa geçişi',
}: PaginationControlsProps) {
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages],
  )

  if (!visible) return null

  return (
    <div
      className={cn(
        'mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm text-text-secondary">
        {rangeStart}–{rangeEnd} / {totalCount} kayıt
      </p>
      <nav className="flex flex-wrap items-center gap-1.5" aria-label={ariaLabel}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Önceki
        </Button>
        {pageNumbers.map((pageNumber) => {
          const active = pageNumber === page
          return (
            <button
              key={pageNumber}
              type="button"
              aria-label={`Sayfa ${pageNumber}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onPageChange(pageNumber)}
              className={cn(
                'inline-flex min-w-9 items-center justify-center rounded-[var(--radius-md)] border px-2.5 py-1.5 text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-blue'
                  : 'border-border bg-surface text-text-secondary hover:bg-surface-muted',
              )}
            >
              {pageNumber}
            </button>
          )
        })}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Sonraki
        </Button>
      </nav>
    </div>
  )
}
