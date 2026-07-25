import type { Timestamp } from 'firebase/firestore'

export interface HrReport {
  id: string
  title: string
  body: string
  createdByUid: string
  createdByNameSnapshot: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface HiringNoteAttachment {
  id: string
  name: string
  size: number
  mimeType: string
  /** Google Drive file id (Firebase Storage kullanılmaz). */
  driveFileId: string
  /** Açılabilir / görüntülenebilir URL (Drive). */
  url: string
  /** Eski Firebase Storage kayıtları için opsiyonel. */
  storagePath?: string
}

export interface HiringNote {
  id: string
  candidateName: string
  note: string
  attachments: HiringNoteAttachment[]
  createdByUid: string
  createdByNameSnapshot: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
