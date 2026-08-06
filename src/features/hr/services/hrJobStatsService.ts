import {
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { jobsCollection } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  expandStatsQueryDateRange,
  isInstantInStatsRange,
} from '@/lib/date'

export type HrJobStatsRange = {
  startDate: string
  endDate: string
}

export type HrJobStatsResult = {
  entered: JobDocument[]
  received: JobDocument[]
  shot: JobDocument[]
  rejected: JobDocument[]
}

function dayStart(dateOnly: string): Timestamp {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEnd(dateOnly: string): Timestamp {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

export async function fetchHrJobStats(
  range: HrJobStatsRange,
): Promise<HrJobStatsResult> {
  const expanded = expandStatsQueryDateRange(range.startDate, range.endDate)
  if (!expanded) {
    return { entered: [], received: [], shot: [], rejected: [] }
  }

  const start = dayStart(expanded.startDate)
  const end = dayEnd(expanded.endDate)

  const [enteredSnap, receivedSnap, shotSnap, rejectedSnap] = await Promise.all([
    getDocs(
      query(
        jobsCollection(),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
    ),
    getDocs(
      query(
        jobsCollection(),
        where('status', 'in', ['approved', 'shot', 'cancelled']),
        where('reviewedAt', '>=', start),
        where('reviewedAt', '<=', end),
        orderBy('reviewedAt', 'desc'),
        limit(100),
      ),
    ),
    getDocs(
      query(
        jobsCollection(),
        where('status', '==', 'shot'),
        where('updatedAt', '>=', start),
        where('updatedAt', '<=', end),
        orderBy('updatedAt', 'desc'),
        limit(100),
      ),
    ),
    getDocs(
      query(
        jobsCollection(),
        where('status', '==', 'rejected'),
        where('reviewedAt', '>=', start),
        where('reviewedAt', '<=', end),
        orderBy('reviewedAt', 'desc'),
        limit(100),
      ),
    ),
  ])

  function keepBy(
    job: JobDocument,
    field: 'createdAt' | 'reviewedAt' | 'updatedAt',
  ): boolean {
    const ts = job[field]
    const d = ts?.toDate?.()
    if (!d) return false
    return isInstantInStatsRange(d, range.startDate, range.endDate)
  }

  return {
    entered: enteredSnap.docs.map((d) => d.data()).filter((j) => keepBy(j, 'createdAt')),
    received: receivedSnap.docs
      .map((d) => d.data())
      .filter((j) => keepBy(j, 'reviewedAt')),
    shot: shotSnap.docs.map((d) => d.data()).filter((j) => keepBy(j, 'updatedAt')),
    rejected: rejectedSnap.docs
      .map((d) => d.data())
      .filter((j) => keepBy(j, 'reviewedAt')),
  }
}
