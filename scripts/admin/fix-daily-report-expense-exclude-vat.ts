#!/usr/bin/env tsx
/**
 * Backfill: totalExpenseKurus = operating + employee (exclude VAT).
 * Also rebuilds opsCash/current from non-deleted reports.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/fix-daily-report-expense-exclude-vat.ts
 *
 * Dry run:
 *   ... DRY_RUN=1 npx tsx scripts/admin/fix-daily-report-expense-exclude-vat.ts
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import {
  FieldValue,
  getFirestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

function initAdmin() {
  if (getApps().length > 0) return
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS is required.')
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(resolve(credPath), 'utf8')) as ServiceAccount
  initializeApp({
    credential: cert(raw),
  })
}

function toNonNegInt(value: unknown): number {
  const n = Math.trunc(Number(value ?? 0) || 0)
  return n > 0 ? n : 0
}

function computeTotalExpense(data: Record<string, unknown>): {
  operating: number
  employee: number
  total: number
  vat: number
  previous: number
} {
  const hotel = toNonNegInt(data.hotelExpenseKurus)
  const stationery = toNonNegInt(data.stationeryExpenseKurus)
  const fuel = toNonNegInt(data.fuelExpenseKurus)
  const meal = toNonNegInt(data.mealExpenseKurus)
  const extra = toNonNegInt(data.extraExpenseKurus)
  const operatingRaw = data.operatingExpenseKurus
  const operating =
    operatingRaw === undefined || operatingRaw === null
      ? hotel + stationery + fuel + meal + extra
      : toNonNegInt(operatingRaw)
  const reporter = toNonNegInt(data.totalReporterEarningsKurus)
  const cameraman = toNonNegInt(data.totalCameramanEarningsKurus)
  const employeeRaw = data.employeeExpenseKurus
  const employee =
    employeeRaw === undefined || employeeRaw === null
      ? reporter + cameraman
      : toNonNegInt(employeeRaw)
  const total = operating + employee
  return {
    operating,
    employee,
    total,
    vat: toNonNegInt(data.totalVatKurus),
    previous: toNonNegInt(data.totalExpenseKurus),
  }
}

function reportIncomeKurus(data: Record<string, unknown>): number {
  const companies = Array.isArray(data.companies) ? data.companies : []
  if (companies.length > 0) {
    return companies.reduce((sum: number, company: unknown) => {
      const c = company as Record<string, unknown>
      return sum + toNonNegInt(c.vatBaseKurus) + toNonNegInt(c.vatKurus)
    }, 0)
  }
  return toNonNegInt(data.earningsKurus)
}

async function main() {
  initAdmin()
  const db = getFirestore()
  let scanned = 0
  let wouldUpdate = 0
  let updated = 0
  let lastDoc: QueryDocumentSnapshot | undefined

  let totalIncomeKurus = 0
  let totalExpenseKurus = 0
  let totalFieldPaidKurus = 0
  let reportCount = 0

  console.log(DRY_RUN ? 'DRY RUN — no writes' : 'LIVE — writing reports + opsCash')

  for (;;) {
    let q = db.collection('reporterDailyReports').orderBy('__name__').limit(300)
    if (lastDoc) q = q.startAfter(lastDoc)
    const snap = await q.get()
    if (snap.empty) break

    const batch = db.batch()
    let batchCount = 0

    for (const docSnap of snap.docs) {
      scanned += 1
      lastDoc = docSnap
      const data = docSnap.data()
      const { total, previous, operating, employee, vat } = computeTotalExpense(data)

      if (data.deletedAt == null) {
        reportCount += 1
        totalIncomeKurus += reportIncomeKurus(data)
        totalExpenseKurus += total
        totalFieldPaidKurus += toNonNegInt(data.fieldPaidKurus)
      }

      if (previous === total) continue
      wouldUpdate += 1
      console.log(
        `${docSnap.id}: totalExpense ${previous} → ${total} (op ${operating} + emp ${employee}; vat was ${vat})`,
      )
      if (!DRY_RUN) {
        batch.update(docSnap.ref, {
          totalExpenseKurus: total,
          operatingExpenseKurus: operating,
          employeeExpenseKurus: employee,
          updatedAt: FieldValue.serverTimestamp(),
        })
        batchCount += 1
        updated += 1
      }
    }

    if (!DRY_RUN && batchCount > 0) {
      await batch.commit()
      console.log(`Committed batch of ${batchCount}`)
    }

    if (snap.size < 300) break
  }

  const cashBalanceKurus = totalFieldPaidKurus - totalExpenseKurus
  console.log(
    `Cash rebuild: reports=${reportCount} income=${totalIncomeKurus} expense=${totalExpenseKurus} fieldPaid=${totalFieldPaidKurus} balance=${cashBalanceKurus}`,
  )

  if (!DRY_RUN) {
    await db.collection('opsCash').doc('current').set(
      {
        cashBalanceKurus,
        totalFieldPaidKurus,
        totalExpenseKurus,
        totalIncomeKurus,
        reportCount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    console.log('opsCash/current published')
  }

  console.log(
    `Done. scanned=${scanned} wouldUpdate=${wouldUpdate} updated=${updated} dryRun=${DRY_RUN}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
