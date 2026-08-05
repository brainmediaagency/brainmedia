/**
 * Session-scoped MediaRecorder engine that survives React remounts
 * (drawer re-open, Strict Mode, parent key churn). Recording continues
 * until the user stops (or the OS reclaims the mic).
 */
import {
  releaseScreenWakeLock,
  requestScreenWakeLock,
  type ScreenWakeLock,
} from '@/lib/screenWakeLock'

export const MAX_RECORDING_MS: number | null = null

/** Chunk interval: continuous flush so stop never depends on a single empty blob. */
export const VOICE_CHUNK_INTERVAL_MS = 1000

export type VoiceRecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'stopped'

export type VoiceRecorderErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'no_microphone'
  | 'start_failed'
  | 'stream_ended'

export type VoiceRecording = {
  blob: Blob
  url: string
  mimeType: string
  durationMs: number
  createdAt: number
}

export type VoiceStopReason = 'manual' | 'stream_ended'

export type VoiceEngineSnapshot = {
  status: VoiceRecorderStatus
  elapsedMs: number
  error: VoiceRecorderErrorCode | null
  recording: VoiceRecording | null
  stoppedReason: VoiceStopReason | null
  supported: boolean
  supportsPauseResume: boolean
}

type Listener = () => void

function isAppleMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = isAppleMobileBrowser()
    ? [
        'audio/mp4',
        'audio/aac',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/webm;codecs=opus',
        'audio/webm',
      ]
    : [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ]
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type)
    } catch {
      return false
    }
  })
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  return 'webm'
}

function mapGetUserMediaError(error: unknown): VoiceRecorderErrorCode {
  if (!(error instanceof DOMException)) return 'start_failed'
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return 'permission_denied'
  }
  if (
    error.name === 'NotFoundError' ||
    error.name === 'DevicesNotFoundError' ||
    error.name === 'OverconstrainedError'
  ) {
    return 'no_microphone'
  }
  return 'start_failed'
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

export function voiceRecorderErrorMessage(code: VoiceRecorderErrorCode): string {
  switch (code) {
    case 'unsupported':
      return 'Tarayıcınız ses kaydını desteklemiyor. Güncel bir Chrome, Edge veya Firefox deneyin.'
    case 'permission_denied':
      return 'Mikrofon izni reddedildi. Tarayıcı ayarlarından mikrofon erişimine izin verin.'
    case 'no_microphone':
      return 'Mikrofon bulunamadı. Cihaza bir mikrofon bağlayıp tekrar deneyin.'
    case 'start_failed':
      return 'Ses kaydı başlatılamadı. Lütfen tekrar deneyin.'
    case 'stream_ended':
      return 'Mikrofon cihaz tarafından kesildi (arama / arka plan). O ana kadar alınan ses korundu; Kaydet’e basabilirsiniz.'
  }
}

/** Unit-test helper: chunked start (interval argument). */
export function mediaRecorderStartArgs(
  intervalMs: number = VOICE_CHUNK_INTERVAL_MS,
): [number] {
  return [intervalMs]
}

export function clampRecordingDurationMs(
  elapsedMs: number,
  maxMs: number | null = MAX_RECORDING_MS,
): number {
  const safe = Math.max(0, elapsedMs)
  if (maxMs === null || !Number.isFinite(maxMs)) return safe
  return Math.min(safe, maxMs)
}

export function downloadVoiceRecording(recording: VoiceRecording): void {
  const ext = extensionForMime(recording.mimeType)
  const stamp = new Date(recording.createdAt)
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19)
  const anchor = document.createElement('a')
  anchor.href = recording.url
  anchor.download = `ses-kaydi-${stamp}.${ext}`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

class VoiceRecorderEngine {
  private listeners = new Set<Listener>()
  private status: VoiceRecorderStatus = 'idle'
  private elapsedMs = 0
  private error: VoiceRecorderErrorCode | null = null
  private recording: VoiceRecording | null = null
  private stoppedReason: VoiceStopReason | null = null

  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private mimeType = 'audio/webm'
  private elapsedBase = 0
  private segmentStartedAt: number | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private recordingUrl: string | null = null
  private stopReason: VoiceStopReason = 'manual'
  private wakeLock: ScreenWakeLock | null = null
  private sessionId = 0
  private starting = false
  private finalizeTimer: ReturnType<typeof setTimeout> | null = null
  private totalBytes = 0

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): VoiceEngineSnapshot {
    return {
      status: this.status,
      elapsedMs: this.elapsedMs,
      error: this.error,
      recording: this.recording,
      stoppedReason: this.stoppedReason,
      supported: isVoiceRecordingSupported(),
      supportsPauseResume:
        typeof MediaRecorder !== 'undefined' &&
        typeof MediaRecorder.prototype.pause === 'function' &&
        typeof MediaRecorder.prototype.resume === 'function',
    }
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }

  private setStatus(next: VoiceRecorderStatus) {
    this.status = next
    this.emit()
  }

  private readElapsedMs(): number {
    const segment =
      this.segmentStartedAt === null ? 0 : Date.now() - this.segmentStartedAt
    return this.elapsedBase + segment
  }

  private stopTick() {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  private startTick() {
    this.stopTick()
    this.tickTimer = setInterval(() => {
      this.elapsedMs = this.readElapsedMs()
      this.emit()
    }, 250)
  }

  private async acquireWakeLock() {
    if (this.wakeLock && !this.wakeLock.released) return
    this.wakeLock = await requestScreenWakeLock()
  }

  private releaseWakeLock() {
    const lock = this.wakeLock
    this.wakeLock = null
    void releaseScreenWakeLock(lock)
  }

  private releaseStream() {
    this.stream?.getTracks().forEach((track) => {
      try {
        track.onended = null
        track.stop()
      } catch {
        /* ignore */
      }
    })
    this.stream = null
  }

  private clearRecordingUrl() {
    if (this.recordingUrl) {
      URL.revokeObjectURL(this.recordingUrl)
      this.recordingUrl = null
    }
  }

  private clearFinalizeTimer() {
    if (this.finalizeTimer !== null) {
      clearTimeout(this.finalizeTimer)
      this.finalizeTimer = null
    }
  }

  private assembleBlob(): Blob {
    return new Blob(this.chunks, { type: this.mimeType })
  }

  private finalize(blob: Blob, durationMs: number, reason: VoiceStopReason) {
    this.clearRecordingUrl()
    const url = URL.createObjectURL(blob)
    this.recordingUrl = url
    this.recording = {
      blob,
      url,
      mimeType: blob.type || this.mimeType,
      durationMs,
      createdAt: Date.now(),
    }
    this.stoppedReason = reason
    this.status = 'stopped'
    this.elapsedMs = durationMs
    // OS cut still surfaces a non-blocking note, but recording payload is kept.
    this.error = reason === 'stream_ended' ? 'stream_ended' : null
    this.mediaRecorder = null
    this.releaseWakeLock()
    this.releaseStream()
    this.chunks = []
    this.totalBytes = 0
    this.emit()
  }

  private finishSession(reason: VoiceStopReason) {
    this.stopTick()
    this.clearFinalizeTimer()
    const durationMs = clampRecordingDurationMs(this.readElapsedMs())
    this.elapsedBase = durationMs
    this.segmentStartedAt = null
    this.stopReason = reason

    // Poll briefly so any late dataavailable joins the chunk list.
    let attempts = 0
    const tryCommit = () => {
      attempts += 1
      const blob = this.assembleBlob()
      if (blob.size > 0 || attempts >= 8) {
        this.finalizeTimer = null
        if (blob.size <= 0) {
          // Should be rare: keep UI from pretending start failed after a long take.
          // Retry once by waiting for any residual chunks is already done.
          this.error = 'start_failed'
          this.status = 'idle'
          this.recording = null
          this.stoppedReason = null
          this.elapsedMs = 0
          this.mediaRecorder = null
          this.chunks = []
          this.totalBytes = 0
          this.releaseWakeLock()
          this.releaseStream()
          this.emit()
          return
        }
        this.finalize(blob, durationMs, reason)
        return
      }
      this.finalizeTimer = setTimeout(tryCommit, 50)
    }
    tryCommit()
  }

  private wireRecorder(recorder: MediaRecorder, sessionId: number) {
    recorder.ondataavailable = (event) => {
      if (sessionId !== this.sessionId) return
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data)
        this.totalBytes += event.data.size
      }
    }

    recorder.onstop = () => {
      if (sessionId !== this.sessionId) return
      this.finishSession(this.stopReason)
    }

    recorder.onerror = () => {
      if (sessionId !== this.sessionId) return
      // Prefer salvaging buffered audio over hard failure mid-session.
      this.stopTick()
      const blob = this.assembleBlob()
      if (blob.size > 0) {
        this.finishSession('stream_ended')
        return
      }
      this.error = 'start_failed'
      this.status = 'idle'
      this.mediaRecorder = null
      this.releaseWakeLock()
      this.releaseStream()
      this.chunks = []
      this.totalBytes = 0
      this.emit()
    }
  }

  async start(): Promise<void> {
    if (this.starting) return
    if (this.status === 'recording' || this.status === 'paused') return
    if (this.status === 'requesting') return

    this.error = null
    this.stoppedReason = null
    this.clearFinalizeTimer()

    if (!isVoiceRecordingSupported()) {
      this.error = 'unsupported'
      this.emit()
      return
    }

    this.starting = true
    this.status = 'requesting'
    this.emit()
    const sessionId = ++this.sessionId

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      if (sessionId !== this.sessionId) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      this.stream = stream
      const mimeType = pickMimeType()
      this.mimeType = mimeType ?? 'audio/webm'
      this.chunks = []
      this.totalBytes = 0
      this.clearRecordingUrl()
      this.recording = null

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      this.mediaRecorder = recorder
      this.wireRecorder(recorder, sessionId)

      for (const track of stream.getAudioTracks()) {
        track.onended = () => {
          if (sessionId !== this.sessionId) return
          const rec = this.mediaRecorder
          if (!rec || rec.state === 'inactive') return
          this.stopReason = 'stream_ended'
          try {
            if (rec.state === 'paused' && typeof rec.resume === 'function') {
              rec.resume()
            }
            rec.stop()
          } catch {
            this.finishSession('stream_ended')
          }
        }
      }

      this.elapsedBase = 0
      this.segmentStartedAt = Date.now()
      this.stopReason = 'manual'
      this.elapsedMs = 0
      // Continuous chunks: no dependency on a single flush at stop().
      recorder.start(...mediaRecorderStartArgs())
      this.status = 'recording'
      this.startTick()
      void this.acquireWakeLock()
      this.emit()
    } catch (err) {
      this.releaseWakeLock()
      this.releaseStream()
      this.mediaRecorder = null
      this.error = mapGetUserMediaError(err)
      this.status = 'idle'
      this.emit()
    } finally {
      this.starting = false
    }
  }

  pause(): void {
    const recorder = this.mediaRecorder
    if (!recorder || recorder.state !== 'recording') return
    if (typeof recorder.pause !== 'function') return
    recorder.pause()
    this.elapsedBase = this.readElapsedMs()
    this.segmentStartedAt = null
    this.stopTick()
    this.releaseWakeLock()
    this.elapsedMs = this.elapsedBase
    this.setStatus('paused')
  }

  resume(): void {
    const recorder = this.mediaRecorder
    if (!recorder || recorder.state !== 'paused') return
    if (typeof recorder.resume !== 'function') return
    this.segmentStartedAt = Date.now()
    recorder.resume()
    this.setStatus('recording')
    this.startTick()
    void this.acquireWakeLock()
  }

  stop(): void {
    const recorder = this.mediaRecorder
    if (!recorder || recorder.state === 'inactive') return
    this.stopReason = 'manual'
    if (this.segmentStartedAt !== null) {
      this.elapsedBase = this.readElapsedMs()
      this.segmentStartedAt = null
    }
    this.stopTick()
    try {
      if (recorder.state === 'paused' && typeof recorder.resume === 'function') {
        recorder.resume()
      }
      // Never requestData() — races with stop on some mobiles.
      recorder.stop()
    } catch {
      this.finishSession('manual')
    }
  }

  clearRecording(): void {
    this.clearFinalizeTimer()
    this.clearRecordingUrl()
    this.recording = null
    this.stoppedReason = null
    this.error = null
    this.elapsedMs = 0
    this.status = 'idle'
    this.emit()
  }

  /** Re-acquire wake lock when tab becomes visible mid-recording. */
  onVisibilityVisible(): void {
    if (this.status === 'recording') void this.acquireWakeLock()
  }
}

/** Module singleton — one live capture session for the app. */
export const voiceRecorderEngine = new VoiceRecorderEngine()
