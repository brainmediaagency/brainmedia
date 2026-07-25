import { AlertCircle } from 'lucide-react'
import { type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/classNames'

export type ErrorStateProps = {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  action?: ReactNode
  className?: string
}

export function ErrorState({
  title = 'Bir hata oluştu',
  message = 'Veriler yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.',
  onRetry,
  retryLabel = 'Tekrar Dene',
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-danger/20 bg-danger/5 px-6 py-10 text-center',
        className,
      )}
      role="alert"
    >
      <div className="mb-4 rounded-full bg-danger/10 p-3 text-danger">
        <AlertCircle className="size-6" aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-text-secondary">{message}</p>
      {(onRetry || action) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}
