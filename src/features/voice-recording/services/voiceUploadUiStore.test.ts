import { describe, expect, it, beforeEach } from 'vitest'
import {
  endVoiceUpload,
  getVoiceUploadUiSnapshot,
  isVoiceUploadInFlight,
  tryBeginVoiceUpload,
  updateVoiceUploadProgress,
} from '@/features/voice-recording/services/voiceUploadUiStore'

describe('voiceUploadUiStore', () => {
  beforeEach(() => {
    endVoiceUpload()
  })

  it('tracks active upload across simulated remount (module state)', () => {
    expect(
      tryBeginVoiceUpload({ dedupeKey: 'k1', detail: 'Firma A' }),
    ).toBe(true)
    expect(tryBeginVoiceUpload({ dedupeKey: 'k1', detail: 'Firma A' })).toBe(
      false,
    )
    expect(getVoiceUploadUiSnapshot().active).toBe(true)
    expect(isVoiceUploadInFlight('k1')).toBe(true)
    expect(isVoiceUploadInFlight('other')).toBe(false)

    updateVoiceUploadProgress(
      { phase: 'uploading', ratio: 0.42, fileName: 'file.webm' },
      'Firma A',
    )
    const snap = getVoiceUploadUiSnapshot()
    expect(snap.percent).toBe(42)
    expect(snap.label.length).toBeGreaterThan(0)

    endVoiceUpload('k1')
    expect(getVoiceUploadUiSnapshot().active).toBe(false)
    expect(isVoiceUploadInFlight('k1')).toBe(false)
  })
})
