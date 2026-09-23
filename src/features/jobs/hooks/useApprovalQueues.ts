import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchAllPendingJobsPage,
  fetchRecentlyRejectedJobsPage,
  fetchTodayConfirmedApprovedJobsPage,
  type JobQueueCursor,
} from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  isApprovedReviewedOnDay,
  sortJobsByDecisionTimeDesc,
  withoutJob,
  upsertFront,
} from '@/features/jobs/utils/approvalQueueSync'
import { mapAppError } from '@/lib/errors'

type QueueState = {
  jobs: JobDocument[]
  cursor: JobQueueCursor | null
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
}

const emptyQueue = (): QueueState => ({
  jobs: [],
  cursor: null,
  hasMore: false,
  loading: true,
  loadingMore: false,
})

export function useApprovalQueues(enabled = true) {
  const [pending, setPending] = useState<QueueState>(emptyQueue)
  /** Konfirme İşler — confirmed today (reviewedAt). */
  const [todayConfirmed, setTodayConfirmed] = useState<QueueState>(emptyQueue)
  const [rejected, setRejected] = useState<QueueState>(emptyQueue)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setPending({ ...emptyQueue(), loading: false })
      setTodayConfirmed({ ...emptyQueue(), loading: false })
      setRejected({ ...emptyQueue(), loading: false })
      return
    }

    setPending(emptyQueue())
    setTodayConfirmed(emptyQueue())
    setRejected(emptyQueue())

    void (async () => {
      try {
        const [pendingPage, todayPage, rejectedPage] = await Promise.all([
          fetchAllPendingJobsPage(),
          fetchTodayConfirmedApprovedJobsPage(),
          fetchRecentlyRejectedJobsPage(),
        ])
        if (!aliveRef.current) return
        setPending({
          jobs: pendingPage.jobs,
          cursor: pendingPage.cursor,
          hasMore: pendingPage.hasMore,
          loading: false,
          loadingMore: false,
        })
        setTodayConfirmed({
          jobs: todayPage.jobs,
          cursor: todayPage.cursor,
          hasMore: todayPage.hasMore,
          loading: false,
          loadingMore: false,
        })
        setRejected({
          jobs: sortJobsByDecisionTimeDesc(rejectedPage.jobs),
          cursor: rejectedPage.cursor,
          hasMore: rejectedPage.hasMore,
          loading: false,
          loadingMore: false,
        })
      } catch (error) {
        if (!aliveRef.current) return
        setPending((s) => ({ ...s, loading: false }))
        setTodayConfirmed((s) => ({ ...s, loading: false }))
        setRejected((s) => ({ ...s, loading: false }))
        toast.error(mapAppError(error, 'İş kuyrukları yüklenemedi.'))
      }
    })()
  }, [enabled])

  const loadMorePending = useCallback(async () => {
    if (!pending.hasMore || pending.loadingMore || !pending.cursor) return
    setPending((s) => ({ ...s, loadingMore: true }))
    try {
      const page = await fetchAllPendingJobsPage(pending.cursor)
      if (!aliveRef.current) return
      setPending((s) => ({
        jobs: [...s.jobs, ...page.jobs],
        cursor: page.cursor,
        hasMore: page.hasMore,
        loading: false,
        loadingMore: false,
      }))
    } catch (error) {
      if (!aliveRef.current) return
      setPending((s) => ({ ...s, loadingMore: false }))
      toast.error(mapAppError(error, 'Konfirme bekleyen işler yüklenemedi.'))
    }
  }, [pending.hasMore, pending.loadingMore, pending.cursor])

  const loadMoreTodayConfirmed = useCallback(async () => {
    if (
      !todayConfirmed.hasMore ||
      todayConfirmed.loadingMore ||
      !todayConfirmed.cursor
    ) {
      return
    }
    setTodayConfirmed((s) => ({ ...s, loadingMore: true }))
    try {
      const page = await fetchTodayConfirmedApprovedJobsPage(
        todayConfirmed.cursor,
      )
      if (!aliveRef.current) return
      setTodayConfirmed((s) => ({
        jobs: [...s.jobs, ...page.jobs],
        cursor: page.cursor,
        hasMore: page.hasMore,
        loading: false,
        loadingMore: false,
      }))
    } catch (error) {
      if (!aliveRef.current) return
      setTodayConfirmed((s) => ({ ...s, loadingMore: false }))
      toast.error(mapAppError(error, 'Konfirme işler yüklenemedi.'))
    }
  }, [
    todayConfirmed.hasMore,
    todayConfirmed.loadingMore,
    todayConfirmed.cursor,
  ])

  const loadMoreRejected = useCallback(async () => {
    if (!rejected.hasMore || rejected.loadingMore || !rejected.cursor) return
    setRejected((s) => ({ ...s, loadingMore: true }))
    try {
      const page = await fetchRecentlyRejectedJobsPage(rejected.cursor)
      if (!aliveRef.current) return
      setRejected((s) => ({
        jobs: sortJobsByDecisionTimeDesc([...s.jobs, ...page.jobs]),
        cursor: page.cursor,
        hasMore: page.hasMore,
        loading: false,
        loadingMore: false,
      }))
    } catch (error) {
      if (!aliveRef.current) return
      setRejected((s) => ({ ...s, loadingMore: false }))
      toast.error(mapAppError(error, 'Reddedilen işler yüklenemedi.'))
    }
  }, [rejected.hasMore, rejected.loadingMore, rejected.cursor])

  const syncJob = useCallback((job: JobDocument) => {
    const id = job.id
    if (job.status === 'pending') {
      setPending((s) => ({ ...s, jobs: upsertFront(s.jobs, job) }))
      setTodayConfirmed((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
      setRejected((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
      return
    }
    if (job.status === 'rejected') {
      setRejected((s) => ({
        ...s,
        jobs: sortJobsByDecisionTimeDesc(upsertFront(s.jobs, job)),
      }))
      setPending((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
      setTodayConfirmed((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
      return
    }
    if (job.status === 'approved') {
      setTodayConfirmed((s) => ({
        ...s,
        jobs: isApprovedReviewedOnDay(job)
          ? upsertFront(s.jobs, job)
          : withoutJob(s.jobs, id),
      }))
      setPending((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
      setRejected((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
      return
    }
    setPending((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
    setTodayConfirmed((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
    setRejected((s) => ({ ...s, jobs: withoutJob(s.jobs, id) }))
  }, [])

  return {
    pendingJobs: pending.jobs,
    todayConfirmedJobs: todayConfirmed.jobs,
    rejectedJobs: rejected.jobs,
    pendingLoading: pending.loading,
    todayConfirmedLoading: todayConfirmed.loading,
    rejectedLoading: rejected.loading,
    pendingHasMore: pending.hasMore,
    todayConfirmedHasMore: todayConfirmed.hasMore,
    rejectedHasMore: rejected.hasMore,
    pendingLoadingMore: pending.loadingMore,
    todayConfirmedLoadingMore: todayConfirmed.loadingMore,
    rejectedLoadingMore: rejected.loadingMore,
    loadMorePending,
    loadMoreTodayConfirmed,
    loadMoreRejected,
    syncJob,
    replaceJob: syncJob,
  }
}
