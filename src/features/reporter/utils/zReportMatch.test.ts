import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import {
  findZReportForDaily,
  hasZReportForDaily,
} from '@/features/reporter/utils/zReportMatch'
import type { ReporterZReport } from '@/features/reporter/types/reporter'

function zReport(
  partial: Partial<ReporterZReport> & Pick<ReporterZReport, 'id' | 'createdByUid'>,
): ReporterZReport {
  return {
    confirmed: true,
    photoStoragePath: null,
    photoDownloadUrl: null,
    createdByNameSnapshot: 'Muhabir',
    createdByEmailSnapshot: 'm@brain.local',
    createdAt: null,
    updatedAt: null,
    ...partial,
  }
}

describe('zReportMatch', () => {
  it('matches same reporter + Istanbul calendar day from createdAt', () => {
    const createdAt = Timestamp.fromDate(new Date('2026-09-22T12:00:00+03:00'))
    const reports = [
      zReport({
        id: 'z1',
        createdByUid: 'rep1',
        createdAt,
        photoDownloadUrl: 'https://example.com/z.jpg',
      }),
    ]
    const daily = { reportDate: '2026-09-22', createdByUid: 'rep1' }
    expect(hasZReportForDaily(daily, reports)).toBe(true)
    expect(findZReportForDaily(daily, reports)?.photoDownloadUrl).toBe(
      'https://example.com/z.jpg',
    )
  })

  it('ignores other reporters and other days', () => {
    const createdAt = Timestamp.fromDate(new Date('2026-09-22T12:00:00+03:00'))
    const reports = [
      zReport({ id: 'z1', createdByUid: 'rep1', createdAt }),
    ]
    expect(
      hasZReportForDaily(
        { reportDate: '2026-09-22', createdByUid: 'rep2' },
        reports,
      ),
    ).toBe(false)
    expect(
      hasZReportForDaily(
        { reportDate: '2026-09-21', createdByUid: 'rep1' },
        reports,
      ),
    ).toBe(false)
  })
})
