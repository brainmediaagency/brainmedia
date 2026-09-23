import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import { getFirebaseAuth } from '@/lib/firebase/auth'
import type { KameramanJobClock } from '@/features/kameraman/types/jobClock'
import {
  formatJobClockRangeTr,
  formatJobClockStaffSummaryTr,
  isOptionalJobClockTime,
  isValidJobClockTime,
  normalizeJobClockTime,
} from '@/features/kameraman/utils/jobClockTimes'
import type { JobDocument } from '@/features/jobs/types/job'
import { jobPlannedDay } from '@/features/jobs/services/jobService'
import {
  formatDateOnlyShortTr,
  formatTimeTr,
  isValidDateOnly,
} from '@/lib/date'
import { DEFAULT_LIST_LIMIT } from '@/config/roles'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { notifyManagement } from '@/features/notifications/services/notificationService'
import { writeActivityLogForCurrentUser } from '@/features/activity-log/services/activityLogService'
import type { ActivityLogAction } from '@/features/activity-log/types/activityLog'

export type JobClockStampKind = 'in' | 'out'

function parseStoredTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = normalizeJobClockTime(String(value))
  return normalized || null
}

const converter: FirestoreDataConverter<KameramanJobClock> = {
  toFirestore(item: KameramanJobClock): DocumentData {
    const { id: _id, ...rest } = item
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): KameramanJobClock {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      jobId: String(data.jobId ?? ''),
      jobCompanyNameSnapshot: String(data.jobCompanyNameSnapshot ?? ''),
      jobProvinceSnapshot: String(data.jobProvinceSnapshot ?? ''),
      jobDistrictSnapshot: String(data.jobDistrictSnapshot ?? ''),
      plannedExecutionDateSnapshot: String(
        data.plannedExecutionDateSnapshot ?? '',
      ),
      clockInTime: parseStoredTime(data.clockInTime),
      clockOutTime: parseStoredTime(data.clockOutTime),
      clockInSubmittedAtHHmm: parseStoredTime(data.clockInSubmittedAtHHmm),
      clockOutSubmittedAtHHmm: parseStoredTime(data.clockOutSubmittedAtHHmm),
      note:
        data.note === null || data.note === undefined || data.note === ''
          ? null
          : String(data.note),
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdByEmailSnapshot: String(data.createdByEmailSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

function clocksCollection() {
  return collection(getDb(), 'kameramanJobClocks').withConverter(converter)
}

export function jobClockDocId(jobId: string, uid: string): string {
  return `${jobId}_${uid}`
}

function nowIstanbulHHmm(): string {
  return formatTimeTr(new Date())
}

function logJobClockActivity(
  action: Extract<
    ActivityLogAction,
    | 'field.job_clock_created'
    | 'field.job_clock_updated'
    | 'field.job_clock_deleted'
  >,
  params: {
    ownerName: string
    companyName: string
    plannedDay: string
    clockInTime?: string | null
    clockOutTime?: string | null
    entityId: string
    jobId: string
  },
): void {
  const rangeLabel = formatJobClockRangeTr(
    params.clockInTime,
    params.clockOutTime,
  )
  const range = rangeLabel !== '—' ? ` · ${rangeLabel}` : ''
  writeActivityLogForCurrentUser({
    category: 'field',
    action,
    summary: `${params.ownerName.trim() || 'Kameraman'} — ${params.companyName.trim() || 'İş'}${range} · ${formatDateOnlyShortTr(params.plannedDay)}`,
    entityType: 'job_clock',
    entityId: params.entityId,
    jobId: params.jobId,
    jobCompanyName: params.companyName,
    actorNameFallback: params.ownerName,
  })
}

export function subscribeOwnJobClockForJob(
  jobId: string,
  uid: string,
  onData: (clock: KameramanJobClock | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const id = jobClockDocId(jobId, uid)
  return onSnapshot(
    doc(getDb(), 'kameramanJobClocks', id).withConverter(converter),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (err) => onError?.(err),
  )
}

export function subscribeJobClocksForJob(
  jobId: string,
  onData: (items: KameramanJobClock[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    clocksCollection(),
    where('jobId', '==', jobId),
    limit(50),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export function subscribeOwnJobClocks(
  uid: string,
  onData: (items: KameramanJobClock[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    clocksCollection(),
    where('createdByUid', '==', uid),
    orderBy('plannedExecutionDateSnapshot', 'desc'),
    limit(DEFAULT_LIST_LIMIT),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export function subscribeAllJobClocks(
  onData: (items: KameramanJobClock[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    clocksCollection(),
    orderBy('plannedExecutionDateSnapshot', 'desc'),
    limit(500),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

function notifyJobClockChange(params: {
  ownerName: string
  companyName: string
  plannedDay: string
  clock: Pick<
    KameramanJobClock,
    | 'clockInTime'
    | 'clockOutTime'
    | 'clockInSubmittedAtHHmm'
    | 'clockOutSubmittedAtHHmm'
  >
  kind: JobClockStampKind
  createdByUid: string
  isUpdate: boolean
}): void {
  const title =
    params.kind === 'in'
      ? params.isUpdate
        ? 'Kameraman giriş saati güncellendi'
        : 'Kameraman giriş saati'
      : params.isUpdate
        ? 'Kameraman çıkış saati güncellendi'
        : 'Kameraman çıkış saati'
  const staffSummary = formatJobClockStaffSummaryTr(params.clock)
  void notifyManagement({
    type: 'job_clock_report',
    title,
    body: `${params.ownerName.trim()} — ${params.companyName} · ${staffSummary} · ${formatDateOnlyShortTr(params.plannedDay)}`,
    link: '/management?tab=schedule',
    createdByUid: params.createdByUid,
    createdByNameSnapshot: params.ownerName.trim().slice(0, 120),
    pushRoles: ['management', 'coordinator', 'sef'],
  })
}

/**
 * Cameraman declares a clock-in or clock-out time; we also store Istanbul "now"
 * as the moment they submitted that field (staff-only audit).
 */
export async function upsertJobClockStamp(input: {
  job: JobDocument
  kind: JobClockStampKind
  declaredTime: string
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
}): Promise<string> {
  try {
    const authUid = getFirebaseAuth().currentUser?.uid
    if (!authUid) {
      throw new UserFacingError('Oturum bulunamadı. Tekrar giriş yapın.')
    }
    if (authUid !== input.createdByUid) {
      throw new UserFacingError('Yalnızca kendi iş saatlerinizi girebilirsiniz.')
    }

    const jobId = input.job.id.trim()
    if (!jobId) throw new UserFacingError('İş seçin.')

    const plannedDay = jobPlannedDay(input.job)
    if (!isValidDateOnly(plannedDay)) {
      throw new UserFacingError('İşin çekim tarihi geçersiz.')
    }

    const declared = normalizeJobClockTime(input.declaredTime)
    if (!isValidJobClockTime(declared)) {
      throw new UserFacingError(
        input.kind === 'in'
          ? 'Geçerli bir giriş saati girin.'
          : 'Geçerli bir çıkış saati girin.',
      )
    }
    if (!isOptionalJobClockTime(declared)) {
      throw new UserFacingError('Geçerli bir saat girin.')
    }

    const submittedNow = nowIstanbulHHmm()
    const companyName = input.job.companyName.trim().slice(0, 200)
    const ownerName = input.createdByNameSnapshot.trim().slice(0, 120)
    const docId = jobClockDocId(jobId, authUid)
    const ref = doc(getDb(), 'kameramanJobClocks', docId)
    const existing = await getDoc(ref)

    if (existing.exists()) {
      const data = existing.data()
      if (data.createdByUid !== authUid) {
        throw new UserFacingError('Bu kayıt size ait değil.')
      }
      if (data.jobId !== jobId) {
        throw new UserFacingError('İş değiştirilemez.')
      }

      const clockInTime =
        input.kind === 'in' ? declared : data.clockInTime
      const clockOutTime =
        input.kind === 'out' ? declared : data.clockOutTime
      const clockInSubmittedAtHHmm =
        input.kind === 'in' ? submittedNow : data.clockInSubmittedAtHHmm
      const clockOutSubmittedAtHHmm =
        input.kind === 'out' ? submittedNow : data.clockOutSubmittedAtHHmm

      const timesChanged =
        input.kind === 'in'
          ? data.clockInTime !== declared
          : data.clockOutTime !== declared

      await updateDoc(ref, {
        clockInTime,
        clockOutTime,
        clockInSubmittedAtHHmm,
        clockOutSubmittedAtHHmm,
        jobCompanyNameSnapshot: companyName,
        jobProvinceSnapshot: input.job.province.trim().slice(0, 80),
        jobDistrictSnapshot: input.job.district.trim().slice(0, 80),
        plannedExecutionDateSnapshot: plannedDay,
        updatedAt: serverTimestamp(),
      })

      if (timesChanged) {
        notifyJobClockChange({
          ownerName,
          companyName,
          plannedDay,
          kind: input.kind,
          clock: {
            clockInTime,
            clockOutTime,
            clockInSubmittedAtHHmm,
            clockOutSubmittedAtHHmm,
          },
          createdByUid: authUid,
          isUpdate: true,
        })
      }

      logJobClockActivity('field.job_clock_updated', {
        ownerName,
        companyName,
        plannedDay,
        clockInTime,
        clockOutTime,
        entityId: docId,
        jobId,
      })
      return docId
    }

    const clockInTime = input.kind === 'in' ? declared : null
    const clockOutTime = input.kind === 'out' ? declared : null
    const clockInSubmittedAtHHmm = input.kind === 'in' ? submittedNow : null
    const clockOutSubmittedAtHHmm = input.kind === 'out' ? submittedNow : null

    await setDoc(ref, {
      jobId,
      jobCompanyNameSnapshot: companyName,
      jobProvinceSnapshot: input.job.province.trim().slice(0, 80),
      jobDistrictSnapshot: input.job.district.trim().slice(0, 80),
      plannedExecutionDateSnapshot: plannedDay,
      clockInTime,
      clockOutTime,
      clockInSubmittedAtHHmm,
      clockOutSubmittedAtHHmm,
      note: null,
      createdByUid: authUid,
      createdByNameSnapshot: ownerName,
      createdByEmailSnapshot: input.createdByEmailSnapshot.trim().slice(0, 254),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    notifyJobClockChange({
      ownerName,
      companyName,
      plannedDay,
      kind: input.kind,
      clock: {
        clockInTime,
        clockOutTime,
        clockInSubmittedAtHHmm,
        clockOutSubmittedAtHHmm,
      },
      createdByUid: authUid,
      isUpdate: false,
    })

    logJobClockActivity('field.job_clock_created', {
      ownerName,
      companyName,
      plannedDay,
      clockInTime,
      clockOutTime,
      entityId: docId,
      jobId,
    })

    return docId
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'İş saati kaydedilemedi.'))
  }
}

export async function deleteJobClock(id: string): Promise<void> {
  try {
    const authUid = getFirebaseAuth().currentUser?.uid
    if (!authUid) {
      throw new UserFacingError('Oturum bulunamadı. Tekrar giriş yapın.')
    }
    const clockId = id.trim()
    if (!clockId) throw new UserFacingError('Kayıt bulunamadı.')

    const ref = doc(getDb(), 'kameramanJobClocks', clockId)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      throw new UserFacingError('Kayıt bulunamadı.')
    }
    const data = snap.data()

    await deleteDoc(ref)

    logJobClockActivity('field.job_clock_deleted', {
      ownerName: data.createdByNameSnapshot,
      companyName: data.jobCompanyNameSnapshot,
      plannedDay: data.plannedExecutionDateSnapshot,
      clockInTime: data.clockInTime,
      clockOutTime: data.clockOutTime,
      entityId: clockId,
      jobId: data.jobId,
    })
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'İş saati silinemedi.'))
  }
}
