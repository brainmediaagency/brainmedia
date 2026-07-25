import { describe, expect, it } from 'vitest'
import {
  formatJobStatusNote,
  formatJobStatusNoteLabel,
  shouldHighlightJobStatusNote,
} from '@/features/jobs/utils/formatJobStatusNote'

describe('formatJobStatusNote', () => {
  it('labels cancelled/rejected notes clearly', () => {
    expect(formatJobStatusNoteLabel('cancelled')).toBe('İptal Nedeni')
    expect(formatJobStatusNoteLabel('rejected')).toBe('Red Nedeni')
    expect(formatJobStatusNoteLabel('approved')).toBe('İnceleme Notu')
  })

  it('always shows a value for cancelled and rejected', () => {
    expect(
      formatJobStatusNote({ status: 'cancelled', reviewNote: 'Müşteri vazgeçti' }),
    ).toBe('Müşteri vazgeçti')
    expect(formatJobStatusNote({ status: 'cancelled', reviewNote: null })).toBe(
      'Açıklama belirtilmedi',
    )
    expect(formatJobStatusNote({ status: 'rejected', reviewNote: '  ' })).toBe(
      'Açıklama belirtilmedi',
    )
  })

  it('hides empty notes for other statuses', () => {
    expect(formatJobStatusNote({ status: 'approved', reviewNote: null })).toBeNull()
    expect(formatJobStatusNote({ status: 'pending', reviewNote: 'ok' })).toBe('ok')
  })

  it('highlights cancelled and rejected', () => {
    expect(shouldHighlightJobStatusNote('cancelled')).toBe(true)
    expect(shouldHighlightJobStatusNote('rejected')).toBe(true)
    expect(shouldHighlightJobStatusNote('shot')).toBe(false)
  })
})
