import { useEffect } from 'react'
import { X } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { NavMenu } from '@/components/layout/NavMenu'

interface MobileNavigationProps {
  open: boolean
  onClose: () => void
}

export function MobileNavigation({ open, onClose }: MobileNavigationProps) {
  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-brand-navy/50 backdrop-blur-[2px]"
        aria-label="Menüyü kapat"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(85vw,320px)] max-w-full flex-col bg-[image:var(--gradient-sidebar)] pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] text-white shadow-[var(--shadow-lg)]">
        <div className="flex h-[var(--header-height)] items-center justify-between gap-3 border-b border-white/10 px-4">
          <BrandLogo variant="white" className="h-6 w-auto max-w-[132px]" alt="B'RAIN menü" />
          <button
            type="button"
            onClick={onClose}
            className="touch-target flex items-center justify-center rounded-[var(--radius-md)] text-white/80 hover:bg-white/10"
            aria-label="Menüyü kapat"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <NavMenu onNavigate={onClose} subItemClassName="py-2.5 text-sm" />
        </nav>
      </div>
    </div>
  )
}
