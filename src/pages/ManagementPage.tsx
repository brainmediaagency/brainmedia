import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { MANAGEMENT_SECTIONS } from '@/config/navSections'
import { ReviewDashboard } from '@/features/jobs/components/ReviewDashboard'
import { DailyHourCalendar } from '@/features/jobs/components/DailyHourCalendar'
import { AccountAdminDashboard } from '@/features/account-admin/components/AccountAdminDashboard'
import { CashRegisterPanel } from '@/features/cash/components/CashRegisterPanel'
import { MonthlyStatsPanel } from '@/features/stats/components/MonthlyStatsPanel'
import { SheetsExcelPanel } from '@/features/sheets/components/SheetsExcelPanel'
import { StorageUsageCard } from '@/features/system/components/StorageUsageCard'
import { VoiceRecordingsListPanel } from '@/features/voice-recording/components/VoiceRecordingsListPanel'
import { RegionPlannerPanel } from '@/features/media-planning/components/RegionPlannerPanel'
import { FieldOpsPanel } from '@/features/kameraman/components/FieldOpsPanel'
import { usePageTab } from '@/hooks/usePageTab'

const TAB_IDS = MANAGEMENT_SECTIONS.map((section) => section.id)
type ManagementTab = (typeof TAB_IDS)[number]

export function ManagementPage() {
  const [tab, setTab] = usePageTab(TAB_IDS, 'approvals')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yönetim"
        subtitle="İş konfirmeleri, günlük takvim, bölge seçimi, ses kayıtları, kasa, aylık özet, Excel ve hesap yönetimi."
      />

      <TabNav
        className="lg:hidden"
        items={[...MANAGEMENT_SECTIONS]}
        activeId={tab}
        onChange={(id) => setTab(id as ManagementTab)}
        aria-label="Yönetim bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {tab === 'approvals' && <ReviewDashboard roleLabel="Yönetim" />}
        {tab === 'schedule' && <DailyHourCalendar sectionNumber="01" />}
        {tab === 'regions' && <RegionPlannerPanel />}
        {tab === 'voice' && (
          <div className="space-y-6">
            <StorageUsageCard className="max-w-md" />
            <VoiceRecordingsListPanel sectionNumber="01" />
          </div>
        )}
        {tab === 'cash' && <CashRegisterPanel sectionNumber={1} />}
        {tab === 'field-ops' && <FieldOpsPanel />}
        {tab === 'stats' && <MonthlyStatsPanel sectionNumber="01" />}
        {tab === 'excel' && <SheetsExcelPanel />}
        {tab === 'accounts' && <AccountAdminDashboard startNumber={1} />}
      </div>
    </div>
  )
}
