#!/usr/bin/env tsx
/**
 * List reporter daily report company rows missing jobId (read-only).
 * Does NOT write or auto-link.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/list-daily-report-companies-missing-jobid.ts
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PAGE = 300

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

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function main() {
  initAdmin()
  const db = getFirestore()
  let scannedReports = 0
  let lastDoc: QueryDocumentSnapshot | undefined
  const rows: Array<Record<string, string | number | boolean>> = []

  for (;;) {
    let q = db
      .collection('reporterDailyReports')
      .orderBy('__name__')
      .limit(PAGE)
    if (lastDoc) q = q.startAfter(lastDoc)
    const snap = await q.get()
    if (snap.empty) break

    for (const docSnap of snap.docs) {
      scannedReports += 1
      lastDoc = docSnap
      const data = docSnap.data()
      if (data.deletedAt != null) continue
      const companies = Array.isArray(data.companies) ? data.companies : []
      for (let i = 0; i < companies.length; i += 1) {
        const company = companies[i] as Record<string, unknown>
        const jobId = String(company.jobId ?? '').trim()
        if (jobId) continue
        rows.push({
          reportId: docSnap.id,
          reportDate: String(data.reportDate ?? ''),
          reporter: String(data.createdByNameSnapshot ?? data.createdByUid ?? ''),
          companyIndex: i,
          companyName: String(company.companyName ?? ''),
          cancelled: company.cancelled === true,
          shootMinutes: Math.max(0, Math.floor(Number(company.shootMinutes ?? 0))),
          hasNews: company.hasNews === true,
          newsTotalKurus:
            company.newsTotalKurus == null
              ? ''
              : Math.max(0, Math.floor(Number(company.newsTotalKurus) || 0)),
          createdAt:
            data.createdAt && typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : '',
        })
      }
    }

    if (snap.size < PAGE) break
  }

  const header = [
    'reportId',
    'reportDate',
    'reporter',
    'companyIndex',
    'companyName',
    'cancelled',
    'shootMinutes',
    'hasNews',
    'newsTotalKurus',
    'createdAt',
  ]
  const lines = [
    header.join(','),
    ...rows.map((r) => header.map((h) => csvEscape(r[h])).join(',')),
  ]
  const outPath = resolve(
    '/tmp',
    'brain-missing-jobid-companies.csv',
  )
  writeFileSync(outPath, lines.join('\n'), 'utf8')

  console.log(
    JSON.stringify(
      {
        scannedReports,
        missingJobIdRows: rows.length,
        csv: outPath,
        sample: rows.slice(0, 25),
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
