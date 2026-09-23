import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { MANAGEMENT_SECTIONS } from '@/config/navSections'
import { AccountAdminDashboard } from '@/features/account-admin/components/AccountAdminDashboard'
import { ManagementCashTab } from '@/features/cash/components/ManagementCashTab'
import { MonthlyStatsPanel } from '@/features/stats/components/MonthlyStatsPanel'
import { StorageUsageCard } from '@/features/system/components/StorageUsageCard'
import { VoiceRecordingsListPanel } from '@/features/voice-recording/components/VoiceRecordingsListPanel'
import { ActivityLogsPanel } from '@/features/activity-log/components/ActivityLogsPanel'
import { usePageTab } from '@/hooks/usePageTab'

const TAB_IDS = MANAGEMENT_SECTIONS.map((section) => section.id)
type ManagementTab = (typeof TAB_IDS)[number]

export function ManagementPage() {
  const [tab, setTab] = usePageTab(TAB_IDS, 'voice')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yönetim"
      />

      <TabNav
        className="lg:hidden"
        items={[...MANAGEMENT_SECTIONS]}
        activeId={tab}
        onChange={(id) => setTab(id as ManagementTab)}
        aria-label="Yönetim bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {tab === 'voice' && (
          <div className="space-y-6">
            <StorageUsageCard className="max-w-md" />
            <VoiceRecordingsListPanel />
          </div>
        )}
        {tab === 'cash' && <ManagementCashTab />}
        {tab === 'stats' && <MonthlyStatsPanel />}
        {tab === 'accounts' && <AccountAdminDashboard />}
        {tab === 'activity' && <ActivityLogsPanel />}
      </div>
    </div>
  )
}
