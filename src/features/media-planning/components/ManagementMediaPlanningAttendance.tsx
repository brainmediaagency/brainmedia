import { Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AttendanceHistory } from '@/features/media-planning/components/AttendanceHistory'
import { MediaPlannerSelector } from '@/features/media-planning/components/MediaPlannerSelector'
import { useMediaPlannerSelection } from '@/features/media-planning/hooks/useMediaPlannerSelection'

export function ManagementMediaPlanningAttendance() {
  const {
    planners,
    loading: plannersLoading,
    selectedUid,
    setSelectedUid,
    selectedPlanner,
  } = useMediaPlannerSelection()

  const viewedName = selectedPlanner?.fullName ?? 'Seçili planlamacı'

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
              Mesai geçmişini görmek için bir kişi seçin.
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
          description="Yukarıdaki menüden bir medya planlamacı seçtiğinizde mesai kaydı burada görünür."
        />
      ) : plannersLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card className="!p-5 animate-fade-in-up">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              Mesai kaydı
            </h2>
            <p className="text-sm text-text-secondary">
              {viewedName} · tamamlanmış mesai geçmişi
            </p>
          </div>
          <AttendanceHistory
            uid={selectedUid}
            userName={viewedName}
            showSummary
          />
        </Card>
      )}
    </div>
  )
}
