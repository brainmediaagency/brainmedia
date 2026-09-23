import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
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
  base64ToUint8Array,
  isDriveUploadConfigured,
  postWebhookForm,
  trashDriveFile,
  uploadFileToDrive,
  type DriveUploadProgress,
} from '@/lib/driveUpload'
import { todayDateOnlyIstanbul } from '@/lib/date'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { writeActivityLogForCurrentUser } from '@/features/activity-log/services/activityLogService'
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

export function isVoiceUploadConfigured(): boolean {
  return isDriveUploadConfigured()
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

/** Drive embed — no CORS. Used when webhook playback is unavailable. */
export function voiceRecordingDrivePreviewUrl(fileId: string): string {
  const id = fileId.trim()
  if (!id) return ''
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`
}

export function voiceRecordingPlaybackUrl(
  item: Pick<VoiceRecordingDoc, 'driveFileId' | 'url'>,
): string {
  return voiceRecordingDrivePreviewUrl(item.driveFileId) || item.url
}

const objectUrlByFileId = new Map<string, Promise<string>>()

/**
 * Same-origin blob via Apps Script `getDriveFile` (v31+).
 * Direct Drive fetch is 403/CORS from the Vercel origin.
 */
export function loadVoiceRecordingObjectUrl(
  item: Pick<VoiceRecordingDoc, 'driveFileId' | 'mimeType'>,
): Promise<string> {
  const id = item.driveFileId.trim()
  if (!id) {
    return Promise.reject(new Error('missing voice file'))
  }
  const cached = objectUrlByFileId.get(id)
  if (cached) return cached

  const promise = (async () => {
    const parsed = await postWebhookForm({
      action: 'getDriveFile',
      fileId: id,
    })
    const b64 = typeof parsed.base64 === 'string' ? parsed.base64 : ''
    if (parsed.ok !== true || !b64) {
      throw new Error('voice webhook playback unavailable')
    }
    const bytes = base64ToUint8Array(b64)
    if (bytes.byteLength <= 0) {
      throw new Error('empty audio')
    }
    const type =
      (typeof parsed.mimeType === 'string' && parsed.mimeType.trim()) ||
      item.mimeType.trim() ||
      'audio/mp4'
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    return URL.createObjectURL(new Blob([copy], { type }))
  })()

  objectUrlByFileId.set(id, promise)
  void promise.catch(() => {
    objectUrlByFileId.delete(id)
  })
  return promise
}

function createdAtMillis(item: VoiceRecordingDoc): number {
  return item.createdAt?.toMillis?.() ?? 0
}

/** Map recordings onto jobs for çekim takvimi chips + detail. */
export function groupVoiceRecordingsByJobId(
  items: VoiceRecordingDoc[],
): Map<string, VoiceRecordingDoc[]> {
  const map = new Map<string, VoiceRecordingDoc[]>()
  for (const item of items) {
    const id = item.jobId?.trim()
    if (!id) continue
    const list = map.get(id)
    if (list) list.push(item)
    else map.set(id, [item])
  }
  for (const list of map.values()) {
    list.sort((a, b) => createdAtMillis(a) - createdAtMillis(b))
  }
  return map
}

/** Recordings saved against a job (çekim takvimi detayı). No composite index. */
export function subscribeVoiceRecordingsForJob(
  jobId: string,
  onData: (items: VoiceRecordingDoc[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const id = jobId.trim()
  if (!id) {
    onData([])
    return () => {}
  }
  const q = query(recordingsCollection(), where('jobId', '==', id), limit(20))
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data())
      items.sort((a, b) => createdAtMillis(a) - createdAtMillis(b))
      onData(items)
    },
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
  if (!isDriveUploadConfigured()) {
    throw new UserFacingError(
      'Dosya yükleme yapılandırılmamış. Apps Script webhook URL eksik.',
    )
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
        void trashDriveFile(drive.fileId)
        throw new UserFacingError(
          mapAppError(
            firestoreError,
            'Dosya Drive’a yüklendi ancak ses kayıtları listesine yazılamadı. Tekrar kaydetmeyi deneyin.',
          ),
        )
      }

      writeActivityLogForCurrentUser({
        category: 'field',
        action: 'field.voice_created',
        summary: companyName,
        jobId: input.jobId?.trim() || null,
        jobCompanyName: companyName,
        entityType: 'voice',
        entityId: refDoc.id,
        actorNameFallback: createdByNameSnapshot,
      })

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

    const refDoc = doc(getDb(), 'voiceRecordings', id)
    const snap = await getDoc(refDoc)
    if (!snap.exists()) {
      throw new UserFacingError('Ses kaydı bulunamadı.')
    }
    const data = snap.data() as {
      driveFileId?: string
      companyName?: string
      jobId?: string | null
    }
    const fileId = String(data.driveFileId ?? '').trim()
    const companyName = String(data.companyName ?? '').trim()

    await deleteDoc(refDoc)
    if (fileId) void trashDriveFile(fileId)
    writeActivityLogForCurrentUser({
      category: 'field',
      action: 'field.voice_deleted',
      summary: companyName || 'Ses kaydı',
      jobId: typeof data.jobId === 'string' ? data.jobId.trim() || null : null,
      jobCompanyName: companyName || null,
      entityType: 'voice',
      entityId: id,
    })
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Ses kaydı silinemedi.'))
  }
}

export function voiceRecordingTitle(item: VoiceRecordingDoc): string {
  return `${item.recordedAtDate} · ${item.companyName}`
}
