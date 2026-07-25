#!/usr/bin/env tsx
/**
 * Compute Firebase Storage bucket usage and write Firestore `system/storageUsage`.
 * Works on Spark (no Cloud Functions). Run periodically (cron / manually).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npm run admin:refresh-storage
 *
 * Optional:
 *   FIREBASE_STORAGE_BUCKET=brain-c5fcb.firebasestorage.app
 *   STORAGE_QUOTA_BYTES=5368709120   (default: 5 GiB Spark free tier)
 *   DRY_RUN=1                       (print totals without writing)
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { Storage } from '@google-cloud/storage'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_QUOTA_BYTES = 5 * 1024 * 1024 * 1024
const DEFAULT_BUCKET = 'brain-c5fcb.firebasestorage.app'
const PROJECT_ID = 'brain-c5fcb'

let serviceAccountCreds: ServiceAccount | null = null

function initAdmin() {
  if (getApps().length > 0) return
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS is required.')
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(resolve(credPath), 'utf8')) as ServiceAccount
  serviceAccountCreds = raw
  initializeApp({
    credential: cert(raw),
    projectId: PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? DEFAULT_BUCKET,
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = -1
  do {
    value /= 1024
    i += 1
  } while (value >= 1024 && i < units.length - 1)
  return `${value.toFixed(value >= 10 || i === 0 ? 1 : 2)} ${units[i]}`
}

async function resolveBucketName(): Promise<string | null> {
  const configured = process.env.FIREBASE_STORAGE_BUCKET?.trim()
  if (configured) {
    const [exists] = await getStorage().bucket(configured).exists()
    if (exists) return configured
    console.warn(`Configured bucket not found: ${configured}`)
  }

  const candidates = [
    'brain-c5fcb.appspot.com',
    'brain-c5fcb.firebasestorage.app',
  ]
  for (const name of candidates) {
    const [exists] = await getStorage().bucket(name).exists()
    if (exists) return name
  }

  if (serviceAccountCreds) {
    try {
      const gcs = new Storage({
        projectId: PROJECT_ID,
        credentials: serviceAccountCreds as object,
      })
      const [buckets] = await gcs.getBuckets()
      if (buckets.length > 0) return buckets[0]!.name
    } catch (err) {
      console.warn(
        'Could not list buckets:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  return null
}

async function sumBucketUsage(
  bucketName: string,
): Promise<{ usedBytes: number; objectCount: number }> {
  const bucket = getStorage().bucket(bucketName)
  let usedBytes = 0
  let objectCount = 0

  const [files] = await bucket.getFiles({ autoPaginate: true })
  for (const file of files) {
    const size = Number(file.metadata?.size ?? 0)
    if (Number.isFinite(size) && size > 0) {
      usedBytes += size
    }
    objectCount += 1
  }

  return { usedBytes, objectCount }
}

async function main() {
  initAdmin()

  const quotaBytes = Number(process.env.STORAGE_QUOTA_BYTES ?? DEFAULT_QUOTA_BYTES)
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

  const bucketName = await resolveBucketName()
  let usedBytes = 0
  let objectCount = 0

  if (!bucketName) {
    console.warn(
      'No Firebase Storage bucket found yet. Writing usedBytes=0 (enable Storage, then re-run).',
    )
  } else {
    console.log(`Listing Storage objects in ${bucketName}…`)
    ;({ usedBytes, objectCount } = await sumBucketUsage(bucketName))
  }

  console.log(
    `Usage: ${formatBytes(usedBytes)} (${usedBytes} bytes) / ${formatBytes(quotaBytes)} · ${objectCount} objects`,
  )

  if (dryRun) {
    console.log('DRY_RUN=1 — Firestore not updated.')
    return
  }

  const ref = getFirestore().collection('system').doc('storageUsage')
  const existing = await ref.get()
  const preservedQuota =
    existing.exists && Number(existing.data()?.quotaBytes) > 0
      ? Number(existing.data()?.quotaBytes)
      : quotaBytes

  await ref.set(
    {
      usedBytes,
      quotaBytes: process.env.STORAGE_QUOTA_BYTES
        ? quotaBytes
        : preservedQuota,
      objectCount,
      updatedAt: FieldValue.serverTimestamp(),
      source: 'admin-script',
      bucketName: bucketName ?? null,
    },
    { merge: true },
  )

  console.log('Wrote system/storageUsage')
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
