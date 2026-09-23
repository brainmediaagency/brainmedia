import { FirebaseError } from 'firebase/app'
import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebaseAuth } from '@/lib/firebase/auth'
import { getDb } from '@/lib/firebase/firestore'
import { isUserRole, ROLE_DISPLAY_NAMES, type UserRole } from '@/config/roles'
import { getUserProfile } from '@/features/users/services/userService'
import {
  ACTIVITY_LOG_TITLES,
  isActivityLogAction,
  isActivityLogCategory,
  type ActivityLog,
  type ActivityLogAction,
  type ActivityLogActor,
  type ActivityLogCategory,
  type ActivityLogCategoryFilter,
} from '@/features/activity-log/types/activityLog'

export const ACTIVITY_LOG_COLLECTION = 'activityLogs'
export const ACTIVITY_LOG_PAGE_SIZE = 50

export type WriteActivityLogInput = {
  actor: ActivityLogActor
  category: ActivityLogCategory
  action: ActivityLogAction
  title?: string
  summary?: string
  jobId?: string | null
  jobCompanyName?: string | null
  entityType?: string | null
  entityId?: string | null
}

export type ActivityLogQueryFilters = {
  category?: ActivityLogCategoryFilter
  actorUid?: string | null
}

/** Firestore create payload (without createdAt). Keys must match security rules. */
export function buildActivityLogFields(input: WriteActivityLogInput): {
  actorUid: string
  actorNameSnapshot: string
  actorRole: UserRole
  category: ActivityLogCategory
  action: ActivityLogAction
  title: string
  summary: string
  jobId: string | null
  jobCompanyName: string | null
  entityType: string | null
  entityId: string | null
} {
  const title = (input.title ?? ACTIVITY_LOG_TITLES[input.action])
    .trim()
    .slice(0, 120)
  return {
    actorUid: input.actor.uid.trim(),
    actorNameSnapshot: input.actor.fullName.trim().slice(0, 120),
    actorRole: input.actor.role,
    category: input.category,
    action: input.action,
    title,
    summary: (input.summary ?? '').trim().slice(0, 300),
    jobId: input.jobId?.trim() || null,
    jobCompanyName: input.jobCompanyName?.trim().slice(0, 200) || null,
    entityType: input.entityType?.trim().slice(0, 40) || null,
    entityId: input.entityId?.trim().slice(0, 120) || null,
  }
}

function parseNullableString(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

export function parseActivityLog(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): ActivityLog | null {
  const data = snapshot.data()
  if (!isActivityLogCategory(data.category)) return null
  if (!isActivityLogAction(data.action)) return null
  if (!isUserRole(data.actorRole)) return null
  return {
    id: snapshot.id,
    actorUid: String(data.actorUid ?? ''),
    actorNameSnapshot: String(data.actorNameSnapshot ?? ''),
    actorRole: data.actorRole,
    category: data.category,
    action: data.action,
    title: String(data.title ?? ''),
    summary: String(data.summary ?? ''),
    jobId: parseNullableString(data.jobId),
    jobCompanyName: parseNullableString(data.jobCompanyName),
    entityType: parseNullableString(data.entityType),
    entityId: parseNullableString(data.entityId),
    createdAt: (data.createdAt as Timestamp | null | undefined) ?? null,
  }
}

async function persistActivityLog(input: WriteActivityLogInput): Promise<void> {
  let actor = input.actor
  try {
    const profile = await getUserProfile(actor.uid)
    if (profile) {
      const role = resolveActivityLogRole(profile.role, actor.role)
      if (!role) {
        console.warn('[writeActivityLog] skipped: no role on profile')
        return
      }
      actor = {
        uid: actor.uid,
        role,
        fullName: (profile.fullName?.trim() || actor.fullName).slice(0, 120),
      }
    }
  } catch (error) {
    console.warn('[writeActivityLog] profile lookup skipped', error)
  }

  const fields = buildActivityLogFields({ ...input, actor })
  if (!fields.actorUid || !fields.actorNameSnapshot || !fields.title) return

  await addDoc(collection(getDb(), ACTIVITY_LOG_COLLECTION), {
    ...fields,
    createdAt: serverTimestamp(),
  })
}

/**
 * Best-effort append-only log. Failures are swallowed so the primary write
 * (job / report / account) is never blocked.
 */
export function writeActivityLog(input: WriteActivityLogInput): void {
  void persistActivityLog(input).catch((error: unknown) => {
    console.warn('[writeActivityLog] skipped', error)
  })
}

export function writeActivityLogForActor(
  actor: { uid: string; role: UserRole; fullName?: string },
  input: Omit<WriteActivityLogInput, 'actor'>,
): void {
  void (async () => {
    let fullName = actor.fullName?.trim() ?? ''
    if (!fullName) {
      const profile = await getUserProfile(actor.uid)
      fullName =
        profile?.fullName?.trim() || ROLE_DISPLAY_NAMES[actor.role] || 'Kullanıcı'
    }
    await persistActivityLog({
      ...input,
      actor: {
        uid: actor.uid,
        role: actor.role,
        fullName: fullName.slice(0, 120),
      },
    })
  })().catch((error: unknown) => {
    console.warn('[writeActivityLog] skipped', error)
  })
}

/** Profile role wins — rules compare actorRole to users/{uid}.role, not claims. */
export function resolveActivityLogRole(
  profileRole: unknown,
  claimRole: unknown,
): UserRole | null {
  if (isUserRole(profileRole)) return profileRole
  if (isUserRole(claimRole)) return claimRole
  return null
}

export function writeActivityLogForCurrentUser(
  input: Omit<WriteActivityLogInput, 'actor'> & {
    actorNameFallback?: string
  },
): void {
  void (async () => {
    const user = getFirebaseAuth().currentUser
    if (!user) return

    let profileRole: unknown
    let profileName = ''
    try {
      const profile = await getUserProfile(user.uid)
      profileRole = profile?.role
      profileName = profile?.fullName?.trim() ?? ''
    } catch (error) {
      console.warn('[writeActivityLog] profile lookup skipped', error)
    }

    const token = await user.getIdTokenResult()
    const role = resolveActivityLogRole(profileRole, token.claims.role)
    if (!role) {
      console.warn('[writeActivityLog] skipped: no role on profile or claims')
      return
    }

    const fullName =
      profileName ||
      user.displayName?.trim() ||
      input.actorNameFallback?.trim() ||
      ROLE_DISPLAY_NAMES[role]
    await persistActivityLog({
      ...input,
      actor: { uid: user.uid, fullName: fullName.slice(0, 120), role },
    })
  })().catch((error: unknown) => {
    console.warn('[writeActivityLog] skipped', error)
  })
}

function activityLogsQuery(
  filters: ActivityLogQueryFilters,
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData>,
) {
  const constraints: QueryConstraint[] = []
  const actorUid = filters.actorUid?.trim() ?? ''
  if (actorUid) constraints.push(where('actorUid', '==', actorUid))
  if (filters.category && filters.category !== 'all') {
    constraints.push(where('category', '==', filters.category))
  }
  constraints.push(orderBy('createdAt', 'desc'))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))
  return query(collection(getDb(), ACTIVITY_LOG_COLLECTION), ...constraints)
}

export type ActivityLogsPage = {
  logs: ActivityLog[]
  cursor: QueryDocumentSnapshot<DocumentData> | null
}

/** Safari/WebChannel 409 and unmount often surface as these — not a real deny. */
export function isTransientFirestoreListenError(error: unknown): boolean {
  const raw =
    error instanceof FirebaseError
      ? error.code
      : typeof error === 'object' &&
          error != null &&
          'code' in error &&
          typeof (error as { code: unknown }).code === 'string'
        ? (error as { code: string }).code
        : ''
  const code = raw.replace(/^firestore\//, '')
  return (
    code === 'aborted' ||
    code === 'cancelled' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded'
  )
}

function pageFromSnapshot(snap: QuerySnapshot<DocumentData>): ActivityLogsPage {
  const logs = snap.docs
    .map((docSnap) => parseActivityLog(docSnap))
    .filter((item): item is ActivityLog => item != null)
  const cursor = snap.docs[snap.docs.length - 1] ?? null
  return { logs, cursor }
}

export function subscribeActivityLogs(
  filters: ActivityLogQueryFilters,
  onData: (page: ActivityLogsPage) => void,
  onError?: (error: Error) => void,
  pageSize = ACTIVITY_LOG_PAGE_SIZE,
): Unsubscribe {
  const q = activityLogsQuery(filters, pageSize)
  let stopped = false
  let emitted = false
  let errorSent = false
  let unaryDone = false

  const emit = (snap: QuerySnapshot<DocumentData>) => {
    if (stopped) return
    emitted = true
    onData(pageFromSnapshot(snap))
  }

  const fail = (error: Error) => {
    if (stopped || errorSent || emitted) return
    errorSent = true
    onError?.(error)
  }

  void getDocs(q)
    .then((snap) => emit(snap))
    .catch((error: unknown) => {
      fail(error instanceof Error ? error : new Error('Kayıtlar yüklenemedi.'))
    })
    .finally(() => {
      unaryDone = true
    })

  const unsub = onSnapshot(
    q,
    (snap) => emit(snap),
    (error) => {
      if (isTransientFirestoreListenError(error)) {
        console.warn('[activityLogs] listen skipped', error.code, error.message)
        return
      }
      console.warn('[activityLogs] listen failed', error.code, error.message)
      if (!unaryDone) return
      fail(error)
    },
  )

  return () => {
    stopped = true
    unsub()
  }
}

export async function fetchActivityLogsPage(
  filters: ActivityLogQueryFilters,
  cursor: QueryDocumentSnapshot<DocumentData>,
  pageSize = ACTIVITY_LOG_PAGE_SIZE,
): Promise<ActivityLogsPage> {
  const snap = await getDocs(activityLogsQuery(filters, pageSize, cursor))
  return pageFromSnapshot(snap)
}
