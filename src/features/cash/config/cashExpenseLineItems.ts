import type { ReportCashExpenseParts } from '@/features/cash/types/cash'

/** Yönetim / koordinatör kasa gider kartları (sıra sabit). */
export const CASH_EXPENSE_LINE_ITEMS = [
  {
    key: 'hotelExpenseKurus',
    label: 'Otel gideri',
    hint: 'Günlük rapor otel kalemi',
  },
  {
    key: 'stationeryExpenseKurus',
    label: 'Kırtasiye gideri',
    hint: 'Günlük rapor kırtasiye kalemi',
  },
  {
    key: 'fuelExpenseKurus',
    label: 'Benzin gideri',
    hint: 'Günlük rapor benzin / yakıt kalemi',
  },
  {
    key: 'mealExpenseKurus',
    label: 'Yemek gideri',
    hint: 'Günlük rapor yemek kalemi',
  },
  {
    key: 'extraExpenseKurus',
    label: 'Ekstra gider',
    hint: 'Günlük rapor ekstra kalemi',
  },
  {
    key: 'reporterEarningsKurus',
    label: 'Muhabir gideri',
    hint: 'Muhabir ücret / prim toplamı',
  },
  {
    key: 'cameramanEarningsKurus',
    label: 'Kameraman gideri',
    hint: 'Kameraman ücret / prim toplamı',
  },
] as const satisfies ReadonlyArray<{
  key: keyof ReportCashExpenseParts
  label: string
  hint: string
}>
