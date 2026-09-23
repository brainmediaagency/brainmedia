import {
  collection,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { jobDocRef, jobsCollection } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import type {
  ReporterDailyCompany,
  ReporterDailyReport,
} from '@/features/reporter/types/reporter'
import type { UserProfile } from '@/features/users/types/user'
import { getDb } from '@/lib/firebase/firestore'
import { mapAppError, UserFacingError } from '@/lib/errors'

const REPORT_PAGE_SIZE = 500
const JOB_PAGE_SIZE = 500
const JOB_IN_CHUNK = 30

/** Enough for all historical MPU accounts (active + frozen). */
export const MEDIA_PLANNER_EMPLOYEES_FETCH_LIMIT = 500

export type MediaPlannerEmployeeRow = {
  uid: string
  fullName: string
  email: string
  isActive: boolean
  /** Soft-deleted profile (Hesaplar → silindi). */
  isDeleted: boolean
  /** İşler: approved + shot + cancelled (konfirme sonrası stok; rejected hariç) */
  confirmedCount: number
  /** İşler: status === shot */
  shotCount: number
  /** İşler: status === cancelled (yalnızca konfirme sonrası iptal) */
  cancelledCount: number
  /** Günlük raporlardaki çekim dakikası toplamı (MPU’nun işleri) */
  totalShootMinutes: number
  /** Haber satılan işlerden newsTotalKurus toplamı (kuruş) */
  totalNewsIncomeKurus: number
}

export type JobReportFees = {
  shootMinutes: number
  newsIncomeKurus: number
}

export type MpuReportTotals = {
  shootMinutes: number
  newsIncomeKurus: number
}

export type MpuJobCounts = {
  confirmedCount: number
  shotCount: number
  cancelledCount: number
}

export function emptyEmployeeRow(
  planner: Pick<
    UserProfile,
    'uid' | 'fullName' | 'email' | 'isActive' | 'deletedAt'
  >,
): MediaPlannerEmployeeRow {
  const isDeleted = planner.deletedAt != null
  return {
    uid: planner.uid,
    fullName: planner.fullName || planner.email || planner.uid,
    email: planner.email,
    isActive: !isDeleted && planner.isActive !== false,
    isDeleted,
    confirmedCount: 0,
    shotCount: 0,
    cancelledCount: 0,
    totalShootMinutes: 0,
    totalNewsIncomeKurus: 0,
  }
}

export function orphanEmployeeRow(input: {
  uid: string
  fullName?: string | null
  email?: string | null
}): MediaPlannerEmployeeRow {
  return {
    uid: input.uid,
    fullName: (input.fullName ?? '').trim() || input.uid,
    email: (input.email ?? '').trim(),
    isActive: false,
    isDeleted: true,
    confirmedCount: 0,
    shotCount: 0,
    cancelledCount: 0,
    totalShootMinutes: 0,
    totalNewsIncomeKurus: 0,
  }
}

export function companyNewsIncomeKurus(
  company: Pick<ReporterDailyCompany, 'cancelled' | 'hasNews' | 'newsTotalKurus'>,
): number {
  if (company.cancelled === true) return 0
  if (company.hasNews !== true) return 0
  if (company.newsTotalKurus == null) return 0
  return Math.max(0, Math.floor(Number(company.newsTotalKurus) || 0))
}

/** jobId → report fees (latest non-cancelled company entry wins). */
export function indexReportFeesByJobId(
  reports: Array<Pick<ReporterDailyReport, 'companies'>>,
): Map<string, JobReportFees> {
  const map = new Map<string, JobReportFees>()
  for (const report of reports) {
    for (const company of report.companies ?? []) {
      const jobId = String(company.jobId ?? '').trim()
      if (!jobId) continue
      // Cancelled rows never lock fees; a later valid row may still win.
      if (company.cancelled === true) continue
      map.set(jobId, {
        shootMinutes: Math.max(0, Math.floor(Number(company.shootMinutes ?? 0))),
        newsIncomeKurus: companyNewsIncomeKurus(company),
      })
    }
  }
  return map
}

export function aggregateReportFeesByMpu(
  feesByJobId: Map<string, JobReportFees>,
  jobs: Array<Pick<JobDocument, 'id' | 'createdByUid'>>,
): Map<string, MpuReportTotals> {
  const byMpu = new Map<string, MpuReportTotals>()
  for (const job of jobs) {
    const fees = feesByJobId.get(job.id)
    if (!fees) continue
    if (fees.shootMinutes <= 0 && fees.newsIncomeKurus <= 0) continue
    const uid = String(job.createdByUid ?? '').trim()
    if (!uid) continue
    const existing = byMpu.get(uid) ?? { shootMinutes: 0, newsIncomeKurus: 0 }
    existing.shootMinutes += fees.shootMinutes
    existing.newsIncomeKurus += fees.newsIncomeKurus
    byMpu.set(uid, existing)
  }
  return byMpu
}

export function aggregateJobCountsByMpu(
  jobs: Array<Pick<JobDocument, 'createdByUid' | 'status'>>,
): Map<string, MpuJobCounts> {
  const byMpu = new Map<string, MpuJobCounts>()
  for (const job of jobs) {
    const uid = String(job.createdByUid ?? '').trim()
    if (!uid) continue
    if (
      job.status !== 'approved' &&
      job.status !== 'shot' &&
      job.status !== 'cancelled'
    ) {
      continue
    }
    const row = byMpu.get(uid) ?? {
      confirmedCount: 0,
      shotCount: 0,
      cancelledCount: 0,
    }
    row.confirmedCount += 1
    if (job.status === 'shot') row.shotCount += 1
    if (job.status === 'cancelled') row.cancelledCount += 1
    byMpu.set(uid, row)
  }
  return byMpu
}

export function buildEmployeeRows(
  planners: UserProfile[],
  totalsByMpu: Map<string, MpuReportTotals>,
  countsByMpu: Map<string, MpuJobCounts>,
  orphanSnapshots?: Map<
    string,
    { fullName?: string | null; email?: string | null }
  >,
): MediaPlannerEmployeeRow[] {
  const byUid = new Map<string, MediaPlannerEmployeeRow>()

  for (const planner of planners) {
    const row = emptyEmployeeRow(planner)
    const totals = totalsByMpu.get(planner.uid)
    const counts = countsByMpu.get(planner.uid)
    row.totalShootMinutes = totals?.shootMinutes ?? 0
    row.totalNewsIncomeKurus = totals?.newsIncomeKurus ?? 0
    row.confirmedCount = counts?.confirmedCount ?? 0
    row.shotCount = counts?.shotCount ?? 0
    row.cancelledCount = counts?.cancelledCount ?? 0
    byUid.set(planner.uid, row)
  }

  // Hard-deleted profiles: keep lifetime job/fee totals via job snapshots.
  const orphanUids = new Set<string>([
    ...countsByMpu.keys(),
    ...totalsByMpu.keys(),
  ])
  for (const uid of orphanUids) {
    if (byUid.has(uid)) continue
    const snap = orphanSnapshots?.get(uid)
    const row = orphanEmployeeRow({
      uid,
      fullName: snap?.fullName,
      email: snap?.email,
    })
    const totals = totalsByMpu.get(uid)
    const counts = countsByMpu.get(uid)
    row.totalShootMinutes = totals?.shootMinutes ?? 0
    row.totalNewsIncomeKurus = totals?.newsIncomeKurus ?? 0
    row.confirmedCount = counts?.confirmedCount ?? 0
    row.shotCount = counts?.shotCount ?? 0
    row.cancelledCount = counts?.cancelledCount ?? 0
    byUid.set(uid, row)
  }

  const rows = [...byUid.values()]
  rows.sort((a, b) => {
    // Aktif → donduruldu → silindi; her grupta A→Z.
    const rank = (row: { isActive: boolean; isDeleted: boolean }) =>
      row.isDeleted ? 2 : row.isActive ? 0 : 1
    const byStatus = rank(a) - rank(b)
    if (byStatus !== 0) return byStatus
    return a.fullName.localeCompare(b.fullName, 'tr')
  })

  return rows
}

async function fetchAllDailyReports(): Promise<ReporterDailyReport[]> {
  const col = collection(getDb(), 'reporterDailyReports')
  const out: ReporterDailyReport[] = []
  let cursor: QueryDocumentSnapshot | undefined

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const constraints = cursor
      ? [orderBy('createdAt', 'asc'), startAfter(cursor), limit(REPORT_PAGE_SIZE)]
      : [orderBy('createdAt', 'asc'), limit(REPORT_PAGE_SIZE)]
    const snap = await getDocs(query(col, ...constraints))
    if (snap.empty) break

    for (const d of snap.docs) {
      const data = d.data() as Omit<ReporterDailyReport, 'id'>
      if (data.deletedAt != null) continue
      out.push({ id: d.id, ...data })
    }

    if (snap.docs.length < REPORT_PAGE_SIZE) break
    cursor = snap.docs[snap.docs.length - 1]
  }

  return out
}

async function fetchJobsByStatus(
  status: 'approved' | 'shot' | 'cancelled',
): Promise<JobDocument[]> {
  const out: JobDocument[] = []
  let cursor: QueryDocumentSnapshot | undefined

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const constraints = cursor
      ? [
          where('status', '==', status),
          orderBy('updatedAt', 'desc'),
          startAfter(cursor),
          limit(JOB_PAGE_SIZE),
        ]
      : [where('status', '==', status), orderBy('updatedAt', 'desc'), limit(JOB_PAGE_SIZE)]
    const snap = await getDocs(query(jobsCollection(), ...constraints))
    if (snap.empty) break
    out.push(...snap.docs.map((d) => d.data()))
    if (snap.docs.length < JOB_PAGE_SIZE) break
    cursor = snap.docs[snap.docs.length - 1]
  }

  return out
}

async function fetchJobsByIds(jobIds: string[]): Promise<JobDocument[]> {
  const unique = [...new Set(jobIds.filter(Boolean))]
  if (unique.length === 0) return []

  const out: JobDocument[] = []

  for (let i = 0; i < unique.length; i += JOB_IN_CHUNK) {
    const chunk = unique.slice(i, i + JOB_IN_CHUNK)
    try {
      const snap = await getDocs(
        query(jobsCollection(), where(documentId(), 'in', chunk)),
      )
      out.push(...snap.docs.map((d) => d.data()))
    } catch {
      const docs = await Promise.all(
        chunk.map(async (jobId) => {
          const snap = await getDoc(jobDocRef(jobId))
          return snap.exists() ? snap.data() : null
        }),
      )
      for (const job of docs) {
        if (job) out.push(job)
      }
    }
  }

  return out
}

/**
 * Lifetime MPU employee summary for management / coordinator.
 * Job counts come from live `jobs` docs (not denormalized user.stats — those
 * drift when muhabir günlük rapor shot stats write is best-effort).
 * Shoot minutes + haber geliri come from daily reports joined to jobs.
 */
export async function fetchMediaPlannerEmployees(
  planners: UserProfile[],
): Promise<MediaPlannerEmployeeRow[]> {
  try {
    if (planners.length === 0) return []

    const [reports, approved, shot, cancelled] = await Promise.all([
      fetchAllDailyReports(),
      fetchJobsByStatus('approved'),
      fetchJobsByStatus('shot'),
      fetchJobsByStatus('cancelled'),
    ])

    const feesByJobId = indexReportFeesByJobId(reports)
    const feeJobs = await fetchJobsByIds([...feesByJobId.keys()])
    const allJobs = [...approved, ...shot, ...cancelled]
    const totalsByMpu = aggregateReportFeesByMpu(feesByJobId, feeJobs)
    const countsByMpu = aggregateJobCountsByMpu(allJobs)

    const plannerUids = new Set(planners.map((p) => p.uid))
    const orphanSnapshots = new Map<
      string,
      { fullName?: string | null; email?: string | null }
    >()
    for (const job of [...allJobs, ...feeJobs]) {
      const uid = String(job.createdByUid ?? '').trim()
      if (!uid || plannerUids.has(uid) || orphanSnapshots.has(uid)) continue
      orphanSnapshots.set(uid, {
        fullName: job.createdByNameSnapshot,
        email: job.createdByEmailSnapshot,
      })
    }

    return buildEmployeeRows(
      planners,
      totalsByMpu,
      countsByMpu,
      orphanSnapshots,
    )
  } catch (error) {
    throw new UserFacingError(
      mapAppError(error, 'Çalışan özeti yüklenemedi.'),
    )
  }
}
