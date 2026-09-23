import { BrandPreloaderMark } from '@/components/brand/BrandPreloaderMark'
import { cn } from '@/lib/classNames'

interface LoadingScreenProps {
  message?: string
  className?: string
}

/** Full-screen loader — same visual as the route preloader so they never stack. */
export function LoadingScreen({
  message = 'Yükleniyor…',
  className,
}: LoadingScreenProps) {
  return (
    <div
      className={cn('route-preloader route-preloader--screen', className)}
      role="status"
      aria-live="polite"
    >
      <BrandPreloaderMark />
      <p className="route-preloader__message">{message}</p>
    </div>
  )
}
