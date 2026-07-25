import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  isNotificationUnread,
  markAllNotificationsRead,
  markNotificationRead,
  mergeNotificationFeeds,
  subscribeBroadcastNotifications,
  subscribeManagementNotifications,
  subscribeUserNotifications,
} from '@/features/notifications/services/notificationService'
import type { AppNotification } from '@/features/notifications/types'
import { isUserRole } from '@/config/roles'

function feedKey(item: AppNotification): string {
  return `${item.source}:${item.id}`
}

export function useNotificationInbox() {
  const { profile, claims } = useAuth()
  const uid = profile?.uid
  const role = claims?.role
  const enabled = Boolean(uid) && isUserRole(role)
  const isManagement = role === 'management'
  const [items, setItems] = useState<AppNotification[]>([])
  const [error, setError] = useState<string | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const primedRef = useRef(false)
  const managementRef = useRef<AppNotification[]>([])
  const broadcastRef = useRef<AppNotification[]>([])
  const personalRef = useRef<AppNotification[]>([])
  const readyRef = useRef({
    management: false,
    broadcast: false,
    personal: false,
  })

  useEffect(() => {
    if (!enabled || !uid) {
      setItems([])
      primedRef.current = false
      seenIdsRef.current = new Set()
      managementRef.current = []
      broadcastRef.current = []
      personalRef.current = []
      readyRef.current = {
        management: false,
        broadcast: false,
        personal: false,
      }
      return
    }

    primedRef.current = false
    seenIdsRef.current = new Set()
    managementRef.current = []
    broadcastRef.current = []
    personalRef.current = []
    readyRef.current = {
      management: !isManagement,
      broadcast: false,
      personal: false,
    }

    const publish = () => {
      const next = mergeNotificationFeeds([
        managementRef.current,
        broadcastRef.current,
        personalRef.current,
      ])
      setItems(next)
      setError(null)

      const ready = readyRef.current
      if (!ready.management || !ready.broadcast || !ready.personal) {
        return
      }

      if (!primedRef.current) {
        primedRef.current = true
        seenIdsRef.current = new Set(next.map(feedKey))
        return
      }

      for (const item of next) {
        const key = feedKey(item)
        if (seenIdsRef.current.has(key)) continue
        seenIdsRef.current.add(key)
        if (!isNotificationUnread(item, uid)) continue

        toast(item.title, { description: item.body || undefined })

        if (
          typeof document !== 'undefined' &&
          document.visibilityState === 'hidden' &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          try {
            const n = new Notification(item.title, {
              body: item.body || undefined,
              icon: '/brand/pwa/icon-192.png',
              tag: key,
            })
            n.onclick = () => {
              window.focus()
              n.close()
            }
          } catch {
            /* ignore */
          }
        }
      }
    }

    function onErr(err: Error) {
      setError(err.message)
    }

    const unsubs: Array<() => void> = [
      subscribeBroadcastNotifications((rows) => {
        broadcastRef.current = rows
        readyRef.current.broadcast = true
        publish()
      }, onErr),
      subscribeUserNotifications(
        uid,
        (rows) => {
          personalRef.current = rows
          readyRef.current.personal = true
          publish()
        },
        onErr,
      ),
    ]

    if (isManagement) {
      unsubs.push(
        subscribeManagementNotifications((rows) => {
          managementRef.current = rows
          readyRef.current.management = true
          publish()
        }, onErr),
      )
    }

    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [enabled, uid, isManagement])

  const unreadCount = useMemo(() => {
    if (!uid) return 0
    return items.filter((n) => isNotificationUnread(n, uid)).length
  }, [items, uid])

  return {
    enabled,
    items,
    unreadCount,
    error,
    uid: uid ?? '',
    markRead: async (item: AppNotification) => {
      if (!uid) return
      await markNotificationRead(item, uid)
    },
    markAllRead: async () => {
      if (!uid) return
      await markAllNotificationsRead(items, uid)
    },
  }
}
