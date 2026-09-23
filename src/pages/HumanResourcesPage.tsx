import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { SHOW_MESAI_UI } from '@/config/featureFlags'
import {
  HR_OWN_SECTIONS,
  HR_VIEWER_PAGE_TABS,
  visibleNavSections,
} from '@/config/navSections'
import { AccountAdminDashboard } from '@/features/account-admin/components/AccountAdminDashboard'
import { AttendanceLogsDashboard } from '@/features/attendance/components/AttendanceLogsDashboard'
import { ShiftTrackerWidget } from '@/features/media-planning/components/ShiftTrackerWidget'
import { HrJobStatsPanel } from '@/features/hr/components/HrJobStatsPanel'
import { HrReportsPanel } from '@/features/hr/components/HrReportsPanel'
import { HiringNotesPanel } from '@/features/hr/components/HiringNotesPanel'
import { ManagementHrInbox } from '@/features/hr/components/ManagementHrInbox'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { usePageTab } from '@/hooks/usePageTab'

const VIEWER_TAB_IDS = HR_VIEWER_PAGE_TABS.map((section) => section.id)
type HrViewerTab = (typeof HR_VIEWER_PAGE_TABS)[number]['id']

function HrViewerPage() {
  const [tab, setTab] = usePageTab(VIEWER_TAB_IDS, 'reports')

  return (
    <div className="space-y-6">
      <PageHeader
        title="İnsan Kaynakları"
      />

      <TabNav
        items={[...HR_VIEWER_PAGE_TABS]}
        activeId={tab}
        onChange={(id) => setTab(id as HrViewerTab)}
        aria-label="İK bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {tab === 'reports' ? <ManagementHrInbox mode="reports" /> : null}
        {tab === 'interviews' ? <ManagementHrInbox mode="interviews" /> : null}
      </div>
    </div>
  )
}

const OWN_SECTIONS = visibleNavSections(HR_OWN_SECTIONS)
const HR_OWN_TAB_IDS = OWN_SECTIONS.map((section) => section.id)
type HrOwnTab = (typeof HR_OWN_SECTIONS)[number]['id']
const HR_OWN_DEFAULT_TAB: HrOwnTab = SHOW_MESAI_UI ? 'attendance' : 'jobs'

export function HumanResourcesPage() {
  const { user, profile } = useAuth()
  const isHr = profile?.role === 'human_resources'
  const [tab, setTab] = usePageTab(HR_OWN_TAB_IDS, HR_OWN_DEFAULT_TAB)

  if (!isHr) {
    return <HrViewerPage />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="İnsan Kaynakları"
        action={
          SHOW_MESAI_UI && user?.uid ? (
            <ShiftTrackerWidget uid={user.uid} />
          ) : undefined
        }
      />

      <TabNav
        className="lg:hidden"
        items={[...OWN_SECTIONS]}
        activeId={tab}
        onChange={(id) => setTab(id as HrOwnTab)}
        aria-label="İnsan kaynakları bölümleri"
      />

      <div key={tab} className="animate-fade-in-up space-y-8">
        {SHOW_MESAI_UI && tab === 'attendance' && (
          <AttendanceLogsDashboard />
        )}
        {tab === 'jobs' && <HrJobStatsPanel defaultOpen />}
        {tab === 'reports' && <HrReportsPanel defaultOpen />}
        {tab === 'hiring' && <HiringNotesPanel defaultOpen />}
        {tab === 'accounts' && <AccountAdminDashboard />}
      </div>
    </div>
  )
}
