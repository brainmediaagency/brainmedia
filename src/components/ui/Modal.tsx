import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/classNames'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: string
  children: ReactNode
  className?: string
  titleClassName?: string
  headerClassName?: string
  showCloseButton?: boolean
}

function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(selector))
    focusable[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [active, containerRef])
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  titleClassName,
  headerClassName,
  showCloseButton = true,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-brand-navy/45 backdrop-blur-[2px]"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'animate-fade-in-up relative z-10 w-full max-w-lg rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-lg)]',
          className,
        )}
      >
        <div
          className={cn(
            'relative border-b border-border px-4 py-3 sm:px-6 sm:py-5',
            showCloseButton && 'pr-12 sm:pr-14',
            headerClassName,
          )}
        >
          <div className="min-w-0">
            <h2
              id={titleId}
              className={cn(
                'font-display text-lg font-semibold text-text-primary',
                titleClassName,
              )}
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-text-secondary">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="touch-target absolute top-2 right-2 inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary hover:bg-surface-muted hover:text-text-primary sm:top-3 sm:right-3"
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
