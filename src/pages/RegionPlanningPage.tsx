import { PageHeader } from '@/components/ui/PageHeader'
import { RegionPlannerPanel } from '@/features/media-planning/components/RegionPlannerPanel'

/** Yönetim / koordinatör üst menü — bölge seçimi. */
export function RegionPlanningPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bölge Seçimi"
      />
      <div className="animate-fade-in-up">
        <RegionPlannerPanel />
      </div>
    </div>
  )
}
