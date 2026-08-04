import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  forwardJobToReporter,
  getJob,
} from '@/features/jobs/services/jobService'
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
import { mapAppError } from '@/lib/errors'

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
                  {job.province} / {job.district}
                </TableCell>
                <TableCell>{formatJobScheduleTr(job.plannedExecutionDate)}</TableCell>
                <TableCell>{formatTryFromKurus(job.agreedAmountKurus)}</TableCell>
                <TableCell>
                  {job.createdAt ? formatDateTimeTr(job.createdAt.toDate()) : '—'}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    İncele
                  </Button>
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
            badge={<StatusBadge status="pending" label="Konfirme bekliyor" />}
            rows={[
              {
                label: 'İl / İlçe',
                value: `${job.province} / ${job.district}`,
              },
              {
                label: 'Planlanan Çekim',
                value: formatJobScheduleTr(job.plannedExecutionDate),
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
}: ReviewedJobsQueueProps) {
  const { profile, claims, isOnline } = useAuth()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [editingJob, setEditingJob] = useState<JobDocument | null>(null)
  const [forwardingId, setForwardingId] = useState<string | null>(null)
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

  const actorRole = claims?.role ?? profile?.role
  const canManageApproved =
    actorRole === 'management' || actorRole === 'coordinator'

  async function handleForward(job: JobDocument) {
    if (!profile || !actorRole || !canManageApproved) return
    setForwardingId(job.id)
    try {
      const updated = await forwardJobToReporter(job.id, {
        uid: profile.uid,
        fullName: profile.fullName,
        role: actorRole,
      })
      onJobUpdated?.(updated)
      toast.success('İş muhabir çekim takvimine iletildi.')
      // Muhabire ilet Excel SON DURUM yazmaz (yalnızca Konfirme/Reddedildi/Çekildi/İptal).
    } catch (error) {
      // Recover stale list if Firestore already forwarded but UI had not refreshed.
      const fresh = await getJob(job.id).catch(() => null)
      if (fresh?.forwardedToReporter) {
        onJobUpdated?.(fresh)
        toast.success('İş muhabir çekim takvimine iletildi.')
      } else {
        toast.error(mapAppError(error, 'İş muhabire iletilemedi.'))
      }
    } finally {
      setForwardingId(null)
    }
  }

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
              <TableCell header>Muhabir iletimi</TableCell>
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
                <TableCell>
                  {job.forwardedToReporter ? (
                    <span className="text-success">
                      {job.forwardedToReporterByUid === 'system-auto-forward'
                        ? 'İletildi (otomatik)'
                        : 'İletildi'}
                    </span>
                  ) : (
                    <span className="text-text-secondary">İletilmedi</span>
                  )}
                </TableCell>
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
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!isOnline || forwardingId !== null}
                          onClick={() => setEditingJob(job)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          Düzenle
                        </Button>
                        {job.forwardedToReporter ? (
                          <Button type="button" size="sm" variant="ghost" disabled>
                            İletildi
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleForward(job)}
                            loading={forwardingId === job.id}
                            disabled={!isOnline || forwardingId !== null}
                          >
                            Muhabire ilet
                          </Button>
                        )}
                      </>
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
              {
                label: 'Muhabir iletimi',
                value: job.forwardedToReporter
                  ? job.forwardedToReporterByUid === 'system-auto-forward'
                    ? 'İletildi (otomatik)'
                    : 'İletildi'
                  : 'İletilmedi',
              },
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
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={!isOnline || forwardingId !== null}
                      onClick={() => setEditingJob(job)}
                    >
                      Düzenle
                    </Button>
                    {job.forwardedToReporter ? (
                      <Button type="button" size="sm" variant="ghost" className="w-full" disabled>
                        İletildi
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        onClick={() => void handleForward(job)}
                        loading={forwardingId === job.id}
                        disabled={!isOnline || forwardingId !== null}
                      >
                        Muhabire ilet
                      </Button>
                    )}
                  </>
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
