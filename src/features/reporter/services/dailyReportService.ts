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
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
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
import { notifyManagement } from '@/features/notifications/services/notificationService'

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
  const hasNews = Boolean(company.hasNews)
  return {
    jobId: String(company.jobId ?? '').trim(),
    companyName: company.companyName.trim(),
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
    const extraExpenseKurus = Number(data.extraExpenseKurus ?? 0)
    const totalReporterEarningsKurus = Number(data.totalReporterEarningsKurus ?? 0)
    const totalCameramanEarningsKurus = Number(data.totalCameramanEarningsKurus ?? 0)
    const totalVatKurus = Number(data.totalVatKurus ?? 0)
    const operatingExpenseKurus = Number(
      data.operatingExpenseKurus ??
        hotelExpenseKurus + stationeryExpenseKurus + fuelExpenseKurus + extraExpenseKurus,
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
      companyCount: Number(data.companyCount ?? 0),
      companies,
      note: String(data.note ?? ''),
      hotelExpenseKurus,
      stationeryExpenseKurus,
      fuelExpenseKurus,
      extraExpenseKurus,
      operatingExpenseKurus,
      employeeExpenseKurus,
      totalExpenseKurus: Number(
        data.totalExpenseKurus ?? operatingExpenseKurus + employeeExpenseKurus + totalVatKurus,
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
  companies: ReporterDailyCompany[]
  note: string
  hotelExpenseKurus: number
  stationeryExpenseKurus: number
  fuelExpenseKurus: number
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
  const companies = input.companies.map(sanitizeCompany)
  const hotelExpenseKurus = toKurusInt(input.hotelExpenseKurus)
  const stationeryExpenseKurus = toKurusInt(input.stationeryExpenseKurus)
  const fuelExpenseKurus = toKurusInt(input.fuelExpenseKurus)
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
    hotelExpenseKurus + stationeryExpenseKurus + fuelExpenseKurus + extraExpenseKurus
  const employeeExpenseKurus = totalReporterEarningsKurus + totalCameramanEarningsKurus
  const totalExpenseKurus = operatingExpenseKurus + employeeExpenseKurus + totalVatKurus
  const earningsKurus = vatBaseKurus + totalVatKurus

  return {
    reportDate: input.reportDate,
    companyCount: companies.length,
    companies,
    note: input.note.trim(),
    hotelExpenseKurus,
    stationeryExpenseKurus,
    fuelExpenseKurus,
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

function jobClaimFromData(data: DocumentData | undefined): string | null {
  if (!data) return null
  const raw = data.dailyReportId
  if (raw === null || raw === undefined) return null
  const id = String(raw).trim()
  return id.length > 0 ? id : null
}

function assertJobClaimable(
  data: DocumentData | undefined,
  reportId: string,
  exists: boolean,
): void {
  if (!exists) {
    throw new UserFacingError('Seçilen iş bulunamadı.')
  }
  const claimedBy = jobClaimFromData(data)
  if (claimedBy != null && claimedBy !== reportId) {
    throw new UserFacingError(JOB_ALREADY_REPORTED_TR)
  }
}

export async function createDailyReport(input: DailyReportWriteInput & {
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
}): Promise<string> {
  try {
    const content = reportContent(input)
    const jobIds = uniqueCompanyJobIds(content.companies)
    const ref = doc(collection(getDb(), 'reporterDailyReports'))
    const db = getDb()

    await runTransaction(db, async (transaction) => {
      const jobSnaps = await Promise.all(
        jobIds.map((jobId) => transaction.get(doc(db, 'jobs', jobId))),
      )
      for (let i = 0; i < jobIds.length; i++) {
        const snap = jobSnaps[i]!
        assertJobClaimable(snap.data(), ref.id, snap.exists())
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
        actorRole: 'reporter',
        createdAt: serverTimestamp(),
      })
      for (const jobId of jobIds) {
        transaction.update(doc(db, 'jobs', jobId), {
          dailyReportId: ref.id,
          updatedAt: serverTimestamp(),
        })
      }
    })

    void notifyManagement({
      type: 'daily_report',
      title: 'Muhabir günlük rapor / kasa',
      body: `${input.createdByNameSnapshot} — ${input.reportDate}`,
      link: '/reporter?tab=daily-reports',
      createdByUid: input.createdByUid,
      createdByNameSnapshot: input.createdByNameSnapshot,
      pushRoles: ['management', 'coordinator'],
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
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref)
      if (!snap.exists()) throw new UserFacingError('Rapor bulunamadı.')
      const current = snap.data()
      if (current.deletedAt != null) {
        throw new UserFacingError('Silinmiş rapor düzenlenemez.')
      }

      const content = reportContent(input)
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
        assertJobClaimable(jobSnap.data(), reportId, jobSnap.exists())
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
        const claimedBy = jobClaimFromData(jobSnap.data())
        if (claimedBy !== reportId) {
          transaction.update(doc(db, 'jobs', jobId), {
            dailyReportId: reportId,
            updatedAt: serverTimestamp(),
          })
        }
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
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref)
      if (!snap.exists()) throw new UserFacingError('Rapor bulunamadı.')
      const current = snap.data()
      if (current.deletedAt != null) return

      const prevCompanies = Array.isArray(current.companies) ? current.companies : []
      const jobIds = uniqueCompanyJobIds(
        prevCompanies as Array<{ jobId?: string | null }>,
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
