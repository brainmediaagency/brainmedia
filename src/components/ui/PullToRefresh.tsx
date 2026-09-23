import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { cn } from '@/lib/classNames'

function reloadPage() {
  window.location.reload()
}

/**
 * Global pull-to-refresh: any page, when the active scroller is at the top.
 */
export function PullToRefresh() {
  const onRefresh = useCallback(() => {
    reloadPage()
  }, [])
  const { pullPx, status } = usePullToRefresh(onRefresh)

  if (typeof document === 'undefined') return null
  if (status === 'idle' && pullPx <= 0) return null

  const visible = status === 'refreshing' ? 56 : pullPx
  const label =
    status === 'refreshing'
      ? 'Yenileniyor…'
      : status === 'armed'
        ? 'Bırakın, yenilensin'
        : 'Yenilemek için çekin'

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center"
      style={{ paddingTop: 'max(0.5rem, var(--safe-top))' }}
      aria-live="polite"
      role="status"
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-medium text-text-secondary shadow-[var(--shadow-xs)] backdrop-blur-md',
        )}
        style={{
          transform: `translateY(${Math.max(0, visible - 8)}px)`,
          opacity: status === 'refreshing' ? 1 : Math.min(1, pullPx / 28),
        }}
      >
        <span
          className={cn(
            'size-4 rounded-full border-2 border-brand-cyan border-t-transparent',
            status === 'refreshing' || status === 'armed'
              ? 'animate-spin'
              : '',
          )}
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
    </div>,
    document.body,
  )
}
