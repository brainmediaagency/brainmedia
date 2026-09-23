#!/usr/bin/env tsx
/**
 * One-time import: Excel FATURA column → Firestore jobLedgerMeta/{jobId}.
 *
 * Expects a CSV export (or paste) with at least:
 *   JOB ID, FATURA
 * Header names are matched case-insensitively (also accepts "Fatura" / "job id").
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/import-job-ledger-fatura.ts --file=/tmp/fatura.csv
 *
 * Dry run (default):
 *   ... --file=/tmp/fatura.csv
 *
 * Apply:
 *   ... --file=/tmp/fatura.csv --apply
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const APPLY = process.argv.includes('--apply')
const fileArg = process.argv.find((a) => a.startsWith('--file='))
const filePath = fileArg?.slice('--file='.length)

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

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (ch === '\r') continue
    cell += ch
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

function normHeader(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR')
}

async function main() {
  if (!filePath) {
    console.error('ERROR: --file=/path/to.csv is required')
    process.exit(1)
  }
  initAdmin()
  const db = getFirestore()
  const rows = parseCsv(readFileSync(resolve(filePath), 'utf8'))
  if (rows.length < 2) {
    console.error('ERROR: CSV needs a header + at least one data row')
    process.exit(1)
  }

  const header = rows[0]!.map(normHeader)
  const jobIdIdx = header.findIndex(
    (h) => h === 'job id' || h === 'jobid' || h === 'iş id' || h === 'is id',
  )
  const faturaIdx = header.findIndex((h) => h === 'fatura' || h === 'fatura notu')
  if (jobIdIdx < 0 || faturaIdx < 0) {
    console.error('ERROR: CSV must include JOB ID and FATURA columns')
    console.error('Headers:', header.join(' | '))
    process.exit(1)
  }

  const byJob = new Map<string, string>()
  const duplicates: string[] = []
  const missingJobId: number[] = []
  const emptyNote: number[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!
    const jobId = String(row[jobIdIdx] ?? '').trim()
    const note = String(row[faturaIdx] ?? '').trim()
    if (!jobId) {
      missingJobId.push(i + 1)
      continue
    }
    if (!note) {
      emptyNote.push(i + 1)
      continue
    }
    if (byJob.has(jobId) && byJob.get(jobId) !== note) {
      duplicates.push(jobId)
      continue
    }
    byJob.set(jobId, note.slice(0, 500))
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        uniqueJobs: byJob.size,
        duplicateJobIds: duplicates,
        missingJobIdRows: missingJobId.slice(0, 20),
        emptyNoteRows: emptyNote.slice(0, 20),
      },
      null,
      2,
    ),
  )

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to write jobLedgerMeta.')
    return
  }

  let written = 0
  let skippedMissingJob = 0
  for (const [jobId, invoiceNote] of byJob) {
    const jobSnap = await db.collection('jobs').doc(jobId).get()
    if (!jobSnap.exists) {
      skippedMissingJob += 1
      console.warn(`SKIP missing job: ${jobId}`)
      continue
    }
    await db.collection('jobLedgerMeta').doc(jobId).set(
      {
        invoiceNote,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: 'admin-script-import-fatura',
        updatedByNameSnapshot: 'Admin import',
      },
      { merge: true },
    )
    written += 1
  }

  console.log(JSON.stringify({ ok: true, written, skippedMissingJob }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
