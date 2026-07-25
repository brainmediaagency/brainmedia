import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { JobDocument } from '@/features/jobs/types/job'
import { cancelJob, markJobAsShot } from '@/features/jobs/services/jobService'
import {
  exportJobReviewToSheet,
  SHEET_SON_DURUM,
  updateJobSonDurumInSheet,
} from '@/features/jobs/services/sheetsExport'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { Modal } from '@/components/ui/Modal'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { Textarea } from '@/components/ui/Textarea'
import { useClientPagination } from '@/hooks/useClientPagination'
import { formatJobScheduleTr, isJobSchedulePast } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'

export type OverdueJobsConfirmationPanelProps = {
  jobs: JobDocument[]
  loading: boolean
  /**
   * `actions` — coordinator/management can mark shot/cancelled.
   * `readonly` — media planner status view only.
   */
  mode?: 'actions' | 'readonly'
  /** Keep parent queues in sync after shot / cancel. */
  onJobUpdated?: (job: JobDocument) => void
}

export function OverdueJobsConfirmationPanel({
  jobs,
  loading,
  mode = 'actions',
  onJobUpdated,
}: OverdueJobsConfirmationPanelProps) {
  const { profile, claims, isOnline } = useAuth()
  const [now, setNow] = useState(() => new Date())
  const [confirming, setConfirming] = useState<JobDocument | null>(null)
  const [cancelling, setCancelling] = useState<JobDocument | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canAct = mode === 'actions'
  const role = claims?.role ?? profile?.role
  const actor =
    canAct &&
    profile &&
    (role === 'coordinator' || role === 'management')
      ? {
          uid: profile.uid,
          fullName: profile.fullName,
          role: role as 'coordinator' | 'management',
        }
      : null

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const listedJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (!isJobSchedulePast(job.plannedExecutionDate, now)) return false
        if (canAct) return job.status === 'approved'
        return job.status === 'approved' || job.status === 'shot' || job.status === 'cancelled'
      })
      .sort((a, b) => {
        // Yönetim / koordinatör: en yeni eklenen üstte
        if (canAct) {
          const aMs = a.createdAt?.toMillis?.() ?? 0
          const bMs = b.createdAt?.toMillis?.() ?? 0
          if (bMs !== aMs) return bMs - aMs
          return b.plannedExecutionDate.localeCompare(a.plannedExecutionDate)
        }
        return a.plannedExecutionDate.localeCompare(b.plannedExecutionDate)
      })
  }, [jobs, now, canAct])

  const {
    page,
    setPage,
    totalPages,
    pageItems: pageJobs,
    rangeStart,
    rangeEnd,
    totalCount,
    showControls,
  } = useClientPagination(listedJobs, { resetKey: `${canAct}-${mode}` })

  const handleConfirmShot = async () => {
    if (!confirming || !actor || !isOnline) return
    setSubmitting(true)
    try {
      const updated = await markJobAsShot(confirming.id, actor)
      onJobUpdated?.(updated)
      toast.success('İş çekildi olarak işaretlendi.')
      void updateJobSonDurumInSheet(confirming, SHEET_SON_DURUM.shot).catch((error) => {
        toast.warning(
          mapAppError(
            error,
            'Firestore kaydı tamam. Excel (Sheets) durumu güncellenemedi — Excel sekmesinden kontrol edin veya işlemi tekrar deneyin.',
          ),
        )
      })
      setConfirming(null)
    } catch (error) {
      toast.error(mapAppError(error, 'İş çekildi olarak işaretlenemedi.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelling || !actor || !isOnline) return
    const reason = cancelReason.trim()
    if (reason.length < 3) {
      toast.error('İptal için en az 3 karakterlik bir neden girin.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await cancelJob(cancelling.id, actor, reason)
      onJobUpdated?.(updated)
      toast.success('İş iptal edildi.')
      void exportJobReviewToSheet(cancelling, 'cancelled', {
        reviewedByName: actor.fullName,
        reviewNote: reason,
      }).catch((error) => {
        toast.warning(
          mapAppError(
            error,
            'Firestore kaydı tamam. Excel (Sheets) yazılamadı — Excel sekmesinden kontrol edin veya işlemi tekrar deneyin.',
          ),
        )
      })
      setCancelling(null)
      setCancelReason('')
    } catch (error) {
      toast.error(mapAppError(error, 'İş iptal edilemedi.'))
    } finally {
      setSubmitting(false)
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

  if (listedJobs.length === 0) {
    return (
      <EmptyState
        title={canAct ? 'Sonuçlandırılacak iş yok' : 'Çekim durumu kaydı yok'}
        description={
          canAct
            ? 'Planlanan tarih ve saati geçmiş, konfirme iş kaydı bulunmuyor.'
            : 'Planlanan çekim zamanı geçmiş iş kaydı bulunmuyor.'
        }
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
              <TableCell header>Planlayan</TableCell>
              <TableCell header>Tutar</TableCell>
              <TableCell header>Durum</TableCell>
              {canAct ? <TableCell header>İşlem</TableCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageJobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.companyName}</TableCell>
                <TableCell>
                  {job.province} / {job.district}
                </TableCell>
                <TableCell>{formatJobScheduleTr(job.plannedExecutionDate)}</TableCell>
                <TableCell>{job.createdByNameSnapshot}</TableCell>
                <TableCell>{formatTryFromKurus(job.agreedAmountKurus)}</TableCell>
                <TableCell>
                  <StatusBadge status={job.status} />
                </TableCell>
                {canAct ? (
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!isOnline || submitting || !actor}
                        onClick={() => setConfirming(job)}
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        Çekildi
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!isOnline || submitting || !actor}
                        onClick={() => {
                          setCancelReason('')
                          setCancelling(job)
                        }}
                      >
                        <XCircle className="size-4" aria-hidden="true" />
                        İptal
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {pageJobs.map((job) => (
          <MobileDataCard
            key={job.id}
            title={job.companyName}
            subtitle={`${job.province} / ${job.district}`}
            badge={<StatusBadge status={job.status} />}
            rows={[
              {
                label: 'Planlanan Çekim',
                value: formatJobScheduleTr(job.plannedExecutionDate),
              },
              {
                label: 'Planlayan',
                value: job.createdByNameSnapshot,
              },
              {
                label: 'Tutar',
                value: formatTryFromKurus(job.agreedAmountKurus),
              },
            ]}
            footer={
              canAct ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={!isOnline || submitting || !actor}
                    onClick={() => setConfirming(job)}
                  >
                    Çekildi olarak işaretle
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    disabled={!isOnline || submitting || !actor}
                    onClick={() => {
                      setCancelReason('')
                      setCancelling(job)
                    }}
                  >
                    İptal et
                  </Button>
                </div>
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
        visible={showControls}
      />

      {canAct ? (
        <>
          <ConfirmDialog
            open={confirming !== null}
            onClose={() => {
              if (!submitting) setConfirming(null)
            }}
            title="Çekildi olarak işaretle"
            description={
              confirming
                ? `"${confirming.companyName}" işi Çekildi olarak işaretlensin mi? Bu adım zorunlu manuel onaydır; zamanı gelince otomatik yapılmaz.`
                : ''
            }
            confirmLabel="Evet, çekildi"
            loading={submitting}
            onConfirm={() => void handleConfirmShot()}
          />

          <Modal
            open={cancelling !== null}
            onClose={() => {
              if (!submitting) {
                setCancelling(null)
                setCancelReason('')
              }
            }}
            title="İşi iptal et"
            description={
              cancelling
                ? `"${cancelling.companyName}" işi iptal edilecek. Denetim kaydı için iptal nedeni zorunludur (en az 3 karakter).`
                : undefined
            }
          >
            <div className="space-y-4">
              <FormField
                label="İptal nedeni"
                htmlFor="overdue-cancel-reason"
                required
              >
                <Textarea
                  id="overdue-cancel-reason"
                  rows={3}
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  disabled={submitting}
                  placeholder="En az 3 karakter"
                />
              </FormField>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => {
                    setCancelling(null)
                    setCancelReason('')
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  loading={submitting}
                  disabled={!isOnline || cancelReason.trim().length < 3}
                  onClick={() => void handleCancel()}
                >
                  İptal et
                </Button>
              </div>
            </div>
          </Modal>
        </>
      ) : null}
    </>
  )
}
