import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PersonalScorecard } from '@/features/media-planning/components/PersonalScorecard'
import { MediaPlannerEmployeesPanel } from '@/features/media-planning/components/MediaPlannerEmployeesPanel'
import { MediaPlannerSelector } from '@/features/media-planning/components/MediaPlannerSelector'
import { NewJobForm } from '@/features/media-planning/components/NewJobForm'
import {
  PlannerJobsPanel,
  PlannerPeriodToolbar,
} from '@/features/media-planning/components/PlannerJobsPanel'
import { OverdueJobsConfirmationPanel } from '@/features/media-planning/components/OverdueJobsConfirmationPanel'
import { TeyitYonergesiCard } from '@/features/media-planning/components/TeyitYonergesiCard'
import { useJobLists } from '@/features/media-planning/hooks/useJobLists'
import { useMediaPlannerSelection } from '@/features/media-planning/hooks/useMediaPlannerSelection'
import { subscribeScheduleJobs } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import { MEDIA_PLANNING_SECTIONS } from '@/config/navSections'
import {
  filterJobsByPeriod,
  plannerScoreFromJobs,
  type PlannerPeriodMode,
} from '@/features/media-planning/utils/plannerJobsPeriod'
import {
  currentYearMonthIstanbul,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { Users } from 'lucide-react'

type MediaPlanningTab =
  | (typeof MEDIA_PLANNING_SECTIONS)[number]['id']
  | 'employees'

type MediaPlannerOwnDashboardProps = {
  tab: MediaPlanningTab
}

function MediaPlannerOwnDashboard({ tab }: MediaPlannerOwnDashboardProps) {
  const { user, profile, claims } = useAuth()
  const viewerRole = profile?.role ?? claims?.role
  const isMediaPlanning = viewerRole === 'media_planning'
  const isHr = viewerRole === 'human_resources'
  const isOpsViewer =
    viewerRole === 'management' || viewerRole === 'coordinator'
  /** Ops never opens Çekim Durumu / Yeni İş — even via stale ?tab=. */
  const activeTab: MediaPlanningTab =
    isOpsViewer && (tab === 'overdue' || tab === 'new-job' || tab === 'score')
      ? 'jobs'
      : tab
  const isEmployeesTab = activeTab === 'employees' && isOpsViewer
  /** İK çekim durumunda tüm işleri görür — planlamacı seçici yok. */
  const hrOrgOverdue = isHr && activeTab === 'overdue'
  const canSelectPlanner = isOpsViewer || (isHr && !hrOrgOverdue)

  const selection = useMediaPlannerSelection()
  const viewedUid = isMediaPlanning
    ? (user?.uid ?? null)
    : selection.selectedUid

  const { pendingJobs, approvedJobs, pendingLoading, approvedLoading } =
    useJobLists(hrOrgOverdue || isEmployeesTab ? null : viewedUid)

  const [orgScheduleJobs, setOrgScheduleJobs] = useState<JobDocument[]>([])
  const [orgScheduleLoading, setOrgScheduleLoading] = useState(false)

  const [periodMode, setPeriodMode] = useState<PlannerPeriodMode>('month')
  const [yearMonth, setYearMonth] = useState(currentYearMonthIstanbul)
  const [day, setDay] = useState(todayDateOnlyIstanbul)

  const jobsLoading = pendingLoading || approvedLoading
  const allJobs = useMemo(
    () => [...pendingJobs, ...approvedJobs],
    [pendingJobs, approvedJobs],
  )
  const periodJobs = useMemo(
    () => filterJobsByPeriod(allJobs, periodMode, yearMonth, day),
    [allJobs, day, periodMode, yearMonth],
  )
  const scoreStats = useMemo(
    () => plannerScoreFromJobs(periodJobs),
    [periodJobs],
  )

  useEffect(() => {
    if (!hrOrgOverdue) {
      setOrgScheduleJobs([])
      setOrgScheduleLoading(false)
      return
    }
    setOrgScheduleLoading(true)
    return subscribeScheduleJobs(
      (jobs) => {
        setOrgScheduleJobs(jobs)
        setOrgScheduleLoading(false)
      },
      () => setOrgScheduleLoading(false),
    )
  }, [hrOrgOverdue])

  if (!user?.uid) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">Oturum bulunamadı.</p>
      </Card>
    )
  }

  if (isEmployeesTab) {
    return (
      <div key={activeTab} className="animate-fade-in-up">
        <MediaPlannerEmployeesPanel />
      </div>
    )
  }

  const showPlannerPicker = canSelectPlanner
  const needsPlanner = showPlannerPicker && !viewedUid && !hrOrgOverdue
  const showInlineMpuScore = activeTab === 'jobs' && isOpsViewer

  const plannerEmpty = (
    <EmptyState
      icon={Users}
      title="Planlamacı seçin"
      description="Bu sekme için yukarıdan bir medya planlamacı seçin."
    />
  )

  const showOverdueTab = activeTab === 'overdue' && !isOpsViewer
  const showNewJobTab =
    activeTab === 'new-job' && !isOpsViewer && viewerRole !== 'human_resources'
  const showScoreTab = activeTab === 'score' && !isOpsViewer

  const periodToolbar = (
    <PlannerPeriodToolbar
      periodMode={periodMode}
      onPeriodModeChange={setPeriodMode}
      yearMonth={yearMonth}
      onYearMonthChange={setYearMonth}
      day={day}
      onDayChange={setDay}
    />
  )

  return (
    <div key={activeTab} className="space-y-4 animate-fade-in-up">
      {showPlannerPicker ? (
        <Card className="!p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                Personel görünümü
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
                Medya planlamacı seçimi
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {showInlineMpuScore
                  ? 'MPU tablosu ve iş kayıtları için bir planlamacı seçin.'
                  : 'Çekim durumu, iş kayıtları ve MPU tablosu için bir planlamacı seçin.'}
              </p>
            </div>
            <MediaPlannerSelector
              planners={selection.planners}
              loading={selection.loading}
              selectedUid={selection.selectedUid}
              onSelect={selection.setSelectedUid}
            />
          </div>
        </Card>
      ) : null}

      {showOverdueTab ? (
        <>
          <Card>
            <SectionHeader
              title="Çekim Durumu"
              description={
                hrOrgOverdue
                  ? 'Tüm planlamacıların planlanan çekim zamanı geçmiş işleri. Sonuçlandırma koordinatör veya yönetim tarafından yapılır.'
                  : 'Planlanan çekim zamanı geçmiş işlerin durumunu takip edin. Zamanı gelince otomatik Çekildi olmaz; sonuçlandırma koordinatör veya yönetim tarafından yapılır.'
              }
            />
            <div className="mt-4">
              {needsPlanner ? (
                plannerEmpty
              ) : (
                <OverdueJobsConfirmationPanel
                  jobs={hrOrgOverdue ? orgScheduleJobs : approvedJobs}
                  loading={hrOrgOverdue ? orgScheduleLoading : approvedLoading}
                  mode="readonly"
                />
              )}
            </div>
          </Card>
          {!needsPlanner ? <TeyitYonergesiCard /> : null}
        </>
      ) : null}

      {showNewJobTab ? (
        <Card>
          <SectionHeader
            title="Yeni İş Kaydı"
            description="Yeni iş bilgilerini girerek konfirmeye gönderin."
          />
          <div className="mt-4">
            {isMediaPlanning ? (
              <NewJobForm />
            ) : (
              <NewJobForm
                readonly
                readonlyMessage="Yeni iş kaydı yalnızca medya planlama kullanıcısının kendi hesabından oluşturulabilir."
              />
            )}
          </div>
        </Card>
      ) : null}

      {showInlineMpuScore ? (
        <Card>
          <SectionHeader
            title="MPU Tablosu"
            description="Alınan, çekilen ve iptal — iş kayıtları ile aynı dönem filtresi."
          />
          <div className="mt-4 space-y-4">
            {needsPlanner || !viewedUid ? (
              plannerEmpty
            ) : (
              <>
                {periodToolbar}
                <PersonalScorecard stats={scoreStats} loading={jobsLoading} />
              </>
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === 'jobs' ? (
        <Card>
          <SectionHeader
            title="İş Kayıtları"
            description="Bekleyen, konfirme, çekilen, iptal ve reddedilen işler. Planlanan çekim tarihine göre sıralı."
          />
          <div className="mt-4">
            {needsPlanner ? (
              plannerEmpty
            ) : (
              <PlannerJobsPanel
                pendingJobs={pendingJobs}
                approvedJobs={approvedJobs}
                loading={jobsLoading}
                canEditPending={isMediaPlanning}
                periodMode={periodMode}
                onPeriodModeChange={setPeriodMode}
                yearMonth={yearMonth}
                onYearMonthChange={setYearMonth}
                day={day}
                onDayChange={setDay}
                hidePeriodControls={showInlineMpuScore}
              />
            )}
          </div>
        </Card>
      ) : null}

      {showScoreTab ? (
        <Card>
          <SectionHeader
            title="MPU Tablosu"
            description="Alınan, çekilen ve iptal — iş kayıtları ile aynı dönem filtresi."
          />
          <div className="mt-4 space-y-4">
            {needsPlanner || !viewedUid ? (
              plannerEmpty
            ) : (
              <>
                {periodToolbar}
                <PersonalScorecard stats={scoreStats} loading={jobsLoading} />
              </>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

export type MediaPlanningDashboardProps = {
  tab?: MediaPlanningTab
}

/** MPU düzeni: kendi kaydı veya yönetim/koordinatör için seçilen planlamacı. */
export function MediaPlanningDashboard({
  tab = 'overdue',
}: MediaPlanningDashboardProps) {
  return <MediaPlannerOwnDashboard tab={tab} />
}
