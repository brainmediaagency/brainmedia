import { useEffect, useMemo, useState } from 'react'
import { subscribeMediaPlanners } from '@/features/users/services/userService'
import type { UserProfile } from '@/features/users/types/user'
import { useAuth } from '@/features/auth/hooks/useAuth'

export function useMediaPlannerSelection() {
  const { user, profile } = useAuth()
  const [planners, setPlanners] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)

  const canSelect =
    profile?.role === 'coordinator' ||
    profile?.role === 'management' ||
    profile?.role === 'human_resources'

  useEffect(() => {
    if (!canSelect) return

    setLoading(true)
    const unsubscribe = subscribeMediaPlanners(
      (users) => {
        setPlanners(users)
        setSelectedUid((current) =>
          current && users.some((user) => user.uid === current) ? current : null,
        )
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [canSelect])

  useEffect(() => {
    if (!canSelect && user) {
      setSelectedUid(user.uid)
    }
  }, [canSelect, user])

  const filteredPlanners = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return planners
    return planners.filter(
      (p) =>
        p.fullName.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query),
    )
  }, [planners, search])

  const viewedUid = canSelect ? selectedUid : user?.uid ?? null

  const selectedPlanner = planners.find((p) => p.uid === viewedUid) ?? null

  return {
    canSelect,
    planners: filteredPlanners,
    allPlanners: planners,
    loading,
    search,
    setSearch,
    selectedUid: viewedUid,
    setSelectedUid,
    selectedPlanner,
  }
}
