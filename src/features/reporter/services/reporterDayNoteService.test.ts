import { describe, expect, it } from 'vitest'
import {
  reporterDayNoteDocId,
} from '@/features/reporter/services/reporterDayNoteService'
import { REPORTER_DAY_NOTE_BODY_MAX } from '@/features/reporter/types/reporterDayNote'

describe('reporterDayNoteService helpers', () => {
  it('builds stable doc id from uid and date', () => {
    expect(reporterDayNoteDocId('uid123', '2026-08-05')).toBe(
      'uid123_2026-08-05',
    )
  })

  it('exposes a sane body max length', () => {
    expect(REPORTER_DAY_NOTE_BODY_MAX).toBe(8000)
  })
})
