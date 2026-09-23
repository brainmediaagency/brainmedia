import { describe, expect, it } from 'vitest'
import {
  aggregateFieldOpsSummary,
  FIELD_OPS_MAX_RANGE_DAYS,
  inclusiveDateOnlyDayCount,
} from '@/features/field-ops/services/fieldOpsSummaryService'
import type { FieldOpsExpenseReport } from '@/features/field-ops/types/fieldOps'
import type {
  KameramanOdometerReading,
  OdometerSlot,
} from '@/features/kameraman/types/odometer'

function reading(input: {
  id: string
  uid: string
  name: string
  reportDate: string
  slot: OdometerSlot
  odometerKm: number
}): KameramanOdometerReading {
  return {
    id: input.id,
    reportDate: input.reportDate,
    slot: input.slot,
    odometerKm: input.odometerKm,
    note: null,
    photoStoragePath: `drive-${input.id}`,
    photoDownloadUrl: `https://example.com/${input.id}`,
    driveFolderKey: `${input.name}_${input.reportDate}`,
    createdByUid: input.uid,
    createdByNameSnapshot: input.name,
    createdByEmailSnapshot: `${input.uid}@brain.local`,
    createdAt: null,
    updatedAt: null,
  }
}

function expense(
  input: Partial<FieldOpsExpenseReport>
    & Pick<FieldOpsExpenseReport, 'id' | 'reportDate'>,
): FieldOpsExpenseReport {
  return {
    reporterName: 'Muhabir',
    hotelExpenseKurus: 0,
    reporterEarningsKurus: 0,
    cameramanEarningsKurus: 0,
    ...input,
  }
}

describe('inclusiveDateOnlyDayCount', () => {
  it('counts inclusive calendar days', () => {
    expect(inclusiveDateOnlyDayCount('2026-05-01', '2026-05-01')).toBe(1)
    expect(inclusiveDateOnlyDayCount('2026-05-01', '2026-05-31')).toBe(31)
    expect(inclusiveDateOnlyDayCount('2026-05-01', '2026-04-30')).toBeNull()
  })

  it('fits a typical month under the field-ops max window', () => {
    expect(
      inclusiveDateOnlyDayCount('2026-05-01', '2026-05-31'),
    ).toBeLessThanOrEqual(FIELD_OPS_MAX_RANGE_DAYS)
  })
})

describe('aggregateFieldOpsSummary', () => {
  it('joins daily km and read-only reporter expense totals', () => {
    const summary = aggregateFieldOpsSummary({
      startDate: '2026-04-30',
      endDate: '2026-05-30',
      odometerReadings: [
        reading({
          id: 'cam1-m',
          uid: 'cam1',
          name: 'Ali Kamera',
          reportDate: '2026-05-19',
          slot: 'morning',
          odometerKm: 1000,
        }),
        reading({
          id: 'cam1-e',
          uid: 'cam1',
          name: 'Ali Kamera',
          reportDate: '2026-05-19',
          slot: 'evening',
          odometerKm: 1300,
        }),
        reading({
          id: 'cam2-m',
          uid: 'cam2',
          name: 'Ayşe Kamera',
          reportDate: '2026-05-19',
          slot: 'morning',
          odometerKm: 2000,
        }),
      ],
      expenseReports: [
        expense({
          id: 'r1',
          reportDate: '2026-05-19',
          reporterName: 'Merve Muhabir',
          hotelExpenseKurus: 25_000,
          reporterEarningsKurus: 70_000,
          cameramanEarningsKurus: 50_000,
        }),
        expense({
          id: 'r2',
          reportDate: '2026-05-19',
          hotelExpenseKurus: 10_000,
          reporterEarningsKurus: 30_000,
          cameramanEarningsKurus: 20_000,
        }),
      ],
    })

    expect(summary.totals).toMatchObject({
      dayKm: 300,
      validKmPairCount: 1,
      invalidKmPairCount: 1,
      hotelExpenseKurus: 35_000,
      reporterEarningsKurus: 100_000,
      cameramanEarningsKurus: 70_000,
    })
    expect(summary.days).toHaveLength(1)
    expect(summary.days[0]).toMatchObject({
      reportDate: '2026-05-19',
      dayKm: 300,
      validKmPairCount: 1,
      invalidKmPairCount: 1,
      hotelExpenseKurus: 35_000,
    })
  })

  it('does not add a decreasing odometer pair to monthly km', () => {
    const summary = aggregateFieldOpsSummary({
      startDate: '2026-04-30',
      endDate: '2026-05-30',
      odometerReadings: [
        reading({
          id: 'm',
          uid: 'cam1',
          name: 'Ali Kamera',
          reportDate: '2026-05-20',
          slot: 'morning',
          odometerKm: 1500,
        }),
        reading({
          id: 'e',
          uid: 'cam1',
          name: 'Ali Kamera',
          reportDate: '2026-05-20',
          slot: 'evening',
          odometerKm: 1400,
        }),
      ],
      expenseReports: [],
    })

    expect(summary.totals.dayKm).toBe(0)
    expect(summary.totals.invalidKmPairCount).toBe(1)
    expect(summary.days[0]?.dayKm).toBe(0)
  })

  it('keeps expense-only days in newest-first order', () => {
    const summary = aggregateFieldOpsSummary({
      startDate: '2026-04-30',
      endDate: '2026-05-30',
      odometerReadings: [],
      expenseReports: [
        expense({ id: 'old', reportDate: '2026-05-01' }),
        expense({ id: 'new', reportDate: '2026-05-03' }),
      ],
    })

    expect(summary.days.map((day) => day.reportDate)).toEqual([
      '2026-05-03',
      '2026-05-01',
    ])
  })

  it('does not warn for incomplete pairs on today', () => {
    const summary = aggregateFieldOpsSummary({
      startDate: '2026-04-30',
      endDate: '2026-05-30',
      todayDate: '2026-05-22',
      odometerReadings: [
        reading({
          id: 'today-m',
          uid: 'cam1',
          name: 'Ali Kamera',
          reportDate: '2026-05-22',
          slot: 'morning',
          odometerKm: 1000,
        }),
        reading({
          id: 'past-m',
          uid: 'cam1',
          name: 'Ali Kamera',
          reportDate: '2026-05-20',
          slot: 'morning',
          odometerKm: 900,
        }),
      ],
      expenseReports: [],
    })

    expect(summary.totals.invalidKmPairCount).toBe(1)
    expect(
      summary.days.find((day) => day.reportDate === '2026-05-22')
        ?.invalidKmPairCount,
    ).toBe(0)
    expect(
      summary.days.find((day) => day.reportDate === '2026-05-20')
        ?.invalidKmPairCount,
    ).toBe(1)
    expect(summary.totals.dayKm).toBe(0)
  })
})
