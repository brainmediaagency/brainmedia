import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchAllApprovedJobsPage,
  fetchAllPendingJobsPage,
  fetchRecentlyRejectedJobsPage,
  type JobQueueCursor,
} from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
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
  const [approved, setApproved] = useState<QueueState>(emptyQueue)
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
      setApproved({ ...emptyQueue(), loading: false })
      setRejected({ ...emptyQueue(), loading: false })
      return
    }

    setPending(emptyQueue())
    setApproved(emptyQueue())
    setRejected(emptyQueue())

    void (async () => {
      try {
        const [pendingPage, approvedPage, rejectedPage] = await Promise.all([
          fetchAllPendingJobsPage(),
          fetchAllApprovedJobsPage(),
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
        setApproved({
          jobs: approvedPage.jobs,
          cursor: approvedPage.cursor,
          hasMore: approvedPage.hasMore,
          loading: false,
          loadingMore: false,
        })
        setRejected({
          jobs: rejectedPage.jobs,
          cursor: rejectedPage.cursor,
          hasMore: rejectedPage.hasMore,
          loading: false,
          loadingMore: false,
        })
      } catch (error) {
        if (!aliveRef.current) return
        setPending((s) => ({ ...s, loading: false }))
        setApproved((s) => ({ ...s, loading: false }))
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

  const loadMoreApproved = useCallback(async () => {
    if (!approved.hasMore || approved.loadingMore || !approved.cursor) return
    setApproved((s) => ({ ...s, loadingMore: true }))
    try {
      const page = await fetchAllApprovedJobsPage(approved.cursor)
      if (!aliveRef.current) return
      setApproved((s) => ({
        jobs: [...s.jobs, ...page.jobs],
        cursor: page.cursor,
        hasMore: page.hasMore,
        loading: false,
        loadingMore: false,
      }))
    } catch (error) {
      if (!aliveRef.current) return
      setApproved((s) => ({ ...s, loadingMore: false }))
      toast.error(mapAppError(error, 'Konfirme işler yüklenemedi.'))
    }
  }, [approved.hasMore, approved.loadingMore, approved.cursor])

  const loadMoreRejected = useCallback(async () => {
    if (!rejected.hasMore || rejected.loadingMore || !rejected.cursor) return
    setRejected((s) => ({ ...s, loadingMore: true }))
    try {
      const page = await fetchRecentlyRejectedJobsPage(rejected.cursor)
      if (!aliveRef.current) return
      setRejected((s) => ({
        jobs: [...s.jobs, ...page.jobs],
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

  /** Keep one-shot queue lists in sync after inline pending-job edits. */
  const replaceJob = useCallback((job: JobDocument) => {
    const patch = (s: QueueState): QueueState => ({
      ...s,
      jobs: s.jobs.map((j) => (j.id === job.id ? job : j)),
    })
    setPending(patch)
    setApproved(patch)
    setRejected(patch)
  }, [])

  return {
    pendingJobs: pending.jobs,
    approvedJobs: approved.jobs,
    rejectedJobs: rejected.jobs,
    pendingLoading: pending.loading,
    approvedLoading: approved.loading,
    rejectedLoading: rejected.loading,
    pendingHasMore: pending.hasMore,
    approvedHasMore: approved.hasMore,
    rejectedHasMore: rejected.hasMore,
    pendingLoadingMore: pending.loadingMore,
    approvedLoadingMore: approved.loadingMore,
    rejectedLoadingMore: rejected.loadingMore,
    loadMorePending,
    loadMoreApproved,
    loadMoreRejected,
    replaceJob,
  }
}
