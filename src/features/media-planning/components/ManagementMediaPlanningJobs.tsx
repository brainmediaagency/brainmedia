import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DateInput } from '@/components/ui/DateInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { Skeleton } from '@/components/ui/Skeleton'
import { MediaPlannerSelector } from '@/features/media-planning/components/MediaPlannerSelector'
import { PlannerJobsPanel } from '@/features/media-planning/components/PlannerJobsPanel'
import { useMediaPlannerSelection } from '@/features/media-planning/hooks/useMediaPlannerSelection'
import { fetchPlannerJobsInRange } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import { mapAppError } from '@/lib/errors'

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function useDefaultRange() {
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(
    () => new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    [defaultEnd],
  )
  return {
    start: toDateInputValue(defaultStart),
    end: toDateInputValue(defaultEnd),
  }
}

export function ManagementMediaPlanningJobs() {
  const defaults = useDefaultRange()
  const {
    planners,
    loading: plannersLoading,
    selectedUid,
    setSelectedUid,
    selectedPlanner,
  } = useMediaPlannerSelection()

  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [jobs, setJobs] = useState<JobDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const viewedName = selectedPlanner?.fullName ?? 'Seçili planlamacı'

  const loadJobs = useCallback(async () => {
    if (!selectedUid) return
    if (!startDate || !endDate || startDate > endDate) {
      toast.error('Geçerli bir tarih aralığı seçin.')
      return
    }

    setLoading(true)
    try {
      setJobs(
        await fetchPlannerJobsInRange({
          ownerUid: selectedUid,
          startDate,
          endDate,
        }),
      )
      setHasLoaded(true)
    } catch (error) {
      toast.error(mapAppError(error, 'Medya planlama işleri yüklenemedi.'))
    } finally {
      setLoading(false)
    }
  }, [selectedUid, startDate, endDate])

  useEffect(() => {
    setJobs([])
    setHasLoaded(false)
    if (!selectedUid) return
    void loadJobs()
  }, [selectedUid, loadJobs])

  const pendingJobs = useMemo(
    () => jobs.filter((job) => job.status === 'pending'),
    [jobs],
  )
  const approvedJobs = useMemo(
    () =>
      jobs.filter((job) =>
        ['approved', 'shot', 'cancelled', 'rejected'].includes(job.status),
      ),
    [jobs],
  )

  return (
    <div className="space-y-6">
      <Card className="!p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
              Personel görünümü
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
              Medya planlamacı seçimi
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Tarih aralığında oluşturduğu iş kayıtlarını görmek için bir kişi seçin.
            </p>
          </div>
          <MediaPlannerSelector
            planners={planners}
            loading={plannersLoading}
            selectedUid={selectedUid}
            onSelect={setSelectedUid}
          />
        </div>
      </Card>

      {!selectedUid ? (
        <EmptyState
          icon={Users}
          title="Planlamacı seçilmedi"
          description="Yukarıdaki menüden bir medya planlamacı seçtiğinizde iş kayıtları burada görünür."
        />
      ) : (
        <Card className="!p-5">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              İş kayıtları
            </h2>
            <p className="text-sm text-text-secondary">
              {viewedName} · kayıt tarihine göre aralık (en fazla 100)
            </p>
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <FormField label="Başlangıç" htmlFor="mp-jobs-start">
              <DateInput
                id="mp-jobs-start"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField label="Bitiş" htmlFor="mp-jobs-end">
              <DateInput
                id="mp-jobs-end"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </FormField>
            <Button type="button" onClick={() => void loadJobs()} loading={loading}>
              Filtrele
            </Button>
          </div>

          {loading && !hasLoaded ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <PlannerJobsPanel
              pendingJobs={pendingJobs}
              approvedJobs={approvedJobs}
              loading={loading}
              canEditPending={false}
            />
          )}
        </Card>
      )}
    </div>
  )
}
