#!/usr/bin/env tsx
/**
 * Assign custom claims (role + active) and sync users/{uid} profile fields.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *   npm run admin:set-role -- --uid USER_UID --role media_planning
 *
 * Optional:
 *   --inactive   sets active/isActive to false
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ALLOWED_ROLES = [
  'media_planning',
  'reporter',
  'human_resources',
  'coordinator',
  'management',
] as const

type AllowedRole = (typeof ALLOWED_ROLES)[number]

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i += 1
    }
  }
  return args
}

function initAdmin() {
  if (getApps().length > 0) return

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    console.error(
      'ERROR: GOOGLE_APPLICATION_CREDENTIALS environment variable is required.',
    )
    console.error(
      'Point it to a Firebase service account JSON file outside the repository.',
    )
    process.exit(1)
  }

  const absolute = resolve(credPath)
  const raw = JSON.parse(readFileSync(absolute, 'utf8')) as ServiceAccount
  initializeApp({
    credential: cert(raw),
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const uid = args.uid
  const role = args.role
  const active = args.inactive === true ? false : true

  if (typeof uid !== 'string' || !uid) {
    console.error('ERROR: --uid USER_UID is required')
    process.exit(1)
  }
  if (typeof role !== 'string' || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    console.error(
      `ERROR: --role must be one of: ${ALLOWED_ROLES.join(', ')}`,
    )
    process.exit(1)
  }

  initAdmin()
  const auth = getAuth()
  const db = getFirestore()

  try {
    const user = await auth.getUser(uid)
    const existingClaims = (user.customClaims ?? {}) as Record<string, unknown>
    const nextClaims = {
      ...existingClaims,
      role: role as AllowedRole,
      active,
    }

    await auth.setCustomUserClaims(uid, nextClaims)

    const userRef = db.collection('users').doc(uid)
    const snap = await userRef.get()
    if (snap.exists) {
      await userRef.update({
        role,
        isActive: active,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      await userRef.set({
        uid,
        fullName: user.displayName ?? user.email ?? uid,
        email: user.email ?? '',
        role,
        isActive: active,
        shiftDurationMinutes: role === 'media_planning' ? null : null,
        timezone: 'Europe/Istanbul',
        stats: {
          jobsReceived: 0,
          jobsShot: 0,
          jobsCancelled: 0,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      console.warn(
        'WARN: users/%s did not exist — created a minimal profile. Prefer create-user-profile.ts for full setup.',
        uid,
      )
    }

    console.log('SUCCESS: role claims updated')
    console.log(`  uid:    ${uid}`)
    console.log(`  email:  ${user.email ?? '(none)'}`)
    console.log(`  role:   ${role}`)
    console.log(`  active: ${active}`)
    console.log(
      'Note: the user must refresh their ID token (sign out/in or getIdToken(true)) to see new claims.',
    )
  } catch (error) {
    console.error('ERROR: failed to set user role')
    console.error(error)
    process.exit(1)
  }
}

void main()
