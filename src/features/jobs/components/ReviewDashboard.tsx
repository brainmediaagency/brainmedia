import { AccordionSection } from '@/components/ui/AccordionSection'
import { CountBadge } from '@/components/ui/CountBadge'
import { useApprovalQueues } from '@/features/jobs/hooks/useApprovalQueues'
import {
  JobApprovalQueue,
  ReviewedJobsQueue,
} from '@/features/jobs/components/JobApprovalQueue'
import { JobCompanySearchPanel } from '@/features/jobs/components/JobCompanySearchPanel'

export type ReviewDashboardProps = {
  /** Shown in section copy — e.g. Koordinatör / Yönetim */
  roleLabel: string
}

export function ReviewDashboard({ roleLabel }: ReviewDashboardProps) {
  const {
    pendingJobs,
    todayConfirmedJobs,
    rejectedJobs,
    pendingLoading,
    todayConfirmedLoading,
    rejectedLoading,
    pendingHasMore,
    todayConfirmedHasMore,
    rejectedHasMore,
    pendingLoadingMore,
    todayConfirmedLoadingMore,
    rejectedLoadingMore,
    loadMorePending,
    loadMoreTodayConfirmed,
    loadMoreRejected,
    syncJob,
  } = useApprovalQueues(true)

  return (
    <div className="space-y-8">
      <AccordionSection
        title="Konfirme Bekleyen İşler"
        description={`${roleLabel} olarak medya planlama uzmanlarının gönderdiği işleri inceleyin. Her kayıtta işi ekleyen kullanıcı görünür.`}
        badge={
          <CountBadge
            count={pendingJobs.length}
            hasMore={pendingHasMore}
            loading={pendingLoading}
            tone="warning"
            label="iş"
          />
        }
        defaultOpen
      >
        <JobApprovalQueue
          jobs={pendingJobs}
          loading={pendingLoading}
          hasMore={pendingHasMore}
          loadingMore={pendingLoadingMore}
          onLoadMore={() => void loadMorePending()}
          onJobUpdated={syncJob}
        />
      </AccordionSection>

      <AccordionSection
        title="Konfirme İşler"
        description="Yalnızca bugün konfirme edilen işler. Çekim günü bugün olsa bile dün konfirme edilenler burada listelenmez."
        badge={
          <CountBadge
            count={todayConfirmedJobs.length}
            hasMore={todayConfirmedHasMore}
            loading={todayConfirmedLoading}
            tone="success"
            label="iş"
          />
        }
      >
        <ReviewedJobsQueue
          jobs={todayConfirmedJobs}
          loading={todayConfirmedLoading}
          emptyTitle="Bugün konfirme iş yok"
          emptyDescription="Bugün konfirme edilen iş kaydı bulunmuyor."
          hasMore={todayConfirmedHasMore}
          loadingMore={todayConfirmedLoadingMore}
          onLoadMore={() => void loadMoreTodayConfirmed()}
          onJobUpdated={syncJob}
        />
      </AccordionSection>

      <AccordionSection
        title="Reddedilen İşler"
        description="Reddedilmiş iş kayıtları; en yeni red en üstte."
        badge={
          <CountBadge
            count={rejectedJobs.length}
            hasMore={rejectedHasMore}
            loading={rejectedLoading}
            label="iş"
          />
        }
      >
        <ReviewedJobsQueue
          jobs={rejectedJobs}
          loading={rejectedLoading}
          emptyTitle="Reddedilmiş iş yok"
          emptyDescription="Henüz reddedilmiş iş kaydı bulunmuyor."
          hasMore={rejectedHasMore}
          loadingMore={rejectedLoadingMore}
          onLoadMore={() => void loadMoreRejected()}
          onJobUpdated={syncJob}
          showDecisionTime
        />
      </AccordionSection>

      <AccordionSection
        title="Firma Arama"
        description="Firma adına göre tüm iş kayıtlarını arayın. Eşleşen işler kart olarak listelenir; karta tıklayınca detay açılır."
        defaultOpen
      >
        <JobCompanySearchPanel onJobUpdated={syncJob} />
      </AccordionSection>
    </div>
  )
}
