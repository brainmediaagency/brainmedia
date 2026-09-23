import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/classNames'

export type DrawerSide = 'bottom' | 'right' | 'responsive'

export type DrawerProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
  /**
   * `responsive` — bottom sheet on phones, right panel from `sm` up.
   */
  side?: DrawerSide
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

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  className,
  side = 'bottom',
}: DrawerProps) {
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
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        className="absolute inset-0 bg-brand-navy/45 backdrop-blur-[2px] transition-opacity"
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
          'absolute z-10 flex flex-col overflow-hidden border border-border bg-surface shadow-[var(--shadow-lg)]',
          side === 'bottom' &&
            'bottom-0 left-0 right-0 max-h-[90vh] w-full max-w-none animate-fade-in-up rounded-t-[var(--radius-lg)] pb-[var(--safe-bottom)]',
          side === 'right' &&
            'inset-y-0 right-0 h-dvh w-full max-w-md animate-[slide-in-right_0.25s_ease-out] rounded-none border-y-0 border-r-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] sm:max-w-lg',
          side === 'responsive' &&
            'drawer-panel-responsive bottom-0 left-0 right-0 max-h-[92vh] w-full rounded-t-[var(--radius-lg)] pb-[var(--safe-bottom)] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-none sm:w-full sm:max-w-lg sm:rounded-none sm:border-y-0 sm:border-r-0 sm:pt-[var(--safe-top)] sm:pl-[var(--safe-left)]',
          className,
        )}
      >
        {side === 'bottom' || side === 'responsive' ? (
          <div
            className={cn(
              'flex shrink-0 justify-center pt-2',
              side === 'responsive' && 'sm:hidden',
            )}
            aria-hidden="true"
          >
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
        ) : null}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate font-display text-lg font-semibold text-text-primary"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-text-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target relative z-10 inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
