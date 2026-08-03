#!/usr/bin/env tsx
/**
 * Upsert active Firestore users into OneSignal Audience (User Model).
 *
 * Creates / updates users with:
 *   identity.external_id = Firebase uid
 *   properties.tags.role = app role
 *   properties.tags.email = login email (optional segment aid)
 *
 * Push delivery still requires each person to open the app once and tap
 * “Bildirimleri aç” (browser permission + PushSubscription).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/adminsdk.json \
 *   ONESIGNAL_REST_API_KEY=os_v2_... \
 *   npm run admin:sync-onesignal
 *
 * Optional:
 *   ONESIGNAL_APP_ID=...   (defaults to VITE_ONESIGNAL_APP_ID from .env)
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ALLOWED_ROLES = new Set([
  'media_planning',
  'reporter',
  'human_resources',
  'coordinator',
  'management',
  'kameraman',
])

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
    if (!(key in process.env)) process.env[key] = value
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

async function upsertOneSignalUser(input: {
  appId: string
  apiKey: string
  uid: string
  role: string
  email: string
  fullName: string
}): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `https://api.onesignal.com/apps/${input.appId}/users`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identity: { external_id: input.uid },
      properties: {
        language: 'tr',
        timezone_id: 'Europe/Istanbul',
        tags: {
          role: input.role,
          email: input.email,
          fullName: input.fullName.slice(0, 64),
        },
      },
    }),
  })
  const body = await response.text()
  return { ok: response.ok, status: response.status, body }
}

async function main() {
  loadDotEnv()
  const appId =
    process.env.ONESIGNAL_APP_ID?.trim() ||
    process.env.VITE_ONESIGNAL_APP_ID?.trim() ||
    ''
  const apiKey = process.env.ONESIGNAL_REST_API_KEY?.trim() || ''

  if (!appId) {
    console.error('ERROR: ONESIGNAL_APP_ID or VITE_ONESIGNAL_APP_ID required')
    process.exit(1)
  }
  if (!apiKey) {
    console.error(
      'ERROR: ONESIGNAL_REST_API_KEY required.\n' +
        '  OneSignal → Settings → Keys & IDs → REST API Key\n' +
        '  (same value as Apps Script property ONESIGNAL_REST_API_KEY)',
    )
    process.exit(1)
  }

  initAdmin()
  const db = getFirestore()
  const snap = await db.collection('users').get()

  const targets = snap.docs
    .map((d) => {
      const data = d.data()
      return {
        uid: String(data.uid || d.id),
        email: String(data.email || ''),
        fullName: String(data.fullName || ''),
        role: String(data.role || ''),
        isActive: data.isActive !== false,
        deletedAt: data.deletedAt ?? null,
      }
    })
    .filter(
      (u) =>
        u.isActive &&
        u.deletedAt == null &&
        ALLOWED_ROLES.has(u.role) &&
        u.uid.length > 8,
    )

  console.log(`OneSignal app: ${appId}`)
  console.log(`Upserting ${targets.length} active users…`)

  let okCount = 0
  let failCount = 0
  for (const user of targets) {
    const result = await upsertOneSignalUser({
      appId,
      apiKey,
      uid: user.uid,
      role: user.role,
      email: user.email,
      fullName: user.fullName || user.email,
    })
    if (result.ok) {
      okCount += 1
      console.log(`  OK  ${user.email} (${user.role}) → ${user.uid}`)
    } else {
      failCount += 1
      console.error(
        `  FAIL ${user.email} HTTP ${result.status}: ${result.body.slice(0, 200)}`,
      )
    }
  }

  console.log(`Done. ok=${okCount} fail=${failCount}`)
  console.log(
    'Note: Audience users appear now; push only after each device taps “Bildirimleri aç”.',
  )
  if (failCount > 0) process.exit(1)
}

void main()
