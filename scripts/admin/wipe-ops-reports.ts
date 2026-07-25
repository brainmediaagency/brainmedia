/**
 * Delete ALL documents in operational report collections:
 *   reporterDailyReports, voiceRecordings, reporterZReports, hrReports, hiringNotes
 *
 * Does not delete Google Drive files (Firestore only).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *   npx tsx scripts/admin/wipe-ops-reports.ts
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const COLLECTIONS = [
  'reporterDailyReports',
  'voiceRecordings',
  'reporterZReports',
  'hrReports',
  'hiringNotes',
] as const

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

async function wipeCollection(name: string): Promise<number> {
  const db = getFirestore()
  const col = db.collection(name)
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
    console.log(`  ${name}: deleted ${deleted}…`)
  }

  return deleted
}

async function main() {
  initAdmin()
  const db = getFirestore()
  const summary: Record<string, number> = {}

  for (const name of COLLECTIONS) {
    const before = (await db.collection(name).count().get()).data().count
    console.log(`${name}: ${before} docs`)
    summary[name] = await wipeCollection(name)
  }

  console.log('SUCCESS', summary)
}

main().catch((error) => {
  console.error('ERROR:', error)
  process.exit(1)
})
