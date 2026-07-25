import { useMemo } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { TabNav } from '@/components/ui/TabNav'
import { SHOW_MESAI_UI } from '@/config/featureFlags'
import {
  MEDIA_PLANNING_SECTIONS,
  visibleNavSections,
} from '@/config/navSections'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { DailyMotivationBanner } from '@/features/media-planning/components/DailyMotivationBanner'
import { DailyRegionBanner } from '@/features/media-planning/components/DailyRegionBanner'
import { MediaPlanningDashboard } from '@/features/media-planning/components/MediaPlanningDashboard'
import { ShiftTrackerWidget } from '@/features/media-planning/components/ShiftTrackerWidget'
import { usePageTab } from '@/hooks/usePageTab'

const PLANNER_SECTIONS = visibleNavSections(MEDIA_PLANNING_SECTIONS)
type MediaPlanningTab = (typeof MEDIA_PLANNING_SECTIONS)[number]['id']

function usesPlannerLayout(role: string | undefined): boolean {
  return (
    role === 'media_planning' ||
    role === 'management' ||
    role === 'coordinator' ||
    role === 'human_resources'
  )
}

function sectionsForRole(role: string | undefined) {
  if (role === 'human_resources') {
    return PLANNER_SECTIONS.filter((section) => section.id !== 'new-job')
  }
  return PLANNER_SECTIONS
}

export function MediaPlanningPage() {
  const { user, profile } = useAuth()
  const role = profile?.role
  const isPlannerLayout = usesPlannerLayout(role)
  const showShiftWidget =
    SHOW_MESAI_UI && role === 'media_planning' && Boolean(user)

  const tabConfig = useMemo(() => {
    const sections = sectionsForRole(role)
    return {
      sections,
      tabIds: sections.map((section) => section.id),
      defaultTab: 'overdue' as MediaPlanningTab,
    }
  }, [role])

  const [tab, setTab] = usePageTab(tabConfig.tabIds, tabConfig.defaultTab)

  if (!isPlannerLayout) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Medya Planlama"
          subtitle="Bu sayfayı görüntüleme yetkiniz bulunmuyor."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medya Planlama"
        subtitle={
          SHOW_MESAI_UI
            ? 'Mesai, MPU Tablosu ve konfirme iş kayıtları.'
            : 'MPU Tablosu ve konfirme iş kayıtları.'
        }
        action={
          showShiftWidget && user ? <ShiftTrackerWidget uid={user.uid} /> : null
        }
      />

      <DailyMotivationBanner />
      <DailyRegionBanner />

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
