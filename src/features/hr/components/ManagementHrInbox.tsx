import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, UserRound } from 'lucide-react'
import {
  formatHrMpuAttendanceEntry,
  summarizeHrMpuAttendances,
  type HrReport,
} from '@/features/hr/types/hr'
import type { HiringNote } from '@/features/hr/types/hr'
import { fetchHrReportsInRange } from '@/features/hr/services/hrReportService'
import { fetchHiringNotesInRange } from '@/features/hr/services/hiringNoteService'
import { HiringNoteAttachmentList } from '@/features/hr/components/HiringNoteAttachmentList'
import { Card } from '@/components/ui/Card'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { formatDateTimeTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function useDefaultRange() {
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(
    () => new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    [defaultEnd],
  )
  return {
    start: toDateInputValue(defaultStart),
    end: toDateInputValue(defaultEnd),
  }
}

function DateRangeFilter({
  startId,
  endId,
  start,
  end,
  onStartChange,
  onEndChange,
  onFilter,
  loading,
}: {
  startId: string
  endId: string
  start: string
  end: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onFilter: () => void
  loading: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <FormField label="Başlangıç" htmlFor={startId}>
        <DateInput
          id={startId}
          value={start}
          onChange={(e) => onStartChange(e.target.value)}
        />
      </FormField>
      <FormField label="Bitiş" htmlFor={endId}>
        <DateInput id={endId} value={end} onChange={(e) => onEndChange(e.target.value)} />
      </FormField>
      <Button type="button" onClick={onFilter} loading={loading}>
        Filtrele
      </Button>
    </div>
  )
}

export type ManagementHrInboxMode = 'all' | 'reports' | 'interviews'

export type ManagementHrInboxProps = {
  startNumber?: number
  /** Which sections to show. Defaults to both. */
  mode?: ManagementHrInboxMode
}

export function ManagementHrInbox({
  startNumber = 1,
  mode = 'all',
}: ManagementHrInboxProps) {
  const defaults = useDefaultRange()
  const showReports = mode === 'all' || mode === 'reports'
  const showInterviews = mode === 'all' || mode === 'interviews'

  const [reportStart, setReportStart] = useState(defaults.start)
  const [reportEnd, setReportEnd] = useState(defaults.end)
  const [reports, setReports] = useState<HrReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)

  const [noteStart, setNoteStart] = useState(defaults.start)
  const [noteEnd, setNoteEnd] = useState(defaults.end)
  const [notes, setNotes] = useState<HiringNote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)

  const loadReports = useCallback(async () => {
    if (!reportStart || !reportEnd || reportStart > reportEnd) {
      toast.error('Geçerli bir tarih aralığı seçin.')
      return
    }
    setReportsLoading(true)
    try {
      setReports(await fetchHrReportsInRange({ startDate: reportStart, endDate: reportEnd }))
    } catch (error) {
      toast.error(mapAppError(error, 'İK raporları yüklenemedi.'))
    } finally {
      setReportsLoading(false)
    }
  }, [reportStart, reportEnd])

  const loadNotes = useCallback(async () => {
    if (!noteStart || !noteEnd || noteStart > noteEnd) {
      toast.error('Geçerli bir tarih aralığı seçin.')
      return
    }
    setNotesLoading(true)
    try {
      setNotes(await fetchHiringNotesInRange({ startDate: noteStart, endDate: noteEnd }))
    } catch (error) {
      toast.error(mapAppError(error, 'İş görüşmesi raporları yüklenemedi.'))
    } finally {
      setNotesLoading(false)
    }
  }, [noteStart, noteEnd])

  useEffect(() => {
    if (!showReports) return
    void loadReports()
  }, [loadReports, showReports])

  useEffect(() => {
    if (!showInterviews) return
    void loadNotes()
  }, [loadNotes, showInterviews])

  const reportSection = String(startNumber).padStart(2, '0')
  const noteSection = String(mode === 'interviews' ? startNumber : startNumber + 1).padStart(
    2,
    '0',
  )

  return (
    <div className="space-y-6">
      {showReports ? (
        <Card className="!p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-[var(--radius-sm)] bg-brand-cyan/12 p-2.5 text-brand-blue">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                {reportSection} · Gelen raporlar
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
                İK Raporları
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                İnsan kaynaklarının size ilettiği raporlar.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <DateRangeFilter
              startId="mgmt-hr-report-start"
              endId="mgmt-hr-report-end"
              start={reportStart}
              end={reportEnd}
              onStartChange={setReportStart}
              onEndChange={setReportEnd}
              onFilter={() => void loadReports()}
              loading={reportsLoading}
            />

            {reportsLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : reports.length === 0 ? (
              <EmptyState
                title="Rapor yok"
                description="Seçilen aralıkta İK raporu bulunmuyor."
              />
            ) : (
              <ul className="space-y-3">
                {reports.map((report) => {
                  const summary = summarizeHrMpuAttendances(report.mpuAttendances)
                  return (
                    <CollapsibleListItem
                      key={report.id}
                      title={report.title}
                      subtitle={[report.createdByNameSnapshot, summary]
                        .filter(Boolean)
                        .join(' · ')}
                      meta={
                        report.createdAt
                          ? formatDateTimeTr(report.createdAt.toDate())
                          : '—'
                      }
                    >
                      {report.mpuAttendances.length > 0 ? (
                        <ul className="mb-2 space-y-1 text-sm font-medium text-text-primary">
                          {report.mpuAttendances.map((entry) => (
                            <li key={entry.mpuUid}>
                              {formatHrMpuAttendanceEntry(entry)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                        {report.body}
                      </p>
                    </CollapsibleListItem>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      {showInterviews ? (
        <Card className="!p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-[var(--radius-sm)] bg-brand-pink/12 p-2.5 text-brand-pink">
              <UserRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-pink">
                {noteSection} · Gelen notlar
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
                İş Görüşmesi Raporları
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                İK’nın ilettiği aday görüşme notları.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <DateRangeFilter
              startId="mgmt-hr-note-start"
              endId="mgmt-hr-note-end"
              start={noteStart}
              end={noteEnd}
              onStartChange={setNoteStart}
              onEndChange={setNoteEnd}
              onFilter={() => void loadNotes()}
              loading={notesLoading}
            />

            {notesLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : notes.length === 0 ? (
              <EmptyState
                title="Görüşme raporu yok"
                description="Seçilen aralıkta iş görüşmesi raporu bulunmuyor."
              />
            ) : (
              <ul className="space-y-3">
                {notes.map((item) => (
                  <CollapsibleListItem
                    key={item.id}
                    title={item.candidateName}
                    subtitle={item.createdByNameSnapshot}
                    meta={
                      item.createdAt ? formatDateTimeTr(item.createdAt.toDate()) : '—'
                    }
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                      {item.note}
                    </p>
                    <HiringNoteAttachmentList attachments={item.attachments} />
                  </CollapsibleListItem>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
