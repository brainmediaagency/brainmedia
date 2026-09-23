import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import {
  CELEBRATION_DURATION_MS,
  celebrationUntilMs,
  shouldArmThirdShotCelebration,
} from '@/features/celebration/utils/thirdShotCelebration'
import { getUserProfile } from '@/features/users/services/userService'

export type MpuCelebrationDoc = {
  uid: string
  startedAtMs: number
  untilMs: number
}

export function mpuCelebrationDocRef(uid: string) {
  return doc(getDb(), 'mpuCelebrations', uid)
}

export function buildCelebrationPayload(
  uid: string,
  startedAtMs: number,
): MpuCelebrationDoc {
  return {
    uid,
    startedAtMs,
    untilMs: celebrationUntilMs(startedAtMs),
  }
}

export async function getMpuCelebration(
  uid: string,
): Promise<MpuCelebrationDoc | null> {
  const snap = await getDoc(mpuCelebrationDocRef(uid))
  if (!snap.exists()) return null
  const data = snap.data()
  const startedAtMs = Number(data.startedAtMs)
  const untilMs = Number(data.untilMs)
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(untilMs)) return null
  return {
    uid: typeof data.uid === 'string' ? data.uid : uid,
    startedAtMs,
    untilMs,
  }
}

export function subscribeMpuCelebration(
  uid: string,
  onData: (doc: MpuCelebrationDoc | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    mpuCelebrationDocRef(uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      const data = snap.data()
      const startedAtMs = Number(data.startedAtMs)
      const untilMs = Number(data.untilMs)
      if (!Number.isFinite(startedAtMs) || !Number.isFinite(untilMs)) {
        onData(null)
        return
      }
      onData({
        uid: typeof data.uid === 'string' ? data.uid : uid,
        startedAtMs,
        untilMs,
      })
    },
    (err) => onError?.(err),
  )
}

/**
 * After a job is marked shot and owner stats are updated: if this was the
 * owner's 3rd shot as media_planning, open a 24h celebration window (once).
 */
export async function maybeArmThirdShotCelebration(
  ownerUid: string,
): Promise<boolean> {
  if (!ownerUid) return false

  const profile = await getUserProfile(ownerUid)
  if (!profile) return false

  const nextJobsShot = Math.max(0, Math.trunc(Number(profile.stats.jobsShot) || 0))
  const previousJobsShot = Math.max(0, nextJobsShot - 1)
  if (
    !shouldArmThirdShotCelebration({
      previousJobsShot,
      nextJobsShot,
      role: profile.role,
    })
  ) {
    return false
  }

  const ref = mpuCelebrationDocRef(ownerUid)
  const existing = await getDoc(ref)
  if (existing.exists()) return false

  const payload = buildCelebrationPayload(ownerUid, Date.now())

  try {
    await setDoc(ref, payload)
    return true
  } catch {
    return false
  }
}

/** Rules expect untilMs === startedAtMs + 86400000. */
export const MPU_CELEBRATION_DURATION_MS = CELEBRATION_DURATION_MS
