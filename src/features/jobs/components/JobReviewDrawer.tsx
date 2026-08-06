import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import turkeyLocations from '@/data/turkeyLocations.json'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  approveJob,
  rejectJob,
  revertJobToPending,
} from '@/features/jobs/services/jobService'
import {
  exportJobReviewToSheet,
  SHEET_SON_DURUM,
  upsertJobRowToSheet,
} from '@/features/jobs/services/sheetsExport'
import {
  useJobReviewFieldEdit,
  type JobReviewEditField,
  type LocationDraft,
} from '@/features/jobs/hooks/useJobReviewFieldEdit'
import { EditableDetailRow } from '@/features/jobs/components/EditableDetailRow'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  formatJobStatusNote,
  formatJobStatusNoteLabel,
} from '@/features/jobs/utils/formatJobStatusNote'
import { Button } from '@/components/ui/Button'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { DateInput } from '@/components/ui/DateInput'
import { Drawer } from '@/components/ui/Drawer'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  combineJobDateAndTime,
  formatJobScheduleTr,
  formatDateTimeTr,
  isValidJobTimeLocal,
} from '@/lib/date'
import { formatTryFromKurus, kurusToTry } from '@/lib/currency'
import { formatPhoneDisplay, normalizeTurkishPhone } from '@/lib/phone'
import { formatJobCreator } from '@/features/jobs/utils/formatJobCreator'
import { VoiceRecordingPanel } from '@/features/voice-recording/components/VoiceRecordingPanel'
import { mapAppError } from '@/lib/errors'

export type JobReviewDrawerProps = {
  job: JobDocument | null
  open: boolean
  onClose: () => void
  mode: 'pending' | 'reviewed'
  /** Called after a successful pending-field edit (fresh job from Firestore). */
  onJobUpdated?: (job: JobDocument) => void
  /**
   * When false (firma araması detayı), ses kaydı ve “konfirme beklemeye geri al”
   * gizlenir. Onay kuyruğunda varsayılan true.
   */
  showRecordingAndRevert?: boolean
}

/** Matches günlük takvim window: full + half hours 09:00–21:00. */
const EXECUTION_TIME_HOUR_START = 9
const EXECUTION_TIME_HOUR_END = 21

function buildExecutionTimeOptions(): string[] {
  const options: string[] = []
  for (let h = EXECUTION_TIME_HOUR_START; h <= EXECUTION_TIME_HOUR_END; h += 1) {
    const hour = String(h).padStart(2, '0')
    options.push(`${hour}:00`)
    if (h < EXECUTION_TIME_HOUR_END) options.push(`${hour}:30`)
  }
  return options
}

const EXECUTION_TIME_OPTIONS = buildExecutionTimeOptions()

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:justify-between">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="text-sm font-medium text-text-primary sm:text-right">{value}</dd>
    </div>
  )
}

function formatPhone(value: string): string {
  const normalized = normalizeTurkishPhone(value)
  return normalized ? formatPhoneDisplay(normalized) : value
}

function plannedDateOnly(job: JobDocument): string {
  return job.plannedExecutionDate.slice(0, 10)
}

export function JobReviewDrawer({
  job,
  open,
  onClose,
  mode,
  onJobUpdated,
  showRecordingAndRevert = true,
}: JobReviewDrawerProps) {
  const { profile, claims, isOnline } = useAuth()
  const [note, setNote] = useState('')
  const [executionTime, setExecutionTime] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const actorRole = claims?.role ?? profile?.role
  const canReview =
    actorRole === 'coordinator' || actorRole === 'management'

  const canEditFields =
    mode === 'pending' && canReview && isOnline && job?.status === 'pending'

  const fieldEdit = useJobReviewFieldEdit(
    job,
    Boolean(canEditFields),
    onJobUpdated,
  )

  useEffect(() => {
    setNote('')
    setExecutionTime('')
    setTimeError(null)
  }, [job?.id, open])

  const locationDraft =
    fieldEdit.editingField === 'location' &&
    typeof fieldEdit.draft === 'object' &&
    fieldEdit.draft !== null
      ? (fieldEdit.draft as LocationDraft)
      : null

  const districts = useMemo(() => {
    if (!locationDraft?.province) return []
    const location = turkeyLocations.find((loc) => loc.name === locationDraft.province)
    return location?.districts ?? []
  }, [locationDraft?.province])

  if (!job) return null

  const actor =
    profile && actorRole
      ? { uid: profile.uid, fullName: profile.fullName, role: actorRole }
      : null

  const plannedDate = plannedDateOnly(job)
  const statusNote = formatJobStatusNote(job)
  const editingInProgress = fieldEdit.editingField !== null
  const canApprove =
    canReview &&
    isOnline &&
    !submitting &&
    !fieldEdit.saving &&
    !editingInProgress &&
    isValidJobTimeLocal(executionTime)

  const busy = submitting || fieldEdit.saving
  const rowCanEdit = Boolean(canEditFields) && !busy && !editingInProgress

  const resetLocalState = () => {
    setNote('')
    setExecutionTime('')
    setTimeError(null)
    fieldEdit.cancelEdit()
  }

  const isFieldEditing = (field: JobReviewEditField) =>
    fieldEdit.editingField === field

  const fieldError = (field: JobReviewEditField) =>
    fieldEdit.editingField === field ? fieldEdit.error : null

  const handleApprove = async () => {
    if (!actor || !isOnline || !canReview) return
    if (!isValidJobTimeLocal(executionTime)) {
      setTimeError('Çekim saati gereklidir.')
      return
    }
    setTimeError(null)
    setSubmitting(true)
    try {
      const plannedExecutionDate = combineJobDateAndTime(plannedDate, executionTime)
      const reviewNote = note.trim() || undefined
      const updated = await approveJob(
        job.id,
        actor,
        plannedExecutionDate,
        reviewNote,
      )
      onJobUpdated?.(updated)
      toast.success('İş konfirme edildi.')
      void exportJobReviewToSheet(job, 'approved', {
        plannedExecutionDate,
        reviewedByName: actor.fullName,
        reviewNote: reviewNote ?? null,
      }).catch((error) => {
        toast.warning(
          mapAppError(
            error,
            'Firestore kaydı tamam. Excel (Sheets) yazılamadı — Excel sekmesinden kontrol edin veya işlemi tekrar deneyin.',
          ),
        )
      })
      resetLocalState()
      onClose()
    } catch (error) {
      toast.error(mapAppError(error, 'İş konfirme edilemedi. Lütfen tekrar deneyin.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!actor || !isOnline || !canReview) return
    setSubmitting(true)
    try {
      const reviewNote = note.trim() || undefined
      const updated = await rejectJob(job.id, actor, reviewNote)
      onJobUpdated?.(updated)
      toast.success('İş reddedildi.')
      void upsertJobRowToSheet(job, SHEET_SON_DURUM.rejected, {
        reviewedByName: actor.fullName,
        reviewNote: reviewNote ?? null,
      }).catch((error) => {
        toast.warning(
          mapAppError(
            error,
            'Firestore kaydı tamam. Excel (Sheets) yazılamadı — Excel sekmesinden kontrol edin veya işlemi tekrar deneyin.',
          ),
        )
      })
      resetLocalState()
      onClose()
    } catch (error) {
      toast.error(mapAppError(error, 'İş reddedilemedi. Lütfen tekrar deneyin.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevertToPending = async () => {
    if (!actor || !isOnline || !canReview) return
    setSubmitting(true)
    try {
      const updated = await revertJobToPending(
        job.id,
        actor,
        note.trim() || undefined,
      )
      onJobUpdated?.(updated)
      toast.success('İş konfirme beklemeye geri alındı.')
      resetLocalState()
      onClose()
    } catch (error) {
      toast.error(
        mapAppError(error, 'İş konfirme beklemeye alınamadı. Lütfen tekrar deneyin.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        if (!busy) {
          resetLocalState()
          onClose()
        }
      }}
      title={job.companyName}
      description="İş inceleme ve konfirme"
      side="right"
    >
      <dl className="mb-6">
        <div className="flex flex-col gap-1 border-b border-border py-3">
          <dt className="text-sm text-text-secondary">Durum</dt>
          <dd>
            <StatusBadge status={job.status} />
          </dd>
        </div>

        <DetailRow label="Ekleyen kullanıcı" value={formatJobCreator(job)} />
        <DetailRow
          label="Gönderim"
          value={
            job.createdAt ? formatDateTimeTr(job.createdAt.toDate()) : '—'
          }
        />

        {job.contacts.map((contact, index) => {
          const nameField = `contactName:${index}` as const
          const phoneField = `contactPhone:${index}` as const
          return (
            <div key={`contact-${index}`} className="border-b border-border py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Yetkili {index + 1}
              </p>
              <EditableDetailRow
                label="Yetkili adı"
                displayValue={contact.name}
                canEdit={rowCanEdit}
                isEditing={isFieldEditing(nameField)}
                saving={fieldEdit.saving}
                error={fieldError(nameField)}
                onStartEdit={() => fieldEdit.startEdit(nameField)}
                onCancel={fieldEdit.cancelEdit}
                onSave={() => void fieldEdit.saveEdit()}
                className="border-b-0 py-2"
              >
                <Input
                  value={typeof fieldEdit.draft === 'string' ? fieldEdit.draft : ''}
                  onChange={(e) => fieldEdit.setDraft(e.target.value)}
                  disabled={fieldEdit.saving}
                  maxLength={100}
                  autoFocus
                />
              </EditableDetailRow>
              <EditableDetailRow
                label="Cep numarası"
                displayValue={formatPhone(contact.mobilePhone)}
                canEdit={rowCanEdit}
                isEditing={isFieldEditing(phoneField)}
                saving={fieldEdit.saving}
                error={fieldError(phoneField)}
                onStartEdit={() => fieldEdit.startEdit(phoneField)}
                onCancel={fieldEdit.cancelEdit}
                onSave={() => void fieldEdit.saveEdit()}
                className="border-b-0 py-2"
              >
                <PhoneInput
                  value={typeof fieldEdit.draft === 'string' ? fieldEdit.draft : ''}
                  onChange={(value) => fieldEdit.setDraft(value)}
                  disabled={fieldEdit.saving}
                  error={Boolean(fieldError(phoneField))}
                />
              </EditableDetailRow>
              {contact.workPhone && (
                <DetailRow label="İş Telefonu" value={formatPhone(contact.workPhone)} />
              )}
            </div>
          )
        })}

        <EditableDetailRow
          label="İl / İlçe"
          displayValue={`${job.province} / ${job.district}`}
          canEdit={rowCanEdit}
          isEditing={isFieldEditing('location')}
          saving={fieldEdit.saving}
          error={fieldError('location')}
          onStartEdit={() => fieldEdit.startEdit('location')}
          onCancel={fieldEdit.cancelEdit}
          onSave={() => void fieldEdit.saveEdit()}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              value={locationDraft?.province ?? ''}
              onChange={(e) => {
                fieldEdit.setDraft({
                  province: e.target.value,
                  district: '',
                })
              }}
              disabled={fieldEdit.saving}
              error={Boolean(fieldError('location'))}
            >
              <option value="">İl seçin</option>
              {turkeyLocations.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </Select>
            <Select
              value={locationDraft?.district ?? ''}
              onChange={(e) => {
                const district = e.target.value
                fieldEdit.setDraft((prev) => {
                  if (typeof prev !== 'object' || prev === null) {
                    return { province: '', district }
                  }
                  return { ...prev, district }
                })
              }}
              disabled={fieldEdit.saving || !locationDraft?.province}
              error={Boolean(fieldError('location'))}
            >
              <option value="">İlçe seçin</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
        </EditableDetailRow>

        <EditableDetailRow
          label="Adres"
          displayValue={job.fullAddress}
          canEdit={rowCanEdit}
          isEditing={isFieldEditing('fullAddress')}
          saving={fieldEdit.saving}
          error={fieldError('fullAddress')}
          onStartEdit={() => fieldEdit.startEdit('fullAddress')}
          onCancel={fieldEdit.cancelEdit}
          onSave={() => void fieldEdit.saveEdit()}
        >
          <Textarea
            value={typeof fieldEdit.draft === 'string' ? fieldEdit.draft : ''}
            onChange={(e) => fieldEdit.setDraft(e.target.value)}
            disabled={fieldEdit.saving}
            maxLength={500}
            showCounter
            error={Boolean(fieldError('fullAddress'))}
            className="min-h-[96px]"
          />
        </EditableDetailRow>

        {job.instagram ? (
          <DetailRow label="Instagram" value={job.instagram} />
        ) : null}

        <EditableDetailRow
          label="İş Alım Tarihi"
          displayValue={formatJobScheduleTr(job.acquiredDate)}
          canEdit={rowCanEdit}
          isEditing={isFieldEditing('acquiredDate')}
          saving={fieldEdit.saving}
          error={fieldError('acquiredDate')}
          onStartEdit={() => fieldEdit.startEdit('acquiredDate')}
          onCancel={fieldEdit.cancelEdit}
          onSave={() => void fieldEdit.saveEdit()}
        >
          <DateInput
            value={typeof fieldEdit.draft === 'string' ? fieldEdit.draft : ''}
            onChange={(e) => fieldEdit.setDraft(e.target.value)}
            disabled={fieldEdit.saving}
            error={Boolean(fieldError('acquiredDate'))}
          />
        </EditableDetailRow>

        <EditableDetailRow
          label="Planlanan Çekim"
          displayValue={formatJobScheduleTr(job.plannedExecutionDate)}
          canEdit={rowCanEdit}
          isEditing={isFieldEditing('plannedExecutionDate')}
          saving={fieldEdit.saving}
          error={fieldError('plannedExecutionDate')}
          onStartEdit={() => fieldEdit.startEdit('plannedExecutionDate')}
          onCancel={fieldEdit.cancelEdit}
          onSave={() => void fieldEdit.saveEdit()}
        >
          <DateInput
            value={typeof fieldEdit.draft === 'string' ? fieldEdit.draft : ''}
            onChange={(e) => fieldEdit.setDraft(e.target.value)}
            disabled={fieldEdit.saving}
            error={Boolean(fieldError('plannedExecutionDate'))}
          />
        </EditableDetailRow>

        <EditableDetailRow
          label="Anlaşılan Tutar"
          displayValue={formatTryFromKurus(job.agreedAmountKurus)}
          canEdit={rowCanEdit}
          isEditing={isFieldEditing('agreedAmount')}
          saving={fieldEdit.saving}
          error={fieldError('agreedAmount')}
          onStartEdit={() => fieldEdit.startEdit('agreedAmount')}
          onCancel={fieldEdit.cancelEdit}
          onSave={() => void fieldEdit.saveEdit()}
        >
          <CurrencyInput
            value={
              typeof fieldEdit.draft === 'number'
                ? fieldEdit.draft
                : kurusToTry(job.agreedAmountKurus)
            }
            onChange={(value) => fieldEdit.setDraft(value ?? 0)}
            disabled={fieldEdit.saving}
            error={Boolean(fieldError('agreedAmount'))}
          />
        </EditableDetailRow>

        {job.reviewedByNameSnapshot && (
          <DetailRow label="İnceleyen" value={job.reviewedByNameSnapshot} />
        )}
        {statusNote ? (
          <DetailRow
            label={formatJobStatusNoteLabel(job.status)}
            value={statusNote}
          />
        ) : null}
      </dl>

      {mode === 'pending' && (
        <div className="space-y-4 border-t border-border pt-4">
          <FormField
            label="Çekim saati"
            htmlFor="executionTime"
            required
            hint="Tam veya buçuk saat seçin (09:00–21:00). Planlanan çekim tarihine eklenir."
            error={timeError ?? undefined}
          >
            <Select
              id="executionTime"
              value={executionTime}
              onChange={(e) => {
                setExecutionTime(e.target.value)
                if (timeError) setTimeError(null)
              }}
              error={Boolean(timeError)}
              disabled={busy || !isOnline}
              required
            >
              <option value="">Saat seçin</option>
              {EXECUTION_TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </Select>
          </FormField>

          {canReview && showRecordingAndRevert && (
            <VoiceRecordingPanel
              key={job.id}
              compact
              companyName={job.companyName}
              jobId={job.id}
            />
          )}

          <FormField
            label="İnceleme notu"
            htmlFor="reviewNote"
            hint="İsteğe bağlıdır."
          >
            <Textarea
              id="reviewNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy || !isOnline}
              maxLength={500}
              showCounter
            />
          </FormField>

          {!isOnline && (
            <p className="text-sm text-warning" role="status">
              İnternet bağlantısı olmadan konfirme işlemi yapılamaz.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {canReview && (
              <Button
                type="button"
                variant="danger"
                loading={submitting}
                disabled={busy || !isOnline || editingInProgress}
                onClick={() => void handleReject()}
              >
                Reddet
              </Button>
            )}
            {canReview && (
              <Button
                type="button"
                loading={submitting}
                disabled={!canApprove}
                onClick={() => void handleApprove()}
              >
                Konfirme et
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === 'reviewed' &&
        job.status === 'approved' &&
        canReview &&
        showRecordingAndRevert && (
        <div className="space-y-4 border-t border-border pt-4">
          <VoiceRecordingPanel
            key={`voice-${job.id}`}
            compact
            companyName={job.companyName}
            jobId={job.id}
          />

          <FormField
            label="Geri alma notu"
            htmlFor="revertNote"
            hint="İsteğe bağlıdır. Geçmiş kaydına yazılır."
          >
            <Textarea
              id="revertNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy || !isOnline}
              maxLength={500}
              showCounter
            />
          </FormField>

          {!isOnline && (
            <p className="text-sm text-warning" role="status">
              İnternet bağlantısı olmadan durum değiştirilemez.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              loading={submitting}
              disabled={busy || !isOnline}
              onClick={() => void handleRevertToPending()}
            >
              Konfirme beklemeye geri al
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
