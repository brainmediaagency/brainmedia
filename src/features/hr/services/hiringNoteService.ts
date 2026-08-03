import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  setDoc,
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
import type {
  HiringNote,
  HiringNoteAttachment,
} from '@/features/hr/types/hr'
import { DEFAULT_LIST_LIMIT } from '@/config/roles'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { uploadFileToDrive, type DriveUploadProgress } from '@/lib/driveUpload'
import { notifyManagement } from '@/features/notifications/services/notificationService'

export const MAX_HIRING_NOTE_FILES = 10
export const MAX_HIRING_NOTE_FILE_BYTES = 20 * 1024 * 1024
export const MAX_HIRING_NOTE_FILE_MB = MAX_HIRING_NOTE_FILE_BYTES / (1024 * 1024)

/** @deprecated use MAX_HIRING_NOTE_FILES */
export const MAX_HIRING_NOTE_PDFS = MAX_HIRING_NOTE_FILES
/** @deprecated use MAX_HIRING_NOTE_FILE_BYTES */
export const MAX_HIRING_NOTE_PDF_BYTES = MAX_HIRING_NOTE_FILE_BYTES
/** @deprecated use MAX_HIRING_NOTE_FILE_MB */
export const MAX_HIRING_NOTE_PDF_MB = MAX_HIRING_NOTE_FILE_MB

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

function isAllowedHiringFile(file: File): boolean {
  const name = file.name.toLowerCase()
  if (ALLOWED_MIME.has(file.type)) return true
  return (
    name.endsWith('.pdf')
    || name.endsWith('.png')
    || name.endsWith('.jpg')
    || name.endsWith('.jpeg')
    || name.endsWith('.webp')
  )
}

function resolveMimeType(file: File): string {
  if (file.type && ALLOWED_MIME.has(file.type)) {
    return file.type === 'image/jpg' ? 'image/jpeg' : file.type
  }
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

function parseAttachments(value: unknown): HiringNoteAttachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const attachment = item as Record<string, unknown>
    if (
      typeof attachment.id !== 'string'
      || typeof attachment.name !== 'string'
      || typeof attachment.size !== 'number'
    ) {
      return []
    }

    const driveFileId =
      typeof attachment.driveFileId === 'string' ? attachment.driveFileId : ''
    const url = typeof attachment.url === 'string' ? attachment.url : ''
    const storagePath =
      typeof attachment.storagePath === 'string' ? attachment.storagePath : undefined
    const mimeType =
      typeof attachment.mimeType === 'string'
        ? attachment.mimeType
        : 'application/pdf'

    // Legacy Storage-only rows: keep listed but without Drive URL.
    if (!driveFileId && !url && !storagePath) return []

    return [{
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      mimeType,
      driveFileId: driveFileId || storagePath || '',
      url: url || '',
      ...(storagePath ? { storagePath } : {}),
    }]
  })
}

const hiringNoteConverter: FirestoreDataConverter<HiringNote> = {
  toFirestore(note: HiringNote): DocumentData {
    const { id: _id, ...rest } = note
    return rest
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): HiringNote {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      candidateName: String(data.candidateName ?? ''),
      note: String(data.note ?? ''),
      attachments: parseAttachments(data.attachments),
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

function validateFiles(files: File[], existingCount = 0): void {
  if (existingCount + files.length > MAX_HIRING_NOTE_FILES) {
    throw new UserFacingError(
      `Bir nota en fazla ${MAX_HIRING_NOTE_FILES} dosya eklenebilir.`,
    )
  }
  for (const file of files) {
    if (!isAllowedHiringFile(file)) {
      throw new UserFacingError('Yalnızca PDF veya PNG/JPG dosyaları eklenebilir.')
    }
    if (file.size > MAX_HIRING_NOTE_FILE_BYTES) {
      throw new UserFacingError(
        `${file.name} ${MAX_HIRING_NOTE_FILE_MB} MB sınırını aşıyor.`,
      )
    }
  }
}

async function uploadAttachments(
  files: File[],
  onProgress?: (progress: {
    fileIndex: number
    fileCount: number
    fileName: string
    phase: DriveUploadProgress['phase']
    ratio: number
  }) => void,
): Promise<HiringNoteAttachment[]> {
  validateFiles(files)
  const uploaded: HiringNoteAttachment[] = []
  const fileCount = files.length
  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const file = files[fileIndex]!
    const id = crypto.randomUUID()
    const mimeType = resolveMimeType(file)
    const safeName = file.name.replace(/[^\w.\-ğüşıöçĞÜŞİÖÇ]+/gi, '_').slice(0, 120)
    const drive = await uploadFileToDrive({
      file,
      fileName: safeName || `${id}.bin`,
      mimeType,
      folder: 'hiring',
      onProgress: (progress) => {
        onProgress?.({
          fileIndex,
          fileCount,
          fileName: file.name,
          phase: progress.phase,
          ratio: progress.ratio,
        })
      },
    })
    uploaded.push({
      id,
      name: file.name,
      size: file.size,
      mimeType,
      driveFileId: drive.fileId,
      url: drive.webViewLink || drive.url,
    })
  }
  return uploaded
}

function notesCollection() {
  return collection(getDb(), 'hiringNotes').withConverter(hiringNoteConverter)
}

function dayStart(dateOnly: string) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEnd(dateOnly: string) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

export function subscribeOwnHiringNotes(
  uid: string,
  onData: (notes: HiringNote[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    notesCollection(),
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

export function subscribeAllHiringNotes(
  onData: (notes: HiringNote[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    notesCollection(),
    orderBy('updatedAt', 'desc'),
    limit(50),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => onError?.(err),
  )
}

export async function fetchHiringNotesInRange(range: {
  startDate: string
  endDate: string
}): Promise<HiringNote[]> {
  try {
    const snap = await getDocs(
      query(
        notesCollection(),
        where('createdAt', '>=', dayStart(range.startDate)),
        where('createdAt', '<=', dayEnd(range.endDate)),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
    )
    return snap.docs.map((d) => d.data())
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'İşe alım notları yüklenemedi.'))
  }
}

export async function createHiringNote(input: {
  candidateName: string
  note: string
  pdfFiles: File[]
  createdByUid: string
  createdByNameSnapshot: string
  onUploadProgress?: (progress: {
    fileIndex: number
    fileCount: number
    fileName: string
    phase: DriveUploadProgress['phase']
    ratio: number
  }) => void
}): Promise<string> {
  const noteRef = doc(collection(getDb(), 'hiringNotes'))
  try {
    validateFiles(input.pdfFiles)
    const attachments = await uploadAttachments(
      input.pdfFiles,
      input.onUploadProgress,
    )
    await setDoc(noteRef, {
      candidateName: input.candidateName.trim(),
      note: input.note.trim(),
      attachments,
      createdByUid: input.createdByUid,
      createdByNameSnapshot: input.createdByNameSnapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    void notifyManagement({
      type: 'hiring_note',
      title: 'Yeni CV / işe alım notu',
      body: `${input.candidateName.trim()} — ${input.createdByNameSnapshot}`,
      link: '/human-resources?tab=interviews',
      createdByUid: input.createdByUid,
      createdByNameSnapshot: input.createdByNameSnapshot,
      pushRoles: ['management'],
    })

    return noteRef.id
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'İşe alım notu gönderilemedi.'))
  }
}

export async function updateHiringNote(input: {
  id: string
  candidateName: string
  note: string
  pdfFiles: File[]
  existingAttachments: HiringNoteAttachment[]
  ownerUid: string
  onUploadProgress?: (progress: {
    fileIndex: number
    fileCount: number
    fileName: string
    phase: DriveUploadProgress['phase']
    ratio: number
  }) => void
}): Promise<void> {
  try {
    validateFiles(input.pdfFiles, input.existingAttachments.length)
    const addedAttachments = await uploadAttachments(
      input.pdfFiles,
      input.onUploadProgress,
    )
    await updateDoc(doc(getDb(), 'hiringNotes', input.id), {
      candidateName: input.candidateName.trim(),
      note: input.note.trim(),
      attachments: [...input.existingAttachments, ...addedAttachments],
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'İşe alım notu güncellenemedi.'))
  }
}

/** Direct Google Drive download URL (avoids /view which often needs a signed-in session). */
export function hiringNoteDriveDownloadUrl(driveFileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`
}

export async function getHiringNoteAttachmentUrl(
  attachment: HiringNoteAttachment | string,
): Promise<string> {
  if (typeof attachment === 'string') {
    throw new UserFacingError(
      'Bu ek eski Storage kaydı; Drive bağlantısı yok. Yeniden yükleyin.',
    )
  }
  if (attachment.driveFileId) {
    return hiringNoteDriveDownloadUrl(attachment.driveFileId)
  }
  if (attachment.url) return attachment.url
  throw new UserFacingError('Dosya bağlantısı bulunamadı.')
}
