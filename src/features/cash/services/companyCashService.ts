import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  reportExpenseKurus,
  reportIncomeKurus,
} from '@/features/cash/services/cashService'
import type { ReportCashTotals } from '@/features/cash/types/cash'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import { getDb } from '@/lib/firebase/firestore'

export const COMPANY_CASH_COLLECTION = 'opsCash'
export const COMPANY_CASH_DOC_ID = 'current'

export type CompanyCashSnapshot = {
  cashBalanceKurus: number
  totalFieldPaidKurus: number
  totalExpenseKurus: number
  totalIncomeKurus: number
  reportCount: number
}

/** Tek raporun kasa kalemleri (income / gider / sahaya ödenen). */
export type ReportCashParts = {
  incomeKurus: number
  expenseKurus: number
  fieldPaidKurus: number
}

export function reportCashParts(
  report:
    | Pick<
        ReporterDailyReport,
        | 'fieldPaidKurus'
        | 'totalExpenseKurus'
        | 'operatingExpenseKurus'
        | 'employeeExpenseKurus'
        | 'totalVatKurus'
        | 'companies'
        | 'earningsKurus'
      >
    | Record<string, unknown>,
): ReportCashParts {
  return {
    incomeKurus: Math.max(
      0,
      Math.trunc(reportIncomeKurus(report as ReporterDailyReport)),
    ),
    expenseKurus: Math.max(
      0,
      Math.trunc(reportExpenseKurus(report as ReporterDailyReport)),
    ),
    fieldPaidKurus: Math.max(
      0,
      Math.trunc(Number(report.fieldPaidKurus ?? 0) || 0),
    ),
  }
}

/**
 * Tek raporun kasa neti: sahaya ödenen − gider (yönetim “Kasa / devreden”).
 */
export function reportNetCashKurus(
  report: Parameters<typeof reportCashParts>[0],
): number {
  const parts = reportCashParts(report)
  return parts.fieldPaidKurus - parts.expenseKurus
}

export async function publishCompanyCashSnapshot(
  totals: ReportCashTotals,
): Promise<void> {
  const cashBalanceKurus =
    totals.totalFieldPaidKurus - totals.totalExpenseKurus
  await setDoc(
    doc(getDb(), COMPANY_CASH_COLLECTION, COMPANY_CASH_DOC_ID),
    {
      cashBalanceKurus,
      totalFieldPaidKurus: totals.totalFieldPaidKurus,
      totalExpenseKurus: totals.totalExpenseKurus,
      totalIncomeKurus: totals.totalIncomeKurus,
      reportCount: totals.reportCount,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/**
 * Rapor create / update / delete sonrası şirket kasa toplamlarını kaydırır.
 * `prev` veya `next` null = o taraf yok (create / soft-delete).
 * Snap yoksa baseline 0; yönetim kasa paneli tam yeniden yazar.
 */
export async function applyCompanyCashContributionDelta(
  next: ReportCashParts | null,
  prev: ReportCashParts | null = null,
): Promise<void> {
  const n = next ?? { incomeKurus: 0, expenseKurus: 0, fieldPaidKurus: 0 }
  const p = prev ?? { incomeKurus: 0, expenseKurus: 0, fieldPaidKurus: 0 }
  const incomeDelta = Math.trunc(n.incomeKurus - p.incomeKurus)
  const expenseDelta = Math.trunc(n.expenseKurus - p.expenseKurus)
  const fieldPaidDelta = Math.trunc(n.fieldPaidKurus - p.fieldPaidKurus)
  const reportCountDelta = (next ? 1 : 0) - (prev ? 1 : 0)

  if (
    incomeDelta === 0 &&
    expenseDelta === 0 &&
    fieldPaidDelta === 0 &&
    reportCountDelta === 0
  ) {
    return
  }

  const ref = doc(getDb(), COMPANY_CASH_COLLECTION, COMPANY_CASH_DOC_ID)
  await runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref)
    const data = snap.exists() ? snap.data() : {}
    const totalIncomeKurus =
      Math.trunc(Number(data.totalIncomeKurus ?? 0) || 0) + incomeDelta
    const totalExpenseKurus =
      Math.trunc(Number(data.totalExpenseKurus ?? 0) || 0) + expenseDelta
    const totalFieldPaidKurus =
      Math.trunc(Number(data.totalFieldPaidKurus ?? 0) || 0) + fieldPaidDelta
    const reportCount = Math.max(
      0,
      Math.trunc(Number(data.reportCount ?? 0) || 0) + reportCountDelta,
    )
    transaction.set(
      ref,
      {
        totalIncomeKurus,
        totalExpenseKurus,
        totalFieldPaidKurus,
        reportCount,
        cashBalanceKurus: totalFieldPaidKurus - totalExpenseKurus,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  })
}

export function subscribeCompanyCashBalance(
  onData: (snapshot: CompanyCashSnapshot | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), COMPANY_CASH_COLLECTION, COMPANY_CASH_DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      const data = snap.data()
      const totalFieldPaidKurus = Math.trunc(
        Number(data.totalFieldPaidKurus ?? 0) || 0,
      )
      const totalExpenseKurus = Math.trunc(
        Number(data.totalExpenseKurus ?? 0) || 0,
      )
      const totalIncomeKurus = Math.trunc(
        Number(data.totalIncomeKurus ?? 0) || 0,
      )
      const storedCash = data.cashBalanceKurus
      const cashBalanceKurus =
        storedCash === undefined || storedCash === null
          ? totalFieldPaidKurus - totalExpenseKurus
          : Math.trunc(Number(storedCash) || 0)
      onData({
        cashBalanceKurus,
        totalFieldPaidKurus,
        totalExpenseKurus,
        totalIncomeKurus,
        reportCount: Math.trunc(Number(data.reportCount ?? 0) || 0),
      })
    },
    (error) => onError?.(error),
  )
}
