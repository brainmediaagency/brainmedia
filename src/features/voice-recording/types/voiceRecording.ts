import type { Timestamp } from 'firebase/firestore'

export type VoiceRecordingDoc = {
  id: string
  companyName: string
  jobId: string | null
  recordedAtDate: string
  durationMs: number
  mimeType: string
  size: number
  driveFileId: string
  url: string
  webViewLink: string
  createdByUid: string
  createdByNameSnapshot: string
  createdAt: Timestamp | null
}
