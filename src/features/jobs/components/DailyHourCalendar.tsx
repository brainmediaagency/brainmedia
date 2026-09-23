import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Mic } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { isVoiceRecordingViewerRole } from '@/config/roles'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ShootingCalendarJobDetail } from '@/features/jobs/components/ShootingCalendarJobDetail'
import {
  jobPlannedDay,
  subscribeApprovedOpenJobs,
  subscribeJobsForCalendarDay,
  subscribeScheduleJobs,
} from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import { formatJobCreatorPrimary } from '@/features/jobs/utils/formatJobCreator'
import { buildCalendarRows } from '@/features/jobs/utils/calendarRows'
import {
  isJobOnReporterShootingCalendar,
} from '@/features/jobs/utils/shootingCalendarVisibility'
import { filterJobsVisibleForReporterEmail } from '@/features/reporter/config/reporterJobVisibility'
import {
  groupVoiceRecordingsByJobId,
  subscribeVoiceRecordings,
} from '@/features/voice-recording/services/voiceRecordingService'
import type { VoiceRecordingDoc } from '@/features/voice-recording/types/voiceRecording'
import {
  formatDateOnlyLongTr,
  formatJobScheduleTr,
  normalizeJobSchedule,
  shiftDateOnlyDays,
  todayDateOnlyIstanbul,
  weekdayLabelTr,
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

function JobChip({
  job,
  slot,
  hasVoiceRecording = false,
  onSelect,
}: {
  job: JobDocument
  /** Row time label; the chip repeats the time only when it differs (e.g. 14:17). */
  slot?: string
  hasVoiceRecording?: boolean
  onSelect: (job: JobDocument) => void
}) {
  const time = normalizeJobSchedule(job.plannedExecutionDate).slice(11, 16)
  const showTime = time !== slot

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${job.companyName} iş detayını aç`}
      className={cn(
        'flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface px-2.5 py-2 text-left shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40 sm:px-3 sm:py-2.5',
        job.status === 'approved' && 'border-l-4 border-l-success',
        job.status === 'shot' && 'border-l-4 border-l-brand-cyan',
        job.status === 'cancelled' && 'border-l-4 border-l-text-secondary',
      )}
      onClick={() => onSelect(job)}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(job)
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {showTime ? (
            <span className="font-display text-sm font-semibold tabular-nums text-text-primary sm:text-base">
              {time}
            </span>
          ) : null}
          <StatusBadge status={job.status} />
          {hasVoiceRecording ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-violet/30 bg-brand-violet/10 px-2 py-0.5 text-[11px] font-medium text-[color:var(--cat-violet-text)] sm:text-xs">
              <Mic className="size-3" aria-hidden="true" />
              Ses kaydı
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-text-primary sm:mt-1 sm:text-base">
          {job.companyName}
        </p>
        {job.fullAddress ? (
          <p
            className="mt-0.5 truncate text-xs text-text-primary sm:text-sm"
            title={job.fullAddress}
          >
            {job.fullAddress}
          </p>
        ) : null}
        <p className="mt-0.5 truncate text-xs text-text-secondary sm:text-sm">
          {formatJobCreatorPrimary(job)}
          {job.province ? ` · ${job.province}` : ''}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-text-secondary sm:text-sm">
          {formatTryFromKurus(job.agreedAmountKurus)}
        </p>
      </div>
      <ChevronRight
        className="mt-1 size-4 shrink-0 text-text-secondary"
        aria-hidden="true"
      />
    </div>
  )
}

export type DailyHourCalendarScope = 'operations' | 'reporter'

export type DailyHourCalendarProps = {
  /**
   * `operations` — yönetim/koordinatör: konfirme / çekildi / iptal (tüm şirket).
   * `reporter` — muhabir/kameraman: konfirme / çekilmiş işler (konfirme anında görünür).
   */
  scope?: DailyHourCalendarScope
  /** Compact wrapper for nested dashboards (e.g. yönetim → muhabir görünümü). */
  embedded?: boolean
  /** Override section description. */
  description?: string
  /** Override initial day (`yyyy-MM-dd`). Defaults to Istanbul today. */
  initialDay?: string
}

export function DailyHourCalendar({
  scope = 'operations',
  embedded = false,
  description: descriptionProp,
  initialDay,
}: DailyHourCalendarProps) {
  const { profile, claims, user } = useAuth()
  const canHearVoice = isVoiceRecordingViewerRole(
    claims?.role ?? profile?.role,
  )
  const isReporterScope = scope === 'reporter'
  const actorRole = claims?.role ?? profile?.role
  /** Beste (and any configured muhabir) may only see jobs from a start date. */
  const reporterVisibilityIdentity =
    isReporterScope && actorRole === 'reporter'
      ? {
          email: user?.email ?? profile?.email ?? null,
          uid: user?.uid ?? profile?.uid ?? null,
        }
      : null
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
  const [selectedJob, setSelectedJob] = useState<JobDocument | null>(null)
  const [voiceByJobId, setVoiceByJobId] = useState<
    Map<string, VoiceRecordingDoc[]>
  >(() => new Map())
  const didAutoJumpRef = useRef(false)

  useEffect(() => {
    if (!canHearVoice) {
      setVoiceByJobId(new Map())
      return
    }
    return subscribeVoiceRecordings(
      (items) => setVoiceByJobId(groupVoiceRecordingsByJobId(items)),
      () => setVoiceByJobId(new Map()),
    )
  }, [canHearVoice])

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

  const visibleDirectoryJobs = useMemo(() => {
    if (!isReporterScope) return directoryJobs
    const onCalendar = directoryJobs.filter((job) =>
      isJobOnReporterShootingCalendar(job),
    )
    return filterJobsVisibleForReporterEmail(
      onCalendar,
      reporterVisibilityIdentity,
    )
  }, [directoryJobs, isReporterScope, reporterVisibilityIdentity])

  const dayJobs = useMemo(() => {
    const scoped = filterJobsVisibleForReporterEmail(
      dayJobsRaw,
      reporterVisibilityIdentity,
    )
    return [...scoped].sort((a, b) => {
      const byTime = normalizeJobSchedule(a.plannedExecutionDate).localeCompare(
        normalizeJobSchedule(b.plannedExecutionDate),
      )
      if (byTime !== 0) return byTime
      return a.companyName.localeCompare(b.companyName, 'tr')
    })
  }, [dayJobsRaw, reporterVisibilityIdentity])

  /**
   * Reporter calendar defaults to “today”. Stay if today already has
   * unlocked jobs (including çekildi). Otherwise jump once — prefer the most
   * recent past day with work so a late-night check still shows yesterday.
   * Uses visibility-filtered lists so Beste never jumps to pre-cutoff days.
   */
  useEffect(() => {
    if (loading || didAutoJumpRef.current || initialDay) return
    if (!isReporterScope || visibleDirectoryJobs.length === 0) return

    const today = todayDateOnlyIstanbul()
    if (day !== today) return
    if (dayJobs.length > 0) return
    if (visibleDirectoryJobs.some((job) => jobDay(job) === today)) return

    const days = [...new Set(visibleDirectoryJobs.map(jobDay).filter(Boolean))].sort()
    const pastOrToday = days.filter((d) => d <= today)
    const target = pastOrToday[pastOrToday.length - 1] ?? days.find((d) => d >= today)
    if (target && target !== day) {
      didAutoJumpRef.current = true
      setDay(target)
    }
  }, [
    loading,
    visibleDirectoryJobs,
    dayJobs.length,
    day,
    initialDay,
    isReporterScope,
  ])

  const otherDaysWithJobs = useMemo(() => {
    return [...new Set(visibleDirectoryJobs.map(jobDay).filter(Boolean))]
      .filter((d) => d !== day)
      .sort()
  }, [visibleDirectoryJobs, day])

  const directoryJobCount = visibleDirectoryJobs.length

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

  const rows = useMemo(() => buildCalendarRows(slots, bySlot), [slots, bySlot])

  const isToday = day === todayDateOnlyIstanbul()

  const selectedFresh =
    selectedJob == null
      ? null
      : (dayJobsRaw.find((job) => job.id === selectedJob.id) ?? selectedJob)
  const selectedRecordings =
    canHearVoice && selectedFresh
      ? (voiceByJobId.get(selectedFresh.id) ?? [])
      : []

  const title = isReporterScope ? 'Çekim takvimi' : 'Günlük saat takvimi'
  const description =
    descriptionProp ??
    (isReporterScope
      ? 'Konfirme edilen işler çekim takvimine hemen düşer. Çekilenler aynı saatte kalır; geçmiş günler silinmez.'
      : 'Tam saatler her zaman listelenir; buçuk dilimler yalnızca o saatte iş varsa eklenir.')
  const emptyDescription = isReporterScope
    ? 'Seçilen tarihte konfirme veya çekilmiş iş bulunmuyor.'
    : 'Seçilen tarihte planlanan konfirme / çekildi / iptal iş kaydı bulunmuyor.'

  const calendarBody = (
    <div className="space-y-3 sm:space-y-4">
      {fetchTruncated && fetchLimit > 0 ? (
        <p className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-secondary">
          İlk {fetchLimit} kayıt gösteriliyor. Daha eski işler listede görünmeyebilir.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-nowrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Önceki gün"
            className="shrink-0 px-2.5"
            onClick={() => setDay((d) => shiftDateOnlyDays(d, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="w-auto min-w-0 max-w-[14rem] flex-1 basis-[10.5rem] sm:flex-none">
            <DateInput
              id={`daily-hour-calendar-day-${scope}`}
              aria-label="Gün"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Sonraki gün"
            className="shrink-0 px-2.5"
            onClick={() => setDay((d) => shiftDateOnlyDays(d, 1))}
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
        <p className="text-sm text-text-secondary sm:text-base">
          <span className="font-medium text-text-primary">
            {isToday ? 'Bugün' : weekdayLabelTr(day)}
          </span>
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
            {rows.map((row) => {
              if (row.kind === 'empty') {
                return (
                  <li
                    key={`empty-${row.from}`}
                    className="flex items-center gap-3 bg-surface-muted/30 px-2.5 py-1.5 sm:px-3 sm:py-2"
                  >
                    <span className="font-display text-xs font-semibold tabular-nums text-text-secondary sm:w-[5.5rem] sm:text-sm">
                      {row.from === row.to ? row.from : `${row.from}–${row.to}`}
                    </span>
                    <span className="text-xs text-text-secondary">Boş</span>
                  </li>
                )
              }
              const isHalf = isHalfHourSlot(row.slot)
              return (
                <li
                  key={row.slot}
                  className={cn(
                    'grid gap-2 px-2.5 py-2 sm:grid-cols-[5.5rem_1fr] sm:items-start sm:gap-3 sm:px-3 sm:py-3',
                    isHalf && 'bg-brand-cyan/[0.03]',
                  )}
                >
                  <div
                    className={cn(
                      'pt-0.5 font-display text-sm font-semibold tabular-nums sm:pt-1 sm:text-base',
                      isHalf ? 'text-text-secondary' : 'text-brand-navy',
                    )}
                  >
                    {row.slot}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {row.items.map((job) => (
                      <JobChip
                        key={job.id}
                        job={job}
                        slot={row.slot}
                        hasVoiceRecording={
                          canHearVoice && voiceByJobId.has(job.id)
                        }
                        onSelect={setSelectedJob}
                      />
                    ))}
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
                      hasVoiceRecording={
                        canHearVoice && voiceByJobId.has(job.id)
                      }
                      onSelect={setSelectedJob}
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

  const detail = (
    <ShootingCalendarJobDetail
      job={selectedFresh}
      open={selectedJob !== null}
      onClose={() => setSelectedJob(null)}
      recordings={selectedRecordings}
    />
  )

  if (embedded) {
    return (
      <>
        <section
          className="rounded-[var(--radius-md)] border border-border bg-surface p-3 shadow-[var(--shadow-sm)] sm:p-5"
          aria-label={title}
        >
          {calendarBody}
        </section>
        {detail}
      </>
    )
  }

  return (
    <>
      <AccordionSection
        title={title}
        description={description}
        defaultOpen
      >
        {calendarBody}
      </AccordionSection>
      {detail}
    </>
  )
}
