import type { Timestamp } from 'firebase/firestore'

/** Günlük rapor gider kırılımı (KDV hariç). */
export type ReportCashExpenseParts = {
  hotelExpenseKurus: number
  stationeryExpenseKurus: number
  fuelExpenseKurus: number
  mealExpenseKurus: number
  extraExpenseKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
}

/** Muhabir günlük formlarından türetilen kasa özetleri. */
export type ReportCashTotals = {
  /** Matrah + KDV. */
  totalIncomeKurus: number
  totalVatBaseKurus: number
  totalVatKurus: number
  totalExpenseKurus: number
  totalFieldPaidKurus: number
  reportCount: number
  hotelExpenseKurus: number
  stationeryExpenseKurus: number
  fuelExpenseKurus: number
  mealExpenseKurus: number
  extraExpenseKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
}

/** Tek günlük raporun kasa görünümü (açılır satır). */
export type ReportCashGroup = {
  reportId: string
  reportDate: string
  title: string
  reporterName: string
  /** Z raporu eşleştirmesi için (aynı muhabir + gün). */
  createdByUid: string
  createdAt: Timestamp | null
  /** Matrah + KDV. */
  incomeKurus: number
  vatBaseKurus: number
  vatKurus: number
  expenseKurus: number
  fieldPaidKurus: number
  hotelExpenseKurus: number
  stationeryExpenseKurus: number
  fuelExpenseKurus: number
  mealExpenseKurus: number
  extraExpenseKurus: number
  reporterEarningsKurus: number
  cameramanEarningsKurus: number
}
