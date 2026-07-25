import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import type { ActiveShift, AttendanceLog } from '@/features/attendance/types/attendance'
import { generateShiftId } from '@/features/attendance/utils/timeSync'
import { getUserProfile } from '@/features/users/services/userService'
import { UserFacingError } from '@/lib/errors'
import { DEFAULT_LIST_LIMIT, isShiftRole } from '@/config/roles'
import { mapAppError } from '@/lib/errors'

export const activeShiftConverter: FirestoreDataConverter<ActiveShift> = {
  toFirestore(data: ActiveShift): DocumentData {
    return {
      shiftId: data.shiftId,
      ownerUid: data.ownerUid,
      ownerNameSnapshot: data.ownerNameSnapshot,
      roleSnapshot: data.roleSnapshot,
      status: data.status,
      startedAt: data.startedAt,
      timezone: data.timezone,
      createdAt: data.createdAt,
    }
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): ActiveShift {
    const d = snapshot.data(options)
    const roleSnapshot = isShiftRole(d.roleSnapshot) ? d.roleSnapshot : 'media_planning'
    return {
      shiftId: String(d.shiftId ?? ''),
      ownerUid: String(d.ownerUid ?? snapshot.id),
      ownerNameSnapshot: String(d.ownerNameSnapshot ?? ''),
      roleSnapshot,
      status: 'active',
      startedAt: d.startedAt ?? null,
      timezone: 'Europe/Istanbul',
      createdAt: d.createdAt ?? null,
    }
  },
}

export const attendanceLogConverter: FirestoreDataConverter<AttendanceLog> = {
  toFirestore(data: AttendanceLog): DocumentData {
    return {
      shiftId: data.shiftId,
      ownerUid: data.ownerUid,
      ownerNameSnapshot: data.ownerNameSnapshot,
      roleSnapshot: data.roleSnapshot,
      status: data.status,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      workedMinutes: data.workedMinutes,
      timezone: data.timezone,
      finalizedAt: data.finalizedAt,
      editVersion: data.editVersion,
      lastEditedByUid: data.lastEditedByUid,
      lastEditedByNameSnapshot: data.lastEditedByNameSnapshot,
      lastEditedAt: data.lastEditedAt,
      lastEditReason: data.lastEditReason,
    }
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): AttendanceLog {
    const d = snapshot.data(options)
    const roleSnapshot = isShiftRole(d.roleSnapshot) ? d.roleSnapshot : 'media_planning'
    return {
      shiftId: String(d.shiftId ?? snapshot.id),
      ownerUid: String(d.ownerUid ?? ''),
      ownerNameSnapshot: String(d.ownerNameSnapshot ?? ''),
      roleSnapshot,
      status: 'completed',
      startedAt: d.startedAt ?? null,
      endedAt: d.endedAt ?? null,
      workedMinutes: Number(d.workedMinutes ?? 0),
      timezone: 'Europe/Istanbul',
      finalizedAt: d.finalizedAt ?? null,
      editVersion: Number(d.editVersion ?? 0),
      lastEditedByUid:
        d.lastEditedByUid === null || d.lastEditedByUid === undefined
          ? null
          : String(d.lastEditedByUid),
      lastEditedByNameSnapshot:
        d.lastEditedByNameSnapshot === null ||
        d.lastEditedByNameSnapshot === undefined
          ? null
          : String(d.lastEditedByNameSnapshot),
      lastEditedAt: d.lastEditedAt ?? null,
      lastEditReason:
        d.lastEditReason === null || d.lastEditReason === undefined
          ? null
          : String(d.lastEditReason),
    }
  },
}

export function activeShiftRef(uid: string) {
  return doc(getDb(), 'activeShifts', uid).withConverter(activeShiftConverter)
}

export function attendanceLogRef(uid: string, shiftId: string) {
  return doc(getDb(), 'users', uid, 'attendanceLogs', shiftId).withConverter(
    attendanceLogConverter,
  )
}

/** Display duration: prefer real timestamps when available. */
export function attendanceWorkedMinutes(log: AttendanceLog): number {
  if (log.startedAt && log.endedAt) {
    return Math.max(
      0,
      Math.floor((log.endedAt.toMillis() - log.startedAt.toMillis()) / 60_000),
    )
  }
  return Math.max(0, log.workedMinutes)
}

export async function getActiveShift(uid: string): Promise<ActiveShift | null> {
  const snap = await getDoc(activeShiftRef(uid))
  return snap.exists() ? snap.data() : null
}

export function subscribeActiveShift(
  uid: string,
  onData: (shift: ActiveShift | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    activeShiftRef(uid),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (err) => onError?.(err),
  )
}

export async function startShift(params: {
  uid: string
  fullName: string
  online: boolean
}): Promise<ActiveShift> {
  if (!params.online) {
    throw new UserFacingError(
      'İnternet bağlantısı bulunamadı. Mesai başlatmak için bağlantı gereklidir.',
    )
  }

  const profile = await getUserProfile(params.uid)
  if (
    !profile ||
    !isShiftRole(profile.role) ||
    !profile.isActive ||
    profile.deletedAt != null
  ) {
    throw new UserFacingError('Mesai başlatma yetkiniz bulunmuyor.')
  }

  const existing = await getActiveShift(params.uid)
  if (existing) {
    throw new UserFacingError('Zaten aktif bir mesainiz bulunuyor.')
  }

  const shiftId = generateShiftId()
  const ref = activeShiftRef(params.uid)

  try {
    await setDoc(ref, {
      shiftId,
      ownerUid: params.uid,
      ownerNameSnapshot: params.fullName,
      roleSnapshot: profile.role,
      status: 'active',
      startedAt: serverTimestamp() as ActiveShift['startedAt'],
      timezone: 'Europe/Istanbul',
      createdAt: serverTimestamp() as ActiveShift['createdAt'],
    })
  } catch (error) {
    throw new UserFacingError(
      mapAppError(error, 'Mesai başlatılamadı. Lütfen tekrar deneyin.'),
    )
  }

  // Write already succeeded. Prefer a server read, but never fail the start if it lags.
  try {
    const snap = await getDocFromServer(ref)
    if (snap.exists() && snap.data().startedAt) {
      return snap.data()
    }
  } catch {
    // Subscription will resolve serverTimestamp fields.
  }

  return {
    shiftId,
    ownerUid: params.uid,
    ownerNameSnapshot: params.fullName,
    roleSnapshot: profile.role,
    status: 'active',
    startedAt: null,
    timezone: 'Europe/Istanbul',
    createdAt: null,
  }
}

/**
 * End active shift. Uses Firestore serverTimestamp for endedAt.
 * No timeSync round-trip — workedMinutes is an estimate checked loosely by rules.
 */
export async function endShift(params: {
  uid: string
  online: boolean
}): Promise<boolean> {
  if (!params.online) {
    throw new UserFacingError(
      'İnternet bağlantısı bulunamadı. Mesai bitirmek için bağlantı gereklidir.',
    )
  }

  const shift = await getActiveShift(params.uid)
  if (!shift?.startedAt) {
    throw new UserFacingError('Aktif mesai bulunamadı.')
  }

  const startedAtMs = shift.startedAt.toMillis()
  const workedMinutes = Math.max(
    0,
    Math.floor((Date.now() - startedAtMs) / 60_000),
  )

  const logRef = attendanceLogRef(shift.ownerUid, shift.shiftId)
  const existing = await getDoc(logRef)
  if (existing.exists()) {
    const active = await getDoc(activeShiftRef(shift.ownerUid))
    if (active.exists()) {
      const batch = writeBatch(getDb())
      batch.delete(activeShiftRef(shift.ownerUid))
      await batch.commit()
    }
    return true
  }

  try {
    const batch = writeBatch(getDb())
    batch.set(logRef, {
      shiftId: shift.shiftId,
      ownerUid: shift.ownerUid,
      ownerNameSnapshot: shift.ownerNameSnapshot,
      roleSnapshot: shift.roleSnapshot,
      status: 'completed',
      startedAt: shift.startedAt,
      endedAt: serverTimestamp() as AttendanceLog['endedAt'],
      workedMinutes,
      timezone: 'Europe/Istanbul',
      finalizedAt: serverTimestamp() as AttendanceLog['finalizedAt'],
      editVersion: 0,
      lastEditedByUid: null,
      lastEditedByNameSnapshot: null,
      lastEditedAt: null,
      lastEditReason: null,
    })
    batch.delete(activeShiftRef(shift.ownerUid))
    await batch.commit()
    return true
  } catch (error) {
    throw new UserFacingError(
      mapAppError(error, 'Mesai bitirilemedi. Lütfen tekrar deneyin.'),
    )
  }
}

export async function updateAttendanceLogTimes(input: {
  ownerUid: string
  shiftId: string
  startedAt: Date
  endedAt: Date
  reason: string
  actorUid: string
  actorName: string
  actorRole: 'human_resources' | 'management'
}): Promise<void> {
  const startedAtMs = input.startedAt.getTime()
  const endedAtMs = input.endedAt.getTime()
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
    throw new UserFacingError('Geçerli başlangıç ve bitiş zamanı girin.')
  }
  if (endedAtMs <= startedAtMs) {
    throw new UserFacingError('Bitiş zamanı başlangıçtan sonra olmalı.')
  }
  const workedMinutes = Math.floor((endedAtMs - startedAtMs) / 60_000)
  if (workedMinutes > 7 * 24 * 60) {
    throw new UserFacingError('Mesai süresi 7 günden uzun olamaz.')
  }
  if (input.reason.trim().length < 3) {
    throw new UserFacingError('Düzeltme nedeni en az 3 karakter olmalı.')
  }

  const ref = attendanceLogRef(input.ownerUid, input.shiftId)
  try {
    await runTransaction(getDb(), async (transaction) => {
      const snap = await transaction.get(ref)
      if (!snap.exists()) throw new UserFacingError('Mesai kaydı bulunamadı.')
      const current = snap.data()
      if (!current.startedAt || !current.endedAt) {
        throw new UserFacingError('Mesai kaydının mevcut zamanları eksik.')
      }
      const version = current.editVersion + 1
      const newStartedAt = Timestamp.fromDate(input.startedAt)
      const newEndedAt = Timestamp.fromDate(input.endedAt)
      transaction.update(ref, {
        startedAt: newStartedAt,
        endedAt: newEndedAt,
        workedMinutes,
        editVersion: version,
        lastEditedByUid: input.actorUid,
        lastEditedByNameSnapshot: input.actorName,
        lastEditedAt: serverTimestamp(),
        lastEditReason: input.reason.trim(),
      })
      transaction.set(doc(ref, 'history', String(version)), {
        version,
        actorUid: input.actorUid,
        actorNameSnapshot: input.actorName,
        actorRole: input.actorRole,
        reason: input.reason.trim(),
        previousStartedAt: current.startedAt,
        previousEndedAt: current.endedAt,
        previousWorkedMinutes: current.workedMinutes,
        newStartedAt,
        newEndedAt,
        newWorkedMinutes: workedMinutes,
        createdAt: serverTimestamp(),
      })
    })
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Mesai kaydı güncellenemedi.'))
  }
}

export function subscribeAttendanceLogs(
  uid: string,
  options: { startDate?: Date; endDate?: Date } = {},
  onData: (logs: AttendanceLog[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const end = options.endDate ?? new Date()
  const start =
    options.startDate ??
    new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

  const q = query(
    collection(getDb(), 'users', uid, 'attendanceLogs').withConverter(
      attendanceLogConverter,
    ),
    where('startedAt', '>=', Timestamp.fromDate(start)),
    where('startedAt', '<=', Timestamp.fromDate(end)),
    orderBy('startedAt', 'desc'),
    limit(DEFAULT_LIST_LIMIT),
  )

  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}
