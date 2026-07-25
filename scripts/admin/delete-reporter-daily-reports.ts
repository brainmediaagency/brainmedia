#!/usr/bin/env tsx
/**
 * Delete all documents in reporterDailyReports (admin SDK).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *   npx tsx scripts/admin/delete-reporter-daily-reports.ts
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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
  initAdmin()
  const db = getFirestore()
  const col = db.collection('reporterDailyReports')
  let deleted = 0

  for (;;) {
    const snap = await col.limit(200).get()
    if (snap.empty) break
    const batch = db.batch()
    for (const doc of snap.docs) {
      batch.delete(doc.ref)
      deleted += 1
    }
    await batch.commit()
    console.log(`Deleted batch… total ${deleted}`)
  }

  console.log(`SUCCESS: deleted ${deleted} reporterDailyReports`)
}

main().catch((error) => {
  console.error('ERROR:', error)
  process.exit(1)
})
