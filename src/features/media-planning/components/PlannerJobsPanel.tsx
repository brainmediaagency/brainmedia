import { useMemo, useState } from 'react'
import type { JobDocument } from '@/features/jobs/types/job'
import type { JobStatus, UserRole } from '@/config/roles'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge, type StatusBadgeStatus } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { useClientPagination } from '@/hooks/useClientPagination'
import { cn } from '@/lib/classNames'
import { formatJobScheduleTr, normalizeJobSchedule } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { formatJobReviewer } from '@/features/jobs/utils/formatJobReviewer'
import {
  formatJobStatusNote,
  formatJobStatusNoteLabel,
  shouldHighlightJobStatusNote,
} from '@/features/jobs/utils/formatJobStatusNote'
import { JobDetailsDrawer } from '@/features/media-planning/components/JobDetailsDrawer'
import { NewJobForm } from '@/features/media-planning/components/NewJobForm'

export type PlannerJobsPanelProps = {
  pendingJobs: JobDocument[]
  approvedJobs: JobDocument[]
  loading: boolean
  canEditPending?: boolean
}

type StatusFilter =
  | 'all'
  | 'pending'
  | 'approved'
  | 'shot'
  | 'cancelled'
  | 'rejected'
type PageSize = 10 | 20 | 50

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Beklemede' },
  { id: 'approved', label: 'Konfirme' },
  { id: 'shot', label: 'Çekildi' },
  { id: 'cancelled', label: 'İptal' },
  { id: 'rejected', label: 'Reddedildi' },
]

const PAGE_SIZES: PageSize[] = [10, 20, 50]

function toBadgeStatus(status: JobStatus): StatusBadgeStatus {
  if (
    status === 'pending' ||
    status === 'approved' ||
    status === 'shot' ||
    status === 'cancelled' ||
    status === 'rejected'
  ) {
    return status
  }
  return 'pending'
}

function comparePlannedDateDesc(a: JobDocument, b: JobDocument): number {
  return normalizeJobSchedule(b.plannedExecutionDate).localeCompare(
    normalizeJobSchedule(a.plannedExecutionDate),
  )
}

function plannerJobCardRows(
  job: JobDocument,
  viewerRole: UserRole | null | undefined,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    {
      label: 'Planlanan Çekim',
      value: formatJobScheduleTr(job.plannedExecutionDate),
    },
    {
      label: 'Tutar',
      value: formatTryFromKurus(job.agreedAmountKurus),
    },
    {
      label: 'İnceleyen',
      value: formatJobReviewer(job, viewerRole),
    },
  ]
  if (shouldHighlightJobStatusNote(job.status)) {
    const note = formatJobStatusNote(job)
    if (note) {
      rows.push({
        label: formatJobStatusNoteLabel(job.status),
        value: note,
      })
    }
  }
  return rows
}

export function PlannerJobsPanel({
  pendingJobs,
  approvedJobs,
  loading,
  canEditPending = false,
}: PlannerJobsPanelProps) {
  const { profile, claims } = useAuth()
  const viewerRole = claims?.role ?? profile?.role
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pageSize, setPageSize] = useState<PageSize>(10)
  const [editingJob, setEditingJob] = useState<JobDocument | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobDocument | null>(null)

  const allJobs = useMemo(() => {
    return [...pendingJobs, ...approvedJobs].sort(comparePlannedDateDesc)
  }, [pendingJobs, approvedJobs])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: allJobs.length,
      pending: 0,
      approved: 0,
      shot: 0,
      cancelled: 0,
      rejected: 0,
    }
    for (const job of allJobs) {
      if (job.status === 'pending') counts.pending += 1
      else if (job.status === 'approved') counts.approved += 1
      else if (job.status === 'shot') counts.shot += 1
      else if (job.status === 'cancelled') counts.cancelled += 1
      else if (job.status === 'rejected') counts.rejected += 1
    }
    return counts
  }, [allJobs])

  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return allJobs
    return allJobs.filter((job) => job.status === statusFilter)
  }, [allJobs, statusFilter])

  const {
    page,
    setPage,
    totalPages,
    pageItems: pageJobs,
    rangeStart,
    rangeEnd,
    totalCount,
    showControls,
  } = useClientPagination(filteredJobs, {
    pageSize,
    resetKey: statusFilter,
  })

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Durum filtresi"
        >
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.id
            const count = statusCounts[filter.id]
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(filter.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-blue'
                    : 'border-border bg-surface text-text-secondary hover:bg-surface-muted',
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[11px]',
                    active ? 'bg-brand-blue/15 text-brand-blue' : 'bg-surface-muted text-text-secondary',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <label htmlFor="planner-jobs-page-size" className="text-sm text-text-secondary">
            Göster
          </label>
          <Select
            id="planner-jobs-page-size"
            value={String(pageSize)}
            onChange={(event) => setPageSize(Number(event.target.value) as PageSize)}
            className="!min-h-10 w-[88px]"
            aria-label="Sayfa başına iş sayısı"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState
          title="İş kaydı yok"
          description={
            statusFilter === 'all'
              ? 'Henüz gönderilmiş iş kaydı bulunmuyor.'
              : 'Bu durumda gösterilecek iş kaydı yok.'
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell header>Firma</TableCell>
                  <TableCell header>İl / İlçe</TableCell>
                  <TableCell header>Planlanan Çekim</TableCell>
                  <TableCell header>Tutar</TableCell>
                  <TableCell header>Durum</TableCell>
                  <TableCell header>İnceleyen</TableCell>
                  <TableCell header>Açıklama</TableCell>
                  {canEditPending ? <TableCell header>İşlem</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {pageJobs.map((job) => {
                  const statusNote = shouldHighlightJobStatusNote(job.status)
                    ? formatJobStatusNote(job)
                    : null
                  return (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedJob(job)}
                  >
                    <TableCell className="font-medium">{job.companyName}</TableCell>
                    <TableCell>
                      {job.province} / {job.district}
                    </TableCell>
                    <TableCell>
                      {formatJobScheduleTr(job.plannedExecutionDate)}
                    </TableCell>
                    <TableCell>{formatTryFromKurus(job.agreedAmountKurus)}</TableCell>
                    <TableCell>
                      <StatusBadge status={toBadgeStatus(job.status)} />
                    </TableCell>
                    <TableCell>
                      {formatJobReviewer(job, viewerRole)}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {statusNote ? (
                        <span
                          className="line-clamp-2 text-sm text-text-primary"
                          title={statusNote}
                        >
                          {statusNote}
                        </span>
                      ) : (
                        <span className="text-sm text-text-secondary">—</span>
                      )}
                    </TableCell>
                    {canEditPending ? (
                      <TableCell>
                        {job.status === 'pending' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              setEditingJob(job)
                            }}
                          >
                            Düzenle
                          </Button>
                        ) : (
                          <span className="text-sm text-text-secondary">—</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {pageJobs.map((job) => (
              <MobileDataCard
                key={job.id}
                title={job.companyName}
                subtitle={`${job.province} / ${job.district}`}
                badge={<StatusBadge status={toBadgeStatus(job.status)} />}
                onClick={() => setSelectedJob(job)}
                rows={plannerJobCardRows(job, viewerRole)}
                footer={
                  canEditPending && job.status === 'pending' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={(event) => {
                        event.stopPropagation()
                        setEditingJob(job)
                      }}
                    >
                      Düzenle
                    </Button>
                  ) : undefined
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
            visible={showControls || totalCount > 0}
          />
        </>
      )}

      <JobDetailsDrawer
        job={selectedJob}
        open={selectedJob !== null}
        onClose={() => setSelectedJob(null)}
        canEdit={canEditPending}
        onEdit={(job) => {
          setSelectedJob(null)
          setEditingJob(job)
        }}
      />

      <Drawer
        open={editingJob !== null}
        onClose={() => setEditingJob(null)}
        title="İş kaydını düzenle"
        description={editingJob?.companyName}
        side="right"
      >
        {editingJob ? (
          <NewJobForm job={editingJob} onSuccess={() => setEditingJob(null)} />
        ) : null}
      </Drawer>
    </>
  )
}
