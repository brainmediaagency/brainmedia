import { useCallback, useEffect, useRef, useState } from 'react'
import {
  releaseScreenWakeLock,
  requestScreenWakeLock,
  type ScreenWakeLock,
} from '@/lib/screenWakeLock'

/**
 * Upper bound for a single take. `null` = unlimited (user stops manually).
 * Soft OS limits (mic reclaim, tab sleep) still apply — see stream_ended.
 */
export const MAX_RECORDING_MS: number | null = null

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

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
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
      return 'Mikrofon bağlantısı kesildi (telefon araması, arka plan veya tarayıcı kısıtı). Kayıt durdu — mümkünse ekranı açık tutup tekrar deneyin.'
  }
}

/** Pure helpers — unit-tested without MediaRecorder / push. */
export function mediaRecorderStartArgs(): [] {
  // Never pass timeslice: mobile engines often truncate after ~1–2 min.
  return []
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

export function useVoiceRecorder() {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<VoiceRecorderErrorCode | null>(null)
  const [recording, setRecording] = useState<VoiceRecording | null>(null)
  const [stoppedReason, setStoppedReason] = useState<VoiceStopReason | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const mimeTypeRef = useRef('audio/webm')
  const elapsedBaseRef = useRef(0)
  const segmentStartedAtRef = useRef<number | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingUrlRef = useRef<string | null>(null)
  const stopReasonRef = useRef<VoiceStopReason>('manual')
  const aliveRef = useRef(true)
  const wakeLockRef = useRef<ScreenWakeLock | null>(null)
  /** Buffers finalization across React Strict Mode / drawer remounts. */
  const sessionEpochRef = useRef(0)

  const acquireWakeLock = useCallback(async () => {
    if (wakeLockRef.current && !wakeLockRef.current.released) return
    wakeLockRef.current = await requestScreenWakeLock()
  }, [])

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current
    wakeLockRef.current = null
    void releaseScreenWakeLock(lock)
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      try {
        track.onended = null
        track.onmute = null
        track.stop()
      } catch {
        /* ignore */
      }
    })
    streamRef.current = null
  }, [])

  const clearRecordingUrl = useCallback(() => {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current)
      recordingUrlRef.current = null
    }
  }, [])

  const readElapsedMs = useCallback(() => {
    const segment =
      segmentStartedAtRef.current === null
        ? 0
        : Date.now() - segmentStartedAtRef.current
    return elapsedBaseRef.current + segment
  }, [])

  const stopTick = useCallback(() => {
    if (tickTimerRef.current !== null) {
      clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
  }, [])

  const startTick = useCallback(() => {
    stopTick()
    tickTimerRef.current = setInterval(() => {
      setElapsedMs(readElapsedMs())
    }, 250)
  }, [readElapsedMs, stopTick])

  const finalizeRecording = useCallback(
    (blob: Blob, durationMs: number, reason: VoiceStopReason) => {
      clearRecordingUrl()
      const url = URL.createObjectURL(blob)
      recordingUrlRef.current = url
      setRecording({
        blob,
        url,
        mimeType: blob.type || mimeTypeRef.current,
        durationMs,
        createdAt: Date.now(),
      })
      setStoppedReason(reason)
      setStatus('stopped')
      setElapsedMs(durationMs)
      if (reason === 'stream_ended') {
        setError('stream_ended')
      }
    },
    [clearRecordingUrl],
  )

  const start = useCallback(async () => {
    setError(null)
    setStoppedReason(null)

    if (!isVoiceRecordingSupported()) {
      setError('unsupported')
      return
    }

    setStatus('requesting')
    const epoch = ++sessionEpochRef.current

    try {
      // Prefer continuous mono voice capture; avoid aggressive constraints that
      // some mobiles drop after ~1–2 minutes.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          // ChannelCount omitted on purpose — forced mono breaks some devices.
        },
      })
      if (sessionEpochRef.current !== epoch || !aliveRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream

      const mimeType = pickMimeType()
      mimeTypeRef.current = mimeType ?? 'audio/webm'
      chunksRef.current = []

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      /**
       * IMPORTANT: Do NOT pass a timeslice to `start()`.
       * On many mobile browsers (esp. Safari / Chrome Android) periodic
       * timeslices drop or truncate audio after ~1–2 minutes. Buffer until
       * explicit stop so the full session is one (or a few) reliable chunks.
       */
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      const finishFromRecorder = () => {
        stopTick()
        releaseWakeLock()
        segmentStartedAtRef.current = null
        const durationMs = clampRecordingDurationMs(readElapsedMs())
        elapsedBaseRef.current = durationMs
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current,
        })
        chunksRef.current = []
        releaseStream()
        mediaRecorderRef.current = null
        if (!aliveRef.current || sessionEpochRef.current !== epoch) return
        if (blob.size <= 0) {
          setError('start_failed')
          setStatus('idle')
          return
        }
        finalizeRecording(blob, durationMs, stopReasonRef.current)
      }

      recorder.onstop = finishFromRecorder

      recorder.onerror = () => {
        stopTick()
        releaseWakeLock()
        releaseStream()
        mediaRecorderRef.current = null
        if (!aliveRef.current || sessionEpochRef.current !== epoch) return
        setError('start_failed')
        setStatus('idle')
      }

      // OS reclaiming the mic (call, another app) ends the track and usually
      // stops MediaRecorder — surface that clearly instead of a silent cut.
      for (const track of stream.getAudioTracks()) {
        track.onended = () => {
          if (sessionEpochRef.current !== epoch) return
          const rec = mediaRecorderRef.current
          if (!rec || rec.state === 'inactive') return
          stopReasonRef.current = 'stream_ended'
          try {
            rec.stop()
          } catch {
            finishFromRecorder()
          }
        }
      }

      clearRecordingUrl()
      setRecording(null)
      elapsedBaseRef.current = 0
      segmentStartedAtRef.current = Date.now()
      stopReasonRef.current = 'manual'
      setElapsedMs(0)
      recorder.start(...mediaRecorderStartArgs())
      setStatus('recording')
      startTick()
      // No automatic max-duration stop — recording is unlimited until manual stop.
      void acquireWakeLock()
    } catch (err) {
      releaseWakeLock()
      releaseStream()
      mediaRecorderRef.current = null
      setError(mapGetUserMediaError(err))
      setStatus('idle')
    }
  }, [
    acquireWakeLock,
    clearRecordingUrl,
    finalizeRecording,
    readElapsedMs,
    releaseStream,
    releaseWakeLock,
    startTick,
    stopTick,
  ])

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    if (typeof recorder.pause !== 'function') return

    recorder.pause()
    elapsedBaseRef.current = readElapsedMs()
    segmentStartedAtRef.current = null
    stopTick()
    releaseWakeLock()
    setElapsedMs(elapsedBaseRef.current)
    setStatus('paused')
  }, [readElapsedMs, releaseWakeLock, stopTick])

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    if (typeof recorder.resume !== 'function') return

    segmentStartedAtRef.current = Date.now()
    recorder.resume()
    setStatus('recording')
    startTick()
    void acquireWakeLock()
  }, [acquireWakeLock, startTick])

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    stopReasonRef.current = 'manual'
    if (segmentStartedAtRef.current !== null) {
      elapsedBaseRef.current = readElapsedMs()
      segmentStartedAtRef.current = null
    }
    stopTick()
    // Flush any remaining buffer before stop (no-op without timeslice on some engines).
    try {
      if (typeof recorder.requestData === 'function' && recorder.state === 'recording') {
        recorder.requestData()
      }
    } catch {
      /* optional */
    }
    recorder.stop()
  }, [readElapsedMs, stopTick])

  const clearRecording = useCallback(() => {
    clearRecordingUrl()
    setRecording(null)
    setStoppedReason(null)
    setError(null)
    setElapsedMs(0)
    setStatus('idle')
  }, [clearRecordingUrl])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      sessionEpochRef.current += 1
      stopTick()
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.ondataavailable = null
          recorder.onstop = null
          recorder.onerror = null
          recorder.stop()
        } catch {
          // ignore teardown errors
        }
      }
      mediaRecorderRef.current = null
      releaseStream()
      releaseWakeLock()
      clearRecordingUrl()
    }
  }, [clearRecordingUrl, releaseStream, releaseWakeLock, stopTick])

  /** Browsers drop the wake lock while hidden — take it back on return. */
  useEffect(() => {
    if (status !== 'recording') return
    if (typeof document === 'undefined') return

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [acquireWakeLock, status])

  return {
    status,
    elapsedMs,
    error,
    recording,
    stoppedReason,
    supported: isVoiceRecordingSupported(),
    supportsPauseResume:
      typeof MediaRecorder !== 'undefined' &&
      typeof MediaRecorder.prototype.pause === 'function' &&
      typeof MediaRecorder.prototype.resume === 'function',
    start,
    pause,
    resume,
    stop,
    clearRecording,
  }
}
