import type { KameramanDayKm } from '@/features/kameraman/types/odometer'

export type FieldOpsExpenseReport = {
  id: string
  reportDate: string
  reporterName: string
  hotelExpenseKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
}

export type FieldOpsDayRow = {
  reportDate: string
  dayKm: number
  validKmPairCount: number
  invalidKmPairCount: number
  hotelExpenseKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
  odometerDays: KameramanDayKm[]
  expenseReports: FieldOpsExpenseReport[]
}

export type FieldOpsSummaryTotals = {
  dayKm: number
  validKmPairCount: number
  invalidKmPairCount: number
  hotelExpenseKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
}

export type FieldOpsSummary = {
  startDate: string
  endDate: string
  totals: FieldOpsSummaryTotals
  days: FieldOpsDayRow[]
}
