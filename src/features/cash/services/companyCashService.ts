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

/**
 * Tek raporun kasa katkısı: sahaya ödenen − gider (yönetim “Kasa / devreden”).
 */
export function reportNetCashKurus(
  report: Pick<
    ReporterDailyReport,
    | 'fieldPaidKurus'
    | 'totalExpenseKurus'
    | 'operatingExpenseKurus'
    | 'employeeExpenseKurus'
    | 'totalVatKurus'
  > | Record<string, unknown>,
): number {
  const fieldPaid = Math.max(0, Math.trunc(Number(report.fieldPaidKurus ?? 0) || 0))
  const expense = Math.max(
    0,
    Math.trunc(reportExpenseKurus(report as ReporterDailyReport)),
  )
  return fieldPaid - expense
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
 * Incremental bakiyeyi günceller (rapor create/update/delete sonrası).
 * Snap yoksa baseline 0 kabul edilir; yönetim kasa paneli tam yeniden yazar.
 */
export async function applyCompanyCashContributionDelta(
  deltaKurus: number,
): Promise<void> {
  if (!Number.isFinite(deltaKurus) || deltaKurus === 0) return
  const delta = Math.trunc(deltaKurus)
  if (delta === 0) return

  const ref = doc(getDb(), COMPANY_CASH_COLLECTION, COMPANY_CASH_DOC_ID)
  await runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref)
    const prev = snap.exists()
      ? Math.trunc(Number(snap.data()?.cashBalanceKurus ?? 0) || 0)
      : 0
    transaction.set(
      ref,
      {
        cashBalanceKurus: prev + delta,
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
      onData({
        cashBalanceKurus: Math.trunc(Number(data.cashBalanceKurus ?? 0) || 0),
        totalFieldPaidKurus: Math.trunc(
          Number(data.totalFieldPaidKurus ?? 0) || 0,
        ),
        totalExpenseKurus: Math.trunc(Number(data.totalExpenseKurus ?? 0) || 0),
        totalIncomeKurus: Math.trunc(Number(data.totalIncomeKurus ?? 0) || 0),
        reportCount: Math.trunc(Number(data.reportCount ?? 0) || 0),
      })
    },
    (error) => onError?.(error),
  )
}
