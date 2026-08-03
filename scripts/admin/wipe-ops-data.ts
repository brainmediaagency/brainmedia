/**
 * Wipe operational Firestore data (keeps users / auth / roles).
 *
 * Collections:
 *   jobs (+ history), reporterDailyReports (+ history), voiceRecordings,
 *   reporterZReports, hrReports, hiringNotes, dailyRegions,
 *   managementNotifications, broadcastNotifications, userNotifications,
 *   reactionDailyScores, reactionDailyWinners, activeShifts, timeSync,
 *   users/{uid}/attendanceLogs (+ history)
 * Also zeros user job stats.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/wipe-ops-data.ts            # dry run counts
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   npx tsx scripts/admin/wipe-ops-data.ts --execute
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FLAT_COLLECTIONS = [
  'voiceRecordings',
  'reporterZReports',
  'hrReports',
  'hiringNotes',
  'dailyRegions',
  'managementNotifications',
  'broadcastNotifications',
  'reactionDailyScores',
  'reactionDailyWinners',
  'activeShifts',
  'timeSync',
] as const

const RECURSIVE_COLLECTIONS = ['jobs', 'reporterDailyReports'] as const

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

async function countCollection(name: string): Promise<number> {
  const db = getFirestore()
  return (await db.collection(name).count().get()).data().count
}

async function wipeFlat(name: string): Promise<number> {
  const db = getFirestore()
  const col = db.collection(name)
  let deleted = 0
  for (;;) {
    const snap = await col.limit(200).get()
    if (snap.empty) break
    const batch = db.batch()
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref)
    }
    deleted += snap.size
    await batch.commit()
    console.log(`  ${name}: deleted ${deleted}…`)
  }
  return deleted
}

/**
 * Wipe including “phantom” parents that only have subcollections
 * (e.g. jobs/{id}/history after the parent doc was deleted).
 * collection.get()/count() miss these; listDocuments() does not.
 */
async function wipeRecursive(name: string): Promise<number> {
  const db = getFirestore()
  const refs = await db.collection(name).listDocuments()
  let deleted = 0
  for (const ref of refs) {
    await db.recursiveDelete(ref)
    deleted += 1
    if (deleted % 25 === 0) {
      console.log(`  ${name}: deleted ${deleted}/${refs.length}…`)
    }
  }
  console.log(`  ${name}: deleted ${deleted}`)
  return deleted
}

async function wipeUserNotificationTrees(): Promise<number> {
  const db = getFirestore()
  const roots = await db.collection('userNotifications').get()
  let deleted = 0
  for (const root of roots.docs) {
    await db.recursiveDelete(root.ref)
    deleted += 1
  }
  console.log(`  userNotifications: wiped ${deleted} user trees`)
  return deleted
}

/** Clear attendance log trees under users (keep user profiles). */
async function wipeAttendanceLogs(): Promise<number> {
  const db = getFirestore()
  const users = await db.collection('users').get()
  let wiped = 0
  for (const userSnap of users.docs) {
    const logs = await userSnap.ref.collection('attendanceLogs').get()
    for (const logSnap of logs.docs) {
      await db.recursiveDelete(logSnap.ref)
      wiped += 1
    }
  }
  console.log(`  attendanceLogs: wiped ${wiped}`)
  return wiped
}

async function zeroJobStats(): Promise<number> {
  const db = getFirestore()
  const users = await db.collection('users').get()
  for (const userSnap of users.docs) {
    await userSnap.ref.update({
      stats: { jobsReceived: 0, jobsShot: 0, jobsCancelled: 0 },
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  console.log(`  users: stats zeroed for ${users.size}`)
  return users.size
}

async function main() {
  const execute = process.argv.includes('--execute')
  initAdmin()

  console.log(execute ? 'EXECUTE wipe' : 'DRY RUN (pass --execute to delete)')
  for (const name of RECURSIVE_COLLECTIONS) {
    const n = (await getFirestore().collection(name).listDocuments()).length
    console.log(`  ${name}: ${n} (incl. phantom parents w/ only subcollections)`)
  }
  for (const name of [...FLAT_COLLECTIONS, 'userNotifications'] as const) {
    const n = await countCollection(name)
    console.log(`  ${name}: ${n}`)
  }

  if (!execute) {
    console.log('\nNo deletes performed.')
    return
  }

  const summary: Record<string, number> = {}
  for (const name of RECURSIVE_COLLECTIONS) {
    summary[name] = await wipeRecursive(name)
  }
  for (const name of FLAT_COLLECTIONS) {
    summary[name] = await wipeFlat(name)
  }
  summary.userNotifications = await wipeUserNotificationTrees()
  summary.attendanceLogs = await wipeAttendanceLogs()
  summary.usersStatsZeroed = await zeroJobStats()

  console.log('SUCCESS', summary)
}

main().catch((error) => {
  console.error('ERROR:', error)
  process.exit(1)
})
