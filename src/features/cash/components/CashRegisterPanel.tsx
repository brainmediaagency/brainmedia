import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { Drawer } from '@/components/ui/Drawer'
import { MetricCard } from '@/components/ui/MetricCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  emptyReportCashTotals,
  fetchReportCashGroupsForMonth,
  subscribeReportCashGroups,
} from '@/features/cash/services/cashService'
import { publishCompanyCashSnapshot } from '@/features/cash/services/companyCashService'
import { CASH_EXPENSE_LINE_ITEMS } from '@/features/cash/config/cashExpenseLineItems'
import {
  CASH_METRIC_VISUAL,
  EXPENSE_ITEM_VISUAL,
  cashBalanceFooter,
  cashBalanceVisual,
} from '@/features/cash/config/cashMetricVisuals'
import type { ReportCashGroup, ReportCashTotals } from '@/features/cash/types/cash'
import { DailyReportDetailBody } from '@/features/reporter/components/DailyReportDetailBody'
import { getDailyReport } from '@/features/reporter/services/dailyReportService'
import { fetchZReportsInRange } from '@/features/reporter/services/zReportService'
import type {
  ReporterDailyReport,
  ReporterZReport,
} from '@/features/reporter/types/reporter'
import { findZReportForDaily, hasZReportForDaily } from '@/features/reporter/utils/zReportMatch'
import {
  formatDateOnlyLongTr,
  formatDateTimeTr,
  formatYearMonthLongTr,
  formatYearMonthRangeTr,
  statsMonthDateBounds,
} from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'

function DetailRow({
  label,
  valueKurus,
  tone,
}: {
  label: string
  valueKurus: number
  tone: 'income' | 'expense' | 'field' | 'cash'
}) {
  const className =
    tone === 'income'
      ? 'tabular-nums font-semibold text-success'
      : tone === 'field'
        ? 'tabular-nums font-semibold text-danger'
        : tone === 'cash'
          ? 'tabular-nums font-semibold text-brand-blue'
          : 'tabular-nums font-semibold text-text-secondary'

  const prefix = tone === 'income' ? '+' : tone === 'field' ? '−' : ''

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2 last:border-b-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={className}>
        {prefix}
        {formatTryFromKurus(valueKurus)}
      </span>
    </div>
  )
}

export type CashRegisterScope =
  | { kind: 'total' }
  | { kind: 'reporter'; createdByUid: string | null; label: string }

export type CashRegisterPeriod =
  | { kind: 'all' }
  | { kind: 'month'; yearMonth: string }

export type CashRegisterPanelProps = {
  /** Panel title suffix, e.g. "Kasa Toplam" / "Kasa Merve". */
  title?: string
  scope?: CashRegisterScope
  /** All-time (live) or ops-month window. Default: all. */
  period?: CashRegisterPeriod
  /**
   * Publish opsCash/current from this panel (only all-time Kasa Toplam).
   * Ignored when period is a month. Default: true when scope is total.
   */
  publishCompanySnapshot?: boolean
}

export function CashRegisterPanel({
  title = 'Kasa',
  scope = { kind: 'total' },
  period = { kind: 'all' },
  publishCompanySnapshot,
}: CashRegisterPanelProps) {
  const [reportGroups, setReportGroups] = useState<ReportCashGroup[]>([])
  const [reportTotals, setReportTotals] = useState<ReportCashTotals>(
    emptyReportCashTotals,
  )
  const [loading, setLoading] = useState(period.kind === 'month')
  const [zReports, setZReports] = useState<ReporterZReport[]>([])
  const [detailReport, setDetailReport] = useState<ReporterDailyReport | null>(
    null,
  )
  const [detailZEntered, setDetailZEntered] = useState<boolean | null>(null)
  const [detailZPhotoUrl, setDetailZPhotoUrl] = useState<string | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)

  const filterUid = scope.kind === 'reporter' ? scope.createdByUid : null
  const isMonth = period.kind === 'month'
  const yearMonth = period.kind === 'month' ? period.yearMonth : null
  const shouldPublish =
    !isMonth && (publishCompanySnapshot ?? scope.kind === 'total')

  const monthLabel = yearMonth ? formatYearMonthLongTr(yearMonth) : null
  const monthRangeHint = yearMonth ? formatYearMonthRangeTr(yearMonth) : null

  const displayTitle =
    isMonth && monthLabel ? `${title} · ${monthLabel}` : title

  const description = isMonth
    ? scope.kind === 'reporter'
      ? `${scope.label} için ${monthLabel} dönem neti (${monthRangeHint}). Canlı kasa bakiyesi değil.`
      : `${monthLabel} dönem neti (${monthRangeHint}). Canlı kasa bakiyesi değil.`
    : scope.kind === 'reporter'
      ? `${scope.label} muhabir formlarından gelen gelir, gider, sahaya ödenen ve kasa bakiyesi.`
      : 'Tüm muhabir formlarından gelen gelir, gider, sahaya ödenen ve kasa bakiyesi.'

  useEffect(() => {
    const onError = (error: Error) =>
      toast.error(mapAppError(error, 'Kasa hareketleri yüklenemedi.'))

    if (scope.kind === 'reporter' && !filterUid) {
      setReportGroups([])
      setReportTotals(emptyReportCashTotals())
      setLoading(false)
      return
    }

    if (period.kind === 'month') {
      let cancelled = false
      setLoading(true)
      void fetchReportCashGroupsForMonth(period.yearMonth, {
        createdByUid: filterUid,
      })
        .then(({ groups, totals }) => {
          if (cancelled) return
          setReportGroups(groups)
          setReportTotals(totals)
          setLoading(false)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setReportGroups([])
          setReportTotals(emptyReportCashTotals())
          setLoading(false)
          onError(error instanceof Error ? error : new Error(String(error)))
        })
      return () => {
        cancelled = true
      }
    }

    setLoading(false)
    return subscribeReportCashGroups(
      (groups, totals) => {
        setReportGroups(groups)
        setReportTotals(totals)
        if (shouldPublish) {
          void publishCompanyCashSnapshot(totals).catch(() => {
            /* best-effort snapshot; panel fails soft */
          })
        }
      },
      onError,
      scope.kind === 'reporter' ? { createdByUid: filterUid } : undefined,
    )
  }, [scope.kind, filterUid, shouldPublish, period.kind, yearMonth])

  const zDateRange = useMemo(() => {
    if (period.kind === 'month') {
      try {
        return statsMonthDateBounds(period.yearMonth)
      } catch {
        return null
      }
    }
    if (reportGroups.length === 0) return null
    let start = reportGroups[0]!.reportDate
    let end = reportGroups[0]!.reportDate
    for (const group of reportGroups) {
      if (group.reportDate < start) start = group.reportDate
      if (group.reportDate > end) end = group.reportDate
    }
    return { startDate: start, endDate: end }
  }, [reportGroups, period])

  useEffect(() => {
    if (!zDateRange) {
      setZReports([])
      return
    }
    let cancelled = false
    void fetchZReportsInRange(zDateRange)
      .then((next) => {
        if (!cancelled) setZReports(next)
      })
      .catch(() => {
        if (!cancelled) setZReports([])
      })
    return () => {
      cancelled = true
    }
  }, [zDateRange])

  const cashBalanceKurus =
    reportTotals.totalFieldPaidKurus - reportTotals.totalExpenseKurus

  async function openReportDetail(group: ReportCashGroup) {
    setDetailLoadingId(group.reportId)
    setDetailReport(null)
    const previewZ = findZReportForDaily(
      { reportDate: group.reportDate, createdByUid: group.createdByUid },
      zReports,
    )
    setDetailZEntered(previewZ != null)
    setDetailZPhotoUrl(previewZ?.photoDownloadUrl ?? null)
    try {
      const report = await getDailyReport(group.reportId)
      if (!report) {
        toast.error('Rapor bulunamadı veya silinmiş.')
        return
      }
      setDetailReport(report)
      const matchedZ = findZReportForDaily(report, zReports)
      setDetailZEntered(matchedZ != null)
      setDetailZPhotoUrl(matchedZ?.photoDownloadUrl ?? null)
    } catch (error) {
      toast.error(mapAppError(error, 'Rapor detayı yüklenemedi.'))
    } finally {
      setDetailLoadingId(null)
    }
  }

  const waitingForUid = scope.kind === 'reporter' && !filterUid
  const cashHint = isMonth
    ? `Dönem neti · ${monthRangeHint}`
    : 'Sahaya ödenen − toplam gider'
  const formHint = isMonth
    ? `${reportTotals.reportCount} form · ${monthLabel}`
    : `${reportTotals.reportCount} form`

  return (
    <>
      <AccordionSection
        title={displayTitle}
        description={description}
        defaultOpen
      >
        <div className="space-y-5">
          {waitingForUid ? (
            <p className="text-sm text-text-secondary">
              Bu muhabir hesabı henüz bulunamadı. Hesaplar sekmesinden aktif
              olduğundan emin olun.
            </p>
          ) : loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Toplam gelir"
                  valueText={formatTryFromKurus(reportTotals.totalIncomeKurus)}
                  {...CASH_METRIC_VISUAL.income}
                  footer={
                    <>
                      Matrah {formatTryFromKurus(reportTotals.totalVatBaseKurus)}
                      {' · '}
                      KDV {formatTryFromKurus(reportTotals.totalVatKurus)}
                      <span className="mt-1 block text-xs">{formHint}</span>
                    </>
                  }
                />
                <MetricCard
                  label="Toplam gider"
                  valueText={formatTryFromKurus(reportTotals.totalExpenseKurus)}
                  {...CASH_METRIC_VISUAL.expense}
                  footer="Saha giderleri + ücretler"
                />
                <MetricCard
                  label="Sahaya ödenen"
                  valueText={formatTryFromKurus(reportTotals.totalFieldPaidKurus)}
                  {...CASH_METRIC_VISUAL.fieldPaid}
                  footer="Kasadan sahaya verilen tutar"
                />
                <MetricCard
                  label="Kasa"
                  valueText={formatTryFromKurus(cashBalanceKurus)}
                  {...cashBalanceVisual(cashBalanceKurus)}
                  footer={cashBalanceFooter(cashBalanceKurus, cashHint)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Gider kalemleri
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {CASH_EXPENSE_LINE_ITEMS.map((item) => {
                    const visual = EXPENSE_ITEM_VISUAL[item.key]
                    return (
                      <MetricCard
                        key={item.key}
                        label={item.label}
                        valueText={formatTryFromKurus(reportTotals[item.key])}
                        icon={visual.icon}
                        accent={visual.accent}
                        topBar={visual.topBar}
                        footer={item.hint}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Muhabir raporları
                </p>
                {reportGroups.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    {isMonth
                      ? 'Bu ay için form raporu yok.'
                      : 'Henüz form raporu yok.'}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {reportGroups.map((group) => {
                      const groupCash =
                        group.fieldPaidKurus - group.expenseKurus
                      const zEntered = hasZReportForDaily(
                        {
                          reportDate: group.reportDate,
                          createdByUid: group.createdByUid,
                        },
                        zReports,
                      )
                      return (
                        <CollapsibleListItem
                          key={group.reportId}
                          title={group.title}
                          subtitle={
                            <span className="flex flex-wrap items-center gap-2">
                              <span>{group.reporterName}</span>
                              <StatusBadge
                                status={zEntered ? 'completed' : 'pending'}
                                label={zEntered ? 'Z girildi' : 'Z girilmedi'}
                              />
                            </span>
                          }
                          meta={
                            group.createdAt
                              ? formatDateTimeTr(group.createdAt.toDate())
                              : undefined
                          }
                          action={
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => void openReportDetail(group)}
                              loading={detailLoadingId === group.reportId}
                            >
                              Detay
                            </Button>
                          }
                        >
                          <div className="space-y-0 px-1">
                            <DetailRow
                              label="Matrah"
                              valueKurus={group.vatBaseKurus}
                              tone="income"
                            />
                            <DetailRow
                              label="KDV"
                              valueKurus={group.vatKurus}
                              tone="income"
                            />
                            <DetailRow
                              label="Toplam gelir"
                              valueKurus={group.incomeKurus}
                              tone="income"
                            />
                            <DetailRow
                              label="Toplam gider"
                              valueKurus={group.expenseKurus}
                              tone="expense"
                            />
                            {CASH_EXPENSE_LINE_ITEMS.map((item) => (
                              <DetailRow
                                key={item.key}
                                label={item.label}
                                valueKurus={group[item.key]}
                                tone="expense"
                              />
                            ))}
                            <DetailRow
                              label="Sahaya ödenen"
                              valueKurus={group.fieldPaidKurus}
                              tone="field"
                            />
                            <DetailRow
                              label="Kasa"
                              valueKurus={groupCash}
                              tone="cash"
                            />
                          </div>
                        </CollapsibleListItem>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </AccordionSection>

      <Drawer
        open={detailReport !== null || detailLoadingId !== null}
        onClose={() => {
          setDetailReport(null)
          setDetailZEntered(null)
          setDetailZPhotoUrl(null)
          setDetailLoadingId(null)
        }}
        title={
          detailReport
            ? `${formatDateOnlyLongTr(detailReport.reportDate)} tarihli rapor`
            : 'Rapor detayı'
        }
        description={
          detailReport
            ? `${detailReport.createdByNameSnapshot} · gelir, gider ve Z durumu`
            : 'Yükleniyor…'
        }
        side="right"
        className="max-w-2xl"
      >
        {detailLoadingId && !detailReport ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : detailReport ? (
          <DailyReportDetailBody
            report={detailReport}
            zReportEntered={detailZEntered}
            zReportPhotoUrl={detailZPhotoUrl}
          />
        ) : null}
      </Drawer>
    </>
  )
}
