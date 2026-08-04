import {
  collection,
  doc,
  getDoc,
  getDocs,
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
import type {
  KameramanOdometerReading,
  OdometerSlot,
} from '@/features/kameraman/types/odometer'
import {
  buildDriveFolderKey,
  slotFileName,
  slotLabelTr,
} from '@/features/kameraman/utils/odometerKm'
import { uploadFileToDrive, trashDriveFile, type DriveUploadProgress } from '@/lib/driveUpload'
import { isValidDateOnly, todayDateOnlyIstanbul, formatDateOnlyShortTr } from '@/lib/date'
import { DEFAULT_LIST_LIMIT } from '@/config/roles'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { notifyManagement } from '@/features/notifications/services/notificationService'

const converter: FirestoreDataConverter<KameramanOdometerReading> = {
  toFirestore(item: KameramanOdometerReading): DocumentData {
    const { id: _id, ...rest } = item
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): KameramanOdometerReading {
    const data = snapshot.data(options)
    const slotRaw = String(data.slot ?? '')
    const slot: OdometerSlot = slotRaw === 'evening' ? 'evening' : 'morning'
    return {
      id: snapshot.id,
      reportDate: String(data.reportDate ?? ''),
      slot,
      odometerKm: Math.max(0, Math.floor(Number(data.odometerKm ?? 0))),
      note:
        data.note === null || data.note === undefined || data.note === ''
          ? null
          : String(data.note),
      photoStoragePath: String(data.photoStoragePath ?? ''),
      photoDownloadUrl: String(data.photoDownloadUrl ?? ''),
      driveFolderKey: String(data.driveFolderKey ?? ''),
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdByEmailSnapshot: String(data.createdByEmailSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

function readingsCollection() {
  return collection(getDb(), 'kameramanOdometerReadings').withConverter(converter)
}

export function readingDocId(
  uid: string,
  reportDate: string,
  slot: OdometerSlot,
): string {
  return `${uid}_${reportDate}_${slot}`
}

function assertEditableToday(reportDate: string): void {
  if (!isValidDateOnly(reportDate)) {
    throw new UserFacingError('Geçerli bir rapor tarihi girin.')
  }
  if (reportDate !== todayDateOnlyIstanbul()) {
    throw new UserFacingError(
      'Yalnızca bugünün kadran raporları düzenlenebilir.',
    )
  }
}

async function uploadOdometerPhoto(input: {
  photoFile: File
  fullName: string
  reportDate: string
  slot: OdometerSlot
  onProgress?: (progress: DriveUploadProgress) => void
}): Promise<{
  photoStoragePath: string
  photoDownloadUrl: string
  driveFolderKey: string
}> {
  const folderKey = buildDriveFolderKey(input.fullName, input.reportDate)
  const fileName = slotFileName(input.slot)
  const mimeType =
    input.photoFile.type && input.photoFile.type.startsWith('image/')
      ? input.photoFile.type
      : 'image/png'
  const drive = await uploadFileToDrive({
    file: input.photoFile,
    fileName,
    mimeType,
    folder: 'kameraman-km',
    folderPath: folderKey,
    onProgress: input.onProgress,
  })
  return {
    photoStoragePath: drive.fileId,
    photoDownloadUrl: `https://drive.google.com/thumbnail?id=${drive.fileId}&sz=w1600`,
    driveFolderKey: folderKey,
  }
}

export function subscribeOwnOdometerReadings(
  uid: string,
  onData: (items: KameramanOdometerReading[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    readingsCollection(),
    where('createdByUid', '==', uid),
    orderBy('reportDate', 'desc'),
    limit(DEFAULT_LIST_LIMIT),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export function subscribeAllOdometerReadings(
  onData: (items: KameramanOdometerReading[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    readingsCollection(),
    orderBy('reportDate', 'desc'),
    limit(500),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export async function fetchOdometerReadingsInRange(params: {
  startDate: string
  endDate: string
}): Promise<KameramanOdometerReading[]> {
  if (!isValidDateOnly(params.startDate) || !isValidDateOnly(params.endDate)) {
    throw new UserFacingError('Geçerli bir tarih aralığı girin.')
  }
  try {
    const snap = await getDocs(
      query(
        readingsCollection(),
        where('reportDate', '>=', params.startDate),
        where('reportDate', '<=', params.endDate),
        orderBy('reportDate', 'desc'),
        limit(1000),
      ),
    )
    return snap.docs.map((d) => d.data())
  } catch (error) {
    throw new UserFacingError(
      mapAppError(error, 'Km raporları yüklenemedi.'),
    )
  }
}

export async function upsertOdometerReading(input: {
  reportDate: string
  slot: OdometerSlot
  odometerKm: number
  note?: string | null
  /** Required for create; optional on update (keep existing photo). */
  photoFile?: File | null
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
  /** When updating, existing doc id (must be today). */
  existingId?: string | null
  onUploadProgress?: (progress: DriveUploadProgress) => void
}): Promise<string> {
  try {
    assertEditableToday(input.reportDate)

    const authUid = getFirebaseAuth().currentUser?.uid
    if (!authUid) {
      throw new UserFacingError('Oturum bulunamadı. Tekrar giriş yapın.')
    }
    if (authUid !== input.createdByUid) {
      throw new UserFacingError('Yalnızca kendi kadran raporlarınızı girebilirsiniz.')
    }

    const km = Math.floor(Number(input.odometerKm))
    if (!Number.isFinite(km) || km < 0 || km > 9_999_999) {
      throw new UserFacingError('Geçerli bir kadran km sayısı girin.')
    }

    const photoFile = input.photoFile ?? null
    if (photoFile) {
      if (!photoFile.type.startsWith('image/')) {
        throw new UserFacingError('Yalnızca görsel dosyaları yüklenebilir.')
      }
      if (photoFile.size > 8 * 1024 * 1024) {
        throw new UserFacingError('Görsel en fazla 8 MB olabilir.')
      }
    }

    const docId =
      input.existingId?.trim() ||
      readingDocId(authUid, input.reportDate, input.slot)
    const ref = doc(getDb(), 'kameramanOdometerReadings', docId)
    const existing = await getDoc(ref)

    const note =
      input.note?.trim() ? input.note.trim().slice(0, 500) : null

    if (existing.exists()) {
      const data = existing.data() as {
        createdByUid?: string
        reportDate?: string
        photoStoragePath?: string
      }
      if (data.createdByUid !== authUid) {
        throw new UserFacingError('Bu rapor size ait değil.')
      }
      if (data.reportDate !== input.reportDate) {
        throw new UserFacingError('Rapor tarihi değiştirilemez.')
      }
      const previousFileId = String(data.photoStoragePath ?? '').trim()

      if (photoFile) {
        const uploaded = await uploadOdometerPhoto({
          photoFile,
          fullName: input.createdByNameSnapshot,
          reportDate: input.reportDate,
          slot: input.slot,
          onProgress: input.onUploadProgress,
        })
        await updateDoc(ref, {
          odometerKm: km,
          note,
          photoStoragePath: uploaded.photoStoragePath,
          photoDownloadUrl: uploaded.photoDownloadUrl,
          driveFolderKey: uploaded.driveFolderKey,
          updatedAt: serverTimestamp(),
        })
        if (
          previousFileId &&
          previousFileId !== uploaded.photoStoragePath
        ) {
          void trashDriveFile(previousFileId)
        }
      } else {
        await updateDoc(ref, {
          odometerKm: km,
          note,
          updatedAt: serverTimestamp(),
        })
      }
      return docId
    }

    if (!photoFile) {
      throw new UserFacingError('Kadran görseli (PNG/JPG) zorunludur.')
    }

    const uploaded = await uploadOdometerPhoto({
      photoFile,
      fullName: input.createdByNameSnapshot,
      reportDate: input.reportDate,
      slot: input.slot,
      onProgress: input.onUploadProgress,
    })

    await setDoc(ref, {
      reportDate: input.reportDate,
      slot: input.slot,
      odometerKm: km,
      note,
      photoStoragePath: uploaded.photoStoragePath,
      photoDownloadUrl: uploaded.photoDownloadUrl,
      driveFolderKey: uploaded.driveFolderKey,
      createdByUid: authUid,
      createdByNameSnapshot: input.createdByNameSnapshot.trim().slice(0, 120),
      createdByEmailSnapshot: input.createdByEmailSnapshot.trim().slice(0, 254),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    void notifyManagement({
      type: 'odometer_report',
      title: 'Kameraman kadran raporu',
      body: `${input.createdByNameSnapshot.trim()} — ${slotLabelTr(input.slot)} · ${km.toLocaleString('tr-TR')} km · ${formatDateOnlyShortTr(input.reportDate)}`,
      link: '/coordinator?tab=field-ops',
      createdByUid: authUid,
      createdByNameSnapshot: input.createdByNameSnapshot.trim().slice(0, 120),
      pushRoles: ['management', 'coordinator'],
    })

    return docId
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(
      mapAppError(error, 'Km raporu kaydedilemedi.'),
    )
  }
}
