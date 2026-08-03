import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  writeBatch,
  updateDoc,
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type Query,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import { JOB_STATUSES, DEFAULT_LIST_LIMIT, type JobStatus } from '@/config/roles'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  getStatsDelta,
  isAllowedTransition,
  normalizeCompanyName,
} from '@/features/jobs/utils/jobTransitions'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { notifyManagement, notifyUser } from '@/features/notifications/services/notificationService'
import {
  isJobScheduleOnOrAfter,
  isJobSchedulePast,
  isValidDateTimeLocal,
} from '@/lib/date'
import type { UserRole } from '@/config/roles'

function parseStatus(value: unknown): JobStatus {
  if (typeof value === 'string' && (JOB_STATUSES as readonly string[]).includes(value)) {
    return value as JobStatus
  }
  throw new Error('Invalid job status')
}

export const jobConverter: FirestoreDataConverter<JobDocument> = {
  toFirestore(job: JobDocument): DocumentData {
    const { id: _id, ...rest } = job
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): JobDocument {
    const data = snapshot.data(options)
    const rawContacts = Array.isArray(data.contacts) ? data.contacts : []
    const contacts = rawContacts.map((item) => {
      const c = item as Record<string, unknown>
      return {
        name: String(c.name ?? ''),
        mobilePhone: String(c.mobilePhone ?? ''),
        workPhone:
          c.workPhone === null || c.workPhone === undefined || c.workPhone === ''
            ? null
            : String(c.workPhone),
      }
    })
    const contactPersonName = String(
      data.contactPersonName ?? contacts[0]?.name ?? '',
    )
    const contactPhone = String(
      data.contactPhone ?? contacts[0]?.mobilePhone ?? '',
    )
    const contactCountRaw = Number(data.contactCount ?? (contacts.length || 1))
    const contactCount = (
      contactCountRaw === 2 || contactCountRaw === 3 ? contactCountRaw : 1
    ) as 1 | 2 | 3

    return {
      id: snapshot.id,
      companyName: String(data.companyName ?? ''),
      companyNameNormalized: String(data.companyNameNormalized ?? ''),
      contactPersonName,
      contactPhone,
      contactCount,
      contacts:
        contacts.length > 0
          ? contacts
          : [
              {
                name: contactPersonName,
                mobilePhone: contactPhone,
                workPhone: null,
              },
            ],
      province: String(data.province ?? ''),
      district: String(data.district ?? ''),
      fullAddress: String(data.fullAddress ?? ''),
      instagram:
        data.instagram === null ||
        data.instagram === undefined ||
        String(data.instagram).trim() === ''
          ? null
          : String(data.instagram).trim(),
      acquiredDate: String(data.acquiredDate ?? ''),
      plannedExecutionDate: String(data.plannedExecutionDate ?? ''),
      agreedAmountKurus: Number(data.agreedAmountKurus ?? 0),
      currency: 'TRY',
      status: parseStatus(data.status),
      statusVersion: Number(data.statusVersion ?? 1),
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdByEmailSnapshot: String(data.createdByEmailSnapshot ?? ''),
      createdByRole: 'media_planning',
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
      reviewedByUid: data.reviewedByUid ?? null,
      reviewedByNameSnapshot: data.reviewedByNameSnapshot ?? null,
      reviewedAt: data.reviewedAt ?? null,
      reviewNote: data.reviewNote ?? null,
      forwardedToReporter: data.forwardedToReporter === true,
      forwardedToReporterByUid:
        data.forwardedToReporterByUid === null ||
        data.forwardedToReporterByUid === undefined
          ? null
          : String(data.forwardedToReporterByUid),
      forwardedToReporterByNameSnapshot:
        data.forwardedToReporterByNameSnapshot === null ||
        data.forwardedToReporterByNameSnapshot === undefined
          ? null
          : String(data.forwardedToReporterByNameSnapshot),
      forwardedToReporterAt: data.forwardedToReporterAt ?? null,
      dailyReportId:
        data.dailyReportId === null ||
        data.dailyReportId === undefined ||
        String(data.dailyReportId).trim() === ''
          ? null
          : String(data.dailyReportId).trim(),
      idempotencyKey: String(data.idempotencyKey ?? ''),
    }
  },
}

export function jobsCollection() {
  return collection(getDb(), 'jobs').withConverter(jobConverter)
}

export function jobDocRef(jobId: string) {
  return doc(getDb(), 'jobs', jobId).withConverter(jobConverter)
}

export interface CreateJobInput {
  companyName: string
  contacts: Array<{
    name: string
    mobilePhone: string
    workPhone: string | null
  }>
  contactCount: 1 | 2 | 3
  province: string
  district: string
  fullAddress: string
  /** Empty → stored as null. */
  instagram: string | null
  acquiredDate: string
  plannedExecutionDate: string
  agreedAmountKurus: number
  idempotencyKey: string
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
}

export async function createJob(input: CreateJobInput): Promise<string> {
  const db = getDb()
  const jobRef = doc(collection(db, 'jobs'))
  const historyRef = doc(collection(db, 'jobs', jobRef.id, 'history'))
  const first = input.contacts[0]
  if (!first) {
    throw new UserFacingError('En az bir yetkili girilmelidir.')
  }

  const batch = writeBatch(db)
  batch.set(jobRef, {
    companyName: input.companyName.trim(),
    companyNameNormalized: normalizeCompanyName(input.companyName),
    contactPersonName: first.name.trim(),
    contactPhone: first.mobilePhone,
    contactCount: input.contactCount,
    contacts: input.contacts.map((c) => ({
      name: c.name.trim(),
      mobilePhone: c.mobilePhone,
      workPhone: c.workPhone,
    })),
    province: input.province,
    district: input.district,
    fullAddress: input.fullAddress.trim(),
    instagram: input.instagram?.trim() ? input.instagram.trim() : null,
    acquiredDate: input.acquiredDate,
    plannedExecutionDate: input.plannedExecutionDate,
    agreedAmountKurus: input.agreedAmountKurus,
    currency: 'TRY',
    status: 'pending',
    statusVersion: 1,
    createdByUid: input.createdByUid,
    createdByNameSnapshot: input.createdByNameSnapshot,
    createdByEmailSnapshot: input.createdByEmailSnapshot,
    createdByRole: 'media_planning',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewedByUid: null,
    reviewedByNameSnapshot: null,
    reviewedAt: null,
    reviewNote: null,
    forwardedToReporter: false,
    forwardedToReporterByUid: null,
    forwardedToReporterByNameSnapshot: null,
    forwardedToReporterAt: null,
    dailyReportId: null,
    idempotencyKey: input.idempotencyKey,
  })
  batch.set(historyRef, {
    version: 1,
    fromStatus: null,
    toStatus: 'pending',
    actorUid: input.createdByUid,
    actorNameSnapshot: input.createdByNameSnapshot,
    actorRole: 'media_planning',
    note: null,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  void notifyManagement({
    type: 'job_created',
    title: 'Yeni iş konfirmeye geldi',
    body: `${input.companyName.trim()} — ${input.createdByNameSnapshot}`,
    link: '/management',
    createdByUid: input.createdByUid,
    createdByNameSnapshot: input.createdByNameSnapshot,
    pushRoles: ['management', 'coordinator', 'media_planning', 'human_resources'],
  })

  return jobRef.id
}

export type UpdatePendingJobInput = {
  jobId: string
  companyName: string
  contacts: Array<{
    name: string
    mobilePhone: string
    workPhone: string | null
  }>
  contactCount: 1 | 2 | 3
  province: string
  district: string
  fullAddress: string
  instagram: string | null
  acquiredDate: string
  plannedExecutionDate: string
  agreedAmountKurus: number
}

export async function updatePendingJob(
  input: UpdatePendingJobInput,
): Promise<JobDocument> {
  const first = input.contacts[0]
  if (!first) {
    throw new UserFacingError('En az bir yetkili girilmelidir.')
  }

  const ref = jobDocRef(input.jobId)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new UserFacingError('İş kaydı bulunamadı.')
  }
  const job = snap.data()
  if (job.status !== 'pending') {
    throw new UserFacingError('Yalnızca konfirme bekleyen işler düzenlenebilir.')
  }

  await updateDoc(ref, {
    companyName: input.companyName.trim(),
    companyNameNormalized: normalizeCompanyName(input.companyName),
    contactPersonName: first.name.trim(),
    contactPhone: first.mobilePhone,
    contactCount: input.contactCount,
    contacts: input.contacts.map((c) => ({
      name: c.name.trim(),
      mobilePhone: c.mobilePhone,
      workPhone: c.workPhone ?? null,
    })),
    province: input.province,
    district: input.district,
    fullAddress: input.fullAddress.trim(),
    instagram: input.instagram?.trim() ? input.instagram.trim() : null,
    acquiredDate: input.acquiredDate,
    plannedExecutionDate: input.plannedExecutionDate,
    agreedAmountKurus: input.agreedAmountKurus,
    updatedAt: serverTimestamp(),
  })

  const fresh = await getJob(input.jobId)
  if (!fresh) {
    throw new UserFacingError('İş kaydı güncellendi ancak yeniden okunamadı.')
  }
  return fresh
}

export function subscribePendingJobs(
  ownerUid: string,
  onData: (jobs: JobDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    jobsCollection(),
    where('createdByUid', '==', ownerUid),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    limit(DEFAULT_LIST_LIMIT),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

/** Non-pending jobs owned by a media planner (konfirme / çekildi / iptal / reddedildi). */
export function subscribeApprovedJobs(
  ownerUid: string,
  onData: (jobs: JobDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    jobsCollection(),
    where('createdByUid', '==', ownerUid),
    where('status', 'in', ['approved', 'shot', 'cancelled', 'rejected']),
    orderBy('updatedAt', 'desc'),
    limit(DEFAULT_LIST_LIMIT),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

function dayStart(dateOnly: string): Timestamp {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEnd(dateOnly: string): Timestamp {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

/**
 * Jobs created by a media planner within an inclusive date range (by createdAt).
 * Uses existing status-scoped indexes (avoids waiting on createdByUid+createdAt composite).
 */
export async function fetchPlannerJobsInRange(params: {
  ownerUid: string
  startDate: string
  endDate: string
}): Promise<JobDocument[]> {
  try {
    const startMs = dayStart(params.startDate).toMillis()
    const endMs = dayEnd(params.endDate).toMillis()

    const [pendingSnap, nonPendingSnap] = await Promise.all([
      getDocs(
        query(
          jobsCollection(),
          where('createdByUid', '==', params.ownerUid),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      ),
      getDocs(
        query(
          jobsCollection(),
          where('createdByUid', '==', params.ownerUid),
          where('status', 'in', ['approved', 'shot', 'cancelled', 'rejected']),
          orderBy('updatedAt', 'desc'),
          limit(100),
        ),
      ),
    ])

    const byId = new Map<string, JobDocument>()
    for (const docSnap of [...pendingSnap.docs, ...nonPendingSnap.docs]) {
      const job = docSnap.data()
      byId.set(job.id, job)
    }

    return [...byId.values()]
      .filter((job) => {
        const createdMs = job.createdAt?.toMillis?.()
        if (createdMs == null) return false
        return createdMs >= startMs && createdMs <= endMs
      })
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() ?? 0
        const bMs = b.createdAt?.toMillis?.() ?? 0
        return bMs - aMs
      })
  } catch (error) {
    throw new UserFacingError(
      mapAppError(error, 'Medya planlama işleri yüklenemedi.'),
    )
  }
}

function buildOwnerStatsIncrement(delta: {
  jobsReceived: number
  jobsShot: number
  jobsCancelled: number
}): Record<string, ReturnType<typeof increment> | ReturnType<typeof serverTimestamp>> {
  const patch: Record<
    string,
    ReturnType<typeof increment> | ReturnType<typeof serverTimestamp>
  > = {
    updatedAt: serverTimestamp(),
  }
  // Only touch non-zero deltas (matches rules tests; avoids noisy increment(0)).
  if (delta.jobsReceived !== 0) {
    patch['stats.jobsReceived'] = increment(delta.jobsReceived)
  }
  if (delta.jobsShot !== 0) {
    patch['stats.jobsShot'] = increment(delta.jobsShot)
  }
  if (delta.jobsCancelled !== 0) {
    patch['stats.jobsCancelled'] = increment(delta.jobsCancelled)
  }
  return patch
}

async function transitionJob(
  jobId: string,
  toStatus: JobStatus,
  actor: { uid: string; fullName: string; role: UserRole },
  reviewNote: string | null,
  options: {
    allowedRoles: UserRole[]
    /** When set, actor must own the job (createdByUid). */
    requireOwnerUid?: string
    /** Required when approving: full datetime `yyyy-MM-ddTHH:mm`. */
    plannedExecutionDate?: string
    /**
     * Skip owner stats write inside the status transaction.
     * Used for reporter daily-report → shot so a denied users/{owner} write
     * cannot roll back the job+history update. Stats are best-effort after.
     */
    deferOwnerStats?: boolean
  },
): Promise<void> {
  if (!options.allowedRoles.includes(actor.role)) {
    throw new UserFacingError('Bu işlem için yetkiniz bulunmuyor.')
  }

  const deferredOwnerStats: {
    value: {
      ownerUid: string
      delta: { jobsReceived: number; jobsShot: number; jobsCancelled: number }
    } | null
  } = { value: null }

  await runTransaction(getDb(), async (tx) => {
    const ref = jobDocRef(jobId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new UserFacingError('İş kaydı bulunamadı.')
    const job = snap.data()
    if (options.requireOwnerUid && job.createdByUid !== options.requireOwnerUid) {
      throw new UserFacingError('Yalnızca kendi iş kayıtlarınızı sonuçlandırabilirsiniz.')
    }
    if (!isAllowedTransition(job.status, toStatus)) {
      if (job.status === toStatus) {
        throw new UserFacingError(
          'Bu iş zaten bu durumda. Listeyi yenileyip kontrol edin.',
        )
      }
      throw new UserFacingError('Bu durum geçişine izin verilmiyor.')
    }

    let nextPlannedExecutionDate: string | undefined
    if (toStatus === 'approved') {
      const planned = options.plannedExecutionDate?.trim() ?? ''
      if (!isValidDateTimeLocal(planned)) {
        throw new UserFacingError('Konfirme için geçerli bir çekim saati girin.')
      }
      if (isJobSchedulePast(planned)) {
        throw new UserFacingError('Planlanan çekim zamanı geçmiş olamaz.')
      }
      if (!isJobScheduleOnOrAfter(planned, job.acquiredDate)) {
        throw new UserFacingError(
          'Planlanan çekim, iş alım tarihinden önce olamaz.',
        )
      }
      nextPlannedExecutionDate = planned
    }

    const delta = getStatsDelta(job.status, toStatus)
    const nextVersion = job.statusVersion + 1
    const ownerRef = doc(getDb(), 'users', job.createdByUid)

    // Rules compare reviewedByNameSnapshot / actorNameSnapshot to
    // callerProfile().fullName. Always prefer the live users/{actor} name
    // (reporters may read themselves; owner path reads the job owner = self).
    let actorName = actor.fullName
    if (options.requireOwnerUid) {
      const ownerSnap = await tx.get(ownerRef)
      if (!ownerSnap.exists()) throw new UserFacingError('Kullanıcı profili bulunamadı.')
      const ownerData = ownerSnap.data()
      if (typeof ownerData.fullName === 'string' && ownerData.fullName.trim()) {
        actorName = ownerData.fullName
      }
    } else {
      const selfRef = doc(getDb(), 'users', actor.uid)
      const selfSnap = await tx.get(selfRef)
      if (selfSnap.exists()) {
        const selfName = selfSnap.data().fullName
        if (typeof selfName === 'string' && selfName.trim()) {
          actorName = selfName
        }
      }
    }

    const revertingToPending = toStatus === 'pending'

    tx.update(ref, {
      status: toStatus,
      statusVersion: nextVersion,
      updatedAt: serverTimestamp(),
      reviewedByUid: revertingToPending ? null : actor.uid,
      reviewedByNameSnapshot: revertingToPending ? null : actorName,
      reviewedAt: revertingToPending ? null : serverTimestamp(),
      reviewNote: revertingToPending ? null : reviewNote,
      ...(nextPlannedExecutionDate
        ? { plannedExecutionDate: nextPlannedExecutionDate }
        : {}),
      ...(revertingToPending
        ? {
            forwardedToReporter: false,
            forwardedToReporterByUid: null,
            forwardedToReporterByNameSnapshot: null,
            forwardedToReporterAt: null,
          }
        : {}),
    })

    const historyRef = doc(collection(getDb(), 'jobs', jobId, 'history'))
    tx.set(historyRef, {
      version: nextVersion,
      fromStatus: job.status,
      toStatus,
      actorUid: actor.uid,
      actorNameSnapshot: actorName,
      actorRole: actor.role,
      note: reviewNote,
      createdAt: serverTimestamp(),
    })

    const hasStatsDelta =
      delta.jobsReceived !== 0 || delta.jobsShot !== 0 || delta.jobsCancelled !== 0

    if (hasStatsDelta && options.deferOwnerStats) {
      // Do not touch users/{owner} in this transaction — a denied owner write
      // would otherwise abort approved→shot for muhabir günlük rapor.
      deferredOwnerStats.value = { ownerUid: job.createdByUid, delta }
    } else if (hasStatsDelta) {
      // Owner stats via increment — no prior users/{owner} read required.
      tx.update(ownerRef, buildOwnerStatsIncrement(delta))
    }
  })

  if (deferredOwnerStats.value) {
    try {
      await updateDoc(
        doc(getDb(), 'users', deferredOwnerStats.value.ownerUid),
        buildOwnerStatsIncrement(deferredOwnerStats.value.delta),
      )
    } catch {
      // Best-effort: job is already shot; stats drift is preferable to blocking.
    }
  }
}

const REVIEWER_ROLES: UserRole[] = ['coordinator', 'management']

async function requireFreshJob(jobId: string): Promise<JobDocument> {
  const fresh = await getJob(jobId)
  if (!fresh) {
    throw new UserFacingError('İş kaydı bulunamadı.')
  }
  return fresh
}

export async function approveJob(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
  plannedExecutionDate: string,
  reviewNote?: string,
): Promise<JobDocument> {
  await transitionJob(jobId, 'approved', actor, reviewNote ?? null, {
    allowedRoles: REVIEWER_ROLES,
    plannedExecutionDate,
  })

  const fresh = await requireFreshJob(jobId)

  try {
    const company = fresh.companyName || 'İş'

    void notifyManagement({
      type: 'job_approved',
      title: 'İş konfirme edildi',
      body: `${company} — ${actor.fullName}`,
      link: '/management',
      createdByUid: actor.uid,
      createdByNameSnapshot: actor.fullName,
      /** Muhabir, kameraman ve MPU konfirme push’u almaz. */
      pushRoles: ['management', 'coordinator', 'human_resources'],
    })
  } catch {
    /* notify is best-effort */
  }

  return fresh
}

export async function rejectJob(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
  reviewNote?: string,
): Promise<JobDocument> {
  await transitionJob(jobId, 'rejected', actor, reviewNote ?? null, {
    allowedRoles: REVIEWER_ROLES,
  })

  const fresh = await requireFreshJob(jobId)

  try {
    const company = fresh.companyName || 'İş'
    const ownerUid = fresh.createdByUid
    if (ownerUid) {
      const note = reviewNote?.trim() ?? ''
      void notifyUser({
        recipientUid: ownerUid,
        type: 'job_rejected',
        title: `"${company}" işiniz reddedildi.`,
        body: note,
        link: '/media-planning',
        createdByUid: actor.uid,
        createdByNameSnapshot: actor.fullName,
      })
    }
  } catch {
    /* notify is best-effort */
  }

  return fresh
}

/** Move an approved job back to the pending approval queue. */
export async function revertJobToPending(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
  note?: string,
): Promise<JobDocument> {
  await transitionJob(jobId, 'pending', actor, note ?? null, {
    allowedRoles: REVIEWER_ROLES,
  })
  return requireFreshJob(jobId)
}

export async function markJobAsShot(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
): Promise<JobDocument> {
  await transitionJob(jobId, 'shot', actor, null, {
    allowedRoles: REVIEWER_ROLES,
  })

  void notifyJobOwnerShot(jobId, actor)
  return requireFreshJob(jobId)
}

const DAILY_REPORT_SHOT_ROLES: UserRole[] = [
  'reporter',
  'coordinator',
  'management',
]

export type DailyReportShotResult = 'marked' | 'already_shot' | 'skipped'

/**
 * When a daily report links a job, mark it çekildi (`shot`).
 * Idempotent: already-shot → already_shot.
 * Skips rejected/cancelled/pending (status machine: only approved → shot).
 */
export async function markJobAsShotFromDailyReport(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
): Promise<DailyReportShotResult> {
  if (!DAILY_REPORT_SHOT_ROLES.includes(actor.role)) {
    throw new UserFacingError('Bu işlem için yetkiniz bulunmuyor.')
  }

  const job = await getJob(jobId)
  if (!job) return 'skipped'
  if (job.status === 'shot') return 'already_shot'
  if (job.status !== 'approved') return 'skipped'

  try {
    await transitionJob(jobId, 'shot', actor, null, {
      allowedRoles: DAILY_REPORT_SHOT_ROLES,
      // Reporter must not bind shot success to users/{owner} stats write —
      // that path has caused live permission-denied on daily report submit.
      deferOwnerStats: actor.role === 'reporter',
    })
    void notifyJobOwnerShot(jobId, actor, job)
    return 'marked'
  } catch (error) {
    // Race: another writer moved status between get and transition.
    const fresh = await getJob(jobId)
    if (fresh?.status === 'shot') return 'already_shot'
    throw error
  }
}

async function notifyJobOwnerShot(
  jobId: string,
  actor: { uid: string; fullName: string },
  knownJob?: { companyName: string; createdByUid: string },
): Promise<void> {
  try {
    let company = knownJob?.companyName
    let ownerUid = knownJob?.createdByUid
    if (!company || !ownerUid) {
      const snap = await getDoc(jobDocRef(jobId))
      if (!snap.exists()) return
      company = String(snap.data().companyName ?? 'İş')
      ownerUid = String(snap.data().createdByUid ?? '')
    }
    if (!ownerUid) return

    void notifyUser({
      recipientUid: ownerUid,
      type: 'job_shot',
      title: `"${company}" işiniz çekildi olarak işaretlendi.`,
      body: '',
      link: '/media-planning',
      createdByUid: actor.uid,
      createdByNameSnapshot: actor.fullName,
    })
  } catch {
    /* notify is best-effort */
  }
}

export async function cancelJob(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
  reviewNote?: string,
): Promise<JobDocument> {
  const note = reviewNote?.trim() ?? ''
  if (note.length < 3) {
    throw new UserFacingError('İptal için en az 3 karakterlik bir neden girin.')
  }
  // Idempotent: concurrent double-submit / retry after success.
  const current = await getJob(jobId)
  if (current?.status === 'cancelled') {
    return current
  }
  await transitionJob(jobId, 'cancelled', actor, note, {
    allowedRoles: REVIEWER_ROLES,
  })
  return requireFreshJob(jobId)
}

/**
 * Media planner confirms their own overdue approved job as successfully shot.
 */
export async function confirmOwnJobAsShot(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
): Promise<void> {
  if (actor.role !== 'media_planning') {
    throw new UserFacingError('Bu işlem yalnızca medya planlama kullanıcıları içindir.')
  }
  await transitionJob(jobId, 'shot', actor, null, {
    allowedRoles: ['media_planning'],
    requireOwnerUid: actor.uid,
  })
}

/**
 * Media planner cancels their own overdue approved job (requires a reason).
 */
export async function cancelOwnJob(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
  reviewNote: string,
): Promise<void> {
  if (actor.role !== 'media_planning') {
    throw new UserFacingError('Bu işlem yalnızca medya planlama kullanıcıları içindir.')
  }
  const note = reviewNote.trim()
  if (note.length < 3) {
    throw new UserFacingError('İptal için en az 3 karakterlik bir neden girin.')
  }
  const current = await getJob(jobId)
  if (current?.status === 'cancelled') {
    return
  }
  await transitionJob(jobId, 'cancelled', actor, note, {
    allowedRoles: ['media_planning'],
    requireOwnerUid: actor.uid,
  })
}

/** Yönetim/koordinatör: konfirme işi muhabir çekim takvimine iletir. */
export async function forwardJobToReporter(
  jobId: string,
  actor: { uid: string; fullName: string; role: UserRole },
): Promise<JobDocument> {
  if (!REVIEWER_ROLES.includes(actor.role)) {
    throw new UserFacingError('Bu işlem yalnızca yönetim veya koordinatör içindir.')
  }

  await runTransaction(getDb(), async (tx) => {
    const ref = jobDocRef(jobId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new UserFacingError('İş kaydı bulunamadı.')
    const job = snap.data()
    if (job.status !== 'approved') {
      throw new UserFacingError('Yalnızca konfirme işler muhabire iletilebilir.')
    }
    if (job.forwardedToReporter) {
      throw new UserFacingError('Bu iş zaten muhabire iletilmiş.')
    }

    tx.update(ref, {
      forwardedToReporter: true,
      forwardedToReporterByUid: actor.uid,
      forwardedToReporterByNameSnapshot: actor.fullName,
      forwardedToReporterAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  const fresh = await getJob(jobId)
  if (!fresh) {
    throw new UserFacingError('İş muhabire iletildi ancak yeniden okunamadı.')
  }
  return fresh
}

/** Muhabir çekim takvimi: yalnızca iletilmiş konfirme işler. */
export function subscribeApprovedOpenJobs(
  onData: (jobs: JobDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    jobsCollection(),
    where('status', '==', 'approved'),
    where('forwardedToReporter', '==', true),
    orderBy('updatedAt', 'desc'),
    limit(100),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export async function getJob(jobId: string): Promise<JobDocument | null> {
  const snap = await getDoc(jobDocRef(jobId))
  return snap.exists() ? snap.data() : null
}

/** Page size for management/coordinator approval & reviewed queues. */
export const JOB_QUEUE_PAGE_SIZE = 50

export type JobQueueCursor = QueryDocumentSnapshot<JobDocument>

export type JobQueuePage = {
  jobs: JobDocument[]
  /** Last doc of this page — pass to the next fetch for `startAfter`. */
  cursor: JobQueueCursor | null
  hasMore: boolean
}

async function fetchJobQueuePage(
  buildQuery: (
    pageLimit: number,
    after: JobQueueCursor | null,
  ) => Query<JobDocument>,
  after: JobQueueCursor | null = null,
  pageSize = JOB_QUEUE_PAGE_SIZE,
): Promise<JobQueuePage> {
  const snap = await getDocs(buildQuery(pageSize + 1, after))
  const hasMore = snap.docs.length > pageSize
  const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs
  return {
    jobs: pageDocs.map((d) => d.data()),
    cursor: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1]! : null,
    hasMore,
  }
}

/** First / next page of pending jobs (approval queue). Cursor via `startAfter`. */
export async function fetchAllPendingJobsPage(
  after: JobQueueCursor | null = null,
  pageSize = JOB_QUEUE_PAGE_SIZE,
): Promise<JobQueuePage> {
  try {
    return await fetchJobQueuePage(
      (pageLimit, cursor) =>
        cursor
          ? query(
              jobsCollection(),
              where('status', '==', 'pending'),
              orderBy('createdAt', 'desc'),
              startAfter(cursor),
              limit(pageLimit),
            )
          : query(
              jobsCollection(),
              where('status', '==', 'pending'),
              orderBy('createdAt', 'desc'),
              limit(pageLimit),
            ),
      after,
      pageSize,
    )
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Konfirme bekleyen işler yüklenemedi.'))
  }
}

/** @deprecated Prefer fetchAllPendingJobsPage + load-more for unbounded queues. */
export function subscribeAllPendingJobs(
  onData: (jobs: JobDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    jobsCollection(),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    limit(JOB_QUEUE_PAGE_SIZE),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

/** Cap for schedule calendar fetch; UI shows truncation when hit. */
export const SCHEDULE_JOBS_FETCH_LIMIT = 500

/** Operational jobs for daily hour calendar (higher limit than approval queues). */
export function subscribeScheduleJobs(
  onData: (jobs: JobDocument[], meta?: { truncated: boolean; fetchLimit: number }) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    jobsCollection(),
    where('status', 'in', ['approved', 'shot', 'cancelled']),
    orderBy('updatedAt', 'desc'),
    limit(SCHEDULE_JOBS_FETCH_LIMIT),
  )
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => d.data()), {
        truncated: snap.docs.length >= SCHEDULE_JOBS_FETCH_LIMIT,
        fetchLimit: SCHEDULE_JOBS_FETCH_LIMIT,
      }),
    (err) => onError?.(err),
  )
}

/**
 * One-shot list for the daily reporter report dropdown: approved/shot jobs
 * whose planned execution day equals the report date (`yyyy-MM-dd`).
 * Excludes jobs already claimed by another daily report (`dailyReportId`).
 * When editing, pass `allowDailyReportId` so that report's own companies stay selectable.
 * Reuses the existing status+updatedAt index (same as subscribeScheduleJobs);
 * day filtering happens client-side.
 */
export async function fetchJobsForReportDate(
  reportDate: string,
  options?: { allowDailyReportId?: string | null },
): Promise<JobDocument[]> {
  const allowId = options?.allowDailyReportId?.trim() || null
  try {
    const snap = await getDocs(
      query(
        jobsCollection(),
        where('status', 'in', ['approved', 'shot']),
        orderBy('updatedAt', 'desc'),
        limit(500),
      ),
    )
    return snap.docs
      .map((d) => d.data())
      .filter((job) => {
        if (job.plannedExecutionDate.slice(0, 10) !== reportDate) return false
        if (!job.dailyReportId) return true
        return allowId != null && job.dailyReportId === allowId
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName, 'tr-TR'))
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Günün işleri yüklenemedi.'))
  }
}

/** First / next page of approved / shot / cancelled jobs (reviewed queue). */
export async function fetchAllApprovedJobsPage(
  after: JobQueueCursor | null = null,
  pageSize = JOB_QUEUE_PAGE_SIZE,
): Promise<JobQueuePage> {
  try {
    return await fetchJobQueuePage(
      (pageLimit, cursor) =>
        cursor
          ? query(
              jobsCollection(),
              where('status', 'in', ['approved', 'shot', 'cancelled']),
              orderBy('updatedAt', 'desc'),
              startAfter(cursor),
              limit(pageLimit),
            )
          : query(
              jobsCollection(),
              where('status', 'in', ['approved', 'shot', 'cancelled']),
              orderBy('updatedAt', 'desc'),
              limit(pageLimit),
            ),
      after,
      pageSize,
    )
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Konfirme işler yüklenemedi.'))
  }
}

/** @deprecated Prefer fetchAllApprovedJobsPage + load-more. */
export function subscribeAllApprovedJobs(
  onData: (jobs: JobDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    jobsCollection(),
    where('status', 'in', ['approved', 'shot', 'cancelled']),
    orderBy('updatedAt', 'desc'),
    limit(JOB_QUEUE_PAGE_SIZE),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

/** First / next page of rejected jobs. */
export async function fetchRecentlyRejectedJobsPage(
  after: JobQueueCursor | null = null,
  pageSize = JOB_QUEUE_PAGE_SIZE,
): Promise<JobQueuePage> {
  try {
    return await fetchJobQueuePage(
      (pageLimit, cursor) =>
        cursor
          ? query(
              jobsCollection(),
              where('status', '==', 'rejected'),
              orderBy('updatedAt', 'desc'),
              startAfter(cursor),
              limit(pageLimit),
            )
          : query(
              jobsCollection(),
              where('status', '==', 'rejected'),
              orderBy('updatedAt', 'desc'),
              limit(pageLimit),
            ),
      after,
      pageSize,
    )
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Reddedilen işler yüklenemedi.'))
  }
}

/** @deprecated Prefer fetchRecentlyRejectedJobsPage + load-more. */
export function subscribeRecentlyRejectedJobs(
  onData: (jobs: JobDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    jobsCollection(),
    where('status', '==', 'rejected'),
    orderBy('updatedAt', 'desc'),
    limit(JOB_QUEUE_PAGE_SIZE),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}
