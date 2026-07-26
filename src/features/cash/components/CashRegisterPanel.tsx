import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { Drawer } from '@/components/ui/Drawer'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  emptyReportCashTotals,
  subscribeReportCashGroups,
} from '@/features/cash/services/cashService'
import type { ReportCashGroup, ReportCashTotals } from '@/features/cash/types/cash'
import { DailyReportDetailBody } from '@/features/reporter/components/DailyReportDetailBody'
import { getDailyReport } from '@/features/reporter/services/dailyReportService'
import { fetchZReportsInRange } from '@/features/reporter/services/zReportService'
import type {
  ReporterDailyReport,
  ReporterZReport,
} from '@/features/reporter/types/reporter'
import { hasZReportForDaily } from '@/features/reporter/utils/zReportMatch'
import { formatDateOnlyLongTr, formatDateTimeTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'

function SummaryCard({
  label,
  valueKurus,
  hint,
  tone,
}: {
  label: string
  valueKurus: number
  hint: string
  tone: 'income' | 'expense' | 'field' | 'cash'
}) {
  const toneClass =
    tone === 'income'
      ? 'border-success/30 bg-success/5'
      : tone === 'expense'
        ? 'border-danger/30 bg-danger/5'
        : tone === 'field'
          ? 'border-warning/30 bg-warning/5'
          : 'border-brand-blue/30 bg-brand-blue/5'

  return (
    <div className={`rounded-[var(--radius-md)] border p-4 ${toneClass}`}>
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-text-primary">
        {formatTryFromKurus(valueKurus)}
      </p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </div>
  )
}

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

export type CashRegisterPanelProps = {
  sectionNumber: number
}

export function CashRegisterPanel({ sectionNumber }: CashRegisterPanelProps) {
  const [reportGroups, setReportGroups] = useState<ReportCashGroup[]>([])
  const [reportTotals, setReportTotals] = useState<ReportCashTotals>(emptyReportCashTotals)
  const [zReports, setZReports] = useState<ReporterZReport[]>([])
  const [detailReport, setDetailReport] = useState<ReporterDailyReport | null>(null)
  const [detailZEntered, setDetailZEntered] = useState<boolean | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)

  useEffect(() => {
    const onError = (error: Error) =>
      toast.error(mapAppError(error, 'Kasa hareketleri yüklenemedi.'))
    return subscribeReportCashGroups((groups, totals) => {
      setReportGroups(groups)
      setReportTotals(totals)
    }, onError)
  }, [])

  const zDateRange = useMemo(() => {
    if (reportGroups.length === 0) return null
    let start = reportGroups[0]!.reportDate
    let end = reportGroups[0]!.reportDate
    for (const group of reportGroups) {
      if (group.reportDate < start) start = group.reportDate
      if (group.reportDate > end) end = group.reportDate
    }
    return { startDate: start, endDate: end }
  }, [reportGroups])

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
    setDetailZEntered(
      hasZReportForDaily(
        { reportDate: group.reportDate, createdByUid: group.createdByUid },
        zReports,
      ),
    )
    try {
      const report = await getDailyReport(group.reportId)
      if (!report) {
        toast.error('Rapor bulunamadı veya silinmiş.')
        return
      }
      setDetailReport(report)
      setDetailZEntered(hasZReportForDaily(report, zReports))
    } catch (error) {
      toast.error(mapAppError(error, 'Rapor detayı yüklenemedi.'))
    } finally {
      setDetailLoadingId(null)
    }
  }

  return (
    <>
      <AccordionSection
        number={String(sectionNumber).padStart(2, '0')}
        title="Kasa"
        description="Muhabir formlarından gelen gelir, gider, sahaya ödenen ve kasa bakiyesi."
        defaultOpen
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Toplam gelir"
              valueKurus={reportTotals.totalIncomeKurus}
              hint={`${reportTotals.reportCount} form · matrah + KDV`}
              tone="income"
            />
            <SummaryCard
              label="Toplam gider"
              valueKurus={reportTotals.totalExpenseKurus}
              hint="Saha giderleri + ücretler + KDV"
              tone="expense"
            />
            <SummaryCard
              label="Sahaya ödenen"
              valueKurus={reportTotals.totalFieldPaidKurus}
              hint="Kasadan sahaya verilen tutar"
              tone="field"
            />
            <SummaryCard
              label="Kasa"
              valueKurus={cashBalanceKurus}
              hint="Sahaya ödenen − toplam gider"
              tone="cash"
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Muhabir raporları
            </p>
            {reportGroups.length === 0 ? (
              <p className="text-sm text-text-secondary">Henüz form raporu yok.</p>
            ) : (
              <ul className="space-y-2">
                {reportGroups.map((group) => {
                  const groupCash = group.fieldPaidKurus - group.expenseKurus
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
                          label="Toplam gelir"
                          valueKurus={group.incomeKurus}
                          tone="income"
                        />
                        <DetailRow
                          label="Toplam gider"
                          valueKurus={group.expenseKurus}
                          tone="expense"
                        />
                        <DetailRow
                          label="Sahaya ödenen"
                          valueKurus={group.fieldPaidKurus}
                          tone="field"
                        />
                        <DetailRow label="Kasa" valueKurus={groupCash} tone="cash" />
                      </div>
                    </CollapsibleListItem>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </AccordionSection>

      <Drawer
        open={detailReport !== null || detailLoadingId !== null}
        onClose={() => {
          setDetailReport(null)
          setDetailZEntered(null)
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
          <DailyReportDetailBody report={detailReport} zReportEntered={detailZEntered} />
        ) : null}
      </Drawer>
    </>
  )
}
