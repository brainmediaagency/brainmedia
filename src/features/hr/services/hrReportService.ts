import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import type { HrMpuAttendanceEntry, HrReport } from '@/features/hr/types/hr'
import { DEFAULT_LIST_LIMIT } from '@/config/roles'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { notifyManagement } from '@/features/notifications/services/notificationService'
import {
  dateToDateOnlyIstanbul,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import {
  assertHrMpuAttendanceLimit,
  assertValidMergedAttendance,
  foldHrMpuAttendances,
  mergeHrMpuAttendanceEntry,
  toFirestoreAttendance,
} from '@/features/hr/utils/mergeHrMpuAttendance'

function optionalTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseAttendanceEntry(raw: unknown): HrMpuAttendanceEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const mpuUid = optionalTrimmedString(data.mpuUid)
  const mpuNameSnapshot = optionalTrimmedString(data.mpuNameSnapshot)
  if (!mpuUid || !mpuNameSnapshot) return null
  const absent = data.absent === true
  return {
    mpuUid,
    mpuNameSnapshot,
    clockInTime: absent ? null : optionalTrimmedString(data.clockInTime),
    clockOutTime: absent ? null : optionalTrimmedString(data.clockOutTime),
    absent,
  }
}

/** Reads `mpuAttendances` or migrates legacy single-MPU fields. */
function parseMpuAttendances(data: DocumentData): HrMpuAttendanceEntry[] {
  if (Array.isArray(data.mpuAttendances)) {
    return data.mpuAttendances
      .map(parseAttendanceEntry)
      .filter((entry): entry is HrMpuAttendanceEntry => entry != null)
  }

  const legacyUid = optionalTrimmedString(data.mpuUid)
  const legacyName = optionalTrimmedString(data.mpuNameSnapshot)
  if (!legacyUid || !legacyName) return []

  return [
    {
      mpuUid: legacyUid,
      mpuNameSnapshot: legacyName,
      clockInTime: optionalTrimmedString(data.clockInTime),
      clockOutTime: optionalTrimmedString(data.clockOutTime),
      absent: false,
    },
  ]
}

const hrReportConverter: FirestoreDataConverter<HrReport> = {
  toFirestore(report: HrReport): DocumentData {
    const { id: _id, ...rest } = report
    return rest
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): HrReport {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      title: String(data.title ?? ''),
      body: String(data.body ?? ''),
      mpuAttendances: parseMpuAttendances(data),
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

function reportsCollection() {
  return collection(getDb(), 'hrReports').withConverter(hrReportConverter)
}

export function subscribeOwnHrReports(
  uid: string,
  onData: (reports: HrReport[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    reportsCollection(),
    where('createdByUid', '==', uid),
    orderBy('updatedAt', 'desc'),
    limit(DEFAULT_LIST_LIMIT),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export function subscribeAllHrReports(
  onData: (reports: HrReport[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    reportsCollection(),
    orderBy('updatedAt', 'desc'),
    limit(50),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export async function fetchHrReportsInRange(range: {
  startDate: string
  endDate: string
}): Promise<HrReport[]> {
  const start = dayStart(range.startDate)
  const end = dayEnd(range.endDate)
  try {
    const snap = await getDocs(
      query(
        reportsCollection(),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
    )
    return snap.docs.map((d) => d.data())
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Raporlar yüklenemedi.'))
  }
}

function dayStart(dateOnly: string) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEnd(dateOnly: string) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

async function fetchOwnHrReportsForIstanbulDay(
  uid: string,
  dateOnly: string,
  excludeId?: string,
): Promise<HrReport[]> {
  try {
    const snap = await getDocs(
      query(
        reportsCollection(),
        where('createdByUid', '==', uid),
        orderBy('updatedAt', 'desc'),
        limit(50),
      ),
    )
    return snap.docs
      .map((d) => d.data())
      .filter((report) => {
        if (excludeId && report.id === excludeId) return false
        if (!report.createdAt) return false
        return dateToDateOnlyIstanbul(report.createdAt.toDate()) === dateOnly
      })
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis() ?? 0
        const bMs = b.createdAt?.toMillis() ?? 0
        return aMs - bMs
      })
  } catch (error) {
    // Same-day merge is best-effort; do not block report create on list denial.
    console.warn('[hrReportService] same-day fetch skipped', error)
    return []
  }
}

function mergeIncomingWithSameDay(params: {
  incoming: HrMpuAttendanceEntry[]
  sameDayOldestFirst: HrReport[]
}): {
  storedIncoming: HrMpuAttendanceEntry[]
  finalByMpu: Map<string, HrMpuAttendanceEntry>
  affectedUids: Set<string>
} {
  const priorByMpu = foldHrMpuAttendances(params.sameDayOldestFirst)
  const finalByMpu = new Map(priorByMpu)
  const affectedUids = new Set<string>()

  for (const entry of params.incoming) {
    affectedUids.add(entry.mpuUid)
    const merged = mergeHrMpuAttendanceEntry(finalByMpu.get(entry.mpuUid), entry)
    assertValidMergedAttendance(merged)
    finalByMpu.set(entry.mpuUid, merged)
  }

  const storedIncoming = params.incoming.map((entry) => {
    const merged = finalByMpu.get(entry.mpuUid) ?? toFirestoreAttendance(entry)
    return toFirestoreAttendance(merged)
  })

  return { storedIncoming, finalByMpu, affectedUids }
}

function patchReportAttendances(
  report: HrReport,
  finalByMpu: Map<string, HrMpuAttendanceEntry>,
  affectedUids: Set<string>,
): HrMpuAttendanceEntry[] | null {
  let changed = false
  const next = report.mpuAttendances.map((entry) => {
    if (!affectedUids.has(entry.mpuUid)) return toFirestoreAttendance(entry)
    const merged = finalByMpu.get(entry.mpuUid)
    if (!merged) return toFirestoreAttendance(entry)
    changed = true
    return toFirestoreAttendance(merged)
  })
  return changed ? next : null
}

export async function createHrReport(input: {
  title: string
  body: string
  mpuAttendances: HrMpuAttendanceEntry[]
  createdByUid: string
  createdByNameSnapshot: string
}): Promise<string> {
  try {
    assertHrMpuAttendanceLimit(input.mpuAttendances)
    const today = todayDateOnlyIstanbul()
    const sameDay = await fetchOwnHrReportsForIstanbulDay(input.createdByUid, today)
    const { storedIncoming, finalByMpu, affectedUids } = mergeIncomingWithSameDay({
      incoming: input.mpuAttendances.map(toFirestoreAttendance),
      sameDayOldestFirst: sameDay,
    })

    const db = getDb()
    const nameSnapshot = input.createdByNameSnapshot.trim()
    if (!nameSnapshot) {
      throw new UserFacingError('Profil adınız eksik. Çıkış yapıp tekrar giriş yapın.')
    }
    const ref = await addDoc(collection(db, 'hrReports'), {
      title: input.title.trim(),
      body: input.body.trim(),
      mpuAttendances: storedIncoming,
      createdByUid: input.createdByUid,
      createdByNameSnapshot: nameSnapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Best-effort: patch earlier same-day reports with merged MPU times.
    if (sameDay.length > 0 && affectedUids.size > 0) {
      try {
        const batch = writeBatch(db)
        let ops = 0
        for (const report of sameDay) {
          const patched = patchReportAttendances(report, finalByMpu, affectedUids)
          if (!patched) continue
          batch.update(doc(db, 'hrReports', report.id), {
            mpuAttendances: patched,
            updatedAt: serverTimestamp(),
          })
          ops += 1
        }
        if (ops > 0) await batch.commit()
      } catch (error) {
        console.warn('[hrReportService] same-day merge patch skipped', error)
      }
    }

    void notifyManagement({
      type: 'hr_report',
      title: 'Yeni İK raporu',
      body: `${input.title.trim()} — ${input.createdByNameSnapshot}`,
      link: '/human-resources?tab=reports',
      createdByUid: input.createdByUid,
      createdByNameSnapshot: input.createdByNameSnapshot,
    })

    return ref.id
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('USER_')) {
      throw new UserFacingError(error.message.replace(/^USER_/, ''))
    }
    throw new UserFacingError(mapAppError(error, 'Rapor gönderilemedi.'))
  }
}

export async function updateHrReport(input: {
  id: string
  title: string
  body: string
  mpuAttendances: HrMpuAttendanceEntry[]
  createdByUid: string
}): Promise<void> {
  try {
    assertHrMpuAttendanceLimit(input.mpuAttendances)
    const today = todayDateOnlyIstanbul()
    const sameDay = await fetchOwnHrReportsForIstanbulDay(
      input.createdByUid,
      today,
      input.id,
    )
    const { storedIncoming, finalByMpu, affectedUids } = mergeIncomingWithSameDay({
      incoming: input.mpuAttendances.map(toFirestoreAttendance),
      sameDayOldestFirst: sameDay,
    })

    const db = getDb()
    await updateDoc(doc(db, 'hrReports', input.id), {
      title: input.title.trim(),
      body: input.body.trim(),
      mpuAttendances: storedIncoming,
      updatedAt: serverTimestamp(),
    })

    if (sameDay.length > 0 && affectedUids.size > 0) {
      try {
        const batch = writeBatch(db)
        let ops = 0
        for (const report of sameDay) {
          const patched = patchReportAttendances(report, finalByMpu, affectedUids)
          if (!patched) continue
          batch.update(doc(db, 'hrReports', report.id), {
            mpuAttendances: patched,
            updatedAt: serverTimestamp(),
          })
          ops += 1
        }
        if (ops > 0) await batch.commit()
      } catch (error) {
        console.warn('[hrReportService] same-day merge patch skipped', error)
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('USER_')) {
      throw new UserFacingError(error.message.replace(/^USER_/, ''))
    }
    throw new UserFacingError(mapAppError(error, 'Rapor güncellenemedi.'))
  }
}
