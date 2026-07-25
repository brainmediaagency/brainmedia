#!/usr/bin/env tsx
/**
 * Hard-delete a Firebase Auth user + Firestore users/{uid} profile.
 * Use after soft-delete in the app when you need Auth cleanup (Spark-safe, local Admin SDK).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *   npm run admin:delete-user -- --uid USER_UID
 *
 * Optional:
 *   --email user@company.com   (resolve uid by email)
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  let uid = typeof args.uid === 'string' ? args.uid : ''
  const email = typeof args.email === 'string' ? args.email : ''

  if (!uid && !email) {
    console.error('ERROR: --uid or --email is required')
    process.exit(1)
  }

  initAdmin()
  const auth = getAuth()
  const db = getFirestore()

  try {
    if (!uid && email) {
      const user = await auth.getUserByEmail(email)
      uid = user.uid
    }

    try {
      await auth.deleteUser(uid)
      console.log(`Deleted Auth user ${uid}`)
    } catch (error) {
      console.warn('WARN: Auth delete failed (may already be gone)', error)
    }

    await db.collection('users').doc(uid).delete()
    console.log(`Deleted Firestore profile users/${uid}`)
    console.log('SUCCESS')
  } catch (error) {
    console.error('ERROR: failed to delete user')
    console.error(error)
    process.exit(1)
  }
}

void main()
