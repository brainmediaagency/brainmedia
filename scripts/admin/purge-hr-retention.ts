#!/usr/bin/env tsx
/**
 * Manual / cron fallback for İK + Z-report retention purge.
 * Prefer the in-app runners (İK/yönetim for HR; yönetim/koordinatör for Z).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/purge-hr-retention.ts
 *
 * Optional:
 *   PURGE_DATE=2026-09-01  (defaults to latest due cycle or first cycle)
 *   SKIP_Z=1               (skip reporterZReports purge)
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FIRST_PURGE = '2026-09-01'

function addMonthsDateOnly(dateOnly: string, months: number): string {
  const [y, m] = dateOnly.split('-').map(Number)
  const index = y! * 12 + (m! - 1) + months
  const nextY = Math.floor(index / 12)
  const nextM = (index % 12) + 1
  return `${nextY}-${String(nextM).padStart(2, '0')}-01`
}

function getDuePurgeDate(today: string): string | null {
  if (today < FIRST_PURGE) return null
  let purgeDate = FIRST_PURGE
  let due = purgeDate
  while (purgeDate <= today) {
    due = purgeDate
    purgeDate = addMonthsDateOnly(purgeDate, 2)
  }
  return due
}

function todayIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

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

function cutoff(purgeDate: string): Timestamp {
  const [y, m, d] = purgeDate.split('-').map(Number)
  return Timestamp.fromDate(new Date(Date.UTC(y!, m! - 1, d!, -3, 0, 0, 0)))
}

async function main() {
  initAdmin()
  const db = getFirestore()
  const purgeDate =
    process.env.PURGE_DATE ?? getDuePurgeDate(todayIstanbul()) ?? FIRST_PURGE

  console.log('Purging HR + Z data created before', purgeDate)
  const before = cutoff(purgeDate)
  let hrReportsDeleted = 0
  let hiringNotesDeleted = 0
  let zReportsDeleted = 0

  for (;;) {
    const snap = await db
      .collection('hrReports')
      .where('createdAt', '<', before)
      .limit(200)
      .get()
    if (snap.empty) break
    const batch = db.batch()
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref)
      hrReportsDeleted += 1
    }
    await batch.commit()
  }

  const bucket = getStorage().bucket()
  for (;;) {
    const snap = await db
      .collection('hiringNotes')
      .where('createdAt', '<', before)
      .limit(100)
      .get()
    if (snap.empty) break
    for (const note of snap.docs) {
      const attachments = Array.isArray(note.data().attachments)
        ? note.data().attachments
        : []
      for (const attachment of attachments) {
        const path = String(attachment?.storagePath ?? '')
        if (!path) continue
        try {
          await bucket.file(path).delete({ ignoreNotFound: true })
        } catch {
          // continue
        }
      }
      await note.ref.delete()
      hiringNotesDeleted += 1
    }
  }

  await db.doc('appMeta/hrRetention').set(
    {
      lastCompletedPurgeDate: purgeDate,
      lastPurgedAt: Timestamp.now(),
      lastPurgedByUid: 'admin-script',
      lastPurgedByName: 'Admin script',
      hrReportsDeleted,
      hiringNotesDeleted,
      status: 'completed',
      claimedPurgeDate: null,
      claimedAt: null,
    },
    { merge: true },
  )

  if (process.env.SKIP_Z !== '1') {
    for (;;) {
      const snap = await db
        .collection('reporterZReports')
        .where('createdAt', '<', before)
        .orderBy('createdAt', 'asc')
        .limit(200)
        .get()
      if (snap.empty) break
      const batch = db.batch()
      for (const docSnap of snap.docs) {
        batch.delete(docSnap.ref)
        zReportsDeleted += 1
      }
      await batch.commit()
    }

    await db.doc('appMeta/zReportRetention').set(
      {
        lastCompletedPurgeDate: purgeDate,
        lastPurgedAt: Timestamp.now(),
        lastPurgedByUid: 'admin-script',
        lastPurgedByName: 'Admin script',
        zReportsDeleted,
        status: 'completed',
        claimedPurgeDate: null,
        claimedAt: null,
      },
      { merge: true },
    )
  }

  console.log('Done.', {
    hrReportsDeleted,
    hiringNotesDeleted,
    zReportsDeleted,
    purgeDate,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
