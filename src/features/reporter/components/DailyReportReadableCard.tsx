import { type ReactNode } from 'react'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { formatDateOnlyLongTr, formatDateTimeTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { cn } from '@/lib/classNames'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import { sumCompanyFees } from '@/features/reporter/utils/feeCalc'
import {
  DailyReportDetailBody,
  MoneyLine,
} from '@/features/reporter/components/DailyReportDetailBody'

export type { MoneyLineProps } from '@/features/reporter/components/DailyReportDetailBody'
export { MoneyLine }

export type DailyReportReadableCardProps = {
  report: ReporterDailyReport
  /** Extra actions in the header (edit/delete). */
  actions?: ReactNode
  /** Start collapsed (list views). */
  defaultOpen?: boolean
  /** `true` / `false` Z durumu; `null` gizler */
  zReportEntered?: boolean | null
  className?: string
}

/**
 * Categorized, mobile-friendly daily report reader with brand-tinted sections.
 */
export function DailyReportReadableCard({
  report,
  actions,
  defaultOpen = false,
  zReportEntered = null,
  className,
}: DailyReportReadableCardProps) {
  const feeTotals = sumCompanyFees(report.companies)
  const totalIncomeKurus =
    feeTotals.totalIncomeKurus ||
    (Array.isArray(report.companies)
      ? report.companies.reduce((s, c) => s + c.vatBaseKurus + c.vatKurus, 0)
      : Number(report.earningsKurus ?? 0))

  const subtitle = [
    report.createdByNameSnapshot || null,
    report.createdByEmailSnapshot || null,
    `${report.companyCount} firma`,
    report.createdAt ? `gönderim ${formatDateTimeTr(report.createdAt.toDate())}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <CollapsibleListItem
      title={`${formatDateOnlyLongTr(report.reportDate)} tarihli rapor`}
      subtitle={subtitle}
      meta={
        <span className="hidden tabular-nums text-brand-blue sm:inline">
          {formatTryFromKurus(totalIncomeKurus)}
        </span>
      }
      action={actions}
      defaultOpen={defaultOpen}
      className={cn('interactive-lift overflow-hidden bg-surface', className)}
    >
      <DailyReportDetailBody report={report} zReportEntered={zReportEntered} />
    </CollapsibleListItem>
  )
}
