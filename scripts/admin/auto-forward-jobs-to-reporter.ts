#!/usr/bin/env tsx
/**
 * Konfirme + iletilmemiş işleri muhabire iletir (Admin SDK).
 * Cloud Functions Blaze gerektirir; bu script cron / manuel yedek:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/auto-forward-jobs-to-reporter.ts
 *
 * FORCE=1 ile saat penceresi atlanır.
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TIME_ZONE = 'Europe/Istanbul'
const WINDOW_START_HOUR = 9
const WINDOW_END_HOUR = 21
const SYSTEM_FORWARD_UID = 'system-auto-forward'
const SYSTEM_FORWARD_NAME = 'Otomatik iletim'
const BATCH_LIMIT = 200

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

function istanbulHourNow(now = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return Number(hourStr)
}

function isWithinWindow(now = new Date()): boolean {
  const hour = istanbulHourNow(now)
  return hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR
}

async function main() {
  initAdmin()
  const force = process.env.FORCE === '1' || process.env.FORCE === 'true'
  if (!force && !isWithinWindow()) {
    console.log('Outside 09:00–21:00 Europe/Istanbul; skip. Set FORCE=1 to override.')
    return
  }

  const db = getFirestore()
  const snap = await db
    .collection('jobs')
    .where('status', '==', 'approved')
    .where('forwardedToReporter', '==', false)
    .limit(BATCH_LIMIT)
    .get()

  if (snap.empty) {
    console.log('No approved unforwarded jobs.')
    return
  }

  let batch = db.batch()
  let ops = 0
  let forwarded = 0

  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      forwardedToReporter: true,
      forwardedToReporterByUid: SYSTEM_FORWARD_UID,
      forwardedToReporterByNameSnapshot: SYSTEM_FORWARD_NAME,
      forwardedToReporterAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    ops += 1
    forwarded += 1
    if (ops >= 400) {
      await batch.commit()
      batch = db.batch()
      ops = 0
    }
  }
  if (ops > 0) await batch.commit()

  console.log(`Auto-forwarded ${forwarded} job(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
