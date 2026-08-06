import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
  where,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import type { ReporterZReport } from '@/features/reporter/types/reporter'
import { UserFacingError, mapAppError } from '@/lib/errors'
import {
  dateToDateOnlyIstanbul,
  expandStatsQueryDateRange,
  isDateOnlyInStatsRange,
} from '@/lib/date'
import { uploadFileToDrive, type DriveUploadProgress } from '@/lib/driveUpload'
import { DEFAULT_LIST_LIMIT } from '@/config/roles'
import { notifyManagement } from '@/features/notifications/services/notificationService'

const converter: FirestoreDataConverter<ReporterZReport> = {
  toFirestore(report: ReporterZReport): DocumentData {
    const { id: _id, ...rest } = report
    return rest
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): ReporterZReport {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      confirmed: true,
      photoStoragePath:
        data.photoStoragePath === null || data.photoStoragePath === undefined
          ? null
          : String(data.photoStoragePath),
      photoDownloadUrl:
        data.photoDownloadUrl === null || data.photoDownloadUrl === undefined
          ? null
          : String(data.photoDownloadUrl),
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdByEmailSnapshot: String(data.createdByEmailSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

function reportsCollection() {
  return collection(getDb(), 'reporterZReports').withConverter(converter)
}

function dayStart(dateOnly: string) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEnd(dateOnly: string) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

async function uploadZPhoto(
  reportId: string,
  photoFile: File,
  onProgress?: (progress: DriveUploadProgress) => void,
): Promise<{ photoStoragePath: string; photoDownloadUrl: string }> {
  const safeName = photoFile.name.replace(/[^\w.\-]+/g, '_').slice(0, 80)
  const mimeType = photoFile.type || 'image/jpeg'
  const drive = await uploadFileToDrive({
    file: photoFile,
    fileName: safeName || `${reportId}.jpg`,
    mimeType,
    folder: 'z-reports',
    onProgress,
  })
  return {
    photoStoragePath: drive.fileId,
    photoDownloadUrl: `https://drive.google.com/thumbnail?id=${drive.fileId}&sz=w1600`,
  }
}

export function subscribeOwnZReports(
  uid: string,
  onData: (reports: ReporterZReport[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    reportsCollection(),
    where('createdByUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(DEFAULT_LIST_LIMIT),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export async function createZReport(input: {
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
  photoFile?: File | null
  onUploadProgress?: (progress: DriveUploadProgress) => void
}): Promise<string> {
  try {
    const reportRef = doc(collection(getDb(), 'reporterZReports'))
    let photoStoragePath: string | null = null
    let photoDownloadUrl: string | null = null

    if (input.photoFile) {
      const uploaded = await uploadZPhoto(
        reportRef.id,
        input.photoFile,
        input.onUploadProgress,
      )
      photoStoragePath = uploaded.photoStoragePath
      photoDownloadUrl = uploaded.photoDownloadUrl
    }

    await setDoc(reportRef, {
      confirmed: true,
      photoStoragePath,
      photoDownloadUrl,
      createdByUid: input.createdByUid,
      createdByNameSnapshot: input.createdByNameSnapshot,
      createdByEmailSnapshot: input.createdByEmailSnapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    void notifyManagement({
      type: 'z_report',
      title: 'Z raporu paylaşıldı',
      body: input.createdByNameSnapshot,
      link: '/reporter?tab=z-reports',
      createdByUid: input.createdByUid,
      createdByNameSnapshot: input.createdByNameSnapshot,
      pushRoles: ['management', 'coordinator'],
    })

    return reportRef.id
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Z raporu gönderilemedi.'))
  }
}

export async function updateOwnZReport(input: {
  id: string
  ownerUid: string
  /** Yeni fotoğraf; yoksa mevcut foto korunur (clearPhoto ile silinmediyse). */
  photoFile?: File | null
  /** true ise fotoğrafı kaldırır (photoFile yokken). */
  clearPhoto?: boolean
  existingPhotoStoragePath: string | null
  existingPhotoDownloadUrl: string | null
  onUploadProgress?: (progress: DriveUploadProgress) => void
}): Promise<void> {
  try {
    let photoStoragePath = input.existingPhotoStoragePath
    let photoDownloadUrl = input.existingPhotoDownloadUrl

    if (input.photoFile) {
      const uploaded = await uploadZPhoto(
        input.id,
        input.photoFile,
        input.onUploadProgress,
      )
      photoStoragePath = uploaded.photoStoragePath
      photoDownloadUrl = uploaded.photoDownloadUrl
    } else if (input.clearPhoto) {
      photoStoragePath = null
      photoDownloadUrl = null
    }

    await updateDoc(doc(getDb(), 'reporterZReports', input.id), {
      photoStoragePath,
      photoDownloadUrl,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Z raporu güncellenemedi.'))
  }
}

export async function deleteOwnZReport(id: string): Promise<void> {
  try {
    await deleteDoc(doc(getDb(), 'reporterZReports', id))
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Z raporu silinemedi.'))
  }
}

export async function fetchZReportsInRange(range: {
  startDate: string
  endDate: string
}): Promise<ReporterZReport[]> {
  try {
    const expanded = expandStatsQueryDateRange(range.startDate, range.endDate)
    if (!expanded) return []

    const snap = await getDocs(
      query(
        reportsCollection(),
        where('createdAt', '>=', dayStart(expanded.startDate)),
        where('createdAt', '<=', dayEnd(expanded.endDate)),
        orderBy('createdAt', 'desc'),
        limit(1000),
      ),
    )
    return snap.docs
      .map((d) => d.data())
      .filter((report) => {
        const created = report.createdAt?.toDate?.()
        if (!created) return false
        return isDateOnlyInStatsRange(
          dateToDateOnlyIstanbul(created),
          range.startDate,
          range.endDate,
        )
      })
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Z raporları yüklenemedi.'))
  }
}
