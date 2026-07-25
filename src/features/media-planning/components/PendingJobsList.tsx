import { useState } from 'react'
import type { JobDocument } from '@/features/jobs/types/job'
import { EmptyState } from '@/components/ui/EmptyState'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { formatJobScheduleTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { NewJobForm } from '@/features/media-planning/components/NewJobForm'

export type PendingJobsListProps = {
  jobs: JobDocument[]
  loading: boolean
  canEdit?: boolean
}

export function PendingJobsList({
  jobs,
  loading,
  canEdit = false,
}: PendingJobsListProps) {
  const [editingJob, setEditingJob] = useState<JobDocument | null>(null)

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
        title="Konfirme bekleyen iş yok"
        description="Henüz konfirmeye gönderilmiş bekleyen iş kaydı bulunmuyor."
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
              <TableCell header>İl / İlçe</TableCell>
              <TableCell header>Planlanan Çekim</TableCell>
              <TableCell header>Tutar</TableCell>
              <TableCell header>Durum</TableCell>
              {canEdit && <TableCell header>İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.companyName}</TableCell>
                <TableCell>
                  {job.province} / {job.district}
                </TableCell>
                <TableCell>{formatJobScheduleTr(job.plannedExecutionDate)}</TableCell>
                <TableCell>{formatTryFromKurus(job.agreedAmountKurus)}</TableCell>
                <TableCell>
                  <StatusBadge status="pending" />
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingJob(job)}
                    >
                      Düzenle
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {jobs.map((job) => (
          <MobileDataCard
            key={job.id}
            title={job.companyName}
            subtitle={`${job.province} / ${job.district}`}
            badge={<StatusBadge status="pending" />}
            rows={[
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
              canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setEditingJob(job)}
                >
                  Düzenle
                </Button>
              ) : undefined
            }
          />
        ))}
      </div>

      <Drawer
        open={editingJob !== null}
        onClose={() => setEditingJob(null)}
        title="İş kaydını düzenle"
        description={editingJob?.companyName}
        side="right"
      >
        {editingJob && (
          <NewJobForm
            job={editingJob}
            onSuccess={() => setEditingJob(null)}
          />
        )}
      </Drawer>
    </>
  )
}
