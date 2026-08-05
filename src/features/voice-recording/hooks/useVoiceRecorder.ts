import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  clampRecordingDurationMs,
  downloadVoiceRecording,
  isVoiceRecordingSupported,
  MAX_RECORDING_MS,
  mediaRecorderStartArgs,
  voiceRecorderEngine,
  voiceRecorderErrorMessage,
  type VoiceEngineSnapshot,
  type VoiceRecorderErrorCode,
  type VoiceRecorderStatus,
  type VoiceRecording,
  type VoiceStopReason,
} from '@/features/voice-recording/services/voiceRecorderEngine'

export type {
  VoiceRecorderErrorCode,
  VoiceRecorderStatus,
  VoiceRecording,
  VoiceStopReason,
}

export {
  clampRecordingDurationMs,
  downloadVoiceRecording,
  isVoiceRecordingSupported,
  MAX_RECORDING_MS,
  mediaRecorderStartArgs,
  voiceRecorderErrorMessage,
}

function subscribe(onStoreChange: () => void) {
  return voiceRecorderEngine.subscribe(onStoreChange)
}

function getSnapshot(): VoiceEngineSnapshot {
  return voiceRecorderEngine.getSnapshot()
}

const serverSnapshot: VoiceEngineSnapshot = {
  status: 'idle',
  elapsedMs: 0,
  error: null,
  recording: null,
  stoppedReason: null,
  supported: false,
  supportsPauseResume: false,
}

function getServerSnapshot(): VoiceEngineSnapshot {
  return serverSnapshot
}

/**
 * React binding to the process-wide voice recorder engine.
 * Remounting the panel does not kill an active capture.
 */
export function useVoiceRecorder() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const start = useCallback(() => {
    void voiceRecorderEngine.start()
  }, [])
  const pause = useCallback(() => {
    voiceRecorderEngine.pause()
  }, [])
  const resume = useCallback(() => {
    voiceRecorderEngine.resume()
  }, [])
  const stop = useCallback(() => {
    voiceRecorderEngine.stop()
  }, [])
  const clearRecording = useCallback(() => {
    voiceRecorderEngine.clearRecording()
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        voiceRecorderEngine.onVisibilityVisible()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return {
    status: snap.status,
    elapsedMs: snap.elapsedMs,
    error: snap.error,
    recording: snap.recording,
    stoppedReason: snap.stoppedReason,
    supported: snap.supported,
    supportsPauseResume: snap.supportsPauseResume,
    start,
    pause,
    resume,
    stop,
    clearRecording,
  }
}
