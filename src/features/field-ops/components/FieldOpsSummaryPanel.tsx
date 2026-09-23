import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  Car,
  Hotel,
  RefreshCw,
  UserRound,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/Table'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  fetchFieldOpsSummary,
} from '@/features/field-ops/services/fieldOpsSummaryService'
import type {
  FieldOpsDayRow,
  FieldOpsSummary,
} from '@/features/field-ops/types/fieldOps'
import type { KameramanDayKm } from '@/features/kameraman/types/odometer'
import { slotLabelTr } from '@/features/kameraman/utils/odometerKm'
import { formatTryFromKurus } from '@/lib/currency'
import {
  currentYearMonthIstanbul,
  formatDateOnlyLongTr,
  formatDateOnlyShortTr,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { mapAppError } from '@/lib/errors'

function defaultFieldOpsRange(): { startDate: string; endDate: string } {
  const today = todayDateOnlyIstanbul()
  return {
    startDate: `${currentYearMonthIstanbul()}-01`,
    endDate: today,
  }
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Car
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-primary)]"
      />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-text-primary">
            {value}
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] bg-brand-cyan/12 p-2.5 text-brand-blue">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

function kmIssue(
  day: KameramanDayKm,
  todayDate: string,
): string | null {
  // Incomplete pairs for today are expected until evening is entered.
  if (day.reportDate === todayDate) return null
  if (!day.morning || !day.evening) {
    return 'Sabah veya akşam kadranı eksik; günlük km toplama dahil edilmedi.'
  }
  if (
    day.morningKm != null
    && day.eveningKm != null
    && day.eveningKm < day.morningKm
  ) {
    return 'Akşam kadranı sabahtan düşük; günlük km toplama dahil edilmedi.'
  }
  return null
}

function OdometerPairDetail({
  day,
  todayDate,
}: {
  day: KameramanDayKm
  todayDate: string
}) {
  const issue = kmIssue(day, todayDate)

  return (
    <article className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-text-primary">
            {day.createdByNameSnapshot}
          </h3>
          <p className="text-sm text-text-secondary">
            {day.dayKm == null
              ? 'Günlük km hesaplanamadı'
              : `${day.dayKm.toLocaleString('tr-TR')} km`}
          </p>
        </div>
        {issue ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Kontrol gerekli
          </span>
        ) : null}
      </div>

      {issue ? (
        <p className="mt-3 rounded-[var(--radius-sm)] border border-warning/25 bg-warning/5 px-3 py-2 text-xs text-text-secondary">
          {issue}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(['morning', 'evening'] as const).map((slot) => {
          const reading = slot === 'morning' ? day.morning : day.evening
          return (
            <div
              key={slot}
              className="rounded-[var(--radius-sm)] border border-border/80 bg-surface-muted/30 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {slotLabelTr(slot)}
              </p>
              {reading ? (
                <>
                  <p className="mt-1 font-medium tabular-nums text-text-primary">
                    {reading.odometerKm.toLocaleString('tr-TR')} km
                  </p>
                  {reading.note ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      {reading.note}
                    </p>
                  ) : null}
                  {reading.photoDownloadUrl ? (
                    <a
                      href={reading.photoDownloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block overflow-hidden rounded border border-border bg-surface"
                      aria-label={`${day.createdByNameSnapshot} ${slotLabelTr(slot)} kadran fotoğrafını aç`}
                    >
                      <img
                        src={reading.photoDownloadUrl}
                        alt={`${day.createdByNameSnapshot} ${slotLabelTr(slot)} kadranı`}
                        className="h-36 w-full object-cover"
                      />
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-text-secondary">
                      Fotoğraf yok
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-text-secondary">Girilmedi</p>
              )}
            </div>
          )
        })}
      </div>
    </article>
  )
}

function DayDetail({
  day,
  todayDate,
}: {
  day: FieldOpsDayRow
  todayDate: string
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard label="Saha km" value={`${day.dayKm.toLocaleString('tr-TR')} km`} icon={Car} />
        <SummaryCard label="Otel" value={formatTryFromKurus(day.hotelExpenseKurus)} icon={Hotel} />
        <SummaryCard label="Muhabir" value={formatTryFromKurus(day.reporterEarningsKurus)} icon={UserRound} />
        <SummaryCard label="Kameraman" value={formatTryFromKurus(day.cameramanEarningsKurus)} icon={Camera} />
      </div>

      <section>
        <h3 className="mb-2 font-display text-base font-semibold text-text-primary">
          Kadran kayıtları
        </h3>
        {day.odometerDays.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Bu gün için kadran kaydı yok.
          </p>
        ) : (
          <div className="space-y-3">
            {day.odometerDays.map((item) => (
              <OdometerPairDetail
                key={`${item.createdByUid}-${item.reportDate}`}
                day={item}
                todayDate={todayDate}
              />
            ))}
          </div>
        )}
      </section>

      {day.expenseReports.length > 0 ? (
        <section>
          <h3 className="mb-2 font-display text-base font-semibold text-text-primary">
            Günlük rapor kırılımı
          </h3>
          <ul className="space-y-2">
            {day.expenseReports.map((report) => (
              <li
                key={report.id}
                className="rounded-[var(--radius-sm)] border border-border bg-surface-muted/30 p-3 text-sm"
              >
                <p className="font-medium text-text-primary">
                  {report.reporterName}
                </p>
                <p className="mt-1 text-text-secondary">
                  Otel {formatTryFromKurus(report.hotelExpenseKurus)}
                  {' · '}Muhabir {formatTryFromKurus(report.reporterEarningsKurus)}
                  {' · '}Kameraman {formatTryFromKurus(report.cameramanEarningsKurus)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function FieldOpsSummaryContent() {
  const [range, setRange] = useState(defaultFieldOpsRange)
  const [summary, setSummary] = useState<FieldOpsSummary | null>(null)
  const [selectedDay, setSelectedDay] = useState<FieldOpsDayRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const todayDate = todayDateOnlyIstanbul()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSelectedDay(null)

    void (async () => {
      try {
        const next = await fetchFieldOpsSummary(range)
        if (!cancelled) setSummary(next)
      } catch (error) {
        if (!cancelled) {
          setSummary(null)
          toast.error(mapAppError(error, 'Saha özeti yüklenemedi.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [range.endDate, range.startDate, reloadKey])

  const rangeLabel = summary
    ? `${formatDateOnlyShortTr(summary.startDate)} – ${formatDateOnlyShortTr(summary.endDate)}`
    : ''

  return (
    <>
      <AccordionSection
        title="Saha Özet"
        description="Seçilen aralıkta saha km, otel, muhabir ve kameraman ödemeleri. Genel kasadan bağımsız salt-okuma özetidir."
        defaultOpen
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <DateRangePicker
              id="field-ops-range"
              value={range}
              onChange={setRange}
              disabled={loading}
              className="sm:min-w-[18rem]"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              className="shrink-0 self-start sm:mt-1"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              <RefreshCw
                className={loading ? 'size-4 animate-spin' : 'size-4'}
                aria-hidden="true"
              />
              Yenile
            </Button>
          </div>

          {loading || !summary ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Saha km"
                value={`${summary.totals.dayKm.toLocaleString('tr-TR')} km`}
                icon={Car}
              />
              <SummaryCard
                label="Otel"
                value={formatTryFromKurus(summary.totals.hotelExpenseKurus)}
                icon={Hotel}
              />
              <SummaryCard
                label="Muhabir ücreti"
                value={formatTryFromKurus(summary.totals.reporterEarningsKurus)}
                icon={UserRound}
              />
              <SummaryCard
                label="Kameraman ücreti"
                value={formatTryFromKurus(summary.totals.cameramanEarningsKurus)}
                icon={Camera}
              />
            </div>
          )}

          {!loading && summary?.totals.invalidKmPairCount ? (
            <p
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-text-secondary"
              role="status"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden="true"
              />
              {summary.totals.invalidKmPairCount} kameraman/gün kaydında sabah-akşam
              çifti eksik veya akşam km daha düşük. Bu kayıtlar dönem km toplamına
              eklenmedi.
            </p>
          ) : null}

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-text-primary">
                  Günlük saha dökümü
                </h3>
                <p className="text-xs text-text-secondary">{rangeLabel}</p>
              </div>
              {!loading && summary ? (
                <p className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  <Users className="size-3.5" aria-hidden="true" />
                  {summary.totals.validKmPairCount} geçerli km çifti
                </p>
              ) : null}
            </div>

            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : !summary || summary.days.length === 0 ? (
              <EmptyState
                title="Bu dönem için saha kaydı yok"
                description="Kadran ve günlük rapor kayıtları oluştuğunda burada listelenir."
              />
            ) : (
              <Table className="min-w-[760px]">
                <TableHead>
                  <TableRow>
                    <TableCell header>Tarih</TableCell>
                    <TableCell header className="text-right">Km</TableCell>
                    <TableCell header className="text-right">Otel</TableCell>
                    <TableCell header className="text-right">Muhabir</TableCell>
                    <TableCell header className="text-right">Kameraman</TableCell>
                    <TableCell header className="text-right">Detay</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.days.map((day) => (
                    <TableRow key={day.reportDate}>
                      <TableCell>
                        <span className="font-medium">
                          {formatDateOnlyLongTr(day.reportDate)}
                        </span>
                        {day.invalidKmPairCount > 0 ? (
                          <span
                            className="ml-2 inline-flex text-warning"
                            title="Eksik veya geçersiz kadran çifti"
                          >
                            <AlertTriangle className="size-3.5" aria-hidden="true" />
                            <span className="sr-only">
                              Eksik veya geçersiz kadran çifti
                            </span>
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {day.dayKm.toLocaleString('tr-TR')} km
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTryFromKurus(day.hotelExpenseKurus)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTryFromKurus(day.reporterEarningsKurus)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTryFromKurus(day.cameramanEarningsKurus)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedDay(day)}
                        >
                          İncele
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </AccordionSection>

      <Drawer
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatDateOnlyLongTr(selectedDay.reportDate) : 'Saha detayı'}
        description="Kadran fotoğrafları ve günlük ödeme kırılımı"
        side="responsive"
      >
        {selectedDay ? (
          <DayDetail day={selectedDay} todayDate={todayDate} />
        ) : null}
      </Drawer>
    </>
  )
}

export function FieldOpsSummaryPanel() {
  const { claims, profile } = useAuth()
  const role = claims?.role ?? profile?.role

  if (role !== 'management' && role !== 'coordinator') return null

  return <FieldOpsSummaryContent />
}
