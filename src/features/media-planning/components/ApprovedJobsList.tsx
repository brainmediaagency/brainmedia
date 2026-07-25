import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { JobDocument } from '@/features/jobs/types/job'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge, type StatusBadgeStatus } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { formatJobScheduleTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { JobDetailsDrawer } from '@/features/media-planning/components/JobDetailsDrawer'

export type ApprovedJobsListProps = {
  jobs: JobDocument[]
  loading: boolean
  /** Show inline search toolbar (viewer dashboard). */
  searchable?: boolean
}

function toBadgeStatus(status: JobDocument['status']): StatusBadgeStatus {
  if (status === 'approved' || status === 'shot' || status === 'cancelled') {
    return status
  }
  return 'approved'
}

export function ApprovedJobsList({
  jobs,
  loading,
  searchable = false,
}: ApprovedJobsListProps) {
  const [selectedJob, setSelectedJob] = useState<JobDocument | null>(null)
  const [query, setQuery] = useState('')

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return jobs
    return jobs.filter((job) => {
      const haystack = [
        job.companyName,
        job.province,
        job.district,
        job.reviewedByNameSnapshot ?? '',
        job.status,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [jobs, query])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="Konfirme iş yok"
        description="Konfirme, çekilmiş veya iptal edilmiş iş kaydı bulunmuyor."
      />
    )
  }

  return (
    <>
      {searchable ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Firma, konum veya durum ara…"
              className="pl-10"
              aria-label="Konfirme işlerde ara"
            />
          </div>
          <p className="text-sm text-text-secondary">
            {filteredJobs.length} / {jobs.length} kayıt
          </p>
        </div>
      ) : null}

      {filteredJobs.length === 0 ? (
        <EmptyState
          title="Sonuç bulunamadı"
          description="Aramanızla eşleşen konfirme iş yok."
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
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedJob(job)}
                  >
                    <TableCell className="font-medium">{job.companyName}</TableCell>
                    <TableCell>
                      {job.province} / {job.district}
                    </TableCell>
                    <TableCell>{formatJobScheduleTr(job.plannedExecutionDate)}</TableCell>
                    <TableCell>{formatTryFromKurus(job.agreedAmountKurus)}</TableCell>
                    <TableCell>
                      <StatusBadge status={toBadgeStatus(job.status)} />
                    </TableCell>
                    <TableCell>{job.reviewedByNameSnapshot ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredJobs.map((job) => (
              <MobileDataCard
                key={job.id}
                title={job.companyName}
                subtitle={`${job.province} / ${job.district}`}
                badge={<StatusBadge status={toBadgeStatus(job.status)} />}
                onClick={() => setSelectedJob(job)}
                rows={[
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
                    value: job.reviewedByNameSnapshot ?? '—',
                  },
                ]}
              />
            ))}
          </div>
        </>
      )}

      <JobDetailsDrawer
        job={selectedJob}
        open={selectedJob !== null}
        onClose={() => setSelectedJob(null)}
      />
    </>
  )
}
