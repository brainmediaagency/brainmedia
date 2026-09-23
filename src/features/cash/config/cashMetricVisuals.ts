import {
  Banknote,
  BedDouble,
  Camera,
  CirclePlus,
  Fuel,
  Landmark,
  Mic,
  PenLine,
  Receipt,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { MetricAccent, MetricTopBar } from '@/components/ui/MetricCard'
import type { CASH_EXPENSE_LINE_ITEMS } from '@/features/cash/config/cashExpenseLineItems'

export type CashMetricVisual = {
  icon: LucideIcon
  accent: MetricAccent
  topBar: MetricTopBar
}

/**
 * Kasa colour semantics: green = money in, orange = money out / deficit,
 * yellow = cash handed to the field, blue = balance and staff fees.
 */
export const CASH_METRIC_VISUAL = {
  income: { icon: Wallet, accent: 'green', topBar: 'green' },
  expense: { icon: Receipt, accent: 'orange', topBar: 'orange' },
  fieldPaid: { icon: Banknote, accent: 'yellow', topBar: 'yellow' },
} as const satisfies Record<string, CashMetricVisual>

export function cashBalanceVisual(balanceKurus: number): CashMetricVisual {
  return balanceKurus < 0
    ? { icon: Landmark, accent: 'orange', topBar: 'orange' }
    : { icon: Landmark, accent: 'cyan', topBar: 'navy' }
}

export function cashBalanceFooter(balanceKurus: number, hint: string): string {
  return balanceKurus < 0 ? `Kasa açığı · ${hint}` : hint
}

export const EXPENSE_ITEM_VISUAL: Record<
  (typeof CASH_EXPENSE_LINE_ITEMS)[number]['key'],
  CashMetricVisual
> = {
  hotelExpenseKurus: { icon: BedDouble, accent: 'orange', topBar: 'orange' },
  stationeryExpenseKurus: { icon: PenLine, accent: 'orange', topBar: 'orange' },
  fuelExpenseKurus: { icon: Fuel, accent: 'orange', topBar: 'orange' },
  mealExpenseKurus: { icon: UtensilsCrossed, accent: 'orange', topBar: 'orange' },
  extraExpenseKurus: { icon: CirclePlus, accent: 'orange', topBar: 'orange' },
  reporterEarningsKurus: { icon: Mic, accent: 'navy', topBar: 'navy' },
  cameramanEarningsKurus: { icon: Camera, accent: 'navy', topBar: 'navy' },
}
