import { useAuth } from '@/features/auth/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PersonalScorecard } from '@/features/media-planning/components/PersonalScorecard'
import { MediaPlannerSelector } from '@/features/media-planning/components/MediaPlannerSelector'
import { NewJobForm } from '@/features/media-planning/components/NewJobForm'
import { PlannerJobsPanel } from '@/features/media-planning/components/PlannerJobsPanel'
import { OverdueJobsConfirmationPanel } from '@/features/media-planning/components/OverdueJobsConfirmationPanel'
import { TeyitYonergesiCard } from '@/features/media-planning/components/TeyitYonergesiCard'
import { useJobLists } from '@/features/media-planning/hooks/useJobLists'
import { useMediaPlannerSelection } from '@/features/media-planning/hooks/useMediaPlannerSelection'
import type { MEDIA_PLANNING_SECTIONS } from '@/config/navSections'
import { Users } from 'lucide-react'

type MediaPlanningTab = (typeof MEDIA_PLANNING_SECTIONS)[number]['id']

type MediaPlannerOwnDashboardProps = {
  tab: MediaPlanningTab
}

function MediaPlannerOwnDashboard({ tab }: MediaPlannerOwnDashboardProps) {
  const { user, profile, claims } = useAuth()
  const viewerRole = claims?.role ?? profile?.role
  const isMediaPlanning = viewerRole === 'media_planning'
  const canSelectPlanner =
    viewerRole === 'management' ||
    viewerRole === 'coordinator' ||
    viewerRole === 'human_resources'

  const selection = useMediaPlannerSelection()
  const viewedUid = isMediaPlanning
    ? (user?.uid ?? null)
    : selection.selectedUid

  const { pendingJobs, approvedJobs, pendingLoading, approvedLoading } =
    useJobLists(viewedUid)

  if (!user?.uid) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">Oturum bulunamadı.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {canSelectPlanner ? (
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
                MPU ekranıyla aynı bölümleri görmek için bir planlamacı seçin.
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

      {canSelectPlanner && !viewedUid ? (
        <EmptyState
          icon={Users}
          title="Planlamacı seçin"
          description="Çekim durumu, iş kayıtları ve MPU tablosu için bir medya planlamacı seçin."
        />
      ) : null}

      {(!canSelectPlanner || viewedUid) && tab === 'overdue' ? (
        <>
          <Card>
            <SectionHeader
              number="01"
              title="Çekim Durumu"
              description="Planlanan çekim zamanı geçmiş işlerin durumunu takip edin. Zamanı gelince otomatik Çekildi olmaz; sonuçlandırma koordinatör veya yönetim tarafından yapılır."
            />
            <div className="mt-4">
              <OverdueJobsConfirmationPanel
                jobs={approvedJobs}
                loading={approvedLoading}
                mode="readonly"
              />
            </div>
          </Card>
          <TeyitYonergesiCard />
        </>
      ) : null}

      {tab === 'new-job' && viewerRole !== 'human_resources' ? (
        <Card>
          <SectionHeader
            number="02"
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

      {(!canSelectPlanner || viewedUid) && tab === 'jobs' ? (
        <Card>
          <SectionHeader
            number="03"
            title="İş Kayıtları"
            description="Bekleyen, konfirme, çekilen, iptal ve reddedilen işler. Planlanan çekim tarihine göre sıralı."
          />
          <div className="mt-4">
            <PlannerJobsPanel
              pendingJobs={pendingJobs}
              approvedJobs={approvedJobs}
              loading={pendingLoading || approvedLoading}
              canEditPending={isMediaPlanning}
            />
          </div>
        </Card>
      ) : null}

      {(!canSelectPlanner || viewedUid) && tab === 'score' && viewedUid ? (
        <Card>
          <SectionHeader
            number="04"
            title="MPU Tablosu"
            description="Alınan, çekilen ve iptal edilen iş sayıları."
          />
          <div className="mt-4">
            <PersonalScorecard uid={viewedUid} />
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
export function MediaPlanningDashboard({ tab = 'overdue' }: MediaPlanningDashboardProps) {
  return <MediaPlannerOwnDashboard tab={tab} />
}
