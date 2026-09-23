import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { CategoryPanel } from '@/components/ui/CategoryPanel'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { isJobReviewerRole } from '@/config/roles'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { KameramanJobClock } from '@/features/kameraman/types/jobClock'
import {
  subscribeJobClocksForJob,
  subscribeOwnJobClockForJob,
  upsertJobClockStamp,
  type JobClockStampKind,
} from '@/features/kameraman/services/jobClockService'
import {
  formatJobClockRangeTr,
  formatJobClockStaffSummaryTr,
  isValidJobClockTime,
  normalizeJobClockTime,
} from '@/features/kameraman/utils/jobClockTimes'
import type { JobDocument } from '@/features/jobs/types/job'
import { mapAppError } from '@/lib/errors'

function canViewJobClock(role: string | undefined): boolean {
  return role === 'kameraman' || isJobReviewerRole(role)
}

export function JobClockInJobDetail({ job }: { job: JobDocument }) {
  const { user, profile, claims } = useAuth()
  const role = claims?.role ?? profile?.role
  const uid = user?.uid ?? ''
  const fullName = profile?.fullName ?? ''
  const email = profile?.email ?? user?.email ?? ''
  const isKameraman = role === 'kameraman'
  const isReviewer = isJobReviewerRole(role)

  const [ownClock, setOwnClock] = useState<KameramanJobClock | null>(null)
  const [allClocks, setAllClocks] = useState<KameramanJobClock[]>([])
  const [loading, setLoading] = useState(true)
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [savingKind, setSavingKind] = useState<JobClockStampKind | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setFormError(null)
    setOwnClock(null)
    setClockIn('')
    setClockOut('')
  }, [job.id])

  useEffect(() => {
    if (!canViewJobClock(role) || !job.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    if (isKameraman && uid) {
      return subscribeOwnJobClockForJob(
        job.id,
        uid,
        (clock) => {
          setOwnClock(clock)
          setClockIn(clock?.clockInTime ?? '')
          setClockOut(clock?.clockOutTime ?? '')
          setLoading(false)
        },
        (error) => {
          setLoading(false)
          toast.error(mapAppError(error, 'İş saati yüklenemedi.'))
        },
      )
    }

    if (isReviewer) {
      return subscribeJobClocksForJob(
        job.id,
        (items) => {
          setAllClocks(items)
          setLoading(false)
        },
        (error) => {
          setLoading(false)
          toast.error(mapAppError(error, 'İş saatleri yüklenemedi.'))
        },
      )
    }

    setLoading(false)
  }, [job.id, role, uid, isKameraman, isReviewer])

  if (!canViewJobClock(role)) return null

  async function saveKind(kind: JobClockStampKind) {
    setFormError(null)
    if (!uid || !fullName) {
      const message = 'Oturum bilgisi eksik. Tekrar giriş yapın.'
      setFormError(message)
      toast.error(message)
      return
    }

    const raw = kind === 'in' ? clockIn : clockOut
    const declared = normalizeJobClockTime(raw)
    if (!isValidJobClockTime(declared)) {
      const message =
        kind === 'in'
          ? 'Geçerli bir giriş saati girin.'
          : 'Geçerli bir çıkış saati girin.'
      setFormError(message)
      toast.error(message)
      return
    }

    setSavingKind(kind)
    try {
      await upsertJobClockStamp({
        job,
        kind,
        declaredTime: declared,
        createdByUid: uid,
        createdByNameSnapshot: fullName,
        createdByEmailSnapshot: email,
      })
      toast.success(
        kind === 'in'
          ? `Giriş kaydedildi · ${declared}`
          : `Çıkış kaydedildi · ${declared}`,
      )
    } catch (error) {
      const message = mapAppError(error, 'İş saati kaydedilemedi.')
      setFormError(message)
      toast.error(message)
    } finally {
      setSavingKind(null)
    }
  }

  const cameramanSaved = ownClock
    ? formatJobClockRangeTr(ownClock.clockInTime, ownClock.clockOutTime)
    : null

  return (
    <CategoryPanel
      title="İş girişi / çıkışı"
      description={
        isKameraman
          ? 'Giriş ve çıkış saatini kendiniz yazıp kaydedin.'
          : 'Beyan edilen saat ve kameramanın işlemi yaptığı İstanbul saati.'
      }
      icon={Clock}
      tone="blue"
      compact
    >
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : isKameraman ? (
        <div className="space-y-3">
          {cameramanSaved && cameramanSaved !== '—' ? (
            <p className="text-sm font-semibold tabular-nums text-brand-blue">
              Kayıtlı · {cameramanSaved}
            </p>
          ) : (
            <p className="text-sm text-text-secondary">
              Henüz giriş veya çıkış yok.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <FormField label="Giriş saati" htmlFor={`job-clock-in-${job.id}`}>
                <Input
                  id={`job-clock-in-${job.id}`}
                  type="time"
                  value={clockIn}
                  disabled={savingKind !== null}
                  onChange={(event) => {
                    setFormError(null)
                    setClockIn(event.target.value)
                  }}
                />
              </FormField>
              <Button
                type="button"
                className="w-full"
                loading={savingKind === 'in'}
                disabled={savingKind !== null || !clockIn}
                onClick={() => void saveKind('in')}
              >
                Giriş kaydet
              </Button>
            </div>
            <div className="space-y-2">
              <FormField label="Çıkış saati" htmlFor={`job-clock-out-${job.id}`}>
                <Input
                  id={`job-clock-out-${job.id}`}
                  type="time"
                  value={clockOut}
                  disabled={savingKind !== null}
                  onChange={(event) => {
                    setFormError(null)
                    setClockOut(event.target.value)
                  }}
                />
              </FormField>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                loading={savingKind === 'out'}
                disabled={savingKind !== null || !clockOut}
                onClick={() => void saveKind('out')}
              >
                Çıkış kaydet
              </Button>
            </div>
          </div>
          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      ) : allClocks.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Bu iş için henüz kameraman saati girilmedi.
        </p>
      ) : (
        <ul className="space-y-2">
          {allClocks.map((clock) => (
            <li
              key={clock.id}
              className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2"
            >
              <p className="text-sm font-medium text-text-primary">
                {clock.createdByNameSnapshot}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-brand-blue">
                {formatJobClockStaffSummaryTr(clock)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </CategoryPanel>
  )
}
