import { describe, expect, it } from 'vitest'
import {
  clampRecordingDurationMs,
  MAX_RECORDING_MS,
  mediaRecorderStartArgs,
} from '@/features/voice-recording/hooks/useVoiceRecorder'

describe('voice recorder limits (no push / Drive)', () => {
  it('is unlimited in product config', () => {
    expect(MAX_RECORDING_MS).toBeNull()
  })

  it('does not pass timeslice to MediaRecorder.start', () => {
    const args = mediaRecorderStartArgs()
    expect(args).toEqual([])
    expect(args).toHaveLength(0)
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
})
