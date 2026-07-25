/**
 * Call Apps Script wipeBrainUploads (requires webhook v16+ deployed).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/wipe-drive-uploads.ts
 *
 * Optional:
 *   VITE_SHEETS_WEBHOOK_URL=...  (defaults to .env)
 *   VITE_FIREBASE_API_KEY=...
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
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

async function getManagementIdToken(apiKey: string): Promise<string> {
  const db = getFirestore()
  const auth = getAuth()
  const snap = await db
    .collection('users')
    .where('role', '==', 'management')
    .where('isActive', '==', true)
    .limit(5)
    .get()

  const uid =
    snap.docs.find((d) => !d.data().deletedAt)?.id ||
    (await auth.getUserByEmail('baran@brain.com').then((u) => u.uid))

  const customToken = await auth.createCustomToken(uid, { role: 'management' })
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  const data = (await res.json()) as { idToken?: string; error?: { message?: string } }
  if (!res.ok || !data.idToken) {
    throw new Error(data.error?.message || `signInWithCustomToken failed (${res.status})`)
  }
  return data.idToken
}

async function main() {
  loadDotEnv()
  initAdmin()

  const webhookUrl = process.env.VITE_SHEETS_WEBHOOK_URL
  const apiKey = process.env.VITE_FIREBASE_API_KEY
  if (!webhookUrl || !apiKey) {
    console.error('ERROR: VITE_SHEETS_WEBHOOK_URL and VITE_FIREBASE_API_KEY required')
    process.exit(1)
  }

  const ping = await fetch(webhookUrl)
  const pingBody = (await ping.json()) as {
    version?: string
    features?: string[]
  }
  console.log('Webhook', pingBody.version, pingBody.features)

  if (!pingBody.features?.includes('wipeBrainUploads')) {
    console.error(
      'ERROR: Live webhook is not v16 yet. In Apps Script: paste latest Code.gs → Deploy → Manage deployments → Edit → New version → Deploy',
    )
    process.exit(2)
  }

  const idToken = await getManagementIdToken(apiKey)
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'wipeBrainUploads', idToken }),
    redirect: 'follow',
  })
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  console.log('HTTP', res.status, body)
  if (!res.ok || (body as { ok?: boolean })?.ok === false) {
    process.exit(1)
  }
  console.log('SUCCESS: BrainUploads wiped')
}

main().catch((error) => {
  console.error('ERROR:', error)
  process.exit(1)
})
