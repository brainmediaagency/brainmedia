import { Star, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { MediaPlannerSelector } from '@/features/media-planning/components/MediaPlannerSelector'
import { PlannerScoreOverview } from '@/features/media-planning/components/PlannerScoreOverview'
import { useMediaPlannerSelection } from '@/features/media-planning/hooks/useMediaPlannerSelection'

export function ManagementMediaPlanningScore() {
  const {
    planners,
    loading: plannersLoading,
    selectedUid,
    setSelectedUid,
    selectedPlanner,
  } = useMediaPlannerSelection()

  const viewedName = selectedPlanner?.fullName ?? 'Seçili planlamacı'
  const initials = viewedName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '')
    .join('')

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
              MPU Tablosu özetini görmek için bir kişi seçin.
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
          description="Yukarıdaki menüden bir medya planlamacı seçtiğinizde MPU Tablosu burada görünür."
        />
      ) : plannersLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-44 w-full" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ) : (
        <section className="space-y-4 animate-fade-in-up">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[image:var(--gradient-primary)] font-display text-sm font-semibold text-white shadow-[var(--shadow-sm)]"
              >
                {initials || <Star className="size-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-text-primary">
                    MPU Tablosu
                  </h2>
                  <span className="rounded-full border border-brand-blue/20 bg-brand-blue/8 px-2.5 py-0.5 text-[11px] font-semibold text-brand-blue">
                    Özet
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-text-secondary">
                  {viewedName}
                  <span className="text-text-secondary/70">
                    {' '}
                    · alınan, çekilen ve iptal edilen iş özeti
                  </span>
                </p>
              </div>
            </div>
          </div>

          <PlannerScoreOverview uid={selectedUid} />
        </section>
      )}
    </div>
  )
}
