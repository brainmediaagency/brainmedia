import { describe, expect, it } from 'vitest'
import { USER_ROLES, isVoiceRecordingViewerRole } from '@/config/roles'
import { voiceRecordingPlaybackUrl, groupVoiceRecordingsByJobId } from '@/features/voice-recording/services/voiceRecordingService'

describe('voiceRecordingPlaybackUrl', () => {
  it('embeds Drive preview (no CORS fetch to usercontent)', () => {
    expect(
      voiceRecordingPlaybackUrl({
        driveFileId: 'abc-123',
        url: 'https://drive.google.com/uc?export=view&id=abc-123',
      }),
    ).toBe('https://drive.google.com/file/d/abc-123/preview')
  })

  it('falls back to stored url when file id is missing', () => {
    expect(
      voiceRecordingPlaybackUrl({
        driveFileId: '  ',
        url: 'https://example.com/clip.webm',
      }),
    ).toBe('https://example.com/clip.webm')
  })
})

describe('groupVoiceRecordingsByJobId', () => {
  it('groups by jobId and skips unlinked recordings', () => {
    const grouped = groupVoiceRecordingsByJobId([
      {
        id: 'a',
        companyName: 'A',
        jobId: 'job-1',
        recordedAtDate: '2026-08-19',
        durationMs: 1000,
        mimeType: 'audio/webm',
        size: 1,
        driveFileId: 'f1',
        url: 'https://example.com/a',
        webViewLink: 'https://example.com/a',
        createdByUid: 'u',
        createdByNameSnapshot: 'Ada',
        createdAt: null,
      },
      {
        id: 'b',
        companyName: 'B',
        jobId: null,
        recordedAtDate: '2026-08-19',
        durationMs: 1000,
        mimeType: 'audio/webm',
        size: 1,
        driveFileId: 'f2',
        url: 'https://example.com/b',
        webViewLink: 'https://example.com/b',
        createdByUid: 'u',
        createdByNameSnapshot: 'Ada',
        createdAt: null,
      },
      {
        id: 'c',
        companyName: 'A',
        jobId: 'job-1',
        recordedAtDate: '2026-08-19',
        durationMs: 2000,
        mimeType: 'audio/webm',
        size: 1,
        driveFileId: 'f3',
        url: 'https://example.com/c',
        webViewLink: 'https://example.com/c',
        createdByUid: 'u',
        createdByNameSnapshot: 'Ada',
        createdAt: null,
      },
    ])
    expect(grouped.get('job-1')?.map((item) => item.id)).toEqual(['a', 'c'])
    expect(grouped.has('')).toBe(false)
    expect(grouped.size).toBe(1)
  })
})

describe('isVoiceRecordingViewerRole', () => {
  it('allows calendar viewers except kameraman', () => {
    expect(isVoiceRecordingViewerRole('kameraman')).toBe(false)
    expect(isVoiceRecordingViewerRole('media_planning')).toBe(false)
    expect(isVoiceRecordingViewerRole('reporter')).toBe(true)
    expect(isVoiceRecordingViewerRole('management')).toBe(true)
    expect(isVoiceRecordingViewerRole('coordinator')).toBe(true)
    expect(isVoiceRecordingViewerRole('sef')).toBe(true)
    expect(isVoiceRecordingViewerRole('human_resources')).toBe(true)
  })

  it('covers every role explicitly', () => {
    const allowed = new Set([
      'coordinator',
      'management',
      'sef',
      'reporter',
      'human_resources',
    ])
    for (const role of USER_ROLES) {
      expect(isVoiceRecordingViewerRole(role)).toBe(allowed.has(role))
    }
  })
})
