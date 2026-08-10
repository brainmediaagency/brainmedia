import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { SEF_SECTIONS } from '@/config/navSections'
import { ReviewDashboard } from '@/features/jobs/components/ReviewDashboard'
import { DailyHourCalendar } from '@/features/jobs/components/DailyHourCalendar'
import { VoiceRecordingsListPanel } from '@/features/voice-recording/components/VoiceRecordingsListPanel'
import { usePageTab } from '@/hooks/usePageTab'

const TAB_IDS = SEF_SECTIONS.map((section) => section.id)
type SefTab = (typeof TAB_IDS)[number]

export function SefPage() {
  const [tab, setTab] = usePageTab(TAB_IDS, 'approvals')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Şef"
        subtitle="İş konfirmeleri (saat vererek onay / red), çekim takvimi ve ses kaydı."
      />

      <TabNav
        className="lg:hidden"
        items={[...SEF_SECTIONS]}
        activeId={tab}
        onChange={(id) => setTab(id as SefTab)}
        aria-label="Şef bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {tab === 'approvals' && <ReviewDashboard roleLabel="Şef" />}
        {tab === 'schedule' && <DailyHourCalendar sectionNumber="01" />}
        {tab === 'voice' && <VoiceRecordingsListPanel sectionNumber="01" />}
      </div>
    </div>
  )
}
