import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import type {
  FieldOpsDayRow,
  FieldOpsExpenseReport,
  FieldOpsSummary,
  FieldOpsSummaryTotals,
} from '@/features/field-ops/types/fieldOps'
import { fetchOdometerReadingsInRange } from '@/features/kameraman/services/odometerService'
import type { KameramanOdometerReading } from '@/features/kameraman/types/odometer'
import {
  pairReadingsIntoDays,
  sumDayKm,
} from '@/features/kameraman/utils/odometerKm'
import { getDb } from '@/lib/firebase/firestore'
import {
  isValidDateOnly,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { UserFacingError, mapAppError } from '@/lib/errors'

const FIELD_OPS_REPORT_LIMIT = 5_000
/** Inclusive max span for one summary query (keeps odometer/report caps honest). */
export const FIELD_OPS_MAX_RANGE_DAYS = 93

function nonNegativeKurus(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0
}

/** Inclusive day count between two `yyyy-MM-dd` values. */
export function inclusiveDateOnlyDayCount(
  startDate: string,
  endDate: string,
): number | null {
  if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) return null
  if (startDate > endDate) return null
  const [ys, ms, ds] = startDate.split('-').map(Number)
  const [ye, me, de] = endDate.split('-').map(Number)
  const startMs = Date.UTC(ys!, (ms ?? 1) - 1, ds ?? 1)
  const endMs = Date.UTC(ye!, (me ?? 1) - 1, de ?? 1)
  return Math.floor((endMs - startMs) / 86_400_000) + 1
}

async function fetchExpenseReportsInRange(input: {
  startDate: string
  endDate: string
}): Promise<FieldOpsExpenseReport[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), 'reporterDailyReports'),
      where('reportDate', '>=', input.startDate),
      where('reportDate', '<=', input.endDate),
      orderBy('reportDate', 'asc'),
      limit(FIELD_OPS_REPORT_LIMIT),
    ),
  )

  if (snap.size >= FIELD_OPS_REPORT_LIMIT) {
    throw new UserFacingError(
      'Seçilen dönem için çok fazla günlük rapor bulundu. Saha özeti eksik gösterilmedi; daha dar bir aralık seçin.',
    )
  }

  return snap.docs.flatMap((item) => {
    const data = item.data()
    if (data.deletedAt != null) return []

    return [{
      id: item.id,
      reportDate: String(data.reportDate ?? ''),
      reporterName:
        String(data.createdByNameSnapshot ?? '').trim() || 'Muhabir',
      hotelExpenseKurus: nonNegativeKurus(data.hotelExpenseKurus),
      reporterEarningsKurus: nonNegativeKurus(
        data.totalReporterEarningsKurus,
      ),
      cameramanEarningsKurus: nonNegativeKurus(
        data.totalCameramanEarningsKurus,
      ),
    }]
  })
}

function emptyTotals(): FieldOpsSummaryTotals {
  return {
    dayKm: 0,
    validKmPairCount: 0,
    invalidKmPairCount: 0,
    hotelExpenseKurus: 0,
    reporterEarningsKurus: 0,
    cameramanEarningsKurus: 0,
  }
}

function emptyDay(reportDate: string): FieldOpsDayRow {
  return {
    reportDate,
    dayKm: 0,
    validKmPairCount: 0,
    invalidKmPairCount: 0,
    hotelExpenseKurus: 0,
    reporterEarningsKurus: 0,
    cameramanEarningsKurus: 0,
    odometerDays: [],
    expenseReports: [],
  }
}

/** Pure join/aggregation for unit tests and the management UI. */
export function aggregateFieldOpsSummary(input: {
  startDate: string
  endDate: string
  odometerReadings: KameramanOdometerReading[]
  expenseReports: FieldOpsExpenseReport[]
  /** Incomplete pairs on this date are expected (evening not entered yet). */
  todayDate?: string
}): FieldOpsSummary {
  const todayDate = input.todayDate ?? todayDateOnlyIstanbul()
  const totals = emptyTotals()
  const byDate = new Map<string, FieldOpsDayRow>()

  for (const odometerDay of pairReadingsIntoDays(input.odometerReadings)) {
    const day = byDate.get(odometerDay.reportDate)
      ?? emptyDay(odometerDay.reportDate)
    day.odometerDays.push(odometerDay)

    if (odometerDay.dayKm == null) {
      // Today’s incomplete/invalid pairs are still open — don’t warn yet.
      if (odometerDay.reportDate !== todayDate) {
        day.invalidKmPairCount += 1
        totals.invalidKmPairCount += 1
      }
    } else {
      day.validKmPairCount += 1
      totals.validKmPairCount += 1
    }

    byDate.set(odometerDay.reportDate, day)
  }

  for (const report of input.expenseReports) {
    const day = byDate.get(report.reportDate) ?? emptyDay(report.reportDate)
    day.expenseReports.push(report)
    day.hotelExpenseKurus += report.hotelExpenseKurus
    day.reporterEarningsKurus += report.reporterEarningsKurus
    day.cameramanEarningsKurus += report.cameramanEarningsKurus
    totals.hotelExpenseKurus += report.hotelExpenseKurus
    totals.reporterEarningsKurus += report.reporterEarningsKurus
    totals.cameramanEarningsKurus += report.cameramanEarningsKurus
    byDate.set(report.reportDate, day)
  }

  const days = [...byDate.values()]
    .map((day) => ({
      ...day,
      dayKm: sumDayKm(day.odometerDays),
      odometerDays: [...day.odometerDays].sort((a, b) =>
        a.createdByNameSnapshot.localeCompare(
          b.createdByNameSnapshot,
          'tr-TR',
        ),
      ),
      expenseReports: [...day.expenseReports].sort((a, b) =>
        a.reporterName.localeCompare(b.reporterName, 'tr-TR'),
      ),
    }))
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate))

  totals.dayKm = sumDayKm(days.flatMap((day) => day.odometerDays))

  return {
    startDate: input.startDate,
    endDate: input.endDate,
    totals,
    days,
  }
}

export async function fetchFieldOpsSummary(input: {
  startDate: string
  endDate: string
}): Promise<FieldOpsSummary> {
  if (!isValidDateOnly(input.startDate) || !isValidDateOnly(input.endDate)) {
    throw new UserFacingError('Geçerli bir tarih aralığı seçin.')
  }
  if (input.startDate > input.endDate) {
    throw new UserFacingError('Başlangıç tarihi bitişten sonra olamaz.')
  }

  const dayCount = inclusiveDateOnlyDayCount(input.startDate, input.endDate)
  if (dayCount == null || dayCount > FIELD_OPS_MAX_RANGE_DAYS) {
    throw new UserFacingError(
      `Tarih aralığı en fazla ${FIELD_OPS_MAX_RANGE_DAYS} gün olabilir.`,
    )
  }

  try {
    const [odometerReadings, expenseReports] = await Promise.all([
      fetchOdometerReadingsInRange({
        startDate: input.startDate,
        endDate: input.endDate,
      }),
      fetchExpenseReportsInRange({
        startDate: input.startDate,
        endDate: input.endDate,
      }),
    ])

    return aggregateFieldOpsSummary({
      startDate: input.startDate,
      endDate: input.endDate,
      odometerReadings,
      expenseReports,
    })
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(
      mapAppError(error, 'Saha özeti yüklenemedi.'),
    )
  }
}
