import { useEffect, useState } from 'react'
import { Briefcase, Camera, XCircle } from 'lucide-react'
import { subscribeUserProfile } from '@/features/users/services/userService'
import type { UserStats } from '@/features/users/types/user'
import { MetricCard } from '@/components/ui/MetricCard'
import { Skeleton } from '@/components/ui/Skeleton'

export type PersonalScorecardProps = {
  uid: string
}

const emptyStats: UserStats = {
  jobsReceived: 0,
  jobsShot: 0,
  jobsCancelled: 0,
}

export function PersonalScorecard({ uid }: PersonalScorecardProps) {
  const [stats, setStats] = useState<UserStats>(emptyStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return

    setLoading(true)
    const unsubscribe = subscribeUserProfile(
      uid,
      (profile) => {
        setStats(profile?.stats ?? emptyStats)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [uid])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        label="Alınan İş"
        value={stats.jobsReceived}
        icon={Briefcase}
        accent="cyan"
        animate
      />
      <MetricCard
        label="Çekilen İş"
        value={stats.jobsShot}
        icon={Camera}
        accent="pink"
        animate
      />
      <MetricCard
        label="İptal Edilen"
        value={stats.jobsCancelled}
        icon={XCircle}
        accent="orange"
        animate
      />
    </div>
  )
}
