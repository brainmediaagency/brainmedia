import { PageHeader } from '@/components/ui/PageHeader'
import { ReporterJobsPanel } from '@/features/reporter/components/ReporterJobsPanel'

/** Yönetim / koordinatör üst menü — Muhabir altından ayrılmış çekim takvimi. */
export function ShootingCalendarPage() {
  return (
    <div className="space-y-3 sm:space-y-6">
      <PageHeader
        title="Çekim Takvimi"
        className="gap-2 sm:gap-4 [&_h1]:text-xl sm:[&_h1]:text-3xl"
      />
      <div className="animate-fade-in-up">
        <ReporterJobsPanel embedded />
      </div>
    </div>
  )
}
