import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  jobPlannedDay,
  subscribeApprovedOpenJobs,
  subscribeJobsForCalendarDay,
  subscribeScheduleJobs,
} from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import { formatJobCreatorPrimary } from '@/features/jobs/utils/formatJobCreator'
import {
  formatDateOnlyLongTr,
  formatJobScheduleTr,
  normalizeJobSchedule,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'
import { cn } from '@/lib/classNames'

const HOUR_START = 9
const HOUR_END = 21 // inclusive full hours 09:00 … 21:00

function jobDay(job: JobDocument): string {
  return jobPlannedDay(job)
}

function jobHour(job: JobDocument): number {
  return Number(normalizeJobSchedule(job.plannedExecutionDate).slice(11, 13))
}

function jobMinute(job: JobDocument): number {
  return Number(normalizeJobSchedule(job.plannedExecutionDate).slice(14, 16))
}

/** Floor to :00 or :30 (e.g. 14:17 → 14:00, 14:45 → 14:30). */
function jobSlotKey(job: JobDocument): string {
  const hour = jobHour(job)
  const minute = jobMinute(job)
  const half = minute < 30 ? 0 : 30
  return `${String(hour).padStart(2, '0')}:${String(half).padStart(2, '0')}`
}

function isHalfHourSlot(slot: string): boolean {
  return slot.endsWith(':30')
}

function buildCalendarSlots(dayJobs: JobDocument[]): string[] {
  const halfNeeded = new Set<string>()
  for (const job of dayJobs) {
    const slot = jobSlotKey(job)
    if (isHalfHourSlot(slot)) {
      const hour = Number(slot.slice(0, 2))
      if (hour >= HOUR_START && hour <= HOUR_END) halfNeeded.add(slot)
    }
  }

  const slots: string[] = []
  for (let h = HOUR_START; h <= HOUR_END; h += 1) {
    const full = `${String(h).padStart(2, '0')}:00`
    const half = `${String(h).padStart(2, '0')}:30`
    slots.push(full)
    if (halfNeeded.has(half)) slots.push(half)
  }
  return slots
}

function shiftDateOnly(dateOnly: string, deltaDays: number): string {
  const [y, m, d] = dateOnly.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
  date.setUTCDate(date.getUTCDate() + deltaDays)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function JobChip({
  job,
  showForwardStatus,
  onSelect,
}: {
  job: JobDocument
  showForwardStatus: boolean
  onSelect?: (job: JobDocument) => void
}) {
  const time = normalizeJobSchedule(job.plannedExecutionDate).slice(11, 16)
  const interactive = typeof onSelect === 'function'

  return (
    <div
      className={cn(
        'min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border/80 bg-surface px-3 py-2.5 text-left shadow-[var(--shadow-xs)]',
        job.status === 'approved' && 'border-l-4 border-l-success',
        job.status === 'shot' && 'border-l-4 border-l-brand-cyan',
        job.status === 'cancelled' && 'border-l-4 border-l-text-secondary',
        interactive &&
          'cursor-pointer transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40',
      )}
      {...(interactive
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: () => onSelect(job),
            onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(job)
              }
            },
          }
        : {})}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-base font-semibold tabular-nums text-text-primary">
          {time}
        </span>
        <StatusBadge status={job.status} />
      </div>
      <p className="mt-1 truncate text-base font-medium text-text-primary">{job.companyName}</p>
      {job.fullAddress ? (
        <p
          className="mt-0.5 truncate text-sm text-text-primary"
          title={job.fullAddress}
        >
          {job.fullAddress}
        </p>
      ) : null}
      <p className="mt-0.5 truncate text-sm text-text-secondary">
        {formatJobCreatorPrimary(job)}
        {job.province ? ` · ${job.province}` : ''}
      </p>
      <p className="mt-0.5 text-sm tabular-nums text-text-secondary">
        {formatTryFromKurus(job.agreedAmountKurus)}
      </p>
      {showForwardStatus ? (
        job.forwardedToReporter ? (
          <p className="mt-1 text-xs font-medium text-success">Muhabire iletildi</p>
        ) : job.status === 'approved' ? (
          <p className="mt-1 text-xs font-medium text-warning">Muhabire iletilmedi</p>
        ) : null
      ) : null}
    </div>
  )
}

export type DailyHourCalendarScope = 'operations' | 'reporter'

export type DailyHourCalendarProps = {
  sectionNumber?: string
  /**
   * `operations` — yönetim/koordinatör: konfirme / çekildi / iptal (tüm şirket).
   * `reporter` — muhabir: yalnızca muhabire iletilmiş açık konfirme işler.
   */
  scope?: DailyHourCalendarScope
  /** Compact wrapper for nested dashboards (e.g. yönetim → muhabir görünümü). */
  embedded?: boolean
  /** Eyebrow above title when `embedded` (e.g. Kameraman görünümü). */
  embeddedLabel?: string
  /** Override section description. */
  description?: string
  /** Optional job select (e.g. muhabir detay drawer). */
  onJobSelect?: (job: JobDocument) => void
  /** Override initial day (`yyyy-MM-dd`). Defaults to Istanbul today. */
  initialDay?: string
}

export function DailyHourCalendar({
  sectionNumber = '01',
  scope = 'operations',
  embedded = false,
  embeddedLabel = 'Muhabir görünümü',
  description: descriptionProp,
  onJobSelect,
  initialDay,
}: DailyHourCalendarProps) {
  const isReporterScope = scope === 'reporter'
  const [day, setDay] = useState(
    () => initialDay || todayDateOnlyIstanbul(),
  )
  /** Jobs planned for the selected day (day-scoped Firestore query). */
  const [dayJobsRaw, setDayJobsRaw] = useState<JobDocument[]>([])
  /** Broader feed — used only for "other days with work" chips + auto-jump. */
  const [directoryJobs, setDirectoryJobs] = useState<JobDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchTruncated, setFetchTruncated] = useState(false)
  const [fetchLimit, setFetchLimit] = useState(0)
  const didAutoJumpRef = useRef(false)

  useEffect(() => {
    if (initialDay) setDay(initialDay)
  }, [initialDay])

  // Primary: query this calendar day so rescheduled jobs always land here.
  useEffect(() => {
    setLoading(true)
    setFetchTruncated(false)
    return subscribeJobsForCalendarDay(
      day,
      isReporterScope ? 'reporter' : 'operations',
      (next, meta) => {
        setDayJobsRaw(next)
        setFetchTruncated(meta?.truncated === true)
        setFetchLimit(meta?.fetchLimit ?? 0)
        setLoading(false)
      },
      (error) => {
        setLoading(false)
        toast.error(mapAppError(error, 'Takvim işleri yüklenemedi.'))
      },
    )
  }, [day, isReporterScope])

  // Secondary: recent/open jobs for other-day shortcuts + first-load jump.
  useEffect(() => {
    if (isReporterScope) {
      return subscribeApprovedOpenJobs(
        (next) => setDirectoryJobs(next),
        () => setDirectoryJobs([]),
      )
    }
    return subscribeScheduleJobs(
      (next) => setDirectoryJobs(next),
      () => setDirectoryJobs([]),
    )
  }, [isReporterScope])

  /**
   * Reporter/İK calendar defaults to “today”. If all forwarded jobs are on
   * another day, jump once to the nearest day that has work so the list is not
   * mistaken for a permissions/empty bug.
   */
  useEffect(() => {
    if (loading || didAutoJumpRef.current || initialDay) return
    if (!isReporterScope || directoryJobs.length === 0) return

    const today = todayDateOnlyIstanbul()
    if (day !== today) return
    if (directoryJobs.some((job) => jobDay(job) === today)) return

    const days = [...new Set(directoryJobs.map(jobDay).filter(Boolean))].sort()
    const upcoming = days.find((d) => d >= today)
    const target = upcoming ?? days[days.length - 1]
    if (target && target !== day) {
      didAutoJumpRef.current = true
      setDay(target)
    }
  }, [loading, directoryJobs, day, initialDay, isReporterScope])

  const dayJobs = useMemo(() => {
    return [...dayJobsRaw].sort((a, b) => {
      const byTime = normalizeJobSchedule(a.plannedExecutionDate).localeCompare(
        normalizeJobSchedule(b.plannedExecutionDate),
      )
      if (byTime !== 0) return byTime
      return a.companyName.localeCompare(b.companyName, 'tr')
    })
  }, [dayJobsRaw])

  const otherDaysWithJobs = useMemo(() => {
    return [...new Set(directoryJobs.map(jobDay).filter(Boolean))]
      .filter((d) => d !== day)
      .sort()
  }, [directoryJobs, day])

  const directoryJobCount = directoryJobs.length

  const slots = useMemo(() => buildCalendarSlots(dayJobs), [dayJobs])

  const { bySlot, outside } = useMemo(() => {
    const map = new Map<string, JobDocument[]>()
    for (const slot of slots) map.set(slot, [])
    const other: JobDocument[] = []

    for (const job of dayJobs) {
      const slot = jobSlotKey(job)
      if (map.has(slot)) {
        map.get(slot)!.push(job)
      } else {
        other.push(job)
      }
    }

    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          jobMinute(a) - jobMinute(b) ||
          a.companyName.localeCompare(b.companyName, 'tr'),
      )
    }

    return { bySlot: map, outside: other }
  }, [dayJobs, slots])

  const isToday = day === todayDateOnlyIstanbul()

  const title = isReporterScope ? 'Çekim takvimi' : 'Günlük saat takvimi'
  const description =
    descriptionProp ??
    (isReporterScope
      ? 'Muhabire iletilmiş konfirme işler. Gün seçerek saat dilimlerine göre görüntüleyin.'
      : 'Tam saatler her zaman listelenir; buçuk dilimler yalnızca o saatte iş varsa eklenir.')
  const emptyDescription = isReporterScope
    ? 'Seçilen tarihte muhabire iletilmiş açık iş bulunmuyor.'
    : 'Seçilen tarihte planlanan konfirme / çekildi / iptal iş kaydı bulunmuyor.'

  const calendarBody = (
    <div className="space-y-4">
      {fetchTruncated && fetchLimit > 0 ? (
        <p className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-secondary">
          İlk {fetchLimit} kayıt gösteriliyor. Daha eski işler listede görünmeyebilir.
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-nowrap items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Önceki gün"
            className="shrink-0 px-2.5"
            onClick={() => setDay((d) => shiftDateOnly(d, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <FormField
            label="Gün"
            htmlFor={`daily-hour-calendar-day-${scope}`}
            className="w-auto min-w-0 max-w-[14rem] flex-1 basis-[10.5rem] sm:flex-none"
          >
            <DateInput
              id={`daily-hour-calendar-day-${scope}`}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Sonraki gün"
            className="shrink-0 px-2.5"
            onClick={() => setDay((d) => shiftDateOnly(d, 1))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          {!isToday ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 whitespace-nowrap px-3.5"
              onClick={() => setDay(todayDateOnlyIstanbul())}
            >
              Bugün
            </Button>
          ) : null}
        </div>
        <p className="text-base text-text-secondary">
          <span className="font-medium text-text-primary">{formatDateOnlyLongTr(day)}</span>
          {' · '}
          {dayJobs.length} iş
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-md)]" />
          ))}
        </div>
      ) : dayJobs.length === 0 ? (
        <div className="space-y-3">
          <EmptyState title="Bu günde iş yok" description={emptyDescription} />
          {otherDaysWithJobs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-muted/40 px-3 py-3">
              <p className="w-full text-sm text-text-secondary">
                Başka günlerde {directoryJobCount} iş var:
              </p>
              {otherDaysWithJobs.slice(0, 6).map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setDay(d)}
                >
                  {formatDateOnlyLongTr(d)}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-sm)]">
          <ul className="divide-y divide-border">
            {slots.map((slot) => {
              const slotJobs = bySlot.get(slot) ?? []
              const isHalf = isHalfHourSlot(slot)
              return (
                <li
                  key={slot}
                  className={cn(
                    'grid gap-3 px-3 py-3 sm:grid-cols-[5.5rem_1fr] sm:items-start',
                    slotJobs.length === 0 && 'bg-surface-muted/30',
                    isHalf && 'bg-brand-cyan/[0.03]',
                  )}
                >
                  <div
                    className={cn(
                      'pt-1 font-display text-base font-semibold tabular-nums',
                      isHalf ? 'text-text-secondary' : 'text-brand-navy',
                    )}
                  >
                    {slot}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {slotJobs.length === 0 ? (
                      <p className="py-1 text-sm text-text-secondary">—</p>
                    ) : (
                      slotJobs.map((job) => (
                        <JobChip
                          key={job.id}
                          job={job}
                          showForwardStatus={!isReporterScope}
                          onSelect={onJobSelect}
                        />
                      ))
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {outside.length > 0 ? (
            <div className="border-t border-border bg-surface-muted/40 px-3 py-3">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Diğer saatler (09:00–21:00 dışı)
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {outside.map((job) => (
                  <div key={job.id} className="space-y-1">
                    <p className="text-sm text-text-secondary">
                      {formatJobScheduleTr(job.plannedExecutionDate)}
                    </p>
                    <JobChip
                      job={job}
                      showForwardStatus={!isReporterScope}
                      onSelect={onJobSelect}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )

  if (embedded) {
    return (
      <section className="rounded-[var(--radius-md)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
            {embeddedLabel}
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        {calendarBody}
      </section>
    )
  }

  return (
    <AccordionSection
      number={sectionNumber}
      title={title}
      description={description}
      defaultOpen
    >
      {calendarBody}
    </AccordionSection>
  )
}
