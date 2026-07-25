import { WifiOff } from 'lucide-react'

interface OfflineBannerProps {
  visible: boolean
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-text-primary [overflow-wrap:anywhere]"
    >
      <WifiOff className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span>
        İnternet bağlantısı bulunamadı. Kayıt işlemleri bağlantı sağlandığında
        kullanılabilir.
      </span>
    </div>
  )
}
