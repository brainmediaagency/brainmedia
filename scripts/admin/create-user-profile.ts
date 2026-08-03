#!/usr/bin/env tsx
/**
 * Create (or update) a Firebase Auth user + Firestore users/{uid} profile.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *   npm run admin:create-user -- \
 *     --email user@company.com \
 *     --password 'TempPass123!' \
 *     --fullName 'Ad Soyad' \
 *     --role media_planning \
 *     --shiftMinutes 360
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
  'kameraman',
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
    console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS is required.')
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(resolve(credPath), 'utf8')) as ServiceAccount
  initializeApp({ credential: cert(raw) })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const email = args.email
  const password = args.password
  const fullName = args.fullName
  const role = args.role
  const shiftMinutesRaw = args.shiftMinutes

  if (typeof email !== 'string' || !email) {
    console.error('ERROR: --email is required')
    process.exit(1)
  }
  if (typeof password !== 'string' || password.length < 8) {
    console.error('ERROR: --password (min 8 chars) is required')
    process.exit(1)
  }
  if (typeof fullName !== 'string' || fullName.trim().length < 2) {
    console.error('ERROR: --fullName is required')
    process.exit(1)
  }
  if (typeof role !== 'string' || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    console.error(`ERROR: --role must be one of: ${ALLOWED_ROLES.join(', ')}`)
    process.exit(1)
  }

  let shiftDurationMinutes: number | null = null
  if (typeof shiftMinutesRaw === 'string') {
    const n = Number(shiftMinutesRaw)
    if (!Number.isInteger(n) || n <= 0) {
      console.error('ERROR: --shiftMinutes must be a positive integer')
      process.exit(1)
    }
    shiftDurationMinutes = n
  }

  initAdmin()
  const auth = getAuth()
  const db = getFirestore()

  try {
    let user
    try {
      user = await auth.getUserByEmail(email)
      await auth.updateUser(user.uid, {
        password,
        displayName: fullName,
        emailVerified: true,
        disabled: false,
      })
      console.log(`Updated existing Auth user ${user.uid}`)
    } catch {
      user = await auth.createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: true,
        disabled: false,
      })
      console.log(`Created Auth user ${user.uid}`)
    }

    const existingClaims = (user.customClaims ?? {}) as Record<string, unknown>
    await auth.setCustomUserClaims(user.uid, {
      ...existingClaims,
      role: role as AllowedRole,
      active: true,
    })

    await db.collection('users').doc(user.uid).set(
      {
        uid: user.uid,
        fullName: fullName.trim(),
        email,
        role,
        isActive: true,
        deletedAt: null,
        shiftDurationMinutes,
        timezone: 'Europe/Istanbul',
        stats: {
          jobsReceived: 0,
          jobsShot: 0,
          jobsCancelled: 0,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    console.log('SUCCESS: user profile ready')
    console.log(`  uid:   ${user.uid}`)
    console.log(`  email: ${email}`)
    console.log(`  role:  ${role}`)
    console.log(`  shift: ${shiftDurationMinutes ?? 'null'}`)
  } catch (error) {
    console.error('ERROR: failed to create user profile')
    console.error(error)
    process.exit(1)
  }
}

void main()
