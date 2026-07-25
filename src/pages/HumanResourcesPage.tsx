import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { SHOW_MESAI_UI } from '@/config/featureFlags'
import {
  HR_OWN_SECTIONS,
  HR_VIEWER_SECTIONS,
  visibleNavSections,
} from '@/config/navSections'
import { AccountAdminDashboard } from '@/features/account-admin/components/AccountAdminDashboard'
import { AttendanceLogsDashboard } from '@/features/attendance/components/AttendanceLogsDashboard'
import { ShiftTrackerWidget } from '@/features/media-planning/components/ShiftTrackerWidget'
import { HrJobStatsPanel } from '@/features/hr/components/HrJobStatsPanel'
import { HrReportsPanel } from '@/features/hr/components/HrReportsPanel'
import { HiringNotesPanel } from '@/features/hr/components/HiringNotesPanel'
import { HrStaffAttendanceViewer } from '@/features/hr/components/HrStaffAttendanceViewer'
import { ManagementHrInbox } from '@/features/hr/components/ManagementHrInbox'
import { ReporterJobsPanel } from '@/features/reporter/components/ReporterJobsPanel'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { usePageTab } from '@/hooks/usePageTab'

const VIEWER_SECTIONS = visibleNavSections(HR_VIEWER_SECTIONS)
const VIEWER_TAB_IDS = VIEWER_SECTIONS.map((section) => section.id)
type HrViewerTab = (typeof HR_VIEWER_SECTIONS)[number]['id']
const VIEWER_DEFAULT_TAB: HrViewerTab = SHOW_MESAI_UI
  ? 'attendance'
  : 'reports'

function HrViewerPage() {
  const [tab, setTab] = usePageTab(VIEWER_TAB_IDS, VIEWER_DEFAULT_TAB)

  return (
    <div className="space-y-6">
      <PageHeader
        title="İnsan Kaynakları"
        subtitle={
          SHOW_MESAI_UI
            ? 'İK çalışanlarının mesaileri, gelen raporlar ve iş görüşmesi notları.'
            : 'Gelen raporlar ve iş görüşmesi notları.'
        }
      />

      <TabNav
        className="lg:hidden"
        items={[...VIEWER_SECTIONS]}
        activeId={tab}
        onChange={(id) => setTab(id as HrViewerTab)}
        aria-label="İK görünümü bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {SHOW_MESAI_UI && tab === 'attendance' && <HrStaffAttendanceViewer />}
        {tab === 'reports' && <ManagementHrInbox mode="reports" />}
        {tab === 'interviews' && <ManagementHrInbox mode="interviews" />}
      </div>
    </div>
  )
}

const OWN_SECTIONS = visibleNavSections(HR_OWN_SECTIONS)
const HR_OWN_TAB_IDS = OWN_SECTIONS.map((section) => section.id)
type HrOwnTab = (typeof HR_OWN_SECTIONS)[number]['id']
const HR_OWN_DEFAULT_TAB: HrOwnTab = SHOW_MESAI_UI ? 'attendance' : 'schedule'

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
        subtitle={
          SHOW_MESAI_UI
            ? 'Mesai, çekim takvimi, iş özeti, raporlar, işe alım notları ve hesap yönetimi.'
            : 'Çekim takvimi, iş özeti, raporlar, işe alım notları ve hesap yönetimi.'
        }
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
          <AttendanceLogsDashboard startNumber={1} />
        )}
        {tab === 'schedule' && <ReporterJobsPanel embedded />}
        {tab === 'jobs' && <HrJobStatsPanel sectionNumber="01" defaultOpen />}
        {tab === 'reports' && <HrReportsPanel sectionNumber="01" defaultOpen />}
        {tab === 'hiring' && <HiringNotesPanel sectionNumber="01" defaultOpen />}
        {tab === 'accounts' && <AccountAdminDashboard startNumber={1} />}
      </div>
    </div>
  )
}
