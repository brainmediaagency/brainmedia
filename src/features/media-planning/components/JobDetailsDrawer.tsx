import type { JobDocument } from '@/features/jobs/types/job'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatPhoneDisplay, normalizeTurkishPhone } from '@/lib/phone'
import { formatJobScheduleTr, formatDateTimeTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { formatJobCreator } from '@/features/jobs/utils/formatJobCreator'
import { formatJobReviewer } from '@/features/jobs/utils/formatJobReviewer'
import {
  formatJobStatusNote,
  formatJobStatusNoteLabel,
  shouldHighlightJobStatusNote,
} from '@/features/jobs/utils/formatJobStatusNote'

export type JobDetailsDrawerProps = {
  job: JobDocument | null
  open: boolean
  onClose: () => void
  /** MPU: show Düzenle while job is still pending (pre-konfirme). */
  canEdit?: boolean
  onEdit?: (job: JobDocument) => void
}

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

export function JobDetailsDrawer({
  job,
  open,
  onClose,
  canEdit = false,
  onEdit,
}: JobDetailsDrawerProps) {
  const { profile, claims } = useAuth()
  const viewerRole = claims?.role ?? profile?.role

  if (!job) return null

  const reviewerLabel = formatJobReviewer(job, viewerRole, '')
  const showEdit = canEdit && job.status === 'pending' && Boolean(onEdit)
  const statusNote = formatJobStatusNote(job)
  const statusNoteLabel = formatJobStatusNoteLabel(job.status)
  const highlightStatusNote = shouldHighlightJobStatusNote(job.status)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={job.companyName}
      description="İş kaydı detayları"
      side="right"
    >
      {showEdit ? (
        <div className="mb-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => onEdit?.(job)}
          >
            Düzenle
          </Button>
          <p className="mt-2 text-xs text-text-secondary">
            Konfirme edilene kadar düzenleyebilirsiniz.
          </p>
        </div>
      ) : null}
      {highlightStatusNote && statusNote ? (
        <div
          className={
            job.status === 'rejected'
              ? 'mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-3'
              : 'mb-4 rounded-lg border border-border bg-surface-muted px-3 py-3'
          }
          role="status"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {statusNoteLabel}
          </p>
          <p className="mt-1 text-sm font-medium text-text-primary whitespace-pre-wrap">
            {statusNote}
          </p>
        </div>
      ) : null}
      <dl>
        <div className="flex flex-col gap-1 border-b border-border py-3">
          <dt className="text-sm text-text-secondary">Durum</dt>
          <dd>
            <StatusBadge status={job.status} />
          </dd>
        </div>

        {job.contacts.map((contact, index) => (
          <div key={`${contact.mobilePhone}-${index}`} className="border-b border-border py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Yetkili {index + 1}
            </p>
            <DetailRow label="Adı" value={contact.name} />
            <DetailRow label="Cep" value={formatPhone(contact.mobilePhone)} />
            {contact.workPhone && (
              <DetailRow label="İş telefonu" value={formatPhone(contact.workPhone)} />
            )}
          </div>
        ))}

        <DetailRow label="İl" value={job.province} />
        <DetailRow label="İlçe" value={job.district} />
        <DetailRow label="Adres" value={job.fullAddress} />
        {job.instagram ? <DetailRow label="Instagram" value={job.instagram} /> : null}
        <DetailRow label="İş Alım Tarihi" value={formatJobScheduleTr(job.acquiredDate)} />
        <DetailRow
          label="Planlanan Çekim"
          value={formatJobScheduleTr(job.plannedExecutionDate)}
        />
        <DetailRow label="Anlaşılan Tutar" value={formatTryFromKurus(job.agreedAmountKurus)} />
        <DetailRow label="Ekleyen kullanıcı" value={formatJobCreator(job)} />
        {reviewerLabel ? (
          <DetailRow label="İnceleyen" value={reviewerLabel} />
        ) : null}
        {statusNote && !highlightStatusNote ? (
          <DetailRow label={statusNoteLabel} value={statusNote} />
        ) : null}
        {job.createdAt && (
          <DetailRow label="Oluşturulma" value={formatDateTimeTr(job.createdAt.toDate())} />
        )}
        {job.reviewedAt && (
          <DetailRow label="İnceleme Tarihi" value={formatDateTimeTr(job.reviewedAt.toDate())} />
        )}
      </dl>
    </Drawer>
  )
}
