import { describe, expect, it } from 'vitest'
import {
  clampRecordingDurationMs,
  hasReachedRecordingLimit,
  isActiveVoiceCaptureStatus,
  isNearRecordingLimit,
  MAX_RECORDING_MS,
  mediaRecorderStartArgs,
  RECORDING_LIMIT_WARN_MS,
  VOICE_CHUNK_INTERVAL_MS,
  voiceRecorderErrorMessage,
} from '@/features/voice-recording/services/voiceRecorderEngine'

describe('voice recorder 45-minute cap (Drive / Spark)', () => {
  it('hard-caps at 45 minutes', () => {
    expect(MAX_RECORDING_MS).toBe(45 * 60 * 1000)
  })

  it('starts MediaRecorder with a steady chunk interval', () => {
    const args = mediaRecorderStartArgs()
    expect(args).toEqual([VOICE_CHUNK_INTERVAL_MS])
    expect(VOICE_CHUNK_INTERVAL_MS).toBeGreaterThanOrEqual(500)
  })

  it('clamps elapsed to the 45-minute product max', () => {
    const over = MAX_RECORDING_MS + 90_000
    expect(clampRecordingDurationMs(over)).toBe(MAX_RECORDING_MS)
    expect(clampRecordingDurationMs(MAX_RECORDING_MS)).toBe(MAX_RECORDING_MS)
    expect(clampRecordingDurationMs(12_000)).toBe(12_000)
  })

  it('still honors an explicit max override', () => {
    expect(clampRecordingDurationMs(90_000, 60_000)).toBe(60_000)
    expect(clampRecordingDurationMs(-5, 60_000)).toBe(0)
  })

  it('warns in the final 2 minutes of the cap', () => {
    expect(RECORDING_LIMIT_WARN_MS).toBe(2 * 60 * 1000)
    expect(isNearRecordingLimit(MAX_RECORDING_MS - RECORDING_LIMIT_WARN_MS)).toBe(
      true,
    )
    expect(isNearRecordingLimit(MAX_RECORDING_MS - RECORDING_LIMIT_WARN_MS - 1)).toBe(
      false,
    )
    expect(hasReachedRecordingLimit(MAX_RECORDING_MS)).toBe(true)
    expect(hasReachedRecordingLimit(MAX_RECORDING_MS - 1)).toBe(false)
  })

  it('does not label empty takes as “başlatılamadı” messaging for OS cut', () => {
    expect(voiceRecorderErrorMessage('stream_ended')).toMatch(/korundu/i)
    expect(voiceRecorderErrorMessage('start_failed')).toMatch(/başlatılamadı/i)
  })

  it('treats recording and paused as active capture for idle session skip', () => {
    expect(isActiveVoiceCaptureStatus('recording')).toBe(true)
    expect(isActiveVoiceCaptureStatus('paused')).toBe(true)
    expect(isActiveVoiceCaptureStatus('idle')).toBe(false)
    expect(isActiveVoiceCaptureStatus('stopped')).toBe(false)
  })
})
