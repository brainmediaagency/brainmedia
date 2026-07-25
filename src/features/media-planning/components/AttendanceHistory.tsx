import { useEffect, useMemo, useState } from 'react'
import {
  subscribeAttendanceLogs,
  attendanceWorkedMinutes,
  updateAttendanceLogTimes,
} from '@/features/attendance/services/attendanceService'
import type { AttendanceLog } from '@/features/attendance/types/attendance'
import { EmptyState } from '@/components/ui/EmptyState'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { formatDateTr, formatDurationMinutes, formatTimeTr } from '@/lib/date'
import { AttendanceHistoryFilters } from '@/features/media-planning/components/AttendanceHistoryFilters'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { COMPANY_TIMEZONE } from '@/config/roles'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'

export type AttendanceHistoryProps = {
  uid: string
  userName: string
  /** Show total shifts / hours summary strip above the table. */
  showSummary?: boolean
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(value: string, endOfDay = false): Date {
  const parts = value.split('-').map(Number)
  const year = parts[0] ?? 1970
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const date = new Date(year, month - 1, day)
  if (endOfDay) date.setHours(23, 59, 59, 999)
  else date.setHours(0, 0, 0, 0)
  return date
}

export function AttendanceHistory({
  uid,
  userName,
  showSummary = false,
}: AttendanceHistoryProps) {
  const { user, profile } = useAuth()
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(
    () => new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    [defaultEnd],
  )

  const [startDate, setStartDate] = useState(() => toDateInputValue(defaultStart))
  const [endDate, setEndDate] = useState(() => toDateInputValue(defaultEnd))
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AttendanceLog | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editReason, setEditReason] = useState('')
  const [saving, setSaving] = useState(false)
  const canEdit =
    profile?.role === 'human_resources' || profile?.role === 'management'

  function openEdit(log: AttendanceLog) {
    if (!log.startedAt || !log.endedAt) return
    setEditing(log)
    setEditStart(
      formatInTimeZone(log.startedAt.toDate(), COMPANY_TIMEZONE, "yyyy-MM-dd'T'HH:mm"),
    )
    setEditEnd(
      formatInTimeZone(log.endedAt.toDate(), COMPANY_TIMEZONE, "yyyy-MM-dd'T'HH:mm"),
    )
    setEditReason('')
  }

  async function saveEdit() {
    if (!editing || !user || !profile || !canEdit) return
    const role = profile.role
    if (role !== 'human_resources' && role !== 'management') return
    setSaving(true)
    try {
      await updateAttendanceLogTimes({
        ownerUid: uid,
        shiftId: editing.shiftId,
        startedAt: fromZonedTime(editStart, COMPANY_TIMEZONE),
        endedAt: fromZonedTime(editEnd, COMPANY_TIMEZONE),
        reason: editReason,
        actorUid: user.uid,
        actorName: profile.fullName,
        actorRole: role,
      })
      toast.success('Mesai zamanı güncellendi.')
      setEditing(null)
    } catch (error) {
      toast.error(mapAppError(error, 'Mesai kaydı güncellenemedi.'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!uid) return

    setLoading(true)
    const unsubscribe = subscribeAttendanceLogs(
      uid,
      {
        startDate: parseDateInput(startDate),
        endDate: parseDateInput(endDate, true),
      },
      (next) => {
        setLogs(next)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [uid, startDate, endDate])

  const summary = useMemo(() => {
    const totalMinutes = logs.reduce(
      (sum, log) => sum + attendanceWorkedMinutes(log),
      0,
    )
    const avgMinutes =
      logs.length > 0 ? Math.round(totalMinutes / logs.length) : 0
    return {
      shifts: logs.length,
      totalMinutes,
      avgMinutes,
    }
  }, [logs])

  return (
    <div className="space-y-4">
      <AttendanceHistoryFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {showSummary && !loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted/50 px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">Mesai kaydı</p>
            <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
              {summary.shifts}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted/50 px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">Toplam süre</p>
            <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
              {formatDurationMinutes(summary.totalMinutes)}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted/50 px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">Ortalama süre</p>
            <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
              {summary.shifts > 0 ? formatDurationMinutes(summary.avgMinutes) : '—'}
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="Mesai kaydı bulunamadı"
          description="Seçilen tarih aralığında tamamlanmış mesai kaydı bulunmuyor."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell header>Tarih</TableCell>
                  <TableCell header>Kullanıcı</TableCell>
                  <TableCell header>Başlangıç</TableCell>
                  <TableCell header>Bitiş</TableCell>
                  <TableCell header>Süre</TableCell>
                  <TableCell header>Durum</TableCell>
                  {canEdit ? <TableCell header>İşlem</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.shiftId}>
                    <TableCell>
                      {log.startedAt ? formatDateTr(log.startedAt.toDate()) : '—'}
                    </TableCell>
                    <TableCell>{log.ownerNameSnapshot || userName}</TableCell>
                    <TableCell>
                      {log.startedAt ? formatTimeTr(log.startedAt.toDate()) : '—'}
                    </TableCell>
                    <TableCell>
                      {log.endedAt ? formatTimeTr(log.endedAt.toDate()) : '—'}
                    </TableCell>
                    <TableCell>{formatDurationMinutes(attendanceWorkedMinutes(log))}</TableCell>
                    <TableCell>
                      <StatusBadge status="completed" />
                    </TableCell>
                    {canEdit ? (
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(log)}
                        >
                          Düzenle
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {logs.map((log) => (
              <MobileDataCard
                key={log.shiftId}
                title={log.startedAt ? formatDateTr(log.startedAt.toDate()) : '—'}
                subtitle={log.ownerNameSnapshot || userName}
                badge={<StatusBadge status="completed" />}
                rows={[
                  {
                    label: 'Başlangıç',
                    value: log.startedAt ? formatTimeTr(log.startedAt.toDate()) : '—',
                  },
                  {
                    label: 'Bitiş',
                    value: log.endedAt ? formatTimeTr(log.endedAt.toDate()) : '—',
                  },
                  {
                    label: 'Süre',
                    value: formatDurationMinutes(attendanceWorkedMinutes(log)),
                  },
                ]}
                footer={
                  canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openEdit(log)}
                    >
                      Mesai zamanını düzenle
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Mesai zamanını düzenle"
        description={`${userName} · Yapılan değişiklik denetim geçmişinde saklanır.`}
      >
        <div className="space-y-4">
          <FormField label="Başlangıç" htmlFor="attendance-edit-start" required>
            <Input
              id="attendance-edit-start"
              type="datetime-local"
              value={editStart}
              onChange={(event) => setEditStart(event.target.value)}
            />
          </FormField>
          <FormField label="Bitiş" htmlFor="attendance-edit-end" required>
            <Input
              id="attendance-edit-end"
              type="datetime-local"
              value={editEnd}
              onChange={(event) => setEditEnd(event.target.value)}
            />
          </FormField>
          <FormField
            label="Düzeltme nedeni"
            htmlFor="attendance-edit-reason"
            required
            hint="En az 3 karakter"
          >
            <Textarea
              id="attendance-edit-reason"
              rows={3}
              value={editReason}
              onChange={(event) => setEditReason(event.target.value)}
            />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void saveEdit()} loading={saving}>
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
