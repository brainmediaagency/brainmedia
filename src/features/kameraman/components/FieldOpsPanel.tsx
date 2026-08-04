import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { MonthPicker } from '@/components/ui/MonthPicker'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  fetchOdometerReadingsInRange,
  subscribeAllOdometerReadings,
} from '@/features/kameraman/services/odometerService'
import type {
  KameramanDayKm,
  KameramanOdometerReading,
} from '@/features/kameraman/types/odometer'
import {
  pairReadingsIntoDays,
  slotLabelTr,
  sumDayKm,
} from '@/features/kameraman/utils/odometerKm'
import { fetchReporterSummary } from '@/features/reporter/services/reporterSummaryService'
import {
  currentYearMonthIstanbul,
  formatDateOnlyLongTr,
  formatDateOnlyShortTr,
  formatYearMonthLongTr,
  formatYearMonthRangeTr,
  isValidDateOnly,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'

function shiftDateOnly(dateOnly: string, deltaDays: number): string {
  const [y, m, d] = dateOnly.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
  date.setUTCDate(date.getUTCDate() + deltaDays)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function currentYearMonth(): string {
  return currentYearMonthIstanbul()
}

function weekStartIstanbul(dateOnly: string): string {
  const [y, m, d] = dateOnly.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
  // Mon=0 … Sun=6 in Europe/Istanbul weekday for Monday-start weeks
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - weekday)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function StatBox({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-text-primary">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
    </div>
  )
}

export function FieldOpsPanel() {
  const [allReadings, setAllReadings] = useState<KameramanOdometerReading[]>([])
  const [reportDay, setReportDay] = useState(todayDateOnlyIstanbul)
  const [dayReportReadings, setDayReportReadings] = useState<
    KameramanOdometerReading[]
  >([])
  const [loadingDayReports, setLoadingDayReports] = useState(true)
  const [yearMonth, setYearMonth] = useState(currentYearMonth)
  const [monthDays, setMonthDays] = useState<KameramanDayKm[]>([])
  const [loadingMonthKm, setLoadingMonthKm] = useState(true)
  const [expenseTotals, setExpenseTotals] = useState<{
    hotelExpenseKurus: number
    stationeryExpenseKurus: number
    fuelExpenseKurus: number
    extraExpenseKurus: number
    reporterEarningsKurus: number
    cameramanEarningsKurus: number
    fieldPaidKurus: number
    totalExpenseKurus: number
  } | null>(null)
  const [loadingExpenses, setLoadingExpenses] = useState(true)
  const [photoPreview, setPhotoPreview] = useState<{
    url: string
    title: string
  } | null>(null)

  useEffect(() => {
    return subscribeAllOdometerReadings(
      (next) => {
        setAllReadings(next)
      },
      (error) => {
        toast.error(mapAppError(error, 'Kameraman raporları yüklenemedi.'))
      },
    )
  }, [])

  useEffect(() => {
    if (!isValidDateOnly(reportDay)) return
    let cancelled = false
    setLoadingDayReports(true)
    void (async () => {
      try {
        const rows = await fetchOdometerReadingsInRange({
          startDate: reportDay,
          endDate: reportDay,
        })
        if (!cancelled) setDayReportReadings(rows)
      } catch (error) {
        if (!cancelled) {
          toast.error(mapAppError(error, 'Günün kadran raporları yüklenemedi.'))
          setDayReportReadings([])
        }
      } finally {
        if (!cancelled) setLoadingDayReports(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reportDay])

  useEffect(() => {
    let cancelled = false
    const { start, end } = monthBounds(yearMonth)
    setLoadingMonthKm(true)
    setLoadingExpenses(true)

    void (async () => {
      try {
        const [odometer, summary] = await Promise.all([
          fetchOdometerReadingsInRange({ startDate: start, endDate: end }),
          fetchReporterSummary({ startDate: start, endDate: end }),
        ])
        if (cancelled) return
        setMonthDays(pairReadingsIntoDays(odometer))
        setExpenseTotals({
          hotelExpenseKurus: summary.totals.hotelExpenseKurus,
          stationeryExpenseKurus: summary.totals.stationeryExpenseKurus,
          fuelExpenseKurus: summary.totals.fuelExpenseKurus,
          extraExpenseKurus: summary.totals.extraExpenseKurus,
          reporterEarningsKurus: summary.totals.reporterEarningsKurus,
          cameramanEarningsKurus: summary.totals.cameramanEarningsKurus,
          fieldPaidKurus: summary.totals.fieldPaidKurus,
          totalExpenseKurus: summary.totals.totalExpenseKurus,
        })
      } catch (error) {
        if (!cancelled) {
          toast.error(mapAppError(error, 'Saha özeti yüklenemedi.'))
        }
      } finally {
        if (!cancelled) {
          setLoadingMonthKm(false)
          setLoadingExpenses(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [yearMonth])

  const dayPairs = useMemo(
    () => pairReadingsIntoDays(allReadings),
    [allReadings],
  )

  const reportDayPairs = useMemo(
    () => pairReadingsIntoDays(dayReportReadings),
    [dayReportReadings],
  )

  const today = todayDateOnlyIstanbul()
  const weekStart = weekStartIstanbul(today)
  const weekEnd = shiftDateOnly(weekStart, 6)
  const isReportToday = reportDay === today
  const canGoNextDay = reportDay < today

  const kmToday = useMemo(
    () => sumDayKm(dayPairs.filter((d) => d.reportDate === today)),
    [dayPairs, today],
  )
  const kmWeek = useMemo(
    () =>
      sumDayKm(
        dayPairs.filter(
          (d) => d.reportDate >= weekStart && d.reportDate <= weekEnd,
        ),
      ),
    [dayPairs, weekStart, weekEnd],
  )
  const kmMonth = useMemo(() => sumDayKm(monthDays), [monthDays])
  const kmReportDay = useMemo(
    () => sumDayKm(reportDayPairs),
    [reportDayPairs],
  )

  return (
    <div className="space-y-8">
      <AccordionSection
        number="01"
        title="Km ve saha giderleri"
        description="Saha km (kameraman kadran farkı) ve muhabir günlük raporlarından saha gider kalemleri. Genel kasaya karışmaz."
        defaultOpen
      >
        <div className="mb-5">
          <MonthPicker
            id="field-ops-month"
            value={yearMonth}
            onChange={setYearMonth}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatBox
            label="Bugün saha km"
            value={`${kmToday.toLocaleString('tr-TR')} km`}
            hint={formatDateOnlyLongTr(today)}
          />
          <StatBox
            label="Bu hafta saha km"
            value={`${kmWeek.toLocaleString('tr-TR')} km`}
            hint={`${formatDateOnlyShortTr(weekStart)} – ${formatDateOnlyShortTr(weekEnd)}`}
          />
          <StatBox
            label={`${formatYearMonthLongTr(yearMonth)} saha km`}
            value={
              loadingMonthKm
                ? '…'
                : `${kmMonth.toLocaleString('tr-TR')} km`
            }
            hint={formatYearMonthRangeTr(yearMonth)}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loadingExpenses || !expenseTotals ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : (
            <>
              <StatBox
                label="Otel ödemesi (ay)"
                value={formatTryFromKurus(expenseTotals.hotelExpenseKurus)}
              />
              <StatBox
                label="Muhabir ücreti (ay)"
                value={formatTryFromKurus(expenseTotals.reporterEarningsKurus)}
              />
              <StatBox
                label="Kameraman ücreti (ay)"
                value={formatTryFromKurus(
                  expenseTotals.cameramanEarningsKurus,
                )}
              />
              <StatBox
                label="Sahaya ödenen (ay)"
                value={formatTryFromKurus(expenseTotals.fieldPaidKurus)}
              />
              <StatBox
                label="Benzin (ay)"
                value={formatTryFromKurus(expenseTotals.fuelExpenseKurus)}
              />
              <StatBox
                label="Kırtasiye (ay)"
                value={formatTryFromKurus(
                  expenseTotals.stationeryExpenseKurus,
                )}
              />
              <StatBox
                label="Ekstra gider (ay)"
                value={formatTryFromKurus(expenseTotals.extraExpenseKurus)}
              />
              <StatBox
                label="Toplam gider (ay)"
                value={formatTryFromKurus(expenseTotals.totalExpenseKurus)}
              />
            </>
          )}
        </div>
      </AccordionSection>

      <AccordionSection
        number="02"
        title="Kameraman raporları"
        description="Tarihe göre sabah / akşam kadran görselleri ve günlük km farkı."
        defaultOpen
      >
        <div className="mb-4 space-y-3">
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label="Önceki gün"
              className="shrink-0 px-2.5"
              onClick={() => setReportDay((d) => shiftDateOnly(d, -1))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <FormField
              label="Rapor günü"
              htmlFor="field-ops-report-day"
              className="w-auto min-w-0 max-w-[14rem] flex-1 basis-[10.5rem] sm:flex-none"
            >
              <DateInput
                id="field-ops-report-day"
                value={reportDay}
                max={today}
                onChange={(e) => {
                  const next = e.target.value
                  if (!isValidDateOnly(next)) return
                  setReportDay(next > today ? today : next)
                }}
              />
            </FormField>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label="Sonraki gün"
              className="shrink-0 px-2.5"
              disabled={!canGoNextDay}
              onClick={() =>
                setReportDay((d) => {
                  const next = shiftDateOnly(d, 1)
                  return next > today ? today : next
                })
              }
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            {!isReportToday ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0 whitespace-nowrap px-3.5"
                onClick={() => setReportDay(today)}
              >
                Bugün
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">
              {formatDateOnlyLongTr(reportDay)}
            </span>
            {' · '}
            {loadingDayReports
              ? 'yükleniyor…'
              : `${reportDayPairs.length} kameraman · ${kmReportDay.toLocaleString('tr-TR')} km saha`}
          </p>
        </div>

        {loadingDayReports ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : reportDayPairs.length === 0 ? (
          <EmptyState
            title="Bu günde rapor yok"
            description={`${formatDateOnlyLongTr(reportDay)} için kadran girişi bulunamadı. Başka bir gün seçin.`}
          />
        ) : (
          <ul className="space-y-4">
            {reportDayPairs.map((day) => (
              <li
                key={`${day.createdByUid}-${day.reportDate}`}
                className="rounded-[var(--radius-md)] border border-border bg-surface p-4 shadow-[var(--shadow-xs)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-primary">
                      {day.createdByNameSnapshot}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {formatDateOnlyLongTr(day.reportDate)}
                    </p>
                  </div>
                  <p className="font-display text-lg font-semibold tabular-nums text-text-primary">
                    {day.dayKm != null
                      ? day.label
                      : 'Günlük km henüz hesaplanamadı'}
                  </p>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(['morning', 'evening'] as const).map((slot) => {
                    const item =
                      slot === 'morning' ? day.morning : day.evening
                    return (
                      <div
                        key={slot}
                        className="rounded-[var(--radius-sm)] border border-border/80 p-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                          {slotLabelTr(slot)}
                        </p>
                        {item ? (
                          <>
                            <p className="mt-1 text-sm font-medium tabular-nums">
                              {item.odometerKm.toLocaleString('tr-TR')} km
                            </p>
                            {item.note ? (
                              <p className="mt-1 text-xs text-text-secondary">
                                {item.note}
                              </p>
                            ) : null}
                            {item.photoDownloadUrl ? (
                              <button
                                type="button"
                                className="mt-2 block w-full overflow-hidden rounded border border-border text-left"
                                onClick={() =>
                                  setPhotoPreview({
                                    url: item.photoDownloadUrl,
                                    title: `${day.createdByNameSnapshot} · ${slotLabelTr(slot)} · ${formatDateOnlyLongTr(day.reportDate)}`,
                                  })
                                }
                              >
                                <img
                                  src={item.photoDownloadUrl}
                                  alt={`${slotLabelTr(slot)} kadran`}
                                  className="h-36 w-full object-cover bg-surface-muted"
                                />
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-text-secondary">
                            Girilmedi
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AccordionSection>

      <Modal
        open={photoPreview !== null}
        onClose={() => setPhotoPreview(null)}
        title={photoPreview?.title ?? 'Kadran'}
      >
        {photoPreview ? (
          <img
            src={photoPreview.url}
            alt={photoPreview.title}
            className="max-h-[70vh] w-full object-contain"
          />
        ) : null}
      </Modal>
    </div>
  )
}
