#!/usr/bin/env tsx
/**
 * Seed Firebase Emulator with test users for local development.
 * Never run against production.
 *
 * Prerequisite: emulators running (auth :9099, firestore :8180)
 *   npm run emulators
 *   npm run seed:emulator
 */

import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8180'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'brain-workspace-demo'

initializeApp({ projectId: PROJECT_ID })

const SEED_USERS = [
  {
    email: 'media@brain.local',
    password: 'Test1234!',
    fullName: 'Ayşe Medya',
    role: 'media_planning' as const,
    shiftDurationMinutes: 360,
  },
  {
    email: 'reporter@brain.local',
    password: 'Test1234!',
    fullName: 'Burak Muhabir',
    role: 'reporter' as const,
    shiftDurationMinutes: null,
  },
  {
    email: 'hr@brain.local',
    password: 'Test1234!',
    fullName: 'Ceren IK',
    role: 'human_resources' as const,
    shiftDurationMinutes: null,
  },
  {
    email: 'coordinator@brain.local',
    password: 'Test1234!',
    fullName: 'Deniz Koordinatör',
    role: 'coordinator' as const,
    shiftDurationMinutes: null,
  },
  {
    email: 'management@brain.local',
    password: 'Test1234!',
    fullName: 'Ege Yönetim',
    role: 'management' as const,
    shiftDurationMinutes: null,
  },
]

async function upsertUser(seed: (typeof SEED_USERS)[number]) {
  const auth = getAuth()
  const db = getFirestore()

  let user
  try {
    user = await auth.getUserByEmail(seed.email)
    await auth.updateUser(user.uid, {
      password: seed.password,
      displayName: seed.fullName,
      emailVerified: true,
      disabled: false,
    })
  } catch {
    user = await auth.createUser({
      email: seed.email,
      password: seed.password,
      displayName: seed.fullName,
      emailVerified: true,
      disabled: false,
    })
  }

  await auth.setCustomUserClaims(user.uid, {
    role: seed.role,
    active: true,
  })

  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    fullName: seed.fullName,
    email: seed.email,
    role: seed.role,
    isActive: true,
    deletedAt: null,
    shiftDurationMinutes: seed.shiftDurationMinutes,
    timezone: 'Europe/Istanbul',
    stats: {
      jobsReceived: 0,
      jobsShot: 0,
      jobsCancelled: 0,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  console.log(`Seeded ${seed.email} (${seed.role}) → ${user.uid}`)
}

async function seedStorageUsage() {
  const db = getFirestore()
  const quotaBytes = 5 * 1024 * 1024 * 1024
  await db.collection('system').doc('storageUsage').set({
    usedBytes: 0,
    quotaBytes,
    objectCount: 0,
    updatedAt: FieldValue.serverTimestamp(),
    source: 'seed-emulator',
  })
  console.log('Seeded system/storageUsage (0 B / 5 GB)')
}

async function main() {
  console.log(`Seeding emulator project: ${PROJECT_ID}`)
  for (const seed of SEED_USERS) {
    await upsertUser(seed)
  }
  await seedStorageUsage()
  console.log('Done. Password for all seed users: Test1234!')
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
