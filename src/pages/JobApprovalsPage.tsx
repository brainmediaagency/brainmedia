import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ReviewDashboard } from '@/features/jobs/components/ReviewDashboard'

/** Yönetim / koordinatör üst menü — iş konfirmeleri. */
export function JobApprovalsPage() {
  const { profile, claims } = useAuth()
  const role = profile?.role ?? claims?.role
  const roleLabel = role === 'coordinator' ? 'Koordinatör' : 'Yönetim'

  return (
    <div className="space-y-6">
      <PageHeader
        title="İş Konfirmeleri"
      />
      <div className="animate-fade-in-up">
        <ReviewDashboard roleLabel={roleLabel} />
      </div>
    </div>
  )
}
