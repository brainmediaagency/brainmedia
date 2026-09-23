import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  subscribeApprovedJobs,
  subscribePendingJobs,
} from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import { mapAppError } from '@/lib/errors'

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
      (error) => {
        setPendingLoading(false)
        toast.error(mapAppError(error, 'Bekleyen işler yüklenemedi.'))
      },
    )

    const unsubApproved = subscribeApprovedJobs(
      ownerUid,
      (jobs) => {
        setApprovedJobs(jobs)
        setApprovedLoading(false)
      },
      (error) => {
        setApprovedLoading(false)
        toast.error(mapAppError(error, 'İş kayıtları yüklenemedi.'))
      },
    )

    return () => {
      unsubPending()
      unsubApproved()
    }
  }, [ownerUid])

  return { pendingJobs, approvedJobs, pendingLoading, approvedLoading }
}
