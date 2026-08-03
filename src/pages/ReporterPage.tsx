import { useMemo } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import {
  CALENDAR_ONLY_REPORTER_SECTIONS,
  REPORTER_SECTIONS,
  REPORTER_VIEWER_SECTIONS,
} from '@/config/navSections'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ReporterJobsPanel } from '@/features/reporter/components/ReporterJobsPanel'
import { ReporterDailyReportForm } from '@/features/reporter/components/ReporterDailyReportForm'
import { ReporterZReportForm } from '@/features/reporter/components/ReporterZReportForm'
import { ReporterMyReports } from '@/features/reporter/components/ReporterMyReports'
import { ManagementReporterInbox } from '@/features/reporter/components/ManagementReporterInbox'
import { ReporterSummaryPanel } from '@/features/reporter/components/ReporterSummaryPanel'
import { usePageTab } from '@/hooks/usePageTab'

const REPORTER_TAB_IDS = REPORTER_SECTIONS.map((section) => section.id)
type ReporterTab = (typeof REPORTER_TAB_IDS)[number]

const REPORTER_VIEWER_TAB_IDS = REPORTER_VIEWER_SECTIONS.map((section) => section.id)
type ReporterViewerTab = (typeof REPORTER_VIEWER_TAB_IDS)[number]

const CALENDAR_ONLY_TAB_IDS = CALENDAR_ONLY_REPORTER_SECTIONS.map(
  (section) => section.id,
)
type CalendarOnlyTab = (typeof CALENDAR_ONLY_TAB_IDS)[number]

export function ReporterPage() {
  const { profile, user } = useAuth()
  const role = profile?.role
  const isReporter = role === 'reporter'
  const isCalendarOnly = role === 'human_resources' || role === 'kameraman'

  const viewerConfig = useMemo(() => {
    if (isReporter) {
      return { sections: REPORTER_SECTIONS, tabIds: REPORTER_TAB_IDS }
    }
    if (isCalendarOnly) {
      return {
        sections: CALENDAR_ONLY_REPORTER_SECTIONS,
        tabIds: CALENDAR_ONLY_TAB_IDS,
      }
    }
    return {
      sections: REPORTER_VIEWER_SECTIONS,
      tabIds: REPORTER_VIEWER_TAB_IDS,
    }
  }, [isCalendarOnly, isReporter])

  const [tab, setTab] = usePageTab(viewerConfig.tabIds, 'jobs')

  if (isReporter) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Muhabir"
          subtitle="Günün çekim takvimi, günlük rapor ve Z raporu."
        />

        <TabNav
          className="lg:hidden"
          items={[...REPORTER_SECTIONS]}
          activeId={tab}
          onChange={(id) => setTab(id as ReporterTab)}
          aria-label="Muhabir bölümleri"
        />

        <div key={tab} className="animate-fade-in-up">
          {tab === 'jobs' && <ReporterJobsPanel />}
          {tab === 'daily-report' && <ReporterDailyReportForm />}
          {tab === 'my-reports' && <ReporterMyReports />}
          {tab === 'muhabir-ozet' && (
            <ReporterSummaryPanel
              lockedReporterUid={user?.uid ?? null}
              lockedReporterName={profile?.fullName ?? null}
              allowReporterPicker={false}
            />
          )}
          {tab === 'z-report' && <ReporterZReportForm />}
        </div>
      </div>
    )
  }

  if (isCalendarOnly) {
    const title = role === 'kameraman' ? 'Kameraman' : 'Muhabir'
    return (
      <div className="space-y-6">
        <PageHeader
          title={title}
          subtitle="Çekim takvimini görüntüleyin."
        />

        <TabNav
          className="lg:hidden"
          items={[...CALENDAR_ONLY_REPORTER_SECTIONS]}
          activeId={tab}
          onChange={(id) => setTab(id as CalendarOnlyTab)}
          aria-label="Çekim takvimi"
        />

        <div key={tab} className="animate-fade-in-up">
          {tab === 'jobs' && <ReporterJobsPanel embedded />}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Muhabir"
        subtitle="Muhabir çekim takvimi, günlük raporlar ve Z raporları."
      />

      <TabNav
        className="lg:hidden"
        items={[...viewerConfig.sections]}
        activeId={tab}
        onChange={(id) => setTab(id as ReporterViewerTab)}
        aria-label="Muhabir görünümü bölümleri"
      />

      <div key={tab} className="animate-fade-in-up">
        {tab === 'jobs' && <ReporterJobsPanel embedded />}
        {tab === 'daily-reports' && <ManagementReporterInbox view="daily" />}
        {tab === 'muhabir-ozet' && <ReporterSummaryPanel allowReporterPicker />}
        {tab === 'z-reports' && <ManagementReporterInbox view="z" />}
      </div>
    </div>
  )
}
