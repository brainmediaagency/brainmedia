import {
  AtSign,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Mic,
  Phone,
  UserRound,
} from 'lucide-react'
import { CategoryPanel } from '@/components/ui/CategoryPanel'
import { Drawer } from '@/components/ui/Drawer'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { isVoiceRecordingViewerRole } from '@/config/roles'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { JobDocument } from '@/features/jobs/types/job'
import { formatJobCreator } from '@/features/jobs/utils/formatJobCreator'
import { formatJobReviewer } from '@/features/jobs/utils/formatJobReviewer'
import {
  formatJobStatusNote,
  formatJobStatusNoteLabel,
  shouldHighlightJobStatusNote,
} from '@/features/jobs/utils/formatJobStatusNote'
import {
  instagramProfileUrl,
  mapsSearchUrl,
  telHref,
  whatsappHref,
} from '@/features/jobs/utils/jobDetailLinks'
import { VoiceRecordingPlayback } from '@/features/voice-recording/components/VoiceRecordingPlayback'
import type { VoiceRecordingDoc } from '@/features/voice-recording/types/voiceRecording'
import { JobClockInJobDetail } from '@/features/kameraman/components/JobClockInJobDetail'
import { formatTryFromKurus } from '@/lib/currency'
import {
  formatDateOnlyLongTr,
  formatDateTimeTr,
  formatJobScheduleTr,
  normalizeJobSchedule,
} from '@/lib/date'
import { formatPhoneDisplay, normalizeTurkishPhone } from '@/lib/phone'

export type ShootingCalendarJobDetailProps = {
  job: JobDocument | null
  open: boolean
  onClose: () => void
  /** Voice clips for this job. Empty for kameraman. */
  recordings?: VoiceRecordingDoc[]
}

function formatPhone(value: string): string {
  const normalized = normalizeTurkishPhone(value)
  return normalized ? formatPhoneDisplay(normalized) : value
}

function ActionLink({
  href,
  icon: Icon,
  children,
  external = false,
}: {
  href: string
  icon: typeof Phone
  children: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : undefined)}
      className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm font-medium text-text-primary shadow-[var(--shadow-xs)] transition-colors hover:border-brand-cyan/40 hover:bg-surface-muted sm:h-10 sm:w-auto"
    >
      <Icon className="size-3.5 shrink-0 text-brand-blue" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </a>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </dt>
      <dd className="text-sm font-medium text-text-primary sm:text-right">
        {value}
      </dd>
    </div>
  )
}

export function ShootingCalendarJobDetail({
  job,
  open,
  onClose,
  recordings = [],
}: ShootingCalendarJobDetailProps) {
  const { profile, claims } = useAuth()
  const viewerRole = claims?.role ?? profile?.role
  const canHearVoice = isVoiceRecordingViewerRole(viewerRole)

  if (!job) return null

  const schedule = normalizeJobSchedule(job.plannedExecutionDate)
  const time = schedule.length >= 16 ? schedule.slice(11, 16) : ''
  const day = schedule.slice(0, 10)
  const mapsUrl = mapsSearchUrl(
    [job.fullAddress, job.district, job.province].filter(Boolean).join(', '),
  )
  const instagramUrl = job.instagram ? instagramProfileUrl(job.instagram) : null
  const statusNote = formatJobStatusNote(job)
  const statusNoteLabel = formatJobStatusNoteLabel(job.status)
  const highlightStatusNote = shouldHighlightJobStatusNote(job.status)
  const reviewerLabel = formatJobReviewer(job, viewerRole, '')

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={job.companyName}
      description="Çekim detayı"
      side="responsive"
      className="sm:max-w-lg lg:max-w-xl"
    >
      <div className="space-y-3">
        <section className="relative overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--cat-navy-border)] bg-[color:var(--cat-navy-bg)] p-4">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-0.5 bg-[image:var(--gradient-primary)]"
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-text-primary">
                {time || '—'}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {formatDateOnlyLongTr(day)}
              </p>
            </div>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-4 font-display text-xl font-semibold tabular-nums text-text-primary">
            {formatTryFromKurus(job.agreedAmountKurus)}
          </p>
        </section>

        {canHearVoice && recordings.length > 0 ? (
          <CategoryPanel
            title={recordings.length > 1 ? 'Ses kayıtları' : 'Ses kaydı'}
            icon={Mic}
            tone="violet"
            compact
          >
            {recordings.map((item) => (
              <VoiceRecordingPlayback key={item.id} item={item} />
            ))}
          </CategoryPanel>
        ) : null}

        <JobClockInJobDetail job={job} />

        {highlightStatusNote && statusNote ? (
          <div
            className={
              job.status === 'rejected'
                ? 'rounded-[var(--radius-md)] border border-danger/30 bg-danger/10 px-3.5 py-3'
                : 'rounded-[var(--radius-md)] border border-border bg-surface-muted px-3.5 py-3'
            }
            role="status"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {statusNoteLabel}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-text-primary">
              {statusNote}
            </p>
          </div>
        ) : null}

        <CategoryPanel
          title="Konum"
          description={`${job.district} / ${job.province}`}
          icon={MapPin}
          tone="cyan"
          compact
        >
          <p className="text-sm leading-relaxed text-text-primary">
            {job.fullAddress}
          </p>
          {mapsUrl ? (
            <ActionLink href={mapsUrl} icon={ExternalLink} external>
              Haritada aç
            </ActionLink>
          ) : null}
        </CategoryPanel>

        {job.contacts.map((contact, index) => {
          const mobileTel = telHref(contact.mobilePhone)
          const workTel = contact.workPhone ? telHref(contact.workPhone) : null
          const wa = whatsappHref(contact.mobilePhone)
          return (
            <CategoryPanel
              key={`${contact.mobilePhone}-${index}`}
              title={job.contacts.length > 1 ? `Yetkili ${index + 1}` : 'Yetkili'}
              description={contact.name}
              icon={UserRound}
              tone="blue"
              compact
            >
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-text-secondary">Cep · </span>
                  <span className="font-medium text-text-primary">
                    {formatPhone(contact.mobilePhone)}
                  </span>
                </p>
                {contact.workPhone ? (
                  <p>
                    <span className="text-text-secondary">İş · </span>
                    <span className="font-medium text-text-primary">
                      {formatPhone(contact.workPhone)}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {mobileTel ? (
                  <ActionLink href={mobileTel} icon={Phone}>
                    Cep ara
                  </ActionLink>
                ) : null}
                {workTel ? (
                  <ActionLink href={workTel} icon={Phone}>
                    İş ara
                  </ActionLink>
                ) : null}
                {wa ? (
                  <ActionLink href={wa} icon={MessageCircle} external>
                    WhatsApp
                  </ActionLink>
                ) : null}
              </div>
            </CategoryPanel>
          )
        })}

        {instagramUrl ? (
          <CategoryPanel title="Instagram" icon={AtSign} tone="pink" compact>
            <ActionLink href={instagramUrl} icon={ExternalLink} external>
            {job.instagram
              ? job.instagram.replace(/^https?:\/\//i, '')
              : 'Profili aç'}
            </ActionLink>
          </CategoryPanel>
        ) : null}

        <CategoryPanel title="Kayıt" icon={Clock} tone="navy" compact>
          <dl className="divide-y divide-black/5">
            <MetaRow
              label="Planlanan çekim"
              value={formatJobScheduleTr(job.plannedExecutionDate)}
            />
            <MetaRow
              label="İş alım tarihi"
              value={formatJobScheduleTr(job.acquiredDate)}
            />
            <MetaRow
              label="Anlaşılan tutar"
              value={formatTryFromKurus(job.agreedAmountKurus)}
            />
            <MetaRow label="Ekleyen" value={formatJobCreator(job)} />
            {reviewerLabel ? (
              <MetaRow label="İnceleyen" value={reviewerLabel} />
            ) : null}
            {job.reviewedAt ? (
              <MetaRow
                label="Konfirme"
                value={formatDateTimeTr(job.reviewedAt.toDate())}
              />
            ) : null}
            {statusNote && !highlightStatusNote ? (
              <MetaRow label={statusNoteLabel} value={statusNote} />
            ) : null}
          </dl>
        </CategoryPanel>
      </div>
    </Drawer>
  )
}
