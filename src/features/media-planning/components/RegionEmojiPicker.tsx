import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { cn } from '@/lib/classNames'
import { Skeleton } from '@/components/ui/Skeleton'

const RegionEmojiPickerPanel = lazy(() =>
  import('@/features/media-planning/components/RegionEmojiPickerPanel').then(
    (module) => ({ default: module.RegionEmojiPickerPanel }),
  ),
)

type RegionEmojiPickerProps = {
  disabled?: boolean
  onPick: (emoji: string) => void
  className?: string
}

/**
 * Bölge metnine yaygın desteklenen Unicode emoji eklemek için seçici (lazy).
 */
export function RegionEmojiPicker({
  disabled = false,
  onPick,
  className,
}: RegionEmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current
      if (!root || root.contains(event.target as Node)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label="Emoji ekle"
        aria-expanded={open}
        aria-controls={listId}
        title="Emoji ekle"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-text-primary shadow-[var(--shadow-xs)] transition-colors hover:border-brand-cyan/40 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/35 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SmilePlus className="size-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={listId}
          role="dialog"
          aria-label="Emoji seçici"
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-lg)]"
        >
          <Suspense
            fallback={
              <div className="space-y-2 p-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
            <RegionEmojiPickerPanel
              onPick={(emoji) => {
                onPick(emoji)
                setOpen(false)
              }}
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  )
}
