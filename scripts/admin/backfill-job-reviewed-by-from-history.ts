#!/usr/bin/env tsx
/**
 * Restore jobs.reviewedBy* when a reporter (or other non-reviewer) overwrote
 * the konfirme reviewer during daily-report shot/cancel.
 *
 * Eligible: status in shot|cancelled|approved, reviewedByUid points at a user
 * whose role is NOT coordinator|management|sef. Restores from the latest
 * history entry toStatus === 'approved' whose actorRole is a job reviewer.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/backfill-job-reviewed-by-from-history.ts
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

const REVIEWER_ROLES = new Set(['coordinator', 'management', 'sef'])
const STATUSES = ['shot', 'cancelled', 'approved'] as const
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

type Fix = {
  uid: string
  name: string
  reviewedAt: FirebaseFirestore.Timestamp | null
}

async function findApprovalReviewer(
  db: Firestore,
  jobId: string,
): Promise<Fix | null> {
  const hist = await db
    .collection('jobs')
    .doc(jobId)
    .collection('history')
    .orderBy('createdAt', 'asc')
    .get()

  let best: Fix | null = null
  for (const h of hist.docs) {
    const d = h.data()
    const to = String(d.toStatus ?? '')
    const role = String(d.actorRole ?? '')
    if (to !== 'approved') continue
    if (!REVIEWER_ROLES.has(role)) continue
    const uid = String(d.actorUid ?? '').trim()
    const name = String(d.actorNameSnapshot ?? '').trim()
    if (!uid || !name) continue
    const createdAt = d.createdAt ?? null
    best = {
      uid,
      name,
      reviewedAt:
        createdAt && typeof createdAt.toDate === 'function' ? createdAt : null,
    }
  }
  return best
}

async function userRole(db: Firestore, uid: string): Promise<string | null> {
  if (!uid) return null
  const snap = await db.collection('users').doc(uid).get()
  if (!snap.exists) return null
  return String(snap.data()?.role ?? '') || null
}

async function main() {
  const apply = process.argv.includes('--apply')
  initAdmin()
  const db = getFirestore()

  let scanned = 0
  let eligible = 0
  let skipped = 0
  let updated = 0
  let noHistory = 0
  const sample: string[] = []
  const roleCache = new Map<string, string | null>()

  for (const status of STATUSES) {
    let lastDoc: QueryDocumentSnapshot | undefined
    for (;;) {
      let q = db
        .collection('jobs')
        .where('status', '==', status)
        .orderBy('__name__')
        .limit(PAGE)
      if (lastDoc) q = q.startAfter(lastDoc)
      const snap = await q.get()
      if (snap.empty) break

      for (const docSnap of snap.docs) {
        scanned += 1
        lastDoc = docSnap
        const data = docSnap.data()
        const reviewedByUid = String(data.reviewedByUid ?? '').trim()
        const reviewedByName = String(data.reviewedByNameSnapshot ?? '').trim()

        if (!reviewedByUid) {
          skipped += 1
          continue
        }

        let role = roleCache.get(reviewedByUid)
        if (role === undefined) {
          role = await userRole(db, reviewedByUid)
          roleCache.set(reviewedByUid, role)
        }

        if (role && REVIEWER_ROLES.has(role)) {
          skipped += 1
          continue
        }

        const fix = await findApprovalReviewer(db, docSnap.id)
        if (!fix) {
          noHistory += 1
          if (sample.length < 50) {
            sample.push(
              `${docSnap.id} | ${status} | bad=${reviewedByName || reviewedByUid} (role=${role ?? '?'}) | NO_APPROVAL_HISTORY`,
            )
          }
          continue
        }

        if (fix.uid === reviewedByUid) {
          skipped += 1
          continue
        }

        eligible += 1
        if (sample.length < 50) {
          sample.push(
            `${docSnap.id} | ${status} | ${reviewedByName || reviewedByUid} → ${fix.name}`,
          )
        }

        if (!apply) continue

        await docSnap.ref.update({
          reviewedByUid: fix.uid,
          reviewedByNameSnapshot: fix.name,
          ...(fix.reviewedAt ? { reviewedAt: fix.reviewedAt } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        })
        updated += 1
      }

      if (snap.size < PAGE) break
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        scanned,
        eligible,
        skipped,
        noHistory,
        updated,
        sample,
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
