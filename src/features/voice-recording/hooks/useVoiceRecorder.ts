import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_RECORDING_MS = 30 * 60 * 1000

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

export type VoiceRecording = {
  blob: Blob
  url: string
  mimeType: string
  durationMs: number
  createdAt: number
}

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
  }
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
  const [stoppedReason, setStoppedReason] = useState<'manual' | 'max_duration' | null>(
    null,
  )

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const mimeTypeRef = useRef('audio/webm')
  const elapsedBaseRef = useRef(0)
  const segmentStartedAtRef = useRef<number | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingUrlRef = useRef<string | null>(null)
  const stopReasonRef = useRef<'manual' | 'max_duration'>('manual')
  const aliveRef = useRef(true)

  const clearTimers = useCallback(() => {
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    if (tickTimerRef.current !== null) {
      clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
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
    }, 200)
  }, [readElapsedMs, stopTick])

  const scheduleMaxDurationStop = useCallback(
    (remainingMs: number) => {
      if (maxTimerRef.current !== null) {
        clearTimeout(maxTimerRef.current)
        maxTimerRef.current = null
      }
      maxTimerRef.current = setTimeout(() => {
        stopReasonRef.current = 'max_duration'
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop()
        }
      }, Math.max(0, remainingMs))
    },
    [],
  )

  const finalizeRecording = useCallback(
    (blob: Blob, durationMs: number, reason: 'manual' | 'max_duration') => {
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickMimeType()
      mimeTypeRef.current = mimeType ?? 'audio/webm'
      chunksRef.current = []

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        clearTimers()
        stopTick()
        segmentStartedAtRef.current = null
        const durationMs = Math.min(readElapsedMs(), MAX_RECORDING_MS)
        elapsedBaseRef.current = durationMs
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current,
        })
        chunksRef.current = []
        releaseStream()
        mediaRecorderRef.current = null
        if (!aliveRef.current) return
        finalizeRecording(blob, durationMs, stopReasonRef.current)
      }

      recorder.onerror = () => {
        clearTimers()
        stopTick()
        releaseStream()
        mediaRecorderRef.current = null
        if (!aliveRef.current) return
        setError('start_failed')
        setStatus('idle')
      }

      clearRecordingUrl()
      setRecording(null)
      elapsedBaseRef.current = 0
      segmentStartedAtRef.current = Date.now()
      stopReasonRef.current = 'manual'
      setElapsedMs(0)
      recorder.start(1000)
      setStatus('recording')
      startTick()
      scheduleMaxDurationStop(MAX_RECORDING_MS)
    } catch (err) {
      releaseStream()
      mediaRecorderRef.current = null
      setError(mapGetUserMediaError(err))
      setStatus('idle')
    }
  }, [
    clearRecordingUrl,
    clearTimers,
    finalizeRecording,
    readElapsedMs,
    releaseStream,
    scheduleMaxDurationStop,
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
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    setElapsedMs(elapsedBaseRef.current)
    setStatus('paused')
  }, [readElapsedMs, stopTick])

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    if (typeof recorder.resume !== 'function') return

    segmentStartedAtRef.current = Date.now()
    recorder.resume()
    setStatus('recording')
    startTick()
    scheduleMaxDurationStop(MAX_RECORDING_MS - elapsedBaseRef.current)
  }, [scheduleMaxDurationStop, startTick])

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    stopReasonRef.current = 'manual'
    clearTimers()
    if (segmentStartedAtRef.current !== null) {
      elapsedBaseRef.current = readElapsedMs()
      segmentStartedAtRef.current = null
    }
    stopTick()
    recorder.stop()
  }, [clearTimers, readElapsedMs, stopTick])

  const clearRecording = useCallback(() => {
    clearRecordingUrl()
    setRecording(null)
    setStoppedReason(null)
    setElapsedMs(0)
    setStatus('idle')
  }, [clearRecordingUrl])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      clearTimers()
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
      clearRecordingUrl()
    }
  }, [clearRecordingUrl, clearTimers, releaseStream, stopTick])

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
