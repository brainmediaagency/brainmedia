import { describe, expect, it } from 'vitest'
import {
  buildDriveFolderKey,
  dayKmDelta,
  formatDayKmLabel,
  pairReadingsIntoDays,
  sumDayKm,
} from '@/features/kameraman/utils/odometerKm'
import type { KameramanOdometerReading } from '@/features/kameraman/types/odometer'

function reading(
  partial: Partial<KameramanOdometerReading> &
    Pick<KameramanOdometerReading, 'id' | 'slot' | 'odometerKm' | 'reportDate'>,
): KameramanOdometerReading {
  return {
    note: null,
    photoStoragePath: 'file',
    photoDownloadUrl: 'https://example.com/x',
    driveFolderKey: 'X_2026-05-19',
    createdByUid: 'cam1',
    createdByNameSnapshot: 'Ali Veli',
    createdByEmailSnapshot: 'ali@brain.local',
    createdAt: null,
    updatedAt: null,
    ...partial,
  }
}

describe('odometerKm utils', () => {
  it('computes non-negative day delta', () => {
    expect(dayKmDelta(1000, 1300)).toBe(300)
    expect(dayKmDelta(1300, 1000)).toBeNull()
    expect(dayKmDelta(null, 1000)).toBeNull()
  })

  it('formats day label like "19 Mayıs 2026 300 km"', () => {
    const label = formatDayKmLabel('2026-05-19', 300)
    expect(label).toContain('2026')
    expect(label).toContain('300 km')
    expect(label).toMatch(/Mayıs|mayıs/i)
  })

  it('pairs morning+evening by uid and date', () => {
    const days = pairReadingsIntoDays([
      reading({
        id: '1',
        slot: 'morning',
        odometerKm: 1000,
        reportDate: '2026-05-19',
      }),
      reading({
        id: '2',
        slot: 'evening',
        odometerKm: 1300,
        reportDate: '2026-05-19',
      }),
    ])
    expect(days).toHaveLength(1)
    expect(days[0]!.dayKm).toBe(300)
    expect(sumDayKm(days)).toBe(300)
  })

  it('builds a drive folder key from name and date', () => {
    expect(buildDriveFolderKey('Ali Veli', '2026-05-19')).toBe(
      'Ali_Veli_2026-05-19',
    )
  })
})
