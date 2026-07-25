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
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import type { HrReport } from '@/features/hr/types/hr'
import { DEFAULT_LIST_LIMIT } from '@/config/roles'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { notifyManagement } from '@/features/notifications/services/notificationService'

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

export async function createHrReport(input: {
  title: string
  body: string
  createdByUid: string
  createdByNameSnapshot: string
}): Promise<string> {
  try {
    const ref = await addDoc(collection(getDb(), 'hrReports'), {
      title: input.title.trim(),
      body: input.body.trim(),
      createdByUid: input.createdByUid,
      createdByNameSnapshot: input.createdByNameSnapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

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
    throw new UserFacingError(mapAppError(error, 'Rapor gönderilemedi.'))
  }
}

export async function updateHrReport(input: {
  id: string
  title: string
  body: string
}): Promise<void> {
  try {
    await updateDoc(doc(getDb(), 'hrReports', input.id), {
      title: input.title.trim(),
      body: input.body.trim(),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Rapor güncellenemedi.'))
  }
}
