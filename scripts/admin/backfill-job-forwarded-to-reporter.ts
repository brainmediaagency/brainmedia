#!/usr/bin/env tsx
/**
 * Backfill jobs missing `forwardedToReporter` fields.
 * Existing approved jobs stay NOT forwarded (muhabir takvimine düşmez)
 * until yönetim/koordinatör “Muhabire ilet” der.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/backfill-job-forwarded-to-reporter.ts
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import {
  getFirestore,
  FieldValue,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
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
  initializeApp({
    credential: cert(raw),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? 'brain-c5fcb.appspot.com',
  })
}

async function main() {
  initAdmin()
  const db = getFirestore()
  let scanned = 0
  let updated = 0
  let lastDoc: QueryDocumentSnapshot | undefined

  for (;;) {
    let q = db.collection('jobs').orderBy('__name__').limit(400)
    if (lastDoc) q = q.startAfter(lastDoc)
    const snap = await q.get()
    if (snap.empty) break

    const batch = db.batch()
    let batchCount = 0

    for (const docSnap of snap.docs) {
      scanned += 1
      lastDoc = docSnap
      const data = docSnap.data()
      if (typeof data.forwardedToReporter === 'boolean') continue

      batch.update(docSnap.ref, {
        forwardedToReporter: false,
        forwardedToReporterByUid: null,
        forwardedToReporterByNameSnapshot: null,
        forwardedToReporterAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      })
      batchCount += 1
      updated += 1
    }

    if (batchCount > 0) {
      await batch.commit()
      console.log(`Updated batch of ${batchCount} (total updated ${updated})`)
    }

    if (snap.size < 400) break
  }

  console.log(`Done. scanned=${scanned} updated=${updated}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
