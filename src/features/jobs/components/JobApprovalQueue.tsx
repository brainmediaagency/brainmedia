import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { isJobReviewerRole, isUserRole } from '@/config/roles'
import type { JobDocument } from '@/features/jobs/types/job'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { EmptyState } from '@/components/ui/EmptyState'
import { Drawer } from '@/components/ui/Drawer'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge, type StatusBadgeStatus } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { useClientPagination } from '@/hooks/useClientPagination'
import { formatJobScheduleTr, formatDateTimeTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { formatJobCreator, formatJobCreatorPrimary, formatJobCreatorSecondary } from '@/features/jobs/utils/formatJobCreator'
import { ApprovedJobEditForm } from '@/features/jobs/components/ApprovedJobEditForm'
import { JobReviewDrawer } from '@/features/jobs/components/JobReviewDrawer'
import {
  PENDING_JOB_URGENCY_LABEL,
  pendingJobUrgency,
  type PendingJobUrgency,
} from '@/features/jobs/utils/pendingJobUrgency'
import { cn } from '@/lib/classNames'

const URGENCY_CLASS: Record<PendingJobUrgency, string> = {
  overdue: 'border-brand-orange/40 bg-brand-orange/12 text-brand-orange',
  today: 'border-warning/40 bg-warning/12 text-warning',
  tomorrow: 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-blue',
}

function UrgencyTag({ urgency }: { urgency: PendingJobUrgency | null }) {
  if (!urgency) return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        URGENCY_CLASS[urgency],
      )}
    >
      {PENDING_JOB_URGENCY_LABEL[urgency]}
    </span>
  )
}

export type JobApprovalQueueProps = {
  jobs: JobDocument[]
  loading: boolean
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  onJobUpdated?: (job: JobDocument) => void
}

export function JobApprovalQueue({
  jobs,
  loading,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onJobUpdated,
}: JobApprovalQueueProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const {
    page,
    setPage,
    totalPages,
    pageItems,
    rangeStart,
    rangeEnd,
    totalCount,
    showControls,
  } = useClientPagination(jobs)

  const selectedJob =
    selectedJobId === null
      ? null
      : (jobs.find((job) => job.id === selectedJobId) ?? null)

  useEffect(() => {
    if (selectedJobId && !jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(null)
    }
  }, [jobs, selectedJobId])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="Konfirme bekleyen iş yok"
        description="Şu an inceleme bekleyen iş kaydı bulunmuyor."
      />
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell header>Firma</TableCell>
              <TableCell header>Ekleyen kullanıcı</TableCell>
              <TableCell header>İl / İlçe</TableCell>
              <TableCell header>Planlanan Çekim</TableCell>
              <TableCell header>Tutar</TableCell>
              <TableCell header>Gönderim</TableCell>
              <TableCell header>İşlem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.map((job) => {
              const urgency = pendingJobUrgency(job.plannedExecutionDate)
              return (
              <TableRow
                key={job.id}
                className={cn(
                  urgency === 'today' && 'shadow-[inset_3px_0_0_0_var(--warning)]',
                  urgency === 'overdue' && 'shadow-[inset_3px_0_0_0_var(--brand-orange)]',
                )}
              >
                <TableCell>{job.companyName}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-text-primary">
                      {formatJobCreatorPrimary(job)}
                    </span>
                    {formatJobCreatorSecondary(job) && (
                      <span className="text-xs text-text-secondary">
                        {formatJobCreatorSecondary(job)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {job.province} / {job.district}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{formatJobScheduleTr(job.plannedExecutionDate)}</span>
                    <UrgencyTag urgency={urgency} />
                  </div>
                </TableCell>
                <TableCell>{formatTryFromKurus(job.agreedAmountKurus)}</TableCell>
                <TableCell>
                  {job.createdAt ? formatDateTimeTr(job.createdAt.toDate()) : '—'}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    aria-label={`${job.companyName} işini incele`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    İncele
                  </Button>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {pageItems.map((job) => (
          <MobileDataCard
            key={job.id}
            title={job.companyName}
            subtitle={`Ekleyen: ${formatJobCreator(job)}`}
            badge={<StatusBadge status="pending" label="Konfirme bekliyor" />}
            rows={[
              {
                label: 'İl / İlçe',
                value: `${job.province} / ${job.district}`,
              },
              {
                label: 'Planlanan Çekim',
                value: (
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    {formatJobScheduleTr(job.plannedExecutionDate)}
                    <UrgencyTag urgency={pendingJobUrgency(job.plannedExecutionDate)} />
                  </span>
                ),
              },
              {
                label: 'Tutar',
                value: formatTryFromKurus(job.agreedAmountKurus),
              },
            ]}
            footer={
              <Button
                type="button"
                size="sm"
                className="w-full"
                aria-label={`${job.companyName} işini incele`}
                onClick={() => setSelectedJobId(job.id)}
              >
                İncele
              </Button>
            }
          />
        ))}
      </div>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onPageChange={setPage}
        visible={showControls}
      />

      {hasMore && onLoadMore ? (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? 'Yükleniyor…' : 'Daha fazla yükle'}
          </Button>
        </div>
      ) : null}

      <JobReviewDrawer
        job={selectedJob}
        open={selectedJobId !== null}
        onClose={() => setSelectedJobId(null)}
        mode="pending"
        onJobUpdated={onJobUpdated}
      />
    </>
  )
}

export type ReviewedJobsQueueProps = {
  jobs: JobDocument[]
  loading: boolean
  emptyTitle?: string
  emptyDescription?: string
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  onJobUpdated?: (job: JobDocument) => void
  /** Show decision timestamp column (e.g. rejection time). */
  showDecisionTime?: boolean
}

function toBadgeStatus(status: JobDocument['status']): StatusBadgeStatus {
  return status
}

export function ReviewedJobsQueue({
  jobs,
  loading,
  emptyTitle = 'İncelenmiş iş yok',
  emptyDescription = 'Henüz konfirme veya reddedilmiş iş kaydı bulunmuyor.',
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onJobUpdated,
  showDecisionTime = false,
}: ReviewedJobsQueueProps) {
  const { profile, claims, isOnline } = useAuth()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [editingJob, setEditingJob] = useState<JobDocument | null>(null)
  const {
    page,
    setPage,
    totalPages,
    pageItems,
    rangeStart,
    rangeEnd,
    totalCount,
    showControls,
  } = useClientPagination(jobs)

  const selectedJob =
    selectedJobId === null
      ? null
      : (jobs.find((job) => job.id === selectedJobId) ?? null)

  useEffect(() => {
    if (selectedJobId && !jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(null)
    }
  }, [jobs, selectedJobId])

  const actorRole = isUserRole(profile?.role)
    ? profile.role
    : claims?.role
  const canManageApproved = isJobReviewerRole(actorRole)

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell header>Firma</TableCell>
              <TableCell header>Ekleyen kullanıcı</TableCell>
              <TableCell header>Durum</TableCell>
              {showDecisionTime ? (
                <TableCell header>Red zamanı</TableCell>
              ) : null}
              <TableCell header>İnceleyen</TableCell>
              <TableCell header>Tutar</TableCell>
              <TableCell header>İşlem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.companyName}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-text-primary">
                      {formatJobCreatorPrimary(job)}
                    </span>
                    {formatJobCreatorSecondary(job) && (
                      <span className="text-xs text-text-secondary">
                        {formatJobCreatorSecondary(job)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={toBadgeStatus(job.status)} />
                </TableCell>
                {showDecisionTime ? (
                  <TableCell>
                    {job.reviewedAt
                      ? formatDateTimeTr(job.reviewedAt.toDate())
                      : job.updatedAt
                        ? formatDateTimeTr(job.updatedAt.toDate())
                        : '—'}
                  </TableCell>
                ) : null}
                <TableCell>{job.reviewedByNameSnapshot ?? '—'}</TableCell>
                <TableCell>{formatTryFromKurus(job.agreedAmountKurus)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      Detay
                    </Button>
                    {canManageApproved && job.status === 'approved' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!isOnline}
                        onClick={() => setEditingJob(job)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        Düzenle
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {pageItems.map((job) => (
          <MobileDataCard
            key={job.id}
            title={job.companyName}
            subtitle={`Ekleyen: ${formatJobCreator(job)}`}
            badge={<StatusBadge status={toBadgeStatus(job.status)} />}
            rows={[
              ...(showDecisionTime
                ? [
                    {
                      label: 'Red zamanı',
                      value: job.reviewedAt
                        ? formatDateTimeTr(job.reviewedAt.toDate())
                        : job.updatedAt
                          ? formatDateTimeTr(job.updatedAt.toDate())
                          : '—',
                    },
                  ]
                : []),
              {
                label: 'İnceleyen',
                value: job.reviewedByNameSnapshot ?? '—',
              },
              {
                label: 'Tutar',
                value: formatTryFromKurus(job.agreedAmountKurus),
              },
            ]}
            footer={
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  Detay
                </Button>
                {canManageApproved && job.status === 'approved' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    disabled={!isOnline}
                    onClick={() => setEditingJob(job)}
                  >
                    Düzenle
                  </Button>
                ) : null}
              </div>
            }
          />
        ))}
      </div>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onPageChange={setPage}
        visible={showControls}
      />

      {hasMore && onLoadMore ? (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? 'Yükleniyor…' : 'Daha fazla yükle'}
          </Button>
        </div>
      ) : null}

      <JobReviewDrawer
        job={selectedJob}
        open={selectedJobId !== null}
        onClose={() => setSelectedJobId(null)}
        mode="reviewed"
        onJobUpdated={onJobUpdated}
      />

      <Drawer
        open={editingJob !== null}
        onClose={() => setEditingJob(null)}
        title="İş kaydını düzenle"
        description={editingJob?.companyName}
        side="right"
      >
        {editingJob ? (
          <ApprovedJobEditForm
            job={editingJob}
            onCancel={() => setEditingJob(null)}
            onSuccess={(updated) => {
              onJobUpdated?.(updated)
              setEditingJob(null)
            }}
          />
        ) : null}
      </Drawer>
    </>
  )
}
