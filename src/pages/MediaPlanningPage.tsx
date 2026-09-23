import { useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { SHOW_MESAI_UI } from '@/config/featureFlags'
import {
  MEDIA_PLANNING_OPS_SECTIONS,
  MEDIA_PLANNING_SECTIONS,
  visibleNavSections,
} from '@/config/navSections'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { DailyBriefingCard } from '@/features/media-planning/components/DailyBriefingCard'
import { MediaPlanningDashboard } from '@/features/media-planning/components/MediaPlanningDashboard'
import { ShiftTrackerWidget } from '@/features/media-planning/components/ShiftTrackerWidget'
import { usePageTab } from '@/hooks/usePageTab'

const PLANNER_SECTIONS = visibleNavSections(MEDIA_PLANNING_SECTIONS)
const OPS_SECTIONS = visibleNavSections(MEDIA_PLANNING_OPS_SECTIONS)
type MediaPlanningTab =
  | (typeof MEDIA_PLANNING_SECTIONS)[number]['id']
  | 'employees'

function usesPlannerLayout(role: string | undefined): boolean {
  return (
    role === 'media_planning' ||
    role === 'management' ||
    role === 'coordinator' ||
    role === 'human_resources'
  )
}

function sectionsForRole(role: string | undefined) {
  if (role === 'management' || role === 'coordinator') {
    return OPS_SECTIONS
  }
  if (role === 'human_resources') {
    return PLANNER_SECTIONS.filter((section) => section.id !== 'new-job')
  }
  return PLANNER_SECTIONS
}

function defaultTabForRole(role: string | undefined): MediaPlanningTab {
  if (role === 'management' || role === 'coordinator') {
    return 'jobs'
  }
  return 'overdue'
}

export function MediaPlanningPage() {
  const { user, profile, claims } = useAuth()
  /** Same source as NavMenu — avoid profile/claims drift showing planner tabs. */
  const role = profile?.role ?? claims?.role
  const isPlannerLayout = usesPlannerLayout(role)
  const showShiftWidget =
    SHOW_MESAI_UI && role === 'media_planning' && Boolean(user)

  const tabConfig = useMemo(() => {
    const sections = sectionsForRole(role)
    return {
      sections,
      tabIds: sections.map((section) => section.id),
      defaultTab: defaultTabForRole(role),
    }
  }, [role])

  const [tab, setTab] = usePageTab(tabConfig.tabIds, tabConfig.defaultTab)

  useEffect(() => {
    const main = document.querySelector('main')
    if (main instanceof HTMLElement) {
      main.scrollTo({ top: 0 })
    }
  }, [tab])

  if (!isPlannerLayout) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Medya Planlama"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medya Planlama"
        action={
          showShiftWidget && user ? <ShiftTrackerWidget uid={user.uid} /> : null
        }
      />

      <DailyBriefingCard />

      <TabNav
        className="lg:hidden"
        items={[...tabConfig.sections]}
        activeId={tab}
        onChange={(id) => setTab(id as MediaPlanningTab)}
        aria-label="Medya planlama bölümleri"
      />

      <MediaPlanningDashboard tab={tab as MediaPlanningTab} />
    </div>
  )
}
