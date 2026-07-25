import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { COORDINATOR_SECTIONS } from '@/config/navSections'
import { ReviewDashboard } from '@/features/jobs/components/ReviewDashboard'
import { DailyHourCalendar } from '@/features/jobs/components/DailyHourCalendar'
import { CashRegisterPanel } from '@/features/cash/components/CashRegisterPanel'
import { MonthlyStatsPanel } from '@/features/stats/components/MonthlyStatsPanel'
import { SheetsExcelPanel } from '@/features/sheets/components/SheetsExcelPanel'
import { VoiceRecordingsListPanel } from '@/features/voice-recording/components/VoiceRecordingsListPanel'
import { RegionPlannerPanel } from '@/features/media-planning/components/RegionPlannerPanel'
import { usePageTab } from '@/hooks/usePageTab'

const TAB_IDS = COORDINATOR_SECTIONS.map((section) => section.id)
type CoordinatorTab = (typeof TAB_IDS)[number]

export function CoordinatorPage() {
  const [tab, setTab] = usePageTab(TAB_IDS, 'approvals')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Koordinatör"
        subtitle="İş konfirmeleri, günlük takvim, bölge seçimi, ses kayıtları, kasa, aylık özet ve Excel."
      />

      <TabNav
        className="lg:hidden"
        items={[...COORDINATOR_SECTIONS]}
        activeId={tab}
        onChange={(id) => setTab(id as CoordinatorTab)}
        aria-label="Koordinatör bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {tab === 'approvals' && <ReviewDashboard roleLabel="Koordinatör" />}
        {tab === 'schedule' && <DailyHourCalendar sectionNumber="01" />}
        {tab === 'regions' && <RegionPlannerPanel />}
        {tab === 'voice' && <VoiceRecordingsListPanel sectionNumber="01" />}
        {tab === 'cash' && <CashRegisterPanel sectionNumber={1} />}
        {tab === 'stats' && <MonthlyStatsPanel sectionNumber="01" />}
        {tab === 'excel' && <SheetsExcelPanel />}
      </div>
    </div>
  )
}
