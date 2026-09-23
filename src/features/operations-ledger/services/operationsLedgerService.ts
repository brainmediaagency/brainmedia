import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import type { JobStatus } from '@/config/roles'
import { jobsCollection, jobPlannedDay } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  LEDGER_STATUS_LABELS,
  LEDGER_VISIBLE_STATUSES,
  type OperationsLedgerFilters,
  type OperationsLedgerRow,
} from '@/features/operations-ledger/types/operationsLedger'
import type { ReporterDailyCompany, ReporterDailyReport } from '@/features/reporter/types/reporter'
import { getDb } from '@/lib/firebase/firestore'
import {
  isValidYearMonth,
  lastDayOfMonthDateOnly,
  shiftYearMonth,
} from '@/lib/date'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { formatJobCreatorPrimary } from '@/features/jobs/utils/formatJobCreator'

const FETCH_LIMIT = 2000

export type JobLedgerMeta = {
  jobId: string
  invoiceNote: string
  updatedAt: unknown
  updatedByUid: string
  updatedByNameSnapshot: string
}

export function calendarMonthBounds(yearMonth: string): {
  startDate: string
  endExclusive: string
  endInclusive: string
} {
  if (!isValidYearMonth(yearMonth)) {
    throw new UserFacingError('Geçerli bir ay seçin.')
  }
  return {
    startDate: `${yearMonth}-01`,
    endExclusive: `${shiftYearMonth(yearMonth, 1)}-01`,
    endInclusive: lastDayOfMonthDateOnly(yearMonth),
  }
}

function companyFees(company: ReporterDailyCompany): {
  shootMinutes: number | null
  haberKurus: number | null
  kazancKurus: number | null
} {
  if (company.cancelled === true) {
    return { shootMinutes: null, haberKurus: null, kazancKurus: null }
  }
  const shootMinutes = Math.max(0, Number(company.shootMinutes ?? 0))
  const haberKurus =
    company.hasNews && company.newsTotalKurus != null
      ? Math.max(0, Number(company.newsTotalKurus) || 0)
      : null
  const kazancKurus =
    Math.max(0, Number(company.vatBaseKurus) || 0) +
    Math.max(0, Number(company.vatKurus) || 0)
  return {
    shootMinutes,
    haberKurus,
    kazancKurus: kazancKurus > 0 ? kazancKurus : null,
  }
}

export function buildOperationsLedgerRow(
  job: JobDocument,
  company: ReporterDailyCompany | null,
  invoiceNote = '',
): OperationsLedgerRow {
  const fees = company ? companyFees(company) : null
  return {
    jobId: job.id,
    plannedDay: jobPlannedDay(job),
    plannedExecutionDate: job.plannedExecutionDate,
    companyName: job.companyName,
    contactPersonName: job.contactPersonName,
    contactPhone: job.contactPhone,
    province: job.province,
    mpuName: formatJobCreatorPrimary(job),
    mpuUid: job.createdByUid,
    status: job.status,
    statusLabel: LEDGER_STATUS_LABELS[job.status],
    shootMinutes: fees?.shootMinutes ?? null,
    haberKurus: fees?.haberKurus ?? null,
    kazancKurus: fees?.kazancKurus ?? null,
    dailyReportId: job.dailyReportId,
    invoiceNote,
    agreedAmountKurus: Math.max(0, Number(job.agreedAmountKurus) || 0),
  }
}

async function fetchJobsForCalendarMonth(yearMonth: string): Promise<JobDocument[]> {
  const { startDate, endExclusive } = calendarMonthBounds(yearMonth)
  try {
    const snap = await getDocs(
      query(
        jobsCollection(),
        where('plannedExecutionDate', '>=', startDate),
        where('plannedExecutionDate', '<', endExclusive),
        orderBy('plannedExecutionDate', 'desc'),
        limit(FETCH_LIMIT),
      ),
    )
    return snap.docs.map((d) => d.data())
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Operasyon defteri işleri yüklenemedi.'))
  }
}

async function fetchReportsForCalendarMonth(
  yearMonth: string,
): Promise<ReporterDailyReport[]> {
  const { startDate, endInclusive } = calendarMonthBounds(yearMonth)
  try {
    const snap = await getDocs(
      query(
        collection(getDb(), 'reporterDailyReports'),
        where('reportDate', '>=', startDate),
        where('reportDate', '<=', endInclusive),
        orderBy('reportDate', 'asc'),
        limit(FETCH_LIMIT),
      ),
    )
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ReporterDailyReport, 'id'>) }))
      .filter((r) => r.deletedAt == null)
  } catch (error) {
    throw new UserFacingError(
      mapAppError(error, 'Operasyon defteri raporları yüklenemedi.'),
    )
  }
}

function indexCompaniesByJobId(
  reports: ReporterDailyReport[],
): Map<string, ReporterDailyCompany> {
  const map = new Map<string, ReporterDailyCompany>()
  for (const report of reports) {
    for (const company of report.companies ?? []) {
      const jobId = String(company.jobId ?? '').trim()
      if (!jobId || map.has(jobId)) continue
      map.set(jobId, company)
    }
  }
  return map
}

export async function fetchJobLedgerMetaMap(
  jobIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(jobIds.filter(Boolean))]
  const out = new Map<string, string>()
  if (unique.length === 0) return out

  const db = getDb()
  const chunkSize = 40
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const docs = await Promise.all(
      chunk.map(async (jobId) => {
        const snap = await getDoc(doc(db, 'jobLedgerMeta', jobId))
        return [jobId, snap] as const
      }),
    )
    for (const [jobId, snap] of docs) {
      if (!snap.exists()) continue
      const note = String(snap.data().invoiceNote ?? '').trim()
      if (note) out.set(jobId, note)
    }
  }
  return out
}

export async function fetchOperationsLedger(
  filters: OperationsLedgerFilters,
): Promise<OperationsLedgerRow[]> {
  const [jobs, reports] = await Promise.all([
    fetchJobsForCalendarMonth(filters.yearMonth),
    fetchReportsForCalendarMonth(filters.yearMonth),
  ])
  const companyByJobId = indexCompaniesByJobId(reports)
  const invoiceByJobId = await fetchJobLedgerMetaMap(jobs.map((j) => j.id))

  const statusFilter = filters.status && filters.status !== 'all' ? filters.status : null
  const mpuFilter = filters.mpuUid && filters.mpuUid !== 'all' ? filters.mpuUid : null
  const search = filters.search?.trim().toLocaleLowerCase('tr-TR') ?? ''

  const rows = jobs
    .filter((job) => {
      if (job.status === 'rejected') return false
      if (statusFilter && job.status !== statusFilter) return false
      if (mpuFilter && job.createdByUid !== mpuFilter) return false
      if (search) {
        const hay = `${job.companyName} ${job.contactPersonName} ${job.contactPhone} ${job.province}`
          .toLocaleLowerCase('tr-TR')
        if (!hay.includes(search)) return false
      }
      return true
    })
    .map((job) =>
      buildOperationsLedgerRow(
        job,
        companyByJobId.get(job.id) ?? null,
        invoiceByJobId.get(job.id) ?? '',
      ),
    )

  return sortLedgerRowsNewestFirst(rows)
}

export async function upsertJobInvoiceNote(args: {
  jobId: string
  invoiceNote: string
  actor: { uid: string; fullName: string }
}): Promise<void> {
  const jobId = args.jobId.trim()
  if (!jobId) throw new UserFacingError('İş bulunamadı.')
  const invoiceNote = args.invoiceNote.trim().slice(0, 500)
  try {
    await setDoc(
      doc(getDb(), 'jobLedgerMeta', jobId),
      {
        invoiceNote,
        updatedAt: serverTimestamp(),
        updatedByUid: args.actor.uid,
        updatedByNameSnapshot: args.actor.fullName.trim().slice(0, 120),
      },
      { merge: true },
    )
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Fatura notu kaydedilemedi.'))
  }
}

export function listLedgerMpuOptions(
  rows: OperationsLedgerRow[],
): Array<{ uid: string; name: string }> {
  const map = new Map<string, string>()
  for (const row of rows) {
    if (!map.has(row.mpuUid)) map.set(row.mpuUid, row.mpuName)
  }
  return [...map.entries()]
    .map(([uid, name]) => ({ uid, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

export function isLedgerJobStatus(value: string): value is JobStatus {
  return value in LEDGER_STATUS_LABELS
}

export function isLedgerVisibleStatus(value: string): value is JobStatus {
  return (LEDGER_VISIBLE_STATUSES as string[]).includes(value)
}

/** Client-side sort helper: newest planned day/time first. */
export function sortLedgerRowsNewestFirst(
  rows: OperationsLedgerRow[],
): OperationsLedgerRow[] {
  return [...rows].sort((a, b) => {
    const byDay = b.plannedDay.localeCompare(a.plannedDay)
    if (byDay !== 0) return byDay
    const bySchedule = b.plannedExecutionDate.localeCompare(a.plannedExecutionDate)
    if (bySchedule !== 0) return bySchedule
    return a.companyName.localeCompare(b.companyName, 'tr')
  })
}
