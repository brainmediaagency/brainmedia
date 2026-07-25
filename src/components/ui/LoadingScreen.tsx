import { BrandLogo } from '@/components/brand/BrandLogo'
import { cn } from '@/lib/classNames'

interface LoadingScreenProps {
  message?: string
  className?: string
}

export function LoadingScreen({
  message = 'Yükleniyor…',
  className,
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        'flex min-h-[50vh] flex-col items-center justify-center gap-4 text-text-secondary',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <BrandLogo variant="blue" className="h-8 w-auto max-w-[160px] opacity-90" />
      <span
        className="size-7 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent"
        aria-hidden="true"
      />
      <p>{message}</p>
    </div>
  )
}
