import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  updateDoc,
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Transaction,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import type { ReporterDailyCompany, ReporterDailyReport } from '@/features/reporter/types/reporter'
import { isVatRate, type VatRate } from '@/features/reporter/utils/feeCalc'
import { COMPANY_TIMEZONE } from '@/config/roles'
import { UserFacingError, mapAppError } from '@/lib/errors'
import {
  expandStatsQueryDateRange,
  isDateOnlyInStatsRange,
  isValidDateOnly,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { formatInTimeZone } from 'date-fns-tz'
import {
  notifyManagement,
  notifyUser,
} from '@/features/notifications/services/notificationService'
import { writeActivityLog } from '@/features/activity-log/services/activityLogService'
import {
  applyCompanyCashContributionDelta,
  reportCashParts,
} from '@/features/cash/services/companyCashService'
import { getStatsDelta } from '@/features/jobs/utils/jobTransitions'
import { DAILY_REPORT_CANCEL_NOTE } from '@/features/jobs/services/jobService'

/** Firestore rules expect non-negative whole numbers (int or whole float). */
function toKurusInt(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.trunc(Math.max(0, value))
}

function parseVatRate(value: unknown): VatRate {
  const n = Number(value)
  return isVatRate(n) ? n : 20
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Prefer stored reportDate; fall back to createdAt (Istanbul day). */
function resolveReportDate(data: DocumentData): string {
  const raw = data.reportDate
  if (typeof raw === 'string' && isValidDateOnly(raw)) return raw
  const createdAt = data.createdAt
  if (createdAt && typeof createdAt.toDate === 'function') {
    return formatInTimeZone(createdAt.toDate(), COMPANY_TIMEZONE, 'yyyy-MM-dd')
  }
  return todayDateOnlyIstanbul()
}

function sanitizeCompany(company: ReporterDailyCompany): ReporterDailyCompany {
  if (company.cancelled === true) {
    return {
      jobId: String(company.jobId ?? '').trim(),
      companyName: company.companyName.trim(),
      cancelled: true,
      hasNews: false,
      newsTotalKurus: null,
      newsReporterFeeKurus: null,
      newsCameramanFeeKurus: null,
      shootMinutes: 0,
      shootReporterFeeKurus: 0,
      shootCameramanFeeKurus: 0,
      vatRate: parseVatRate(company.vatRate),
      vatBaseKurus: 0,
      vatKurus: 0,
      chargeMode: 'cash',
    }
  }
  const hasNews = Boolean(company.hasNews)
  return {
    jobId: String(company.jobId ?? '').trim(),
    companyName: company.companyName.trim(),
    cancelled: false,
    hasNews,
    newsTotalKurus: hasNews ? toKurusInt(company.newsTotalKurus ?? 0) : null,
    newsReporterFeeKurus: hasNews ? toKurusInt(company.newsReporterFeeKurus ?? 0) : null,
    newsCameramanFeeKurus: hasNews ? toKurusInt(company.newsCameramanFeeKurus ?? 0) : null,
    shootMinutes: toKurusInt(company.shootMinutes),
    shootReporterFeeKurus: toKurusInt(company.shootReporterFeeKurus),
    shootCameramanFeeKurus: toKurusInt(company.shootCameramanFeeKurus),
    vatRate: parseVatRate(company.vatRate),
    vatBaseKurus: toKurusInt(company.vatBaseKurus),
    vatKurus: toKurusInt(company.vatKurus),
    chargeMode: company.chargeMode === 'cash' ? 'cash' : 'vat',
  }
}

const converter: FirestoreDataConverter<ReporterDailyReport> = {
  toFirestore(report: ReporterDailyReport): DocumentData {
    const { id: _id, ...rest } = report
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): ReporterDailyReport {
    const data = snapshot.data(options)
    const companiesRaw = Array.isArray(data.companies) ? data.companies : []
    const hotelExpenseKurus = Number(data.hotelExpenseKurus ?? 0)
    const stationeryExpenseKurus = Number(data.stationeryExpenseKurus ?? 0)
    const fuelExpenseKurus = Number(data.fuelExpenseKurus ?? 0)
    const mealExpenseKurus = Number(data.mealExpenseKurus ?? 0)
    const extraExpenseKurus = Number(data.extraExpenseKurus ?? 0)
    const totalReporterEarningsKurus = Number(data.totalReporterEarningsKurus ?? 0)
    const totalCameramanEarningsKurus = Number(data.totalCameramanEarningsKurus ?? 0)
    const totalVatKurus = Number(data.totalVatKurus ?? 0)
    const operatingExpenseKurus = Number(
      data.operatingExpenseKurus ??
        hotelExpenseKurus +
          stationeryExpenseKurus +
          fuelExpenseKurus +
          mealExpenseKurus +
          extraExpenseKurus,
    )
    const employeeExpenseKurus = Number(
      data.employeeExpenseKurus ?? totalReporterEarningsKurus + totalCameramanEarningsKurus,
    )
    const companies = companiesRaw.map((item) => {
      const c = item as Record<string, unknown>
      const hasNews =
        typeof c.hasNews === 'boolean'
          ? c.hasNews
          : c.workType === 'news' || c.workType === 'both'
      return {
        jobId: String(c.jobId ?? ''),
        companyName: String(c.companyName ?? ''),
        cancelled: c.cancelled === true,
        hasNews,
        newsTotalKurus: nullableNumber(c.newsTotalKurus),
        newsReporterFeeKurus: nullableNumber(c.newsReporterFeeKurus),
        newsCameramanFeeKurus: nullableNumber(c.newsCameramanFeeKurus),
        shootMinutes: Number(c.shootMinutes ?? 0),
        shootReporterFeeKurus: Number(c.shootReporterFeeKurus ?? 0),
        shootCameramanFeeKurus: Number(c.shootCameramanFeeKurus ?? 0),
        vatRate: parseVatRate(c.vatRate),
        vatBaseKurus: Number(c.vatBaseKurus ?? 0),
        vatKurus: Number(c.vatKurus ?? 0),
        chargeMode: (c.chargeMode === 'cash' ? 'cash' : 'vat') as 'vat' | 'cash',
      }
    })
    const incomeFromCompanies = companies.reduce(
      (sum, company) => sum + company.vatBaseKurus + company.vatKurus,
      0,
    )
    return {
      id: snapshot.id,
      reportDate: resolveReportDate(data),
      leaveDayCash: data.leaveDayCash === true,
      companyCount: Number(data.companyCount ?? 0),
      companies,
      note: String(data.note ?? ''),
      hotelExpenseKurus,
      stationeryExpenseKurus,
      fuelExpenseKurus,
      mealExpenseKurus,
      extraExpenseKurus,
      operatingExpenseKurus,
      employeeExpenseKurus,
      totalExpenseKurus: Number(
        data.totalExpenseKurus ?? operatingExpenseKurus + employeeExpenseKurus,
      ),
      earningsKurus: Number(data.earningsKurus ?? incomeFromCompanies),
      fieldPaidKurus: Number(data.fieldPaidKurus ?? 0),
      totalReporterEarningsKurus,
      totalCameramanEarningsKurus,
      totalVatKurus,
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdByEmailSnapshot: String(data.createdByEmailSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
      editVersion: Number(data.editVersion ?? 0),
      updatedByUid: String(data.updatedByUid ?? ''),
      updatedByNameSnapshot: String(data.updatedByNameSnapshot ?? ''),
      deletedAt: data.deletedAt ?? null,
      deletedByUid:
        data.deletedByUid === null || data.deletedByUid === undefined
          ? null
          : String(data.deletedByUid),
      deletedByNameSnapshot:
        data.deletedByNameSnapshot === null ||
        data.deletedByNameSnapshot === undefined
          ? null
          : String(data.deletedByNameSnapshot),
    }
  },
}

function reportsCollection() {
  return collection(getDb(), 'reporterDailyReports').withConverter(converter)
}

function reportDocRef(reportId: string) {
  return doc(getDb(), 'reporterDailyReports', reportId).withConverter(converter)
}

function dayStart(dateOnly: string) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEnd(dateOnly: string) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return Timestamp.fromDate(new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

export type DailyReportWriteInput = {
  reportDate: string
  leaveDayCash?: boolean
  companies: ReporterDailyCompany[]
  note: string
  hotelExpenseKurus: number
  stationeryExpenseKurus: number
  fuelExpenseKurus: number
  mealExpenseKurus: number
  extraExpenseKurus: number
  fieldPaidKurus: number
  totalReporterEarningsKurus: number
  totalCameramanEarningsKurus: number
  totalVatKurus: number
}

export type DailyReportActor = {
  uid: string
  name: string
  role: 'reporter' | 'coordinator' | 'management'
}

/**
 * Build a rules-safe payload: truncated kuruş ints + earnings = matrah + KDV.
 */
function reportContent(input: DailyReportWriteInput) {
  if (!isValidDateOnly(input.reportDate)) {
    throw new UserFacingError('Geçerli bir rapor tarihi seçin.')
  }
  const leaveDayCash = input.leaveDayCash === true
  const companies = leaveDayCash ? [] : input.companies.map(sanitizeCompany)
  if (!leaveDayCash && companies.length < 1) {
    throw new UserFacingError('En az bir firma gerekli.')
  }
  const hotelExpenseKurus = toKurusInt(input.hotelExpenseKurus)
  const stationeryExpenseKurus = toKurusInt(input.stationeryExpenseKurus)
  const fuelExpenseKurus = toKurusInt(input.fuelExpenseKurus)
  const mealExpenseKurus = toKurusInt(input.mealExpenseKurus)
  const extraExpenseKurus = toKurusInt(input.extraExpenseKurus)
  const fieldPaidKurus = toKurusInt(input.fieldPaidKurus)
  const totalReporterEarningsKurus = toKurusInt(input.totalReporterEarningsKurus)
  const totalCameramanEarningsKurus = toKurusInt(input.totalCameramanEarningsKurus)
  const totalVatKurus = toKurusInt(
    companies.reduce((sum, company) => sum + company.vatKurus, 0),
  )
  const vatBaseKurus = toKurusInt(
    companies.reduce((sum, company) => sum + company.vatBaseKurus, 0),
  )
  const operatingExpenseKurus =
    hotelExpenseKurus +
    stationeryExpenseKurus +
    fuelExpenseKurus +
    mealExpenseKurus +
    extraExpenseKurus
  const employeeExpenseKurus = totalReporterEarningsKurus + totalCameramanEarningsKurus
  // Toplam gider = saha giderleri + ücretler (KDV gelire eklenir, gidere değil)
  const totalExpenseKurus = operatingExpenseKurus + employeeExpenseKurus
  const earningsKurus = vatBaseKurus + totalVatKurus

  return {
    reportDate: input.reportDate,
    leaveDayCash,
    companyCount: companies.length,
    companies,
    note: input.note.trim(),
    hotelExpenseKurus,
    stationeryExpenseKurus,
    fuelExpenseKurus,
    mealExpenseKurus,
    extraExpenseKurus,
    fieldPaidKurus,
    totalReporterEarningsKurus,
    totalCameramanEarningsKurus,
    totalVatKurus,
    operatingExpenseKurus,
    employeeExpenseKurus,
    totalExpenseKurus,
    earningsKurus,
  }
}

const JOB_ALREADY_REPORTED_TR = 'Bu iş için zaten günlük rapor girilmiş.'

function uniqueCompanyJobIds(
  companies: Array<{ jobId?: string | null }>,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const company of companies) {
    const jobId = String(company.jobId ?? '').trim()
    if (!jobId || seen.has(jobId)) continue
    seen.add(jobId)
    out.push(jobId)
  }
  return out
}

function reportActivityJobFields(
  companies: Array<{ jobId?: string | null; companyName?: string }>,
): { jobId: string | null; jobCompanyName: string | null } {
  const jobIds = uniqueCompanyJobIds(companies)
  if (jobIds.length !== 1) {
    return { jobId: null, jobCompanyName: null }
  }
  const jobId = jobIds[0]!
  const company = companies.find(
    (item) => String(item.jobId ?? '').trim() === jobId,
  )
  return {
    jobId,
    jobCompanyName: company?.companyName?.trim() || null,
  }
}

function reportActivitySummary(
  reportDate: string,
  companies: Array<{ companyName?: string }>,
  leaveDayCash: boolean,
): string {
  if (leaveDayCash) return `${reportDate} — izin günü kasası`
  const names = companies
    .map((item) => String(item.companyName ?? '').trim())
    .filter(Boolean)
    .slice(0, 3)
  return names.length > 0 ? `${reportDate} — ${names.join(', ')}` : reportDate
}

function jobClaimFromData(data: DocumentData | undefined): string | null {
  if (!data) return null
  const raw = data.dailyReportId
  if (raw === null || raw === undefined) return null
  const id = String(raw).trim()
  return id.length > 0 ? id : null
}

function plannedDayOfJob(data: DocumentData | undefined): string {
  const raw = String(data?.plannedExecutionDate ?? '').trim()
  if (raw.length >= 10) return raw.slice(0, 10)
  return ''
}

function assertJobClaimable(
  data: DocumentData | undefined,
  reportId: string,
  exists: boolean,
  reportDate: string,
): void {
  if (!exists) {
    throw new UserFacingError('Seçilen iş bulunamadı.')
  }
  const status = String(data?.status ?? '')
  if (status !== 'approved' && status !== 'shot') {
    throw new UserFacingError(
      'Yalnızca konfirme veya çekilmiş işler günlük rapora girilebilir.',
    )
  }
  if (plannedDayOfJob(data) !== reportDate) {
    throw new UserFacingError(
      'Seçilen işin çekim günü rapor tarihiyle eşleşmiyor. Rapor tarihini o işin gününe alın.',
    )
  }
  const claimedBy = jobClaimFromData(data)
  if (claimedBy != null && claimedBy !== reportId) {
    throw new UserFacingError(JOB_ALREADY_REPORTED_TR)
  }
}

type JobOutcomeEvent = {
  jobId: string
  companyName: string
  createdByUid: string
  toStatus: 'shot' | 'cancelled'
}

type OwnerStatsDelta = {
  ownerUid: string
  jobsShot: number
  jobsCancelled: number
}

/**
 * Claim job for this report and, when still approved, transition to shot/cancelled
 * in the same write so Firestore never leaves “claimed but still Konfirme”.
 */
function applyDailyReportJobOutcome(
  transaction: Transaction,
  args: {
    jobId: string
    jobData: DocumentData
    reportId: string
    cancelled: boolean
    actor: DailyReportActor
  },
): { event: JobOutcomeEvent | null; stats: OwnerStatsDelta | null } {
  const { jobId, jobData, reportId, cancelled, actor } = args
  const status = String(jobData.status ?? '')
  const claimedBy = jobClaimFromData(jobData)
  const needsClaim = claimedBy !== reportId
  const companyName = String(jobData.companyName ?? 'İş')
  const createdByUid = String(jobData.createdByUid ?? '')
  const jobRef = doc(getDb(), 'jobs', jobId)

  if (cancelled) {
    if (status === 'approved') {
      const nextVersion = Number(jobData.statusVersion ?? 0) + 1
      transaction.update(jobRef, {
        status: 'cancelled',
        statusVersion: nextVersion,
        updatedAt: serverTimestamp(),
        reviewNote: DAILY_REPORT_CANCEL_NOTE,
        dailyReportId: reportId,
      })
      transaction.set(doc(collection(getDb(), 'jobs', jobId, 'history')), {
        version: nextVersion,
        fromStatus: 'approved',
        toStatus: 'cancelled',
        actorUid: actor.uid,
        actorNameSnapshot: actor.name,
        actorRole: actor.role,
        note: DAILY_REPORT_CANCEL_NOTE,
        createdAt: serverTimestamp(),
      })
      const delta = getStatsDelta('approved', 'cancelled')
      return {
        event: { jobId, companyName, createdByUid, toStatus: 'cancelled' },
        stats:
          createdByUid && delta.jobsCancelled !== 0
            ? {
                ownerUid: createdByUid,
                jobsShot: 0,
                jobsCancelled: delta.jobsCancelled,
              }
            : null,
      }
    }
    if (needsClaim) {
      transaction.update(jobRef, {
        dailyReportId: reportId,
        updatedAt: serverTimestamp(),
      })
    }
    return { event: null, stats: null }
  }

  if (status === 'approved') {
    const nextVersion = Number(jobData.statusVersion ?? 0) + 1
    transaction.update(jobRef, {
      status: 'shot',
      statusVersion: nextVersion,
      updatedAt: serverTimestamp(),
      dailyReportId: reportId,
    })
    transaction.set(doc(collection(getDb(), 'jobs', jobId, 'history')), {
      version: nextVersion,
      fromStatus: 'approved',
      toStatus: 'shot',
      actorUid: actor.uid,
      actorNameSnapshot: actor.name,
      actorRole: actor.role,
      note: null,
      createdAt: serverTimestamp(),
    })
    const delta = getStatsDelta('approved', 'shot')
    return {
      event: { jobId, companyName, createdByUid, toStatus: 'shot' },
      stats:
        createdByUid && delta.jobsShot !== 0
          ? { ownerUid: createdByUid, jobsShot: delta.jobsShot, jobsCancelled: 0 }
          : null,
    }
  }

  if (needsClaim) {
    if (status !== 'shot' && status !== 'approved') {
      throw new UserFacingError(
        'Yalnızca konfirme veya çekilmiş işler günlük rapora girilebilir.',
      )
    }
    transaction.update(jobRef, {
      dailyReportId: reportId,
      updatedAt: serverTimestamp(),
    })
  }
  return { event: null, stats: null }
}

function mergeOwnerStats(
  into: Map<string, OwnerStatsDelta>,
  next: OwnerStatsDelta | null,
): void {
  if (!next) return
  const prev = into.get(next.ownerUid)
  if (!prev) {
    into.set(next.ownerUid, { ...next })
    return
  }
  prev.jobsShot += next.jobsShot
  prev.jobsCancelled += next.jobsCancelled
}

async function applyDeferredOwnerStats(
  statsByOwner: Map<string, OwnerStatsDelta>,
): Promise<void> {
  for (const stats of statsByOwner.values()) {
    const patch: Record<string, ReturnType<typeof increment> | ReturnType<typeof serverTimestamp>> =
      { updatedAt: serverTimestamp() }
    if (stats.jobsShot !== 0) patch['stats.jobsShot'] = increment(stats.jobsShot)
    if (stats.jobsCancelled !== 0) {
      patch['stats.jobsCancelled'] = increment(stats.jobsCancelled)
    }
    try {
      await updateDoc(doc(getDb(), 'users', stats.ownerUid), patch)
    } catch {
      /* best-effort — report/job already committed */
    }
  }
}

function notifyJobOutcomes(
  events: JobOutcomeEvent[],
  actor: DailyReportActor,
): void {
  for (const event of events) {
    if (event.toStatus === 'shot' && event.createdByUid) {
      void notifyUser({
        recipientUid: event.createdByUid,
        type: 'job_shot',
        title: `"${event.companyName}" işiniz çekildi olarak işaretlendi.`,
        body: '',
        link: '/media-planning',
        createdByUid: actor.uid,
        createdByNameSnapshot: actor.name,
      })
    }
    writeActivityLog({
      actor: {
        uid: actor.uid,
        fullName: actor.name,
        role: actor.role,
      },
      category: 'job',
      action: event.toStatus === 'shot' ? 'job.shot' : 'job.cancelled',
      summary:
        event.toStatus === 'shot'
          ? event.companyName
          : `${event.companyName} — ${DAILY_REPORT_CANCEL_NOTE}`,
      jobId: event.jobId,
      jobCompanyName: event.companyName,
      entityType: 'job',
      entityId: event.jobId,
    })
  }
}

export async function createDailyReport(input: DailyReportWriteInput & {
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
  actorRole?: DailyReportActor['role']
}): Promise<string> {
  try {
    const content = reportContent(input)
    const actor: DailyReportActor = {
      uid: input.createdByUid,
      name: input.createdByNameSnapshot,
      role: input.actorRole ?? 'reporter',
    }
    const companiesByJobId = new Map(
      content.companies
        .filter((c) => c.jobId.trim())
        .map((c) => [c.jobId.trim(), c] as const),
    )
    const jobIds = uniqueCompanyJobIds(content.companies)
    const ref = doc(collection(getDb(), 'reporterDailyReports'))
    const db = getDb()
    const outcomeEvents: JobOutcomeEvent[] = []
    const statsByOwner = new Map<string, OwnerStatsDelta>()

    await runTransaction(db, async (transaction) => {
      const jobSnaps = await Promise.all(
        jobIds.map((jobId) => transaction.get(doc(db, 'jobs', jobId))),
      )
      for (let i = 0; i < jobIds.length; i++) {
        const snap = jobSnaps[i]!
        assertJobClaimable(snap.data(), ref.id, snap.exists(), content.reportDate)
      }

      transaction.set(ref, {
        ...content,
        createdByUid: input.createdByUid,
        createdByNameSnapshot: input.createdByNameSnapshot,
        createdByEmailSnapshot: input.createdByEmailSnapshot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editVersion: 0,
        updatedByUid: input.createdByUid,
        updatedByNameSnapshot: input.createdByNameSnapshot,
        deletedAt: null,
        deletedByUid: null,
        deletedByNameSnapshot: null,
      })
      transaction.set(doc(ref, 'history', '0'), {
        action: 'create',
        version: 0,
        actorUid: input.createdByUid,
        actorNameSnapshot: input.createdByNameSnapshot,
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      })

      for (let i = 0; i < jobIds.length; i++) {
        const jobId = jobIds[i]!
        const company = companiesByJobId.get(jobId)
        if (!company) continue
        const result = applyDailyReportJobOutcome(transaction, {
          jobId,
          jobData: jobSnaps[i]!.data()!,
          reportId: ref.id,
          cancelled: company.cancelled === true,
          actor,
        })
        if (result.event) outcomeEvents.push(result.event)
        mergeOwnerStats(statsByOwner, result.stats)
      }
    })

    void applyDeferredOwnerStats(statsByOwner)
    notifyJobOutcomes(outcomeEvents, actor)

    void notifyManagement({
      type: 'daily_report',
      title: 'Muhabir günlük rapor / kasa',
      body: `${input.createdByNameSnapshot} — ${input.reportDate}${
        content.leaveDayCash ? ' (izin günü kasası)' : ''
      }`,
      link: '/reporter?tab=daily-reports',
      createdByUid: input.createdByUid,
      createdByNameSnapshot: input.createdByNameSnapshot,
      pushRoles: ['management', 'coordinator'],
    })

    void applyCompanyCashContributionDelta(reportCashParts(content), null).catch(
      () => {
        /* muhabir kasa snapshot best-effort */
      },
    )

    const jobFields = reportActivityJobFields(content.companies)
    writeActivityLog({
      actor: {
        uid: input.createdByUid,
        fullName: input.createdByNameSnapshot,
        role: actor.role,
      },
      category: 'report',
      action: 'report.created',
      summary: reportActivitySummary(
        content.reportDate,
        content.companies,
        content.leaveDayCash === true,
      ),
      jobId: jobFields.jobId,
      jobCompanyName: jobFields.jobCompanyName,
      entityType: 'daily_report',
      entityId: ref.id,
    })

    return ref.id
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Günlük rapor gönderilemedi.'))
  }
}

export async function updateDailyReport(
  reportId: string,
  input: DailyReportWriteInput,
  actor: DailyReportActor,
): Promise<void> {
  const db = getDb()
  const ref = doc(db, 'reporterDailyReports', reportId)
  try {
    let prevParts: ReturnType<typeof reportCashParts> | null = null
    let nextParts: ReturnType<typeof reportCashParts> | null = null
    const outcomeEvents: JobOutcomeEvent[] = []
    const statsByOwner = new Map<string, OwnerStatsDelta>()
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref)
      if (!snap.exists()) throw new UserFacingError('Rapor bulunamadı.')
      const current = snap.data()
      if (current.deletedAt != null) {
        throw new UserFacingError('Silinmiş rapor düzenlenemez.')
      }

      const content = reportContent(input)
      prevParts = reportCashParts(current)
      nextParts = reportCashParts(content)
      const companiesByJobId = new Map(
        content.companies
          .filter((c) => c.jobId.trim())
          .map((c) => [c.jobId.trim(), c] as const),
      )
      const nextJobIds = uniqueCompanyJobIds(content.companies)
      const prevCompanies = Array.isArray(current.companies) ? current.companies : []
      const prevJobIds = uniqueCompanyJobIds(
        prevCompanies as Array<{ jobId?: string | null }>,
      )
      const releaseJobIds = prevJobIds.filter((id) => !nextJobIds.includes(id))
      const jobIdsToRead = [...new Set([...nextJobIds, ...releaseJobIds])]

      const jobSnaps = await Promise.all(
        jobIdsToRead.map((jobId) => transaction.get(doc(db, 'jobs', jobId))),
      )
      const snapById = new Map(
        jobIdsToRead.map((jobId, index) => [jobId, jobSnaps[index]!] as const),
      )

      for (const jobId of nextJobIds) {
        const jobSnap = snapById.get(jobId)!
        assertJobClaimable(jobSnap.data(), reportId, jobSnap.exists(), content.reportDate)
      }

      const version = Number(current.editVersion ?? 0) + 1
      transaction.update(ref, {
        ...content,
        editVersion: version,
        updatedAt: serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByNameSnapshot: actor.name,
      })
      transaction.set(doc(ref, 'history', String(version)), {
        action: 'update',
        version,
        actorUid: actor.uid,
        actorNameSnapshot: actor.name,
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      })

      for (const jobId of nextJobIds) {
        const jobSnap = snapById.get(jobId)!
        const company = companiesByJobId.get(jobId)
        if (!company || !jobSnap.exists()) continue
        const result = applyDailyReportJobOutcome(transaction, {
          jobId,
          jobData: jobSnap.data()!,
          reportId,
          cancelled: company.cancelled === true,
          actor,
        })
        if (result.event) outcomeEvents.push(result.event)
        mergeOwnerStats(statsByOwner, result.stats)
      }
      for (const jobId of releaseJobIds) {
        const jobSnap = snapById.get(jobId)!
        if (!jobSnap.exists()) continue
        if (jobClaimFromData(jobSnap.data()) === reportId) {
          transaction.update(doc(db, 'jobs', jobId), {
            dailyReportId: null,
            updatedAt: serverTimestamp(),
          })
        }
      }
    })
    void applyDeferredOwnerStats(statsByOwner)
    notifyJobOutcomes(outcomeEvents, actor)
    void applyCompanyCashContributionDelta(nextParts, prevParts).catch(
      () => {
        /* muhabir kasa snapshot best-effort */
      },
    )
    const companies =
      input.leaveDayCash === true ? [] : input.companies
    const jobFields = reportActivityJobFields(companies)
    writeActivityLog({
      actor: {
        uid: actor.uid,
        fullName: actor.name,
        role: actor.role,
      },
      category: 'report',
      action: 'report.updated',
      summary: reportActivitySummary(
        input.reportDate,
        companies,
        input.leaveDayCash === true,
      ),
      jobId: jobFields.jobId,
      jobCompanyName: jobFields.jobCompanyName,
      entityType: 'daily_report',
      entityId: reportId,
    })
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Günlük rapor güncellenemedi.'))
  }
}

export async function softDeleteDailyReport(
  reportId: string,
  actor: DailyReportActor,
): Promise<void> {
  const db = getDb()
  const ref = doc(db, 'reporterDailyReports', reportId)
  try {
    let removedParts: ReturnType<typeof reportCashParts> | null = null
    let didDelete = false
    let deletedSummary = ''
    let deletedJobId: string | null = null
    let deletedCompanyName: string | null = null
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref)
      if (!snap.exists()) throw new UserFacingError('Rapor bulunamadı.')
      const current = snap.data()
      if (current.deletedAt != null) return

      didDelete = true
      removedParts = reportCashParts(current)

      const prevCompanies = Array.isArray(current.companies) ? current.companies : []
      const jobIds = uniqueCompanyJobIds(
        prevCompanies as Array<{ jobId?: string | null }>,
      )
      const jobFields = reportActivityJobFields(
        prevCompanies as Array<{ jobId?: string | null; companyName?: string }>,
      )
      deletedJobId = jobFields.jobId
      deletedCompanyName = jobFields.jobCompanyName
      deletedSummary = reportActivitySummary(
        String(current.reportDate ?? ''),
        prevCompanies as Array<{ companyName?: string }>,
        current.leaveDayCash === true,
      )
      const jobSnaps = await Promise.all(
        jobIds.map((jobId) => transaction.get(doc(db, 'jobs', jobId))),
      )

      const version = Number(current.editVersion ?? 0) + 1
      transaction.update(ref, {
        deletedAt: serverTimestamp(),
        deletedByUid: actor.uid,
        deletedByNameSnapshot: actor.name,
        editVersion: version,
        updatedAt: serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByNameSnapshot: actor.name,
      })
      transaction.set(doc(ref, 'history', String(version)), {
        action: 'soft_delete',
        version,
        actorUid: actor.uid,
        actorNameSnapshot: actor.name,
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      })

      for (let i = 0; i < jobIds.length; i++) {
        const jobSnap = jobSnaps[i]!
        if (!jobSnap.exists()) continue
        if (jobClaimFromData(jobSnap.data()) === reportId) {
          transaction.update(doc(db, 'jobs', jobIds[i]!), {
            dailyReportId: null,
            updatedAt: serverTimestamp(),
          })
        }
      }
    })
    if (didDelete && removedParts) {
      void applyCompanyCashContributionDelta(null, removedParts).catch(() => {
        /* muhabir kasa snapshot best-effort */
      })
      writeActivityLog({
        actor: {
          uid: actor.uid,
          fullName: actor.name,
          role: actor.role,
        },
        category: 'report',
        action: 'report.deleted',
        summary: deletedSummary,
        jobId: deletedJobId,
        jobCompanyName: deletedCompanyName,
        entityType: 'daily_report',
        entityId: reportId,
      })
    }
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Günlük rapor silinemedi.'))
  }
}

/**
 * Best-effort: stamp `jobs.dailyReportId` for legacy reports that predate the claim field.
 * Safe to call from management/coordinator inbox loads. Skips already-claimed jobs.
 */
export async function backfillDailyReportJobClaims(
  reports: ReporterDailyReport[],
): Promise<void> {
  const db = getDb()
  // Prefer older reports first so the earliest claim wins if duplicates exist.
  const ordered = [...reports].sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0
    const bMs = b.createdAt?.toMillis?.() ?? 0
    return aMs - bMs
  })

  for (const report of ordered) {
    const jobIds = uniqueCompanyJobIds(report.companies)
    for (const jobId of jobIds) {
      try {
        await runTransaction(db, async (transaction) => {
          const jobRef = doc(db, 'jobs', jobId)
          const jobSnap = await transaction.get(jobRef)
          if (!jobSnap.exists()) return
          const claimedBy = jobClaimFromData(jobSnap.data())
          if (claimedBy != null) return
          transaction.update(jobRef, {
            dailyReportId: report.id,
            updatedAt: serverTimestamp(),
          })
        })
      } catch {
        // Ignore individual backfill failures (permissions / races).
      }
    }
  }
}

export async function fetchDailyReportsInRange(range: {
  startDate: string
  endDate: string
}): Promise<ReporterDailyReport[]> {
  try {
    const expanded = expandStatsQueryDateRange(range.startDate, range.endDate)
    if (!expanded) return []

    const snap = await getDocs(
      query(
        reportsCollection(),
        where('createdAt', '>=', dayStart(expanded.startDate)),
        where('createdAt', '<=', dayEnd(expanded.endDate)),
        orderBy('createdAt', 'desc'),
        limit(1000),
      ),
    )
    return snap.docs
      .map((d) => d.data())
      .filter((report) => report.deletedAt == null)
      .filter((report) => {
        const reportDate =
          typeof report.reportDate === 'string' && isValidDateOnly(report.reportDate)
            ? report.reportDate
            : report.createdAt?.toDate
              ? formatInTimeZone(
                  report.createdAt.toDate(),
                  COMPANY_TIMEZONE,
                  'yyyy-MM-dd',
                )
              : null
        if (!reportDate) return false
        return isDateOnlyInStatsRange(reportDate, range.startDate, range.endDate)
      })
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Günlük raporlar yüklenemedi.'))
  }
}

export async function getDailyReport(
  reportId: string,
): Promise<ReporterDailyReport | null> {
  try {
    const snap = await getDoc(reportDocRef(reportId))
    if (!snap.exists()) return null
    const report = snap.data()
    if (report.deletedAt != null) return null
    return report
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Günlük rapor yüklenemedi.'))
  }
}

export async function fetchMyDailyReports(uid: string): Promise<ReporterDailyReport[]> {
  try {
    const snap = await getDocs(
      query(
        reportsCollection(),
        where('createdByUid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(500),
      ),
    )
    return snap.docs.map((d) => d.data()).filter((report) => report.deletedAt == null)
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Raporlarınız yüklenemedi.'))
  }
}

export function subscribeOwnDailyReports(
  uid: string,
  onData: (reports: ReporterDailyReport[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    reportsCollection(),
    where('createdByUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(500),
  )
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => d.data()).filter((report) => report.deletedAt == null)),
    (err) => onError?.(err),
  )
}
