import type { Timestamp } from 'firebase/firestore'

/** Muhabir günlük formlarından türetilen kasa özetleri. */
export type ReportCashTotals = {
  totalIncomeKurus: number
  totalExpenseKurus: number
  totalFieldPaidKurus: number
  reportCount: number
}

/** Tek günlük raporun kasa görünümü (açılır satır). */
export type ReportCashGroup = {
  reportId: string
  reportDate: string
  title: string
  reporterName: string
  createdAt: Timestamp | null
  incomeKurus: number
  expenseKurus: number
  fieldPaidKurus: number
}
