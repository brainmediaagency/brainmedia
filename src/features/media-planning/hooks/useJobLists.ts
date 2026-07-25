import { useEffect, useState } from 'react'
import {
  subscribeApprovedJobs,
  subscribePendingJobs,
} from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'

export function useJobLists(ownerUid: string | null) {
  const [pendingJobs, setPendingJobs] = useState<JobDocument[]>([])
  const [approvedJobs, setApprovedJobs] = useState<JobDocument[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [approvedLoading, setApprovedLoading] = useState(true)

  useEffect(() => {
    if (!ownerUid) {
      setPendingJobs([])
      setApprovedJobs([])
      setPendingLoading(false)
      setApprovedLoading(false)
      return
    }

    setPendingLoading(true)
    setApprovedLoading(true)

    const unsubPending = subscribePendingJobs(
      ownerUid,
      (jobs) => {
        setPendingJobs(jobs)
        setPendingLoading(false)
      },
      () => setPendingLoading(false),
    )

    const unsubApproved = subscribeApprovedJobs(
      ownerUid,
      (jobs) => {
        setApprovedJobs(jobs)
        setApprovedLoading(false)
      },
      () => setApprovedLoading(false),
    )

    return () => {
      unsubPending()
      unsubApproved()
    }
  }, [ownerUid])

  return { pendingJobs, approvedJobs, pendingLoading, approvedLoading }
}
