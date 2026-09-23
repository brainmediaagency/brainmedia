import { Briefcase, Camera, XCircle } from 'lucide-react'
import type { UserStats } from '@/features/users/types/user'
import { MetricCard } from '@/components/ui/MetricCard'
import { Skeleton } from '@/components/ui/Skeleton'

export type PersonalScorecardProps = {
  stats: UserStats
  loading?: boolean
}

const emptyStats: UserStats = {
  jobsReceived: 0,
  jobsShot: 0,
  jobsCancelled: 0,
}

/** MPU özeti — iş kayıtları listesiyle aynı sayım kaynağı. */
export function PersonalScorecard({
  stats,
  loading = false,
}: PersonalScorecardProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  const safe = stats ?? emptyStats

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        label="Alınan İş"
        value={safe.jobsReceived}
        icon={Briefcase}
        accent="cyan"
        animate
      />
      <MetricCard
        label="Çekilen İş"
        value={safe.jobsShot}
        icon={Camera}
        accent="pink"
        animate
      />
      <MetricCard
        label="İptal Edilen"
        value={safe.jobsCancelled}
        icon={XCircle}
        accent="orange"
        animate
      />
    </div>
  )
}
