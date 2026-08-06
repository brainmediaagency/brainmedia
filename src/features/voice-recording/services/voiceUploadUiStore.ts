import type { DriveUploadProgress } from '@/lib/driveUpload'
import { driveUploadPhaseLabel } from '@/lib/driveUpload'

export type VoiceUploadUiSnapshot = {
  active: boolean
  label: string
  detail: string
  percent: number
  /** Matches VoiceRecordingPanel auto-save dedupe. */
  dedupeKey: string | null
}

type Listener = () => void

const listeners = new Set<Listener>()

let snapshot: VoiceUploadUiSnapshot = {
  active: false,
  label: '',
  detail: '',
  percent: 0,
  dedupeKey: null,
}

function emit(next: VoiceUploadUiSnapshot) {
  snapshot = next
  for (const listener of listeners) listener()
}

export function subscribeVoiceUploadUi(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getVoiceUploadUiSnapshot(): VoiceUploadUiSnapshot {
  return snapshot
}

/**
 * Starts upload UI if nothing is in flight for this take.
 * Returns false when this dedupeKey (or another upload) is already active.
 */
export function tryBeginVoiceUpload(input: {
  dedupeKey: string
  detail: string
}): boolean {
  if (snapshot.active) return false
  emit({
    active: true,
    label: 'Ses kaydı yükleniyor…',
    detail: input.detail,
    percent: 0,
    dedupeKey: input.dedupeKey,
  })
  return true
}

export function updateVoiceUploadProgress(
  progress: DriveUploadProgress,
  detailFallback: string,
): void {
  if (!snapshot.active) return
  emit({
    ...snapshot,
    label: driveUploadPhaseLabel(progress.phase),
    detail: progress.fileName || detailFallback || snapshot.detail,
    percent: Math.round(Math.min(1, Math.max(0, progress.ratio)) * 100),
  })
}

export function endVoiceUpload(dedupeKey?: string | null): void {
  if (dedupeKey != null && snapshot.dedupeKey && snapshot.dedupeKey !== dedupeKey) {
    return
  }
  if (!snapshot.active && snapshot.dedupeKey === null) return
  emit({
    active: false,
    label: '',
    detail: '',
    percent: 0,
    dedupeKey: null,
  })
}

/** True when this take is already mid-upload (survives panel remount). */
export function isVoiceUploadInFlight(dedupeKey: string | null): boolean {
  if (!dedupeKey) return false
  return snapshot.active && snapshot.dedupeKey === dedupeKey
}
