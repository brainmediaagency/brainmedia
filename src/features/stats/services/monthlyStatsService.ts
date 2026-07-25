import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import {
  reportExpenseKurus,
  reportIncomeKurus,
  resolveReportDate,
} from '@/features/cash/services/cashService'
import { jobsCollection } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import type { UserProfile } from '@/features/users/types/user'
import { getDb } from '@/lib/firebase/firestore'
import { todayDateOnlyIstanbul } from '@/lib/date'

const MONTHLY_FETCH_LIMIT = 2000

export type YearMonth = string // `yyyy-MM`

export type MonthlyOrgStats = {
  jobsEntered: number
  jobsReceived: number
  jobsShot: number
  jobsCancelled: number
  shootMinutes: number
  /** Muhabir formlarındaki haber (newsTotalKurus) toplamı */
  totalNewsIncomeKurus: number
  totalIncomeKurus: number
  totalExpenseKurus: number
  totalFieldPaidKurus: number
  cashBalanceKurus: number
  reportCount: number
}

export type PlannerMonthlyRow = {
  uid: string
  fullName: string
  entered: number
  shot: number
  cancelled: number
  agreedAmountKurus: number
}

export type MonthlyStatsResult = {
  yearMonth: YearMonth
  org: MonthlyOrgStats
  planners: PlannerMonthlyRow[]
  totals: Omit<PlannerMonthlyRow, 'uid' | 'fullName'>
}

export function currentYearMonthIstanbul(now: Date = new Date()): YearMonth {
  return todayDateOnlyIstanbul(now).slice(0, 7)
}

/** First and last `yyyy-MM-dd` for a calendar month. */
export function monthDateBounds(yearMonth: YearMonth): {
  startDate: string
  endDate: string
} {
  const [yRaw, mRaw] = yearMonth.split('-')
  const y = Number(yRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error('Geçersiz ay')
  }
  const startDate = `${yRaw}-${mRaw}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const endDate = `${yRaw}-${mRaw}-${String(lastDay).padStart(2, '0')}`
  return { startDate, endDate }
}

function dayStart(dateOnly: string): Timestamp {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEnd(dateOnly: string): Timestamp {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

function emptyPlannerBucket(uid: string, fullName: string): PlannerMonthlyRow {
  return {
    uid,
    fullName,
    entered: 0,
    shot: 0,
    cancelled: 0,
    agreedAmountKurus: 0,
  }
}

function reportShootMinutes(report: ReporterDailyReport): number {
  if (!Array.isArray(report.companies)) return 0
  return report.companies.reduce(
    (sum, company) => sum + Math.max(0, Number(company.shootMinutes ?? 0)),
    0,
  )
}

/** Haber kısmından kazanılan tutar (şirket bazlı newsTotalKurus). */
function reportNewsIncomeKurus(report: ReporterDailyReport): number {
  if (!Array.isArray(report.companies)) return 0
  return report.companies.reduce((sum, company) => {
    if (!company.hasNews) return sum
    return sum + Math.max(0, Number(company.newsTotalKurus ?? 0))
  }, 0)
}

async function fetchJobsInCreatedRange(
  start: Timestamp,
  end: Timestamp,
): Promise<JobDocument[]> {
  const snap = await getDocs(
    query(
      jobsCollection(),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      orderBy('createdAt', 'desc'),
      limit(MONTHLY_FETCH_LIMIT),
    ),
  )
  return snap.docs.map((d) => d.data())
}

async function fetchJobsByStatusUpdatedRange(
  status: 'shot' | 'cancelled',
  start: Timestamp,
  end: Timestamp,
): Promise<JobDocument[]> {
  const snap = await getDocs(
    query(
      jobsCollection(),
      where('status', '==', status),
      where('updatedAt', '>=', start),
      where('updatedAt', '<=', end),
      orderBy('updatedAt', 'desc'),
      limit(MONTHLY_FETCH_LIMIT),
    ),
  )
  return snap.docs.map((d) => d.data())
}

async function fetchReceivedJobsInRange(
  start: Timestamp,
  end: Timestamp,
): Promise<JobDocument[]> {
  const snap = await getDocs(
    query(
      jobsCollection(),
      where('status', 'in', ['approved', 'shot', 'cancelled']),
      where('reviewedAt', '>=', start),
      where('reviewedAt', '<=', end),
      orderBy('reviewedAt', 'desc'),
      limit(MONTHLY_FETCH_LIMIT),
    ),
  )
  return snap.docs.map((d) => d.data())
}

/**
 * Ayın muhabir raporları. Önce `reportDate` aralığı; index/kural hatasında
 * son kayıtlar üzerinden istemci filtresi.
 */
async function fetchReportsForMonth(
  startDate: string,
  endDate: string,
): Promise<ReporterDailyReport[]> {
  const col = collection(getDb(), 'reporterDailyReports')

  try {
    const snap = await getDocs(
      query(
        col,
        where('reportDate', '>=', startDate),
        where('reportDate', '<=', endDate),
        orderBy('reportDate', 'asc'),
        limit(MONTHLY_FETCH_LIMIT),
      ),
    )
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ReporterDailyReport, 'id'>) }))
      .filter((r) => r.deletedAt == null)
  } catch {
    const snap = await getDocs(
      query(col, orderBy('createdAt', 'desc'), limit(MONTHLY_FETCH_LIMIT)),
    )
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ReporterDailyReport, 'id'>) }))
      .filter((r) => {
        if (r.deletedAt != null) return false
        const reportDate = resolveReportDate(r)
        return reportDate >= startDate && reportDate <= endDate
      })
  }
}

export async function fetchMonthlyStats(
  yearMonth: YearMonth,
  activePlanners: UserProfile[],
): Promise<MonthlyStatsResult> {
  const { startDate, endDate } = monthDateBounds(yearMonth)
  const start = dayStart(startDate)
  const end = dayEnd(endDate)

  const [entered, received, shot, cancelled, reports] = await Promise.all([
    fetchJobsInCreatedRange(start, end),
    fetchReceivedJobsInRange(start, end),
    fetchJobsByStatusUpdatedRange('shot', start, end),
    fetchJobsByStatusUpdatedRange('cancelled', start, end),
    fetchReportsForMonth(startDate, endDate),
  ])

  let shootMinutes = 0
  let totalNewsIncomeKurus = 0
  let totalIncomeKurus = 0
  let totalExpenseKurus = 0
  let totalFieldPaidKurus = 0

  for (const report of reports) {
    shootMinutes += reportShootMinutes(report)
    totalNewsIncomeKurus += reportNewsIncomeKurus(report)
    totalIncomeKurus += reportIncomeKurus(report)
    totalExpenseKurus += reportExpenseKurus(report)
    totalFieldPaidKurus += Math.max(0, Number(report.fieldPaidKurus ?? 0))
  }

  const byUid = new Map<string, PlannerMonthlyRow>()

  for (const planner of activePlanners) {
    byUid.set(
      planner.uid,
      emptyPlannerBucket(planner.uid, planner.fullName || planner.email || planner.uid),
    )
  }

  function ensureRow(job: JobDocument): PlannerMonthlyRow {
    const existing = byUid.get(job.createdByUid)
    if (existing) return existing
    const row = emptyPlannerBucket(
      job.createdByUid,
      job.createdByNameSnapshot || job.createdByUid,
    )
    byUid.set(job.createdByUid, row)
    return row
  }

  for (const job of entered) {
    const row = ensureRow(job)
    row.entered += 1
    row.agreedAmountKurus += Math.max(0, Number(job.agreedAmountKurus ?? 0))
  }
  for (const job of shot) {
    ensureRow(job).shot += 1
  }
  for (const job of cancelled) {
    ensureRow(job).cancelled += 1
  }

  const planners = [...byUid.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, 'tr'),
  )

  const totals = planners.reduce(
    (acc, row) => {
      acc.entered += row.entered
      acc.shot += row.shot
      acc.cancelled += row.cancelled
      acc.agreedAmountKurus += row.agreedAmountKurus
      return acc
    },
    { entered: 0, shot: 0, cancelled: 0, agreedAmountKurus: 0 },
  )

  return {
    yearMonth,
    org: {
      jobsEntered: entered.length,
      jobsReceived: received.length,
      jobsShot: shot.length,
      jobsCancelled: cancelled.length,
      shootMinutes,
      totalNewsIncomeKurus,
      totalIncomeKurus,
      totalExpenseKurus,
      totalFieldPaidKurus,
      cashBalanceKurus: totalFieldPaidKurus - totalExpenseKurus,
      reportCount: reports.length,
    },
    planners,
    totals,
  }
}
