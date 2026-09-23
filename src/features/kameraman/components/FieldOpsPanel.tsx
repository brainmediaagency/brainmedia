import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DateInput } from '@/components/ui/DateInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileUploadStatus } from '@/components/ui/FileUploadStatus'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  adminUpdateOdometerReading,
  deleteOdometerReading,
  fetchOdometerReadingsInRange,
  subscribeAllOdometerReadings,
} from '@/features/kameraman/services/odometerService'
import type {
  KameramanDayKm,
  KameramanOdometerReading,
} from '@/features/kameraman/types/odometer'
import {
  ODOMETER_PHOTO_MAX_BYTES,
  ODOMETER_PHOTO_MAX_MB,
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
  isValidDateOnly,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { driveUploadPhaseLabel } from '@/lib/driveUpload'
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

/** First calendar day of the Istanbul month for `yyyy-MM`. */
function firstDayOfYearMonth(yearMonth: string): string {
  return `${yearMonth}-01`
}

function defaultRangeStart(): string {
  return firstDayOfYearMonth(currentYearMonthIstanbul())
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
  const { profile, claims } = useAuth()
  const role = claims?.role ?? profile?.role
  const canManageReports = role === 'management' || role === 'coordinator'

  const [allReadings, setAllReadings] = useState<KameramanOdometerReading[]>([])
  const [reportDay, setReportDay] = useState(todayDateOnlyIstanbul)
  const [dayReportReadings, setDayReportReadings] = useState<
    KameramanOdometerReading[]
  >([])
  const [loadingDayReports, setLoadingDayReports] = useState(true)
  const [dayRefreshKey, setDayRefreshKey] = useState(0)
  const [rangeStart, setRangeStart] = useState(defaultRangeStart)
  const [rangeEnd, setRangeEnd] = useState(todayDateOnlyIstanbul)
  const [rangeDays, setRangeDays] = useState<KameramanDayKm[]>([])
  const [loadingRangeKm, setLoadingRangeKm] = useState(true)
  const [expenseTotals, setExpenseTotals] = useState<{
    hotelExpenseKurus: number
    stationeryExpenseKurus: number
    fuelExpenseKurus: number
    mealExpenseKurus: number
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
  const [editTarget, setEditTarget] = useState<KameramanOdometerReading | null>(
    null,
  )
  const [editKm, setEditKm] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editPreview, setEditPreview] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editUploadUi, setEditUploadUi] = useState<{
    label: string
    detail: string
    percent: number
  } | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<KameramanOdometerReading | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const editFileRef = useRef<HTMLInputElement>(null)

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
  }, [reportDay, dayRefreshKey])

  useEffect(() => {
    let cancelled = false
    if (!isValidDateOnly(rangeStart) || !isValidDateOnly(rangeEnd)) return
    if (rangeStart > rangeEnd) {
      setRangeDays([])
      setExpenseTotals(null)
      setLoadingRangeKm(false)
      setLoadingExpenses(false)
      return
    }

    setLoadingRangeKm(true)
    setLoadingExpenses(true)

    void (async () => {
      try {
        const [odometer, summary] = await Promise.all([
          fetchOdometerReadingsInRange({
            startDate: rangeStart,
            endDate: rangeEnd,
          }),
          fetchReporterSummary({
            startDate: rangeStart,
            endDate: rangeEnd,
          }),
        ])
        if (cancelled) return
        setRangeDays(pairReadingsIntoDays(odometer))
        setExpenseTotals({
          hotelExpenseKurus: summary.totals.hotelExpenseKurus,
          stationeryExpenseKurus: summary.totals.stationeryExpenseKurus,
          fuelExpenseKurus: summary.totals.fuelExpenseKurus,
          mealExpenseKurus: summary.totals.mealExpenseKurus,
          extraExpenseKurus: summary.totals.extraExpenseKurus,
          reporterEarningsKurus: summary.totals.reporterEarningsKurus,
          cameramanEarningsKurus: summary.totals.cameramanEarningsKurus,
          fieldPaidKurus: summary.totals.fieldPaidKurus,
          totalExpenseKurus: summary.totals.totalExpenseKurus,
        })
      } catch (error) {
        if (!cancelled) {
          toast.error(mapAppError(error, 'Saha özeti yüklenemedi.'))
          setRangeDays([])
          setExpenseTotals(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingRangeKm(false)
          setLoadingExpenses(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rangeStart, rangeEnd])

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
  const rangeLabel =
    isValidDateOnly(rangeStart) && isValidDateOnly(rangeEnd)
      ? `${formatDateOnlyShortTr(rangeStart)} – ${formatDateOnlyShortTr(rangeEnd)}`
      : '—'
  const cashBalanceKurus =
    expenseTotals == null
      ? null
      : expenseTotals.fieldPaidKurus - expenseTotals.totalExpenseKurus

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
  const kmRange = useMemo(() => sumDayKm(rangeDays), [rangeDays])
  const kmReportDay = useMemo(
    () => sumDayKm(reportDayPairs),
    [reportDayPairs],
  )

  const reloadDay = () => setDayRefreshKey((k) => k + 1)

  const openEdit = (item: KameramanOdometerReading) => {
    setEditTarget(item)
    setEditKm(String(item.odometerKm))
    setEditNote(item.note ?? '')
    setEditFile(null)
    setEditPreview(item.photoDownloadUrl)
    if (editFileRef.current) editFileRef.current.value = ''
  }

  const closeEdit = () => {
    if (editPreview?.startsWith('blob:')) URL.revokeObjectURL(editPreview)
    setEditTarget(null)
    setEditKm('')
    setEditNote('')
    setEditFile(null)
    setEditPreview(null)
    setEditUploadUi(null)
    if (editFileRef.current) editFileRef.current.value = ''
  }

  const onEditFileChange = (file: File | null) => {
    if (editPreview?.startsWith('blob:')) URL.revokeObjectURL(editPreview)
    if (!file) {
      setEditFile(null)
      setEditPreview(editTarget?.photoDownloadUrl ?? null)
      if (editFileRef.current) editFileRef.current.value = ''
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Yalnızca görsel dosyaları yüklenebilir (PNG/JPG).')
      return
    }
    if (file.size > ODOMETER_PHOTO_MAX_BYTES) {
      toast.error(`Görsel en fazla ${ODOMETER_PHOTO_MAX_MB} MB olabilir.`)
      return
    }
    setEditFile(file)
    setEditPreview(URL.createObjectURL(file))
  }

  const saveEdit = async () => {
    if (!editTarget) return
    const km = Number(editKm.replace(',', '.'))
    if (!Number.isFinite(km) || km < 0) {
      toast.error('Geçerli bir kadran km sayısı girin.')
      return
    }
    setEditSaving(true)
    if (editFile) {
      setEditUploadUi({
        label: 'Kadran görseli yükleniyor…',
        detail: slotLabelTr(editTarget.slot),
        percent: 0,
      })
    }
    try {
      await adminUpdateOdometerReading({
        readingId: editTarget.id,
        odometerKm: Math.floor(km),
        note: editNote,
        photoFile: editFile,
        onUploadProgress: editFile
          ? (progress) => {
              setEditUploadUi({
                label: driveUploadPhaseLabel(progress.phase),
                detail: progress.fileName || slotLabelTr(editTarget.slot),
                percent: Math.round(progress.ratio * 100),
              })
            }
          : undefined,
      })
      toast.success(
        `${editTarget.createdByNameSnapshot} · ${slotLabelTr(editTarget.slot)} güncellendi.`,
      )
      closeEdit()
      reloadDay()
    } catch (error) {
      toast.error(mapAppError(error, 'Kadran raporu güncellenemedi.'))
    } finally {
      setEditSaving(false)
      setEditUploadUi(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteOdometerReading(deleteTarget.id)
      toast.success(
        `${deleteTarget.createdByNameSnapshot} · ${slotLabelTr(deleteTarget.slot)} silindi.`,
      )
      setDeleteTarget(null)
      reloadDay()
    } catch (error) {
      toast.error(mapAppError(error, 'Kadran raporu silinemedi.'))
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <AccordionSection
        title="Km ve saha giderleri"
        description="Saha km (kameraman kadran farkı) ve muhabir günlük raporlarından saha gider kalemleri. Genel kasaya karışmaz."
        defaultOpen
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <FormField label="Başlangıç" htmlFor="field-ops-range-start">
            <DateInput
              id="field-ops-range-start"
              value={rangeStart}
              max={rangeEnd || today}
              onChange={(e) => {
                const next = e.target.value
                setRangeStart(next)
                if (isValidDateOnly(next) && isValidDateOnly(rangeEnd) && next > rangeEnd) {
                  setRangeEnd(next)
                }
              }}
            />
          </FormField>
          <FormField label="Bitiş" htmlFor="field-ops-range-end">
            <DateInput
              id="field-ops-range-end"
              value={rangeEnd}
              min={rangeStart || undefined}
              max={today}
              onChange={(e) => {
                const next = e.target.value
                setRangeEnd(next)
                if (isValidDateOnly(next) && isValidDateOnly(rangeStart) && next < rangeStart) {
                  setRangeStart(next)
                }
              }}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setRangeStart(weekStart)
                setRangeEnd(today < weekEnd ? today : weekEnd)
              }}
            >
              Bu hafta
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setRangeStart(defaultRangeStart())
                setRangeEnd(today)
              }}
            >
              Bu ay
            </Button>
          </div>
        </div>

        {rangeStart > rangeEnd ? (
          <p className="mb-4 text-sm text-danger" role="alert">
            Başlangıç tarihi bitişten sonra olamaz.
          </p>
        ) : null}

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
            label="Seçilen aralık saha km"
            value={
              loadingRangeKm
                ? '…'
                : `${kmRange.toLocaleString('tr-TR')} km`
            }
            hint={rangeLabel}
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
                label="Otel ödemesi"
                value={formatTryFromKurus(expenseTotals.hotelExpenseKurus)}
                hint={rangeLabel}
              />
              <StatBox
                label="Muhabir ücreti"
                value={formatTryFromKurus(expenseTotals.reporterEarningsKurus)}
                hint={rangeLabel}
              />
              <StatBox
                label="Kameraman ücreti"
                value={formatTryFromKurus(
                  expenseTotals.cameramanEarningsKurus,
                )}
                hint={rangeLabel}
              />
              <StatBox
                label="Sahaya ödenen"
                value={formatTryFromKurus(expenseTotals.fieldPaidKurus)}
                hint={rangeLabel}
              />
              <StatBox
                label="Benzin"
                value={formatTryFromKurus(expenseTotals.fuelExpenseKurus)}
                hint={rangeLabel}
              />
              <StatBox
                label="Yemek"
                value={formatTryFromKurus(expenseTotals.mealExpenseKurus)}
                hint={rangeLabel}
              />
              <StatBox
                label="Kırtasiye"
                value={formatTryFromKurus(
                  expenseTotals.stationeryExpenseKurus,
                )}
                hint={rangeLabel}
              />
              <StatBox
                label="Ekstra gider"
                value={formatTryFromKurus(expenseTotals.extraExpenseKurus)}
                hint={rangeLabel}
              />
              <StatBox
                label="Toplam gider"
                value={formatTryFromKurus(expenseTotals.totalExpenseKurus)}
                hint={rangeLabel}
              />
              <StatBox
                label="Kasa (aralık)"
                value={formatTryFromKurus(cashBalanceKurus ?? 0)}
                hint="Sahaya ödenen − toplam gider"
              />
            </>
          )}
        </div>
      </AccordionSection>

      <AccordionSection
        title="Kameraman raporları"
        description="Tarihe göre sabah / akşam kadran görselleri ve günlük km farkı. Yönetim ve koordinatör düzenleyip silebilir."
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
                            {canManageReports ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openEdit(item)}
                                >
                                  <Pencil
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                  Düzenle
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                  Sil
                                </Button>
                              </div>
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

      <Modal
        open={editTarget !== null}
        onClose={() => {
          if (!editSaving) closeEdit()
        }}
        title={
          editTarget
            ? `Kadran düzenle · ${editTarget.createdByNameSnapshot}`
            : 'Kadran düzenle'
        }
        description={
          editTarget
            ? `${slotLabelTr(editTarget.slot)} · ${formatDateOnlyLongTr(editTarget.reportDate)}`
            : undefined
        }
      >
        {editTarget ? (
          <div className="space-y-4">
            <FormField label="Kadran km" htmlFor="admin-odometer-km" required>
              <Input
                id="admin-odometer-km"
                inputMode="numeric"
                value={editKm}
                onChange={(e) =>
                  setEditKm(e.target.value.replace(/[^\d]/g, ''))
                }
                disabled={editSaving}
              />
            </FormField>
            <FormField label="Not" htmlFor="admin-odometer-note">
              <Textarea
                id="admin-odometer-note"
                rows={2}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                disabled={editSaving}
                maxLength={500}
              />
            </FormField>
            <FormField
              label="Kadran görseli (opsiyonel)"
              htmlFor="admin-odometer-photo"
              hint="Yeni görsel seçilmezse mevcut fotoğraf korunur."
            >
              <input
                ref={editFileRef}
                id="admin-odometer-photo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/*"
                className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary"
                disabled={editSaving}
                onChange={(e) =>
                  onEditFileChange(e.target.files?.[0] ?? null)
                }
              />
            </FormField>
            {editPreview ? (
              <img
                src={editPreview}
                alt="Kadran önizleme"
                className="max-h-48 w-full rounded border border-border object-contain bg-surface-muted"
              />
            ) : null}
            {editUploadUi ? (
              <FileUploadStatus
                label={editUploadUi.label}
                detail={editUploadUi.detail}
                percent={editUploadUi.percent}
              />
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={editSaving}
                onClick={closeEdit}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                loading={editSaving}
                disabled={editSaving}
                onClick={() => void saveEdit()}
              >
                Kaydet
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleteLoading) setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDelete()}
        title="Kadran raporu silinsin mi?"
        description={
          deleteTarget
            ? `${deleteTarget.createdByNameSnapshot} · ${slotLabelTr(deleteTarget.slot)} · ${formatDateOnlyLongTr(deleteTarget.reportDate)} kaydı kalıcı olarak silinir.`
            : undefined
        }
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        loading={deleteLoading}
        destructive
      />
    </div>
  )
}
