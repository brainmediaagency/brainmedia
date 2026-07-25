import {
  doc,
  getDoc,
  onSnapshot,
  query,
  collection,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  serverTimestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import {
  DEFAULT_LIST_LIMIT,
  SHIFT_ROLES,
  isUserRole,
  type UserRole,
} from '@/config/roles'
import type { UserProfile, UserStats } from '@/features/users/types/user'
import { getManageableRoles } from '@/features/account-admin/utils/accountPermissions'
import { mapAppError, UserFacingError } from '@/lib/errors'

function parseStats(raw: unknown): UserStats {
  const s = (raw ?? {}) as Record<string, unknown>
  return {
    jobsReceived: typeof s.jobsReceived === 'number' ? s.jobsReceived : 0,
    jobsShot: typeof s.jobsShot === 'number' ? s.jobsShot : 0,
    jobsCancelled: typeof s.jobsCancelled === 'number' ? s.jobsCancelled : 0,
  }
}

export const userConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(user: UserProfile): DocumentData {
    return {
      uid: user.uid,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      deletedAt: user.deletedAt,
      shiftDurationMinutes: user.shiftDurationMinutes,
      timezone: user.timezone,
      stats: user.stats,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): UserProfile {
    const data = snapshot.data(options)
    const role = data.role
    if (!isUserRole(role)) {
      throw new Error('Invalid user role in profile document')
    }
    return {
      uid: typeof data.uid === 'string' ? data.uid : snapshot.id,
      fullName: String(data.fullName ?? ''),
      email: String(data.email ?? ''),
      role,
      isActive: Boolean(data.isActive),
      deletedAt: data.deletedAt ?? null,
      shiftDurationMinutes:
        typeof data.shiftDurationMinutes === 'number'
          ? data.shiftDurationMinutes
          : null,
      timezone: 'Europe/Istanbul',
      stats: parseStats(data.stats),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

export function userDocRef(uid: string) {
  return doc(getDb(), 'users', uid).withConverter(userConverter)
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDocRef(uid))
  return snap.exists() ? snap.data() : null
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(uid),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (err) => onError?.(err),
  )
}

export function subscribeMediaPlanners(
  onData: (users: UserProfile[]) => void,
  onError?: (error: Error) => void,
  searchLimit = DEFAULT_LIST_LIMIT,
): Unsubscribe {
  const q = query(
    collection(getDb(), 'users').withConverter(userConverter),
    where('role', '==', 'media_planning' satisfies UserRole),
    where('isActive', '==', true),
    orderBy('fullName', 'asc'),
    limit(searchLimit),
  )
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map((d) => d.data())
        .filter((u) => u.deletedAt == null)
      onData(users)
    },
    (err) => onError?.(err),
  )
}

/** Active reporter users (for muhabir özet picker). */
export function subscribeReporters(
  onData: (users: UserProfile[]) => void,
  onError?: (error: Error) => void,
  searchLimit = DEFAULT_LIST_LIMIT,
): Unsubscribe {
  const q = query(
    collection(getDb(), 'users').withConverter(userConverter),
    where('role', '==', 'reporter' satisfies UserRole),
    where('isActive', '==', true),
    orderBy('fullName', 'asc'),
    limit(searchLimit),
  )
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map((d) => d.data())
        .filter((u) => u.deletedAt == null)
      onData(users)
    },
    (err) => onError?.(err),
  )
}

/** Active human resources users (for management / coordinator attendance view). */
export function subscribeHrStaff(
  onData: (users: UserProfile[]) => void,
  onError?: (error: Error) => void,
  searchLimit = DEFAULT_LIST_LIMIT,
): Unsubscribe {
  const q = query(
    collection(getDb(), 'users').withConverter(userConverter),
    where('role', '==', 'human_resources' satisfies UserRole),
    where('isActive', '==', true),
    orderBy('fullName', 'asc'),
    limit(searchLimit),
  )
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map((d) => d.data())
        .filter((u) => u.deletedAt == null)
      onData(users)
    },
    (err) => onError?.(err),
  )
}

/** Active users who can track shifts (media planning, HR). */
export function subscribeShiftWorkers(
  onData: (users: UserProfile[]) => void,
  onError?: (error: Error) => void,
  searchLimit = 100,
): Unsubscribe {
  const q = query(
    collection(getDb(), 'users').withConverter(userConverter),
    where('role', 'in', [...SHIFT_ROLES]),
    where('isActive', '==', true),
    orderBy('fullName', 'asc'),
    limit(searchLimit),
  )
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map((d) => d.data())
        .filter((u) => u.deletedAt == null)
      onData(users)
    },
    (err) => onError?.(err),
  )
}

export type CreateUserProfileInput = {
  uid: string
  fullName: string
  email: string
  role: UserRole
  shiftDurationMinutes?: number | null
}

export async function createUserProfileDoc(
  input: CreateUserProfileInput,
): Promise<void> {
  await setDoc(userDocRef(input.uid), {
    uid: input.uid,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    isActive: true,
    deletedAt: null,
    shiftDurationMinutes: input.shiftDurationMinutes ?? null,
    timezone: 'Europe/Istanbul',
    stats: { jobsReceived: 0, jobsShot: 0, jobsCancelled: 0 },
    createdAt: serverTimestamp() as UserProfile['createdAt'],
    updatedAt: serverTimestamp() as UserProfile['updatedAt'],
  })
}

export async function setUserActiveState(
  uid: string,
  isActive: boolean,
): Promise<void> {
  await updateDoc(userDocRef(uid), {
    isActive,
    updatedAt: serverTimestamp(),
  })
}

export async function softDeleteUserProfile(uid: string): Promise<void> {
  await updateDoc(userDocRef(uid), {
    isActive: false,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateOwnFullName(
  uid: string,
  fullName: string,
): Promise<void> {
  const trimmed = fullName.trim()
  if (trimmed.length < 2 || trimmed.length > 120) {
    throw new UserFacingError('Ad soyad 2–120 karakter olmalıdır.')
  }

  try {
    await updateDoc(userDocRef(uid), {
      fullName: trimmed,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    throw new UserFacingError(
      mapAppError(error, 'Ad soyad güncellenemedi.'),
    )
  }
}

/** Live list of users the actor may manage (excludes soft-deleted). */
export function subscribeManagedUsers(
  actorRole: UserRole,
  onData: (users: UserProfile[]) => void,
  onError?: (error: Error) => void,
  listLimit = 100,
): Unsubscribe {
  const roles = getManageableRoles(actorRole)
  if (roles.length === 0) {
    onData([])
    return () => undefined
  }

  // Firestore `in` supports up to 30 values; our role set is small.
  const q = query(
    collection(getDb(), 'users').withConverter(userConverter),
    where('role', 'in', roles),
    orderBy('fullName', 'asc'),
    limit(listLimit),
  )

  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map((d) => d.data())
        .filter((u) => u.deletedAt == null)
      onData(users)
    },
    (err) => onError?.(err),
  )
}
