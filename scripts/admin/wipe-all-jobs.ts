#!/usr/bin/env tsx
/**
 * Delete ALL jobs (and history subcollections), then zero every user's job stats.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/wipe-all-jobs.ts            # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/wipe-all-jobs.ts --execute  # delete
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  console.log(`Jobs total=${snap.size}`)
  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    console.log(
      `  ${String(data.companyName ?? '?')} [${String(data.status ?? '?')}] ${docSnap.id}`,
    )
  }

  if (!execute) {
    console.log('\nDry run — pass --execute to delete ALL jobs and zero stats.')
    return
  }

  for (const docSnap of snap.docs) {
    const company = String(docSnap.data().companyName ?? '?')
    await db.recursiveDelete(docSnap.ref)
    console.log(`deleted ${company} (${docSnap.id})`)
  }

  const users = await db.collection('users').get()
  for (const userSnap of users.docs) {
    await userSnap.ref.update({
      stats: { jobsReceived: 0, jobsShot: 0, jobsCancelled: 0 },
      updatedAt: FieldValue.serverTimestamp(),
    })
    console.log(`stats zeroed ${userSnap.id}`)
  }

  console.log('Done. All jobs wiped; UI will clear on refresh.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
