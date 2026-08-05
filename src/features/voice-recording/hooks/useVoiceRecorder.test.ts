import { describe, expect, it } from 'vitest'
import {
  clampRecordingDurationMs,
  MAX_RECORDING_MS,
  mediaRecorderStartArgs,
  VOICE_CHUNK_INTERVAL_MS,
  voiceRecorderErrorMessage,
} from '@/features/voice-recording/services/voiceRecorderEngine'

describe('voice recorder limits (no push / Drive)', () => {
  it('is unlimited in product config', () => {
    expect(MAX_RECORDING_MS).toBeNull()
  })

  it('starts MediaRecorder with a steady chunk interval', () => {
    const args = mediaRecorderStartArgs()
    expect(args).toEqual([VOICE_CHUNK_INTERVAL_MS])
    expect(VOICE_CHUNK_INTERVAL_MS).toBeGreaterThanOrEqual(500)
  })

  it('does not clamp multi-hour elapsed when unlimited', () => {
    const twoHours = 2 * 60 * 60 * 1000
    expect(clampRecordingDurationMs(twoHours)).toBe(twoHours)
    expect(clampRecordingDurationMs(twoHours, null)).toBe(twoHours)
  })

  it('still clamps if an explicit max is provided (defensive helper)', () => {
    expect(clampRecordingDurationMs(90_000, 60_000)).toBe(60_000)
    expect(clampRecordingDurationMs(-5, 60_000)).toBe(0)
  })

  it('does not label empty takes as “başlatılamadı” messaging for OS cut', () => {
    expect(voiceRecorderErrorMessage('stream_ended')).toMatch(/korundu/i)
    expect(voiceRecorderErrorMessage('start_failed')).toMatch(/başlatılamadı/i)
  })
})
