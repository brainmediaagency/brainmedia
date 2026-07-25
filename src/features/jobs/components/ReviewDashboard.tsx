import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { useApprovalQueues } from '@/features/jobs/hooks/useApprovalQueues'
import {
  JobApprovalQueue,
  ReviewedJobsQueue,
} from '@/features/jobs/components/JobApprovalQueue'
import { OverdueJobsConfirmationPanel } from '@/features/media-planning/components/OverdueJobsConfirmationPanel'

export type ReviewDashboardProps = {
  /** Shown in section copy — e.g. Koordinatör / Yönetim */
  roleLabel: string
}

export function ReviewDashboard({ roleLabel }: ReviewDashboardProps) {
  const {
    pendingJobs,
    approvedJobs,
    rejectedJobs,
    pendingLoading,
    approvedLoading,
    rejectedLoading,
    pendingHasMore,
    approvedHasMore,
    rejectedHasMore,
    pendingLoadingMore,
    approvedLoadingMore,
    rejectedLoadingMore,
    loadMorePending,
    loadMoreApproved,
    loadMoreRejected,
    syncJob,
  } = useApprovalQueues(true)

  return (
    <div className="space-y-8">
      <AccordionSection
        number="01"
        title="Konfirme Bekleyen İşler"
        description={`${roleLabel} olarak medya planlama uzmanlarının gönderdiği işleri inceleyin. Her kayıtta işi ekleyen kullanıcı görünür.`}
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
        number="02"
        title="Konfirme İşler"
        description="Konfirme, çekilmiş veya iptal edilmiş iş kayıtları. Muhabire ilet ile takvime düşer; İstanbul 09:00–21:00 arasında iletilmeyenler otomatik iletilir."
      >
        <ReviewedJobsQueue
          jobs={approvedJobs}
          loading={approvedLoading}
          emptyTitle="Konfirme iş yok"
          emptyDescription="Henüz konfirme iş kaydı bulunmuyor."
          hasMore={approvedHasMore}
          loadingMore={approvedLoadingMore}
          onLoadMore={() => void loadMoreApproved()}
          onJobUpdated={syncJob}
        />
      </AccordionSection>

      <AccordionSection
        number="03"
        title="Çekim Durumu"
        description="Zamanı gelen konfirme işler burada listelenir; durum otomatik değişmez. Çekildi veya iptal için manuel onay gerekir."
        defaultOpen
      >
        <OverdueJobsConfirmationPanel
          jobs={approvedJobs}
          loading={approvedLoading}
          mode="actions"
          onJobUpdated={syncJob}
        />
        {approvedHasMore ? (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={approvedLoadingMore}
              onClick={() => void loadMoreApproved()}
            >
              {approvedLoadingMore ? 'Yükleniyor…' : 'Daha fazla yükle'}
            </Button>
          </div>
        ) : null}
      </AccordionSection>

      <AccordionSection
        number="04"
        title="Reddedilen İşler"
        description="Reddedilmiş iş kayıtları."
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
        />
      </AccordionSection>
    </div>
  )
}
