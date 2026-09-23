#!/usr/bin/env tsx
/**
 * Migrate never-approved cancelled jobs → rejected (Reddedildi).
 *
 * Eligible: status === 'cancelled', history has pending→cancelled, never approved.
 * Also decrements owner stats.jobsCancelled by 1 (pending→cancelled used to increment it).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/migrate-stale-pending-cancelled-to-rejected.ts
 *
 *   # apply writes:
 *   ... --apply
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import {
  FieldValue,
  getFirestore,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const NEW_NOTE = 'Otomatik red: 48 saat içinde konfirme edilmedi.'
const PAGE = 200

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

async function classifyCancelledJob(
  db: Firestore,
  jobId: string,
  reviewNote: string,
): Promise<{ migrate: boolean; reason: string }> {
  const hist = await db
    .collection('jobs')
    .doc(jobId)
    .collection('history')
    .orderBy('createdAt', 'asc')
    .get()

  let sawPendingToCancelled = false
  let sawApproved = false
  for (const h of hist.docs) {
    const d = h.data()
    const from = String(d.fromStatus ?? '')
    const to = String(d.toStatus ?? '')
    if (to === 'approved') sawApproved = true
    if (from === 'pending' && to === 'cancelled') sawPendingToCancelled = true
  }

  if (sawApproved) {
    return { migrate: false, reason: 'had-approved' }
  }
  if (sawPendingToCancelled) {
    return { migrate: true, reason: 'pending-cancel-never-approved' }
  }
  // Legacy / missing history: old auto-cancel note implies never confirmed.
  if (/otomatik iptal/i.test(reviewNote)) {
    return { migrate: true, reason: 'auto-cancel-note-no-approved' }
  }
  return { migrate: false, reason: 'no-pending-cancel-history' }
}

async function main() {
  const apply = process.argv.includes('--apply')
  initAdmin()
  const db = getFirestore()

  let scanned = 0
  let eligible = 0
  let skipped = 0
  let updated = 0
  let lastDoc: QueryDocumentSnapshot | undefined
  const statsDeltaByOwner = new Map<string, number>()
  const sample: string[] = []

  for (;;) {
    let q = db
      .collection('jobs')
      .where('status', '==', 'cancelled')
      .orderBy('__name__')
      .limit(PAGE)
    if (lastDoc) q = q.startAfter(lastDoc)
    const snap = await q.get()
    if (snap.empty) break

    for (const docSnap of snap.docs) {
      scanned += 1
      lastDoc = docSnap
      const data = docSnap.data()
      const note = String(data.reviewNote ?? '')
      const check = await classifyCancelledJob(db, docSnap.id, note)

      if (!check.migrate) {
        skipped += 1
        continue
      }

      eligible += 1
      const ownerUid = String(data.createdByUid ?? '').trim()
      if (sample.length < 40) {
        sample.push(
          `${docSnap.id} | ${data.companyName ?? ''} | owner=${ownerUid} | ${check.reason}`,
        )
      }

      if (!apply) continue

      const nextVersion = Number(data.statusVersion ?? 0) + 1
      const batch = db.batch()
      batch.update(docSnap.ref, {
        status: 'rejected',
        statusVersion: nextVersion,
        reviewNote: NEW_NOTE,
        updatedAt: FieldValue.serverTimestamp(),
      })
      batch.set(docSnap.ref.collection('history').doc(), {
        version: nextVersion,
        fromStatus: 'cancelled',
        toStatus: 'rejected',
        actorUid: 'system-migration',
        actorNameSnapshot: 'system-migration',
        actorRole: 'management',
        note: 'migrate-stale-pending-cancelled-to-rejected',
        createdAt: FieldValue.serverTimestamp(),
      })
      await batch.commit()
      updated += 1
      if (ownerUid) {
        statsDeltaByOwner.set(
          ownerUid,
          (statsDeltaByOwner.get(ownerUid) ?? 0) - 1,
        )
      }
    }

    if (snap.size < PAGE) break
  }

  if (apply && statsDeltaByOwner.size > 0) {
    for (const [uid, delta] of statsDeltaByOwner) {
      if (delta === 0) continue
      const userRef = db.collection('users').doc(uid)
      const userSnap = await userRef.get()
      if (!userSnap.exists) continue
      await userRef.update({
        'stats.jobsCancelled': FieldValue.increment(delta),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        scanned,
        eligible,
        skipped,
        updated,
        ownersTouched: statsDeltaByOwner.size,
        sample,
      },
      null,
      2,
    ),
  )
  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to write.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
