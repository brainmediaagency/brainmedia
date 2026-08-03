import {
  addDoc,
  arrayUnion,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import { sanitizeAppPath } from '@/lib/appPath'
import type { UserRole } from '@/config/roles'
import { sendOneSignalPush } from '@/features/notifications/services/oneSignalPush'
import type {
  AppNotification,
  AppNotificationType,
  NotificationSource,
  NotifyBroadcastInput,
  NotifyManagementInput,
  NotifyUserInput,
} from '@/features/notifications/types'

const MANAGEMENT_COLLECTION = 'managementNotifications'
const BROADCAST_COLLECTION = 'broadcastNotifications'

function userItemsCollection(uid: string) {
  return collection(getDb(), 'userNotifications', uid, 'items')
}

function mapNotification(
  id: string,
  data: Record<string, unknown>,
  source: NotificationSource,
): AppNotification {
  const readBy = data.readByUids
  return {
    id,
    type: String(data.type ?? 'job_created') as AppNotificationType,
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    link: sanitizeAppPath(String(data.link ?? '/management')),
    createdAt: (data.createdAt as Timestamp | null | undefined) ?? null,
    createdByUid: String(data.createdByUid ?? ''),
    readByUids: Array.isArray(readBy)
      ? readBy.map((u) => String(u)).filter(Boolean)
      : [],
    source,
  }
}

/**
 * True when this inbox row was created by the viewing user (should not notify them).
 * Day-start region broadcasts are kept visible even for the triggering admin.
 */
export function isOwnActionNotification(
  item: AppNotification,
  uid: string,
): boolean {
  if (!uid || item.createdByUid !== uid) return false
  if (item.type === 'region_created') return false
  return true
}

/**
 * Broadcast rows reach every role in Firestore, so day-of region rows are
 * filtered out for reporters here — they do not act on region planning.
 * Kameraman only receives the evening shooting-calendar push (not inbox noise).
 */
export function isNotificationVisibleForRole(
  item: AppNotification,
  role: UserRole | undefined,
): boolean {
  if (role === 'kameraman') return false
  if (role === 'reporter' && item.type === 'region_created') return false
  return true
}

function inboxPayload(input: {
  type: string
  title: string
  body: string
  link: string
  createdByUid: string
  createdByNameSnapshot: string
}) {
  const title = input.title.trim().slice(0, 120)
  const body = input.body.trim().slice(0, 300)
  const link = sanitizeAppPath(input.link.trim().slice(0, 200) || '/management')
  return {
    type: input.type,
    title,
    body,
    link,
    createdByUid: input.createdByUid,
    createdByNameSnapshot: input.createdByNameSnapshot.trim().slice(0, 120),
    createdAt: serverTimestamp(),
    readByUids: [] as string[],
  }
}

/**
 * In-app inbox (Firestore) + OneSignal Web Push (via Apps Script webhook).
 * Failures are swallowed so the primary write (job/report) is never blocked.
 * Push default audience = all five app roles (subscribers with matching role tags).
 */
export async function notifyManagement(
  input: NotifyManagementInput,
): Promise<void> {
  const payload = inboxPayload(input)
  const actorUid = input.createdByUid.trim()

  try {
    await addDoc(collection(getDb(), MANAGEMENT_COLLECTION), payload)
  } catch (error) {
    console.warn('[notifyManagement] inbox skipped', error)
  }

  void sendOneSignalPush({
    title: payload.title,
    body: payload.body,
    link: payload.link,
    roles: input.pushRoles,
    audience: 'all',
    excludeExternalIds: actorUid ? [actorUid] : undefined,
  })
}

/**
 * Broadcast to all authenticated roles (in-app + OneSignal all-role audience).
 */
export async function notifyBroadcast(
  input: NotifyBroadcastInput,
): Promise<void> {
  const payload = inboxPayload(input)
  const actorUid = input.createdByUid.trim()
  const notifyActor = input.notifyActor === true

  try {
    await addDoc(collection(getDb(), BROADCAST_COLLECTION), payload)
  } catch (error) {
    console.warn('[notifyBroadcast] inbox skipped', error)
  }

  void sendOneSignalPush({
    title: payload.title,
    body: payload.body,
    link: payload.link,
    roles: input.pushRoles,
    audience: 'all',
    excludeExternalIds:
      !notifyActor && actorUid ? [actorUid] : undefined,
  })
}

/**
 * Per-user in-app notification (e.g. MPU job status) + OneSignal push by external_id.
 */
export async function notifyUser(input: NotifyUserInput): Promise<void> {
  const recipientUid = input.recipientUid.trim()
  if (!recipientUid) return

  // Never notify the actor about their own action.
  if (recipientUid === input.createdByUid.trim()) return

  const payload = inboxPayload(input)

  try {
    await addDoc(userItemsCollection(recipientUid), payload)
  } catch (error) {
    console.warn('[notifyUser] inbox skipped', error)
  }

  void sendOneSignalPush({
    title: payload.title,
    body: payload.body,
    link: payload.link,
    externalIds: [recipientUid],
  })
}

function subscribeCollection(
  collectionName: string,
  source: NotificationSource,
  onData: (items: AppNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), collectionName),
    orderBy('createdAt', 'desc'),
    limit(40),
  )
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => mapNotification(d.id, d.data(), source))),
    (err) => onError?.(err),
  )
}

export function subscribeManagementNotifications(
  onData: (items: AppNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeCollection(
    MANAGEMENT_COLLECTION,
    'management',
    onData,
    onError,
  )
}

export function subscribeBroadcastNotifications(
  onData: (items: AppNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeCollection(
    BROADCAST_COLLECTION,
    'broadcast',
    onData,
    onError,
  )
}

export function subscribeUserNotifications(
  uid: string,
  onData: (items: AppNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    userItemsCollection(uid),
    orderBy('createdAt', 'desc'),
    limit(40),
  )
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => mapNotification(d.id, d.data(), 'user'))),
    (err) => onError?.(err),
  )
}

function notificationDocRef(item: AppNotification, uid: string) {
  if (item.source === 'management') {
    return doc(getDb(), MANAGEMENT_COLLECTION, item.id)
  }
  if (item.source === 'broadcast') {
    return doc(getDb(), BROADCAST_COLLECTION, item.id)
  }
  return doc(getDb(), 'userNotifications', uid, 'items', item.id)
}

export async function markNotificationRead(
  item: AppNotification,
  uid: string,
): Promise<void> {
  await updateDoc(notificationDocRef(item, uid), {
    readByUids: arrayUnion(uid),
  })
}

export async function markAllNotificationsRead(
  items: AppNotification[],
  uid: string,
): Promise<void> {
  const unread = items.filter((n) => !n.readByUids.includes(uid))
  await Promise.all(unread.map((n) => markNotificationRead(n, uid)))
}

export function isNotificationUnread(
  item: AppNotification,
  uid: string,
): boolean {
  return !item.readByUids.includes(uid)
}

/** Merge inbox streams newest-first (cap for UI). */
export function mergeNotificationFeeds(
  feeds: AppNotification[][],
  max = 40,
): AppNotification[] {
  return feeds
    .flat()
    .sort((a, b) => {
      const aMs = a.createdAt?.toMillis?.() ?? 0
      const bMs = b.createdAt?.toMillis?.() ?? 0
      return bMs - aMs
    })
    .slice(0, max)
}
