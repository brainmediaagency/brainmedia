#!/usr/bin/env tsx
/**
 * Import 2026-08-01 shot jobs + daily report (cash / MPU stats / ops ledger).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/import-aug1-2026-shot-jobs.ts
 *
 *   ... --apply
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type Firestore,
} from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APPLY = process.argv.includes('--apply')
const REPORT_DATE = '2026-08-01'
const IMPORT_TAG = 'import-aug1-2026-shot-jobs'

const REPORTER = {
  uid: 'cfIXNJQzTCOagYrZSec8HmAsugo2',
  fullName: 'Muhabir Merve',
  email: 'muhabir@brain.com',
}

const REVIEWER = {
  uid: 'q4qgMzUTfQRBg3gXrOIgc4aF1YH2',
  fullName: 'Elif',
  role: 'coordinator' as const,
}

const MPUS = {
  erkan: {
    uid: 'qV20hDkXvQcf2kYBKvD7SF1RRzH3',
    fullName: 'Erkan',
    email: 'mpuerkan@brain.com',
  },
  taha: {
    uid: 'dy8pR7ADOPbOi4g6XERJ714h6X03',
    fullName: 'Taha servi',
    email: 'mputaha@brain.com',
  },
  merve: {
    uid: 'IehSZELd9ih548V59i12SV89C2B2',
    fullName: 'Merve',
    email: 'mpumerve@brain.com',
  },
  ece: {
    uid: 'CvKgxp4svtXyX6bzQrkXFUDppbe2',
    fullName: 'ECE',
    email: 'mpuece@brain.com',
  },
  ahmet: {
    uid: 'ChTa8FTGOLNC08LFmmLRP0qpBnj1',
    fullName: 'Ahmet Dirim',
    email: 'mpuahmet@brain.com',
  },
} as const

type ChargeMode = 'vat' | 'cash'
type VatRate = 14 | 17 | 20

type ImportRow = {
  key: string
  companyName: string
  mpu: (typeof MPUS)[keyof typeof MPUS]
  plannedExecutionDate: string
  shootMinutes: number
  hasNews: boolean
  newsTotalTry: number
  vatRate: VatRate
  chargeMode: ChargeMode
  invoiceNote: string
  expectedTotalTry: number
}

const ROWS: ImportRow[] = [
  {
    key: 'fornella',
    companyName: "Fornella'S Pizza",
    mpu: MPUS.erkan,
    plannedExecutionDate: '2026-08-01T10:00',
    shootMinutes: 2,
    hasNews: false,
    newsTotalTry: 0,
    vatRate: 20,
    chargeMode: 'vat',
    invoiceNote: 'Faturalı · Havale',
    expectedTotalTry: 12_000,
  },
  {
    key: 'ozgaziantep',
    companyName: 'Tarihi Özgaziantep Lokantası',
    mpu: MPUS.taha,
    plannedExecutionDate: '2026-08-01T11:30',
    shootMinutes: 14,
    hasNews: false,
    newsTotalTry: 0,
    vatRate: 14,
    chargeMode: 'vat',
    invoiceNote: 'Faturalı · Havale',
    expectedTotalTry: 79_800,
  },
  {
    key: 'remax-boss',
    companyName: 'Remax Boss Broker Eda Altun',
    mpu: MPUS.merve,
    plannedExecutionDate: '2026-08-01T13:00',
    shootMinutes: 3,
    hasNews: false,
    newsTotalTry: 0,
    vatRate: 20,
    // Toplam matrah ile aynı (=15.000); KDV kasaya eklenmedi.
    chargeMode: 'cash',
    invoiceNote: 'Faturalı · Kredi kartı (KDV kasaya yansımadı)',
    expectedTotalTry: 15_000,
  },
  {
    key: 'urfali-kebap',
    companyName: "Urfalı Kebap Hayrağ'nın Yeri",
    mpu: MPUS.ece,
    plannedExecutionDate: '2026-08-01T15:00',
    shootMinutes: 7,
    hasNews: false,
    newsTotalTry: 0,
    vatRate: 20,
    chargeMode: 'vat',
    invoiceNote: 'Faturalı · Havale',
    expectedTotalTry: 42_000,
  },
  {
    key: 'pala-group',
    companyName: 'Pala Group 1 İnşaat',
    mpu: MPUS.ahmet,
    plannedExecutionDate: '2026-08-01T17:00',
    shootMinutes: 3,
    hasNews: true,
    newsTotalTry: 15_000,
    vatRate: 20,
    chargeMode: 'vat',
    invoiceNote: 'Faturalı · Havale · Haber 15.000₺',
    expectedTotalTry: 36_000,
  },
]

function initAdmin() {
  if (getApps().length > 0) return
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS is required.')
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(resolve(credPath), 'utf8')) as ServiceAccount
  initializeApp({ credential: cert(raw) })
}

function normalizeCompanyName(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')
}

function tryToKurus(tryAmount: number): number {
  return Math.round(Math.max(0, tryAmount) * 100)
}

function calcShootFees(minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  const billableMinutes = Math.max(0, safeMinutes - 1)
  const feeBaseKurus = tryToKurus(billableMinutes * 5000)
  return {
    minutes: safeMinutes,
    shootReporterFeeKurus: Math.round(feeBaseKurus * 0.08),
    shootCameramanFeeKurus: Math.round(feeBaseKurus * 0.02),
    vatBaseShootKurus: tryToKurus(safeMinutes * 5000),
  }
}

function buildCompany(row: ImportRow) {
  const shoot = calcShootFees(row.shootMinutes)
  const newsTotalKurus = row.hasNews ? tryToKurus(row.newsTotalTry) : null
  const newsReporterFeeKurus =
    newsTotalKurus != null ? Math.round(newsTotalKurus * 0.15) : null
  const newsCameramanFeeKurus =
    newsTotalKurus != null ? Math.round(newsTotalKurus * 0.1) : null
  const vatBaseKurus =
    shoot.vatBaseShootKurus + (newsTotalKurus ?? 0)
  const vatKurus =
    row.chargeMode === 'cash'
      ? 0
      : Math.round(vatBaseKurus * (row.vatRate / 100))
  const totalKurus = vatBaseKurus + vatKurus
  const expected = tryToKurus(row.expectedTotalTry)
  if (totalKurus !== expected) {
    throw new Error(
      `${row.companyName}: computed ${totalKurus} kuruş != expected ${expected}`,
    )
  }
  return {
    companyName: row.companyName,
    cancelled: false,
    hasNews: row.hasNews,
    newsTotalKurus,
    newsReporterFeeKurus,
    newsCameramanFeeKurus,
    shootMinutes: shoot.minutes,
    shootReporterFeeKurus: shoot.shootReporterFeeKurus,
    shootCameramanFeeKurus: shoot.shootCameramanFeeKurus,
    vatRate: row.vatRate,
    vatBaseKurus,
    vatKurus,
    chargeMode: row.chargeMode,
    totalKurus,
  }
}

function tsAt(isoLocal: string): Timestamp {
  return Timestamp.fromDate(new Date(isoLocal))
}

async function alreadyImported(db: Firestore): Promise<boolean> {
  const snap = await db
    .collection('reporterDailyReports')
    .where('reportDate', '==', REPORT_DATE)
    .where('note', '==', IMPORT_TAG)
    .limit(1)
    .get()
  return !snap.empty
}

async function main() {
  initAdmin()
  const db = getFirestore()

  if (await alreadyImported(db)) {
    console.log(
      JSON.stringify(
        {
          mode: APPLY ? 'apply' : 'dry-run',
          skipped: true,
          reason: `Already imported (note=${IMPORT_TAG} on ${REPORT_DATE})`,
        },
        null,
        2,
      ),
    )
    return
  }

  const companiesBuilt = ROWS.map(buildCompany)
  const totals = companiesBuilt.reduce(
    (acc, c) => ({
      totalReporterEarningsKurus:
        acc.totalReporterEarningsKurus +
        c.shootReporterFeeKurus +
        (c.newsReporterFeeKurus ?? 0),
      totalCameramanEarningsKurus:
        acc.totalCameramanEarningsKurus +
        c.shootCameramanFeeKurus +
        (c.newsCameramanFeeKurus ?? 0),
      totalVatBaseKurus: acc.totalVatBaseKurus + c.vatBaseKurus,
      totalVatKurus: acc.totalVatKurus + c.vatKurus,
      earningsKurus: acc.earningsKurus + c.totalKurus,
    }),
    {
      totalReporterEarningsKurus: 0,
      totalCameramanEarningsKurus: 0,
      totalVatBaseKurus: 0,
      totalVatKurus: 0,
      earningsKurus: 0,
    },
  )
  const employeeExpenseKurus =
    totals.totalReporterEarningsKurus + totals.totalCameramanEarningsKurus

  const preview = ROWS.map((row, i) => ({
    key: row.key,
    companyName: row.companyName,
    mpu: row.mpu.fullName,
    minutes: row.shootMinutes,
    chargeMode: row.chargeMode,
    vatRate: row.vatRate,
    vatBaseTry: companiesBuilt[i]!.vatBaseKurus / 100,
    vatTry: companiesBuilt[i]!.vatKurus / 100,
    totalTry: companiesBuilt[i]!.totalKurus / 100,
    invoiceNote: row.invoiceNote,
  }))

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        reportDate: REPORT_DATE,
        reporter: REPORTER.fullName,
        reviewer: REVIEWER.fullName,
        jobs: preview,
        reportTotalsTry: {
          earnings: totals.earningsKurus / 100,
          vatBase: totals.totalVatBaseKurus / 100,
          vat: totals.totalVatKurus / 100,
          employeeExpense: employeeExpenseKurus / 100,
          reporterFees: totals.totalReporterEarningsKurus / 100,
          cameramanFees: totals.totalCameramanEarningsKurus / 100,
        },
        cashDeltaTry: {
          income: totals.earningsKurus / 100,
          expense: employeeExpenseKurus / 100,
          fieldPaid: 0,
          balanceImpact: 0 - employeeExpenseKurus / 100,
        },
      },
      null,
      2,
    ),
  )

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write.')
    return
  }

  const createdAt = tsAt('2026-08-01T21:00:00+03:00')
  const reviewedAt = tsAt('2026-08-01T12:00:00+03:00')
  const shotAt = tsAt('2026-08-01T21:05:00+03:00')
  const reportRef = db.collection('reporterDailyReports').doc()
  const jobIds: string[] = []

  const batch = db.batch()

  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i]!
    const company = companiesBuilt[i]!
    const jobRef = db.collection('jobs').doc()
    jobIds.push(jobRef.id)

    const contactName = 'Yetkili'
    const contactPhone = '+905550000001'
    batch.set(jobRef, {
      companyName: row.companyName,
      companyNameNormalized: normalizeCompanyName(row.companyName),
      contactPersonName: contactName,
      contactPhone,
      contactCount: 1,
      contacts: [
        { name: contactName, mobilePhone: contactPhone, workPhone: null },
      ],
      province: 'Türkiye',
      district: 'Merkez',
      fullAddress: 'İçe aktarım — adres bilgisi sonradan güncellenebilir.',
      instagram: null,
      acquiredDate: '2026-07-31',
      plannedExecutionDate: row.plannedExecutionDate,
      agreedAmountKurus: 500_000,
      currency: 'TRY',
      status: 'shot',
      statusVersion: 3,
      createdByUid: row.mpu.uid,
      createdByNameSnapshot: row.mpu.fullName,
      createdByEmailSnapshot: row.mpu.email,
      createdByRole: 'media_planning',
      createdAt,
      updatedAt: shotAt,
      reviewedByUid: REVIEWER.uid,
      reviewedByNameSnapshot: REVIEWER.fullName,
      reviewedAt,
      reviewNote: null,
      forwardedToReporter: true,
      forwardedToReporterByUid: REVIEWER.uid,
      forwardedToReporterByNameSnapshot: REVIEWER.fullName,
      forwardedToReporterAt: reviewedAt,
      dailyReportId: reportRef.id,
      callOutcome: 'reached',
      idempotencyKey: `${IMPORT_TAG}-${row.key}`,
    })

    const hist = jobRef.collection('history')
    batch.set(hist.doc(), {
      version: 1,
      fromStatus: null,
      toStatus: 'pending',
      actorUid: row.mpu.uid,
      actorNameSnapshot: row.mpu.fullName,
      actorRole: 'media_planning',
      note: null,
      createdAt,
    })
    batch.set(hist.doc(), {
      version: 2,
      fromStatus: 'pending',
      toStatus: 'approved',
      actorUid: REVIEWER.uid,
      actorNameSnapshot: REVIEWER.fullName,
      actorRole: REVIEWER.role,
      note: null,
      createdAt: reviewedAt,
    })
    batch.set(hist.doc(), {
      version: 3,
      fromStatus: 'approved',
      toStatus: 'shot',
      actorUid: REPORTER.uid,
      actorNameSnapshot: REPORTER.fullName,
      actorRole: 'reporter',
      note: null,
      createdAt: shotAt,
    })

    batch.set(
      db.collection('jobLedgerMeta').doc(jobRef.id),
      {
        invoiceNote: row.invoiceNote,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: 'admin-script',
        updatedByNameSnapshot: 'Admin import Aug1',
      },
      { merge: true },
    )

    // MPU stats: received + shot
    batch.update(db.collection('users').doc(row.mpu.uid), {
      'stats.jobsReceived': FieldValue.increment(1),
      'stats.jobsShot': FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  const reportCompanies = companiesBuilt.map((c, i) => ({
    jobId: jobIds[i]!,
    companyName: c.companyName,
    cancelled: false,
    hasNews: c.hasNews,
    newsTotalKurus: c.newsTotalKurus,
    newsReporterFeeKurus: c.newsReporterFeeKurus,
    newsCameramanFeeKurus: c.newsCameramanFeeKurus,
    shootMinutes: c.shootMinutes,
    shootReporterFeeKurus: c.shootReporterFeeKurus,
    shootCameramanFeeKurus: c.shootCameramanFeeKurus,
    vatRate: c.vatRate,
    vatBaseKurus: c.vatBaseKurus,
    vatKurus: c.vatKurus,
    chargeMode: c.chargeMode,
  }))

  batch.set(reportRef, {
    reportDate: REPORT_DATE,
    leaveDayCash: false,
    companyCount: reportCompanies.length,
    companies: reportCompanies,
    note: IMPORT_TAG,
    hotelExpenseKurus: 0,
    stationeryExpenseKurus: 0,
    fuelExpenseKurus: 0,
    mealExpenseKurus: 0,
    extraExpenseKurus: 0,
    operatingExpenseKurus: 0,
    employeeExpenseKurus,
    totalExpenseKurus: employeeExpenseKurus,
    earningsKurus: totals.earningsKurus,
    fieldPaidKurus: 0,
    totalReporterEarningsKurus: totals.totalReporterEarningsKurus,
    totalCameramanEarningsKurus: totals.totalCameramanEarningsKurus,
    totalVatKurus: totals.totalVatKurus,
    createdByUid: REPORTER.uid,
    createdByNameSnapshot: REPORTER.fullName,
    createdByEmailSnapshot: REPORTER.email,
    createdAt: shotAt,
    updatedAt: shotAt,
    editVersion: 1,
    updatedByUid: REPORTER.uid,
    updatedByNameSnapshot: REPORTER.fullName,
    deletedAt: null,
    deletedByUid: null,
    deletedByNameSnapshot: null,
  })

  // opsCash delta (same as applyCompanyCashContributionDelta)
  const cashRef = db.collection('opsCash').doc('current')
  const cashSnap = await cashRef.get()
  const cash = cashSnap.data() ?? {}
  const incomeDelta = totals.earningsKurus
  const expenseDelta = employeeExpenseKurus
  const fieldPaidDelta = 0
  const totalIncomeKurus =
    Math.trunc(Number(cash.totalIncomeKurus ?? 0) || 0) + incomeDelta
  const totalExpenseKurus =
    Math.trunc(Number(cash.totalExpenseKurus ?? 0) || 0) + expenseDelta
  const totalFieldPaidKurus =
    Math.trunc(Number(cash.totalFieldPaidKurus ?? 0) || 0) + fieldPaidDelta
  const reportCount =
    Math.max(0, Math.trunc(Number(cash.reportCount ?? 0) || 0)) + 1
  batch.set(
    cashRef,
    {
      totalIncomeKurus,
      totalExpenseKurus,
      totalFieldPaidKurus,
      reportCount,
      cashBalanceKurus: totalFieldPaidKurus - totalExpenseKurus,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  await batch.commit()

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportId: reportRef.id,
        jobIds,
        cashAfter: {
          totalIncomeKurus,
          totalExpenseKurus,
          totalFieldPaidKurus,
          reportCount,
          cashBalanceKurus: totalFieldPaidKurus - totalExpenseKurus,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
