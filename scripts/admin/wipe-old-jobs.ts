#!/usr/bin/env tsx
/**
 * One-off: delete ALL jobs except an explicit keep-list (companyName match),
 * then recompute every user's stats from the remaining jobs.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/wipe-old-jobs.ts            # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/wipe-old-jobs.ts --execute  # actually delete
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const KEEP_COMPANY_NAMES = new Set(
  ['Muş Hırdavat', 'Murat Lojistik', 'Bade Tekel'].map((s) =>
    s.trim().toLocaleLowerCase('tr-TR'),
  ),
)

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

async function main() {
  const execute = process.argv.includes('--execute')
  initAdmin()
  const db = getFirestore()

  const snap = await db.collection('jobs').get()
  const toDelete: { id: string; company: string; status: string }[] = []
  const kept: { id: string; company: string; status: string; owner: string }[] = []

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const company = String(data.companyName ?? '')
    const norm = company.trim().toLocaleLowerCase('tr-TR')
    const row = {
      id: docSnap.id,
      company,
      status: String(data.status ?? '?'),
      owner: String(data.createdByUid ?? ''),
    }
    if (KEEP_COMPANY_NAMES.has(norm)) kept.push(row)
    else toDelete.push(row)
  }

  console.log(`Jobs total=${snap.size} keep=${kept.length} delete=${toDelete.length}`)
  console.log('KEEP:')
  for (const j of kept) console.log(`  ${j.company} [${j.status}] ${j.id}`)
  console.log('DELETE:')
  for (const j of toDelete) console.log(`  ${j.company} [${j.status}] ${j.id}`)

  if (!execute) {
    console.log('\nDry run — pass --execute to delete.')
    return
  }

  // recursiveDelete removes history subcollections too.
  for (const j of toDelete) {
    await db.recursiveDelete(db.collection('jobs').doc(j.id))
    console.log(`deleted ${j.company} (${j.id})`)
  }

  // Recompute stats for every user from remaining jobs.
  // received = approved+shot+cancelled, shot = shot, cancelled = cancelled.
  const statsByUid = new Map<
    string,
    { jobsReceived: number; jobsShot: number; jobsCancelled: number }
  >()
  for (const j of kept) {
    if (!j.owner) continue
    const s = statsByUid.get(j.owner) ?? {
      jobsReceived: 0,
      jobsShot: 0,
      jobsCancelled: 0,
    }
    if (j.status === 'approved' || j.status === 'shot' || j.status === 'cancelled') {
      s.jobsReceived += 1
    }
    if (j.status === 'shot') s.jobsShot += 1
    if (j.status === 'cancelled') s.jobsCancelled += 1
    statsByUid.set(j.owner, s)
  }

  const users = await db.collection('users').get()
  for (const userSnap of users.docs) {
    const next = statsByUid.get(userSnap.id) ?? {
      jobsReceived: 0,
      jobsShot: 0,
      jobsCancelled: 0,
    }
    await userSnap.ref.update({
      stats: next,
      updatedAt: FieldValue.serverTimestamp(),
    })
    console.log(`stats ${userSnap.id} ->`, next)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
