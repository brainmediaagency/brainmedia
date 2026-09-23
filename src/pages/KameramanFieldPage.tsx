import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { KAMERAMAN_FIELD_SECTIONS } from '@/config/navSections'
import { FieldOpsSummaryPanel } from '@/features/field-ops/components/FieldOpsSummaryPanel'
import { usePageTab } from '@/hooks/usePageTab'

const TAB_IDS = KAMERAMAN_FIELD_SECTIONS.map((section) => section.id)
type KameramanFieldTab = (typeof TAB_IDS)[number]

/**
 * Yönetim / koordinatör: solda “Kameraman” altında saha km & kadran panelleri.
 * İş giriş/çıkış saatleri çekim takvimi iş detayında.
 */
export function KameramanFieldPage() {
  const [tab, setTab] = usePageTab(TAB_IDS, 'field-ops')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kameraman"
      />

      <TabNav
        className="lg:hidden"
        items={[...KAMERAMAN_FIELD_SECTIONS]}
        activeId={tab}
        onChange={(id) => setTab(id as KameramanFieldTab)}
        aria-label="Kameraman saha bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {tab === 'field-ops' && <FieldOpsSummaryPanel />}
      </div>
    </div>
  )
}
