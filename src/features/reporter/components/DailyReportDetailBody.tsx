import {
  Building2,
  Camera,
  Coins,
  FileText,
  NotebookPen,
  Receipt,
  Wallet,
} from 'lucide-react'
import { CategoryPanel } from '@/components/ui/CategoryPanel'
import { formatTryFromKurus } from '@/lib/currency'
import { cn } from '@/lib/classNames'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import { shootGrossTotalKurus, sumCompanyFees } from '@/features/reporter/utils/feeCalc'

export type MoneyLineProps = {
  label: string
  valueKurus: number
  emphasize?: boolean
  tone?: 'default' | 'positive' | 'negative' | 'muted'
}

export function MoneyLine({
  label,
  valueKurus,
  emphasize = false,
  tone = 'default',
}: MoneyLineProps) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 border-b border-black/5 py-2 text-sm last:border-b-0',
        emphasize && 'border-b-0 pt-2.5',
      )}
    >
      <dt
        className={cn(
          'min-w-0 leading-snug',
          emphasize ? 'font-medium text-text-primary' : 'text-text-secondary',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'shrink-0 tabular-nums',
          emphasize ? 'text-base font-semibold' : 'font-medium',
          tone === 'positive' && 'text-[color:var(--cat-success-text)]',
          tone === 'negative' && 'text-danger',
          tone === 'muted' && 'text-text-secondary',
          tone === 'default' && 'text-text-primary',
        )}
      >
        {formatTryFromKurus(valueKurus)}
      </dd>
    </div>
  )
}

export type DailyReportDetailBodyProps = {
  report: ReporterDailyReport
  /** `true` = o gün Z raporu var; `false` = yok; `null` = henüz bilinmiyor */
  zReportEntered?: boolean | null
  className?: string
}

/**
 * Renkli kategori panelleriyle günlük rapor kırılımı (haber / çekim / ücret / gider / kasa).
 */
export function DailyReportDetailBody({
  report,
  zReportEntered = null,
  className,
}: DailyReportDetailBodyProps) {
  const feeTotals = sumCompanyFees(report.companies)
  const totals = {
    totalReporterEarningsKurus:
      report.totalReporterEarningsKurus || feeTotals.totalReporterEarningsKurus,
    totalCameramanEarningsKurus:
      report.totalCameramanEarningsKurus || feeTotals.totalCameramanEarningsKurus,
    totalVatBaseKurus: feeTotals.totalVatBaseKurus,
    totalVatKurus: report.totalVatKurus || feeTotals.totalVatKurus,
    totalIncomeKurus: feeTotals.totalIncomeKurus,
  }
  const hasAnyVat = report.companies.some((c) => c.chargeMode !== 'cash')
  const allCash = !hasAnyVat
  const operating =
    report.operatingExpenseKurus ||
    report.hotelExpenseKurus +
      report.stationeryExpenseKurus +
      report.fuelExpenseKurus +
      report.extraExpenseKurus
  const employee =
    report.employeeExpenseKurus ||
    totals.totalReporterEarningsKurus + totals.totalCameramanEarningsKurus
  const totalExpense =
    report.totalExpenseKurus || operating + employee + totals.totalVatKurus
  const netCash = totals.totalIncomeKurus - report.fieldPaidKurus

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-2 sm:grid-cols-3">
        <SummaryChip label="Toplam gelir" valueKurus={totals.totalIncomeKurus} />
        <SummaryChip label="Toplam gider" valueKurus={totalExpense} />
        <SummaryChip
          label="Net kasa"
          valueKurus={netCash}
          className={
            netCash >= 0
              ? 'border-[color:var(--cat-success-border)] bg-[color:var(--cat-success-bg)]'
              : 'border-danger/25 bg-danger/5'
          }
        />
      </div>

      <CategoryPanel
        title="Firmalar"
        description={
          allCash
            ? 'Haber, çekim ve nakit kırılımı'
            : 'Haber, çekim ve KDV kırılımı'
        }
        icon={Building2}
        tone="cyan"
        compact
      >
        <div className="space-y-3">
          {report.companies.map((company, index) => {
            const isCash = company.chargeMode === 'cash'
            return (
            <div
              key={`${report.id}-company-${index}`}
              className="rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 p-3 shadow-[var(--shadow-xs)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display font-semibold text-text-primary">
                  {company.companyName}
                </p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    isCash
                      ? 'bg-surface-muted text-text-secondary'
                      : 'bg-brand-cyan/12 text-brand-blue',
                  )}
                >
                  {isCash ? 'Nakit' : `KDV %${company.vatRate}`}
                </span>
              </div>
              <dl className="mt-2">
                {company.hasNews ? (
                  <>
                    <MoneyLine
                      label="Haber toplam iş tutarı"
                      valueKurus={company.newsTotalKurus ?? 0}
                    />
                    <MoneyLine
                      label="Haber · muhabir (%15)"
                      valueKurus={company.newsReporterFeeKurus ?? 0}
                    />
                    <MoneyLine
                      label="Haber · kameraman (%10)"
                      valueKurus={company.newsCameramanFeeKurus ?? 0}
                    />
                  </>
                ) : (
                  <p className="py-1.5 text-xs text-text-secondary">Haber yok</p>
                )}
                <MoneyLine
                  label={`Çekim · ${company.shootMinutes} dk`}
                  valueKurus={shootGrossTotalKurus(company.shootMinutes)}
                />
                <MoneyLine
                  label="Çekim · muhabir (%8)"
                  valueKurus={company.shootReporterFeeKurus}
                />
                <MoneyLine
                  label="Çekim · kameraman (%2)"
                  valueKurus={company.shootCameramanFeeKurus}
                />
                {isCash ? (
                  <MoneyLine
                    label="İş tutarı (nakit)"
                    valueKurus={company.vatBaseKurus}
                    emphasize
                  />
                ) : (
                  <>
                    <MoneyLine label="KDV matrahı" valueKurus={company.vatBaseKurus} />
                    <MoneyLine label="KDV tutarı" valueKurus={company.vatKurus} emphasize />
                  </>
                )}
              </dl>
            </div>
            )
          })}
        </div>
      </CategoryPanel>

      <CategoryPanel
        title="Saha ücretleri"
        description="Muhabir ve kameraman payları"
        icon={Camera}
        tone="pink"
        compact
      >
        <dl>
          <MoneyLine
            label="Toplam muhabir kazancı"
            valueKurus={totals.totalReporterEarningsKurus}
          />
          <MoneyLine
            label="Toplam kameraman kazancı"
            valueKurus={totals.totalCameramanEarningsKurus}
          />
          <MoneyLine label="Ücretler toplamı" valueKurus={employee} emphasize />
        </dl>
      </CategoryPanel>

      <CategoryPanel
        title="Saha giderleri"
        description="Otel, kırtasiye, benzin ve ekstra"
        icon={Receipt}
        tone="orange"
        compact
      >
        <dl>
          <MoneyLine label="Otel" valueKurus={report.hotelExpenseKurus} />
          <MoneyLine label="Kırtasiye" valueKurus={report.stationeryExpenseKurus} />
          <MoneyLine label="Benzin" valueKurus={report.fuelExpenseKurus} />
          <MoneyLine label="Ekstra" valueKurus={report.extraExpenseKurus} />
          <MoneyLine label="Saha giderleri ara toplam" valueKurus={operating} emphasize />
        </dl>
      </CategoryPanel>

      <CategoryPanel
        title="Toplam gelir"
        description={
          allCash || totals.totalVatKurus === 0
            ? 'Kasaya geçen tutar'
            : 'Matrah + KDV (kasaya geçen)'
        }
        icon={Coins}
        tone="violet"
        compact
      >
        <dl>
          <MoneyLine
            label={allCash || totals.totalVatKurus === 0 ? 'İş tutarı' : 'Matrah'}
            valueKurus={totals.totalVatBaseKurus}
          />
          {hasAnyVat && totals.totalVatKurus > 0 ? (
            <MoneyLine label="+ KDV" valueKurus={totals.totalVatKurus} />
          ) : null}
          <MoneyLine
            label="Toplam gelir"
            valueKurus={totals.totalIncomeKurus}
            emphasize
            tone="positive"
          />
          <MoneyLine label="Toplam gider" valueKurus={totalExpense} />
        </dl>
      </CategoryPanel>

      <CategoryPanel
        title="Kasa etkisi"
        description="Gelir eksi sahaya ödenen"
        icon={Wallet}
        tone={netCash >= 0 ? 'success' : 'navy'}
        compact
      >
        <dl>
          <MoneyLine
            label="Rapor geliri (+)"
            valueKurus={totals.totalIncomeKurus}
            tone="positive"
          />
          <MoneyLine
            label="Sahaya ödenen (−)"
            valueKurus={report.fieldPaidKurus}
            tone="negative"
          />
          <MoneyLine
            label="Net kasa etkisi"
            valueKurus={netCash}
            emphasize
            tone={netCash >= 0 ? 'positive' : 'negative'}
          />
        </dl>
      </CategoryPanel>

      {report.note ? (
        <CategoryPanel title="Not" icon={NotebookPen} tone="navy" compact>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {report.note}
          </p>
        </CategoryPanel>
      ) : (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-border bg-surface-muted/40 px-3 py-2 text-xs text-text-secondary">
          <FileText className="size-3.5 shrink-0" aria-hidden="true" />
          Not eklenmemiş
        </div>
      )}

      {zReportEntered !== null ? (
        <div
          className={cn(
            'rounded-[var(--radius-md)] border px-3 py-3 text-sm font-medium',
            zReportEntered
              ? 'border-[color:var(--cat-success-border)] bg-[color:var(--cat-success-bg)] text-[color:var(--cat-success-text)]'
              : 'border-warning/30 bg-warning/5 text-warning',
          )}
          role="status"
        >
          {zReportEntered
            ? 'Z raporu girildi'
            : 'Z raporu girilmedi — o güne özel Z raporu paylaşılmadı'}
        </div>
      ) : null}
    </div>
  )
}

function SummaryChip({
  label,
  valueKurus,
  className,
}: {
  label: string
  valueKurus: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-sm)] border border-border/70 bg-surface/80 px-3 py-2 backdrop-blur-sm',
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className="mt-0.5 font-display text-base font-semibold tabular-nums text-text-primary sm:text-lg">
        {formatTryFromKurus(valueKurus)}
      </p>
    </div>
  )
}
