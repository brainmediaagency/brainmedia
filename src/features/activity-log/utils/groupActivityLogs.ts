import type { ActivityLog } from '@/features/activity-log/types/activityLog'
import { formatDateTr } from '@/lib/date'

export type ActivityLogDayGroup = {
  dateKey: string
  label: string
  logs: ActivityLog[]
}

export type JobActivityGroup = {
  jobId: string
  companyName: string
  latestLabel: string
  events: ActivityLog[]
}

function logMillis(log: ActivityLog): number {
  const ms = log.createdAt?.toMillis?.()
  return typeof ms === 'number' && Number.isFinite(ms) ? ms : 0
}

/** Newest-first logs grouped by Istanbul calendar day. */
export function groupActivityLogsByDay(
  logs: ActivityLog[],
): ActivityLogDayGroup[] {
  const groups: ActivityLogDayGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const log of logs) {
    const date =
      log.createdAt && typeof log.createdAt.toDate === 'function'
        ? log.createdAt.toDate()
        : null
    const dateKey = date ? formatDateTr(date) : '—'
    const existing = indexByKey.get(dateKey)
    if (existing == null) {
      indexByKey.set(dateKey, groups.length)
      groups.push({ dateKey, label: dateKey, logs: [log] })
    } else {
      groups[existing]!.logs.push(log)
    }
  }

  return groups
}

/** Group job-related rows by jobId; rows without jobId stay ungrouped. */
export function groupActivityLogsByJob(logs: ActivityLog[]): {
  groups: JobActivityGroup[]
  ungrouped: ActivityLog[]
} {
  const byJob = new Map<string, ActivityLog[]>()
  const ungrouped: ActivityLog[] = []

  for (const log of logs) {
    const jobId = log.jobId?.trim() ?? ''
    if (!jobId) {
      ungrouped.push(log)
      continue
    }
    const list = byJob.get(jobId)
    if (list) list.push(log)
    else byJob.set(jobId, [log])
  }

  const groups: JobActivityGroup[] = [...byJob.entries()].map(
    ([jobId, events]) => {
      const latest = events[0]!
      const date =
        latest.createdAt && typeof latest.createdAt.toDate === 'function'
          ? latest.createdAt.toDate()
          : null
      return {
        jobId,
        companyName: latest.jobCompanyName?.trim() || 'İş',
        latestLabel: date ? formatDateTr(date) : '',
        events,
      }
    },
  )

  groups.sort((a, b) => logMillis(b.events[0]!) - logMillis(a.events[0]!))

  return { groups, ungrouped }
}
