import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { COORDINATOR_SECTIONS } from '@/config/navSections'
import { DailyHourCalendar } from '@/features/jobs/components/DailyHourCalendar'
import { ManagementCashTab } from '@/features/cash/components/ManagementCashTab'
import { MonthlyStatsPanel } from '@/features/stats/components/MonthlyStatsPanel'
import { VoiceRecordingsListPanel } from '@/features/voice-recording/components/VoiceRecordingsListPanel'
import { usePageTab } from '@/hooks/usePageTab'

const TAB_IDS = COORDINATOR_SECTIONS.map((section) => section.id)
type CoordinatorTab = (typeof TAB_IDS)[number]

export function CoordinatorPage() {
  const [tab, setTab] = usePageTab(TAB_IDS, 'schedule')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Koordinatör"
      />

      <TabNav
        className="lg:hidden"
        items={[...COORDINATOR_SECTIONS]}
        activeId={tab}
        onChange={(id) => setTab(id as CoordinatorTab)}
        aria-label="Koordinatör bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {tab === 'schedule' && <DailyHourCalendar />}
        {tab === 'voice' && <VoiceRecordingsListPanel />}
        {tab === 'cash' && <ManagementCashTab />}
        {tab === 'stats' && <MonthlyStatsPanel />}
      </div>
    </div>
  )
}
