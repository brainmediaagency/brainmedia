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
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import { getFirebaseAuth } from '@/lib/firebase/auth'
import {
  trashDriveFile,
  uploadFileToDrive,
  type DriveUploadProgress,
} from '@/lib/driveUpload'
import { todayDateOnlyIstanbul } from '@/lib/date'
import { UserFacingError, mapAppError } from '@/lib/errors'
import type { VoiceRecordingDoc } from '@/features/voice-recording/types/voiceRecording'

const converter: FirestoreDataConverter<VoiceRecordingDoc> = {
  toFirestore(item: VoiceRecordingDoc): DocumentData {
    const { id: _id, ...rest } = item
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): VoiceRecordingDoc {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      companyName: String(data.companyName ?? ''),
      jobId:
        data.jobId === null || data.jobId === undefined
          ? null
          : String(data.jobId),
      recordedAtDate: String(data.recordedAtDate ?? ''),
      durationMs: Number(data.durationMs ?? 0),
      mimeType: String(data.mimeType ?? 'audio/webm'),
      size: Number(data.size ?? 0),
      driveFileId: String(data.driveFileId ?? ''),
      url: String(data.url ?? ''),
      webViewLink: String(data.webViewLink ?? data.url ?? ''),
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
    }
  },
}

function recordingsCollection() {
  return collection(getDb(), 'voiceRecordings').withConverter(converter)
}

export function subscribeVoiceRecordings(
  onData: (items: VoiceRecordingDoc[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(recordingsCollection(), orderBy('createdAt', 'desc'), limit(200))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

/** Same Blob object coalesces concurrent saves (double-click / Strict Mode). */
const inFlightByBlob = new WeakMap<Blob, Promise<string>>()

export async function saveVoiceRecording(input: {
  blob: Blob
  mimeType: string
  durationMs: number
  companyName: string
  jobId?: string | null
  createdByUid: string
  createdByNameSnapshot: string
  onUploadProgress?: (progress: DriveUploadProgress) => void
}): Promise<string> {
  const companyName = input.companyName.trim()
  if (!companyName) {
    throw new UserFacingError('Firma adı olmadan ses kaydı kaydedilemez.')
  }
  if (input.blob.size <= 0) {
    throw new UserFacingError('Kayıt dosyası boş.')
  }

  const authUid = getFirebaseAuth().currentUser?.uid
  if (!authUid) {
    throw new UserFacingError('Oturum bulunamadı. Tekrar giriş yapın.')
  }
  // Auth uid is authoritative for rules; ignore stale profile.uid mismatches.
  const createdByUid = authUid
  const createdByNameSnapshot = input.createdByNameSnapshot.trim().slice(0, 120)
  if (!createdByNameSnapshot) {
    throw new UserFacingError('Kayıt için kullanıcı adı gerekli.')
  }

  const existing = inFlightByBlob.get(input.blob)
  if (existing) return existing

  let settle!: {
    resolve: (id: string) => void
    reject: (error: unknown) => void
  }
  const savePromise = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject }
  })
  // Register before any await so a second sync caller joins this promise.
  inFlightByBlob.set(input.blob, savePromise)

  void (async () => {
    try {
      const refDoc = doc(collection(getDb(), 'voiceRecordings'))
      const dateOnly = todayDateOnlyIstanbul()
      const ext = input.mimeType.includes('ogg')
        ? 'ogg'
        : input.mimeType.includes('mp4')
          ? 'm4a'
          : 'webm'
      const fileName = `${dateOnly}_${companyName.slice(0, 40).replace(/\s+/g, '_')}_${refDoc.id.slice(0, 8)}.${ext}`

      const drive = await uploadFileToDrive({
        file: input.blob,
        fileName,
        mimeType: input.mimeType || 'audio/webm',
        folder: 'voice-recordings',
        onProgress: input.onUploadProgress,
      })

      try {
        await setDoc(refDoc, {
          companyName,
          jobId: input.jobId?.trim() || null,
          recordedAtDate: dateOnly,
          durationMs: Math.max(0, Math.round(input.durationMs)),
          mimeType: (input.mimeType || 'audio/webm').slice(0, 100),
          size: input.blob.size,
          driveFileId: drive.fileId,
          url: drive.url,
          webViewLink: drive.webViewLink,
          createdByUid,
          createdByNameSnapshot,
          createdAt: serverTimestamp(),
        })
      } catch (firestoreError) {
        throw new UserFacingError(
          mapAppError(
            firestoreError,
            'Dosya Drive’a yüklendi ancak ses kayıtları listesine yazılamadı. Tekrar kaydetmeyi deneyin.',
          ),
        )
      }

      settle.resolve(refDoc.id)
    } catch (error) {
      if (error instanceof UserFacingError) {
        settle.reject(error)
      } else {
        settle.reject(
          new UserFacingError(mapAppError(error, 'Ses kaydı kaydedilemedi.')),
        )
      }
    } finally {
      inFlightByBlob.delete(input.blob)
    }
  })()

  return savePromise
}

/**
 * Yönetim / koordinatör: listeden kaydı siler + Drive dosyasını trash’ler.
 * Firestore rules: isCoordinatorOrManagement().
 */
export async function deleteVoiceRecording(recordingId: string): Promise<void> {
  try {
    const authUid = getFirebaseAuth().currentUser?.uid
    if (!authUid) {
      throw new UserFacingError('Oturum bulunamadı. Tekrar giriş yapın.')
    }
    const id = recordingId.trim()
    if (!id) throw new UserFacingError('Kayıt bulunamadı.')

    const ref = doc(getDb(), 'voiceRecordings', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      throw new UserFacingError('Ses kaydı bulunamadı.')
    }
    const data = snap.data() as { driveFileId?: string }
    const fileId = String(data.driveFileId ?? '').trim()

    await deleteDoc(ref)
    if (fileId) void trashDriveFile(fileId)
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Ses kaydı silinemedi.'))
  }
}

export function voiceRecordingTitle(item: VoiceRecordingDoc): string {
  return `${item.recordedAtDate} · ${item.companyName}`
}
