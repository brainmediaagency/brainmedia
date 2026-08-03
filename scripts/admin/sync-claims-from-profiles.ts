#!/usr/bin/env tsx
/**
 * Sync Firebase Auth custom claims (role + active) from Firestore users/{uid}.
 *
 * UI-created accounts often lack claims (Spark — no Admin SDK in browser).
 * Webhook / push filters work better when claims match the profile role.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/adminsdk.json \
 *   npm run admin:sync-claims
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ALLOWED_ROLES = new Set([
  'media_planning',
  'reporter',
  'human_resources',
  'coordinator',
  'management',
  'kameraman',
])

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
  const auth = getAuth()
  const db = getFirestore()
  const snap = await db.collection('users').get()

  let ok = 0
  let skip = 0
  let fail = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const uid = String(data.uid || doc.id)
    const role = String(data.role || '')
    const isActive = data.isActive !== false && data.deletedAt == null

    if (!ALLOWED_ROLES.has(role)) {
      skip += 1
      console.log(`SKIP ${uid} — invalid role "${role}"`)
      continue
    }

    try {
      const user = await auth.getUser(uid)
      const existing = (user.customClaims ?? {}) as Record<string, unknown>
      const next = { ...existing, role, active: isActive }
      await auth.setCustomUserClaims(uid, next)
      ok += 1
      console.log(
        `OK   ${data.email || uid} → role=${role} active=${isActive}`,
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (/no user record/i.test(msg)) {
        skip += 1
        console.log(`SKIP ${data.email || uid} — Auth user missing (orphan profile)`)
        continue
      }
      fail += 1
      console.error(`FAIL ${data.email || uid}:`, msg)
    }
  }

  console.log(`Done. ok=${ok} skip=${skip} fail=${fail}`)
  console.log('Users must sign out/in (or refresh token) to see new claims.')
  if (fail > 0) process.exit(1)
}

void main()
