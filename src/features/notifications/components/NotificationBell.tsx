import { Bell, CheckCheck } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { PushNotificationToggle } from '@/features/notifications/components/PushNotificationToggle'
import { useNotificationInbox } from '@/features/notifications/hooks/useNotificationInbox'
import { isNotificationUnread } from '@/features/notifications/services/notificationService'
import type { AppNotification } from '@/features/notifications/types'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { sanitizeAppPath } from '@/lib/appPath'
import { cn } from '@/lib/classNames'

function formatWhen(createdAt: { toDate?: () => Date } | null): string {
  if (!createdAt?.toDate) return ''
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Istanbul',
    }).format(createdAt.toDate())
  } catch {
    return ''
  }
}

function NotificationList({
  items,
  uid,
  onSelect,
}: {
  items: AppNotification[]
  uid: string
  onSelect: (item: AppNotification) => void
}) {
  if (items.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-text-secondary">
        Henüz bildirim yok.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const unread = isNotificationUnread(item, uid)
        return (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                'flex w-full flex-col gap-0.5 px-1 py-3 text-left transition-colors hover:bg-surface-muted sm:px-3 sm:py-2.5',
                unread && 'bg-brand-cyan/5',
              )}
              onClick={() => onSelect(item)}
            >
              <span className="text-sm font-medium text-text-primary">
                {item.title}
              </span>
              {item.body ? (
                <span className="line-clamp-2 text-xs text-text-secondary">
                  {item.body}
                </span>
              ) : null}
              <span className="text-[11px] text-text-secondary/80">
                {formatWhen(item.createdAt)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Desktop popover portaled to body — escapes sticky header / overflow-x-clip. */
function NotificationDesktopPopover({
  open,
  onClose,
  anchorRef,
  panelId,
  markAllButton,
  items,
  uid,
  onSelect,
  pushToggle,
}: {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  panelId: string
  markAllButton: ReactNode
  items: AppNotification[]
  uid: string
  onSelect: (item: AppNotification) => void
  pushToggle: ReactNode
}) {
  const [coords, setCoords] = useState({ top: 0, right: 0 })

  useLayoutEffect(() => {
    if (!open) return

    const update = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      setCoords({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        id={panelId}
        role="region"
        aria-label="Bildirim listesi"
        style={{ top: coords.top, right: coords.right }}
        className="absolute z-10 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-text-primary">Bildirimler</p>
          {markAllButton}
        </div>
        {pushToggle}
        <div className="max-h-80 overflow-y-auto border-t border-border">
          <NotificationList items={items} uid={uid} onSelect={onSelect} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function NotificationBell() {
  const { enabled, items, unreadCount, uid, markRead, markAllRead } =
    useNotificationInbox()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const prevDesktopRef = useRef<boolean | null>(null)
  const navigate = useNavigate()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  // Close only when the breakpoint actually changes after first paint.
  useEffect(() => {
    if (prevDesktopRef.current === null) {
      prevDesktopRef.current = isDesktop
      return
    }
    if (prevDesktopRef.current !== isDesktop) {
      prevDesktopRef.current = isDesktop
      setOpen(false)
    }
  }, [isDesktop])

  if (!enabled) return null

  const handleSelect = (item: AppNotification) => {
    void markRead(item)
    setOpen(false)
    navigate(sanitizeAppPath(item.link))
  }

  const markAllButton =
    unreadCount > 0 ? (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-cyan hover:underline"
        onClick={() => void markAllRead()}
      >
        <CheckCheck className="size-3.5" aria-hidden="true" />
        Tümünü okundu
      </button>
    ) : null

  const pushToggle = (
    <PushNotificationToggle
      active={open}
      className="space-y-2 px-3 py-3"
    />
  )

  return (
    <div className="relative">
      <Button
        ref={anchorRef}
        variant="ghost"
        size="sm"
        aria-label={
          unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : 'Bildirimler'
        }
        aria-expanded={open}
        aria-controls={isDesktop ? panelId : undefined}
        aria-haspopup={isDesktop ? 'true' : 'dialog'}
        onClick={() => setOpen((v) => !v)}
        className="relative px-2"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {isDesktop ? (
        <NotificationDesktopPopover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
          panelId={panelId}
          markAllButton={markAllButton}
          items={items}
          uid={uid}
          onSelect={handleSelect}
          pushToggle={pushToggle}
        />
      ) : (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          title="Bildirimler"
          description={
            unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : undefined
          }
          side="bottom"
          className="max-h-[min(90vh,40rem)] w-full max-w-none pb-[max(0.5rem,var(--safe-bottom))]"
        >
          {markAllButton ? (
            <div className="mb-3 flex justify-end">{markAllButton}</div>
          ) : null}
          <div className="mb-3 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface-muted/40">
            {pushToggle}
          </div>
          <NotificationList items={items} uid={uid} onSelect={handleSelect} />
        </Drawer>
      )}
    </div>
  )
}
