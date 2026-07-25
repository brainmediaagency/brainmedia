import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Newspaper,
  Users,
} from 'lucide-react'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { MetricCard } from '@/components/ui/MetricCard'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/Table'
import {
  fetchReporterSummary,
  type ReporterSummaryResult,
} from '@/features/reporter/services/reporterSummaryService'
import { subscribeReporters } from '@/features/users/services/userService'
import type { UserProfile } from '@/features/users/types/user'
import { formatDateOnlyLongTr, todayDateOnlyIstanbul } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'

const ALL_REPORTERS = '__all__'

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type ReporterSummaryPanelProps = {
  sectionNumber?: string
  defaultOpen?: boolean
  /** When set, picker is locked to this reporter (own stats). */
  lockedReporterUid?: string | null
  lockedReporterName?: string | null
  /** Show reporter filter (mgmt / coord / HR). */
  allowReporterPicker?: boolean
}

export function ReporterSummaryPanel({
  sectionNumber = '01',
  defaultOpen = true,
  lockedReporterUid = null,
  lockedReporterName = null,
  allowReporterPicker = false,
}: ReporterSummaryPanelProps) {
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(
    () => new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    [defaultEnd],
  )

  const [startDate, setStartDate] = useState(() => toDateInputValue(defaultStart))
  const [endDate, setEndDate] = useState(() => toDateInputValue(defaultEnd))
  const [reporterFilter, setReporterFilter] = useState(
    () => lockedReporterUid ?? ALL_REPORTERS,
  )
  const [reporters, setReporters] = useState<UserProfile[]>([])
  const [reportersReady, setReportersReady] = useState(!allowReporterPicker)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ReporterSummaryResult | null>(null)

  useEffect(() => {
    if (lockedReporterUid) {
      setReporterFilter(lockedReporterUid)
    }
  }, [lockedReporterUid])

  useEffect(() => {
    if (!allowReporterPicker) {
      setReportersReady(true)
      return
    }
    return subscribeReporters(
      (users) => {
        setReporters(users)
        setReportersReady(true)
      },
      (error) => {
        toast.error(mapAppError(error, 'Muhabir listesi yüklenemedi.'))
        setReportersReady(true)
      },
    )
  }, [allowReporterPicker])

  const load = useCallback(async () => {
    if (!startDate || !endDate || startDate > endDate) {
      toast.error('Geçerli bir tarih aralığı seçin.')
      return
    }

    const createdByUid = allowReporterPicker
      ? reporterFilter === ALL_REPORTERS
        ? null
        : reporterFilter
      : lockedReporterUid

    if (!allowReporterPicker && !createdByUid) {
      toast.error('Muhabir kimliği bulunamadı.')
      return
    }

    setLoading(true)
    try {
      const result = await fetchReporterSummary({
        startDate,
        endDate,
        createdByUid,
      })
      setSummary(result)
    } catch (error) {
      toast.error(mapAppError(error, 'Muhabir özeti yüklenemedi.'))
    } finally {
      setLoading(false)
    }
  }, [
    allowReporterPicker,
    endDate,
    lockedReporterUid,
    reporterFilter,
    startDate,
  ])

  useEffect(() => {
    if (!reportersReady) return
    void load()
  }, [reportersReady, load])

  const selectedLabel = allowReporterPicker
    ? reporterFilter === ALL_REPORTERS
      ? 'Tüm muhabirler'
      : reporters.find((r) => r.uid === reporterFilter)?.fullName ||
        'Seçili muhabir'
    : lockedReporterName || 'Sizin özetiniz'

  const showReporterBreakdown =
    allowReporterPicker &&
    reporterFilter === ALL_REPORTERS &&
    (summary?.byReporter.length ?? 0) > 1

  return (
    <AccordionSection
      number={sectionNumber}
      title="Muhabir Özet"
      description="Günlük raporlara göre çekim dakikası, haber ve çekildi iş özeti."
      defaultOpen={defaultOpen}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
          <FormField label="Başlangıç" htmlFor="reporter-summary-start">
            <DateInput
              id="reporter-summary-start"
              value={startDate}
              max={endDate || todayDateOnlyIstanbul()}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <FormField label="Bitiş" htmlFor="reporter-summary-end">
            <DateInput
              id="reporter-summary-end"
              value={endDate}
              min={startDate}
              max={todayDateOnlyIstanbul()}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
          {allowReporterPicker ? (
            <FormField label="Muhabir" htmlFor="reporter-summary-user">
              <Select
                id="reporter-summary-user"
                value={reporterFilter}
                onChange={(e) => setReporterFilter(e.target.value)}
              >
                <option value={ALL_REPORTERS}>Tüm muhabirler</option>
                {reporters.map((reporter) => (
                  <option key={reporter.uid} value={reporter.uid}>
                    {reporter.fullName || reporter.email || reporter.uid}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField label="Muhabir" htmlFor="reporter-summary-self">
              <Select
                id="reporter-summary-self"
                value={lockedReporterUid ?? ''}
                disabled
              >
                <option value={lockedReporterUid ?? ''}>
                  {lockedReporterName || 'Sizin özetiniz'}
                </option>
              </Select>
            </FormField>
          )}
          <Button type="button" onClick={() => void load()} loading={loading}>
            Filtrele
          </Button>
        </div>

        <p className="text-sm text-text-secondary">
          Görüntülenen: <span className="font-medium text-text-primary">{selectedLabel}</span>
        </p>

        {loading && !summary ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-[var(--radius-md)]" />
            ))}
          </div>
        ) : summary ? (
          <>
            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-text-primary">
                Çalışma özeti
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Çekim dakikası"
                  value={summary.totals.shootMinutes}
                  icon={Clock3}
                  accent="orange"
                  suffix="dk"
                  animate
                />
                <MetricCard
                  label="Haber sayısı"
                  value={summary.totals.newsCount}
                  icon={Newspaper}
                  accent="pink"
                  topBar="pink"
                  animate
                />
                <MetricCard
                  label="Çekildi iş"
                  value={summary.totals.companyCount}
                  icon={CheckCircle2}
                  accent="navy"
                  topBar="navy"
                  animate
                  footer="Raporlara eklenen işler"
                />
                <MetricCard
                  label="Rapor sayısı"
                  value={summary.totals.reportCount}
                  icon={FileText}
                  accent="cyan"
                  animate
                  footer={
                    allowReporterPicker && reporterFilter === ALL_REPORTERS
                      ? `${summary.totals.uniqueReporterCount} muhabir`
                      : undefined
                  }
                />
              </div>
            </div>

            {summary.totals.reportCount === 0 ? (
              <EmptyState
                title="Kayıt yok"
                description="Seçilen aralıkta günlük rapor bulunmuyor."
              />
            ) : (
              <>
                {showReporterBreakdown ? (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-text-primary">
                      <Users className="size-4 text-brand-blue" aria-hidden="true" />
                      Muhabir bazında
                    </h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell header>Muhabir</TableCell>
                            <TableCell header className="text-right">
                              Rapor
                            </TableCell>
                            <TableCell header className="text-right">
                              Çekildi
                            </TableCell>
                            <TableCell header className="text-right">
                              Haber
                            </TableCell>
                            <TableCell header className="text-right">
                              Dk
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {summary.byReporter.map((row) => (
                            <TableRow key={row.uid}>
                              <TableCell className="font-medium text-text-primary">
                                {row.fullName}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.reportCount}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.companyCount}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.newsCount}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.shootMinutes}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-text-primary">
                    <Camera className="size-4 text-brand-blue" aria-hidden="true" />
                    Günlük kırılım
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell header>Tarih</TableCell>
                          <TableCell header className="text-right">
                            Rapor
                          </TableCell>
                          <TableCell header className="text-right">
                            Çekildi
                          </TableCell>
                          <TableCell header className="text-right">
                            Haber
                          </TableCell>
                          <TableCell header className="text-right">
                            Dk
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {summary.byDay.map((row) => (
                          <TableRow key={row.reportDate}>
                            <TableCell className="font-medium text-text-primary">
                              {formatDateOnlyLongTr(row.reportDate)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.reportCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.companyCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.newsCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.shootMinutes}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <EmptyState
            title="Özet yüklenemedi"
            description="Filtreleri kontrol edip tekrar deneyin."
          />
        )}
      </div>
    </AccordionSection>
  )
}
