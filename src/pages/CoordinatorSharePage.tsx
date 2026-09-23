import { PageHeader } from '@/components/ui/PageHeader'
import { CoordinatorSharePanel } from '@/features/coordinator-share/components/CoordinatorSharePanel'

/** Yönetim / koordinatör üst menü — aylık ciro payı. */
export function CoordinatorSharePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Koordinatör" />
      <div className="animate-fade-in-up">
        <CoordinatorSharePanel />
      </div>
    </div>
  )
}
