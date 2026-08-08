/**
 * Live production role × action smoke test (custom tokens).
 * Creates disposable docs under matrix-smoke-* ids and deletes them after.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=... npx tsx scripts/admin/role-permission-smoke.ts
 */
import { initializeApp as adminInit, cert, getApps } from 'firebase-admin/app'
import { getAuth as adminAuth } from 'firebase-admin/auth'
import { getFirestore as adminFs, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInWithCustomToken } from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

const WEB = {
  apiKey: 'AIzaSyCrdFlPckKkKDnrAOe_IjaNmBiaqH_Shz0',
  authDomain: 'brain-c5fcb.firebaseapp.com',
  projectId: 'brain-c5fcb',
  appId: '1:426603619201:web:c2a83e6543dc7d8133be80',
}

type Role =
  | 'media_planning'
  | 'reporter'
  | 'human_resources'
  | 'coordinator'
  | 'management'
  | 'kameraman'

type Result = { role: Role; action: string; expect: 'allow' | 'deny'; ok: boolean; detail?: string }

const results: Result[] = []
const cleanupIds: Array<{ path: string }> = []

function record(r: Result) {
  results.push(r)
  const mark = r.ok ? '✓' : '✗'
  const exp = r.expect === 'allow' ? 'ALLOW' : 'DENY'
  console.log(`  ${mark} [${exp}] ${r.role} — ${r.action}${r.detail ? ` (${r.detail})` : ''}`)
}

async function tryOp(
  role: Role,
  action: string,
  expect: 'allow' | 'deny',
  fn: () => Promise<void>,
) {
  try {
    await fn()
    record({
      role,
      action,
      expect,
      ok: expect === 'allow',
      detail: expect === 'deny' ? 'unexpectedly succeeded' : undefined,
    })
  } catch (e: unknown) {
    const code =
      e && typeof e === 'object' && 'code' in e
        ? String((e as { code: string }).code)
        : 'error'
    const denied = code.includes('permission-denied') || code === 'permission-denied'
    record({
      role,
      action,
      expect,
      ok: expect === 'deny' ? denied : false,
      detail: expect === 'allow' ? code : denied ? undefined : code,
    })
  }
}

async function clientFor(uid: string): Promise<{ app: FirebaseApp; db: Firestore }> {
  const app = initializeApp(WEB, `smoke-${uid}-${Date.now()}`)
  await signInWithCustomToken(
    getAuth(app),
    await adminAuth().createCustomToken(uid),
  )
  return { app, db: getFirestore(app) }
}

function jobCreatePayload(uid: string, fullName: string, email: string) {
  return {
    companyName: 'Smoke Firma',
    companyNameNormalized: 'smoke firma',
    contactPersonName: 'Smoke Contact',
    contactPhone: '+905551112233',
    contactCount: 1,
    contacts: [
      { name: 'Smoke Contact', mobilePhone: '+905551112233', workPhone: null },
    ],
    province: 'İstanbul',
    district: 'Kadıköy',
    fullAddress: 'Caferağa Mahallesi smoke sokak no 1',
    instagram: null,
    acquiredDate: '2026-07-01',
    plannedExecutionDate: '2026-07-28',
    agreedAmountKurus: 150000,
    currency: 'TRY',
    status: 'pending',
    statusVersion: 1,
    createdByUid: uid,
    createdByNameSnapshot: fullName,
    createdByEmailSnapshot: email,
    createdByRole: 'media_planning',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewedByUid: null,
    reviewedByNameSnapshot: null,
    reviewedAt: null,
    reviewNote: null,
    forwardedToReporter: false,
    forwardedToReporterByUid: null,
    forwardedToReporterByNameSnapshot: null,
    forwardedToReporterAt: null,
    dailyReportId: null,
    idempotencyKey: `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  }
}

async function main() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS required')
  }
  const sa = JSON.parse(readFileSync(credPath, 'utf8'))
  if (!getApps().length) adminInit({ credential: cert(sa) })
  const adminDb = adminFs()

  const byRole = new Map<Role, { uid: string; fullName: string; email: string }>()
  for (const role of [
    'media_planning',
    'reporter',
    'human_resources',
    'coordinator',
    'management',
  ] as Role[]) {
    const snap = await adminDb
      .collection('users')
      .where('role', '==', role)
      .where('isActive', '==', true)
      .limit(5)
      .get()
    const docu = snap.docs.find((d) => d.data().deletedAt == null)
    if (!docu) {
      console.warn(`SKIP role ${role}: no active user`)
      continue
    }
    byRole.set(role, {
      uid: docu.id,
      fullName: String(docu.data().fullName ?? ''),
      email: String(docu.data().email ?? ''),
    })
  }

  console.log('\n=== Live role permission smoke ===\n')
  for (const [role, u] of byRole) {
    console.log(`${role}: ${u.fullName} (${u.uid.slice(0, 8)}…)`)
  }
  console.log('')

  // Seed a disposable pending job owned by media for review actions
  const media = byRole.get('media_planning')
  if (!media) throw new Error('Need an active media_planning user')
  const seedJobRef = adminDb.collection('jobs').doc()
  await seedJobRef.set({
    ...jobCreatePayload(media.uid, media.fullName, media.email),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  cleanupIds.push({ path: `jobs/${seedJobRef.id}` })

  const approvedJobRef = adminDb.collection('jobs').doc()
  await approvedJobRef.set({
    ...jobCreatePayload(media.uid, media.fullName, media.email),
    status: 'approved',
    statusVersion: 2,
    plannedExecutionDate: '2026-07-28T10:00',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  cleanupIds.push({ path: `jobs/${approvedJobRef.id}` })

  // ---- media_planning ----
  if (byRole.has('media_planning')) {
    const u = byRole.get('media_planning')!
    const { app, db } = await clientFor(u.uid)
    console.log('\n[media_planning]')

    await tryOp('media_planning', 'create pending job', 'allow', async () => {
      const ref = doc(collection(db, 'jobs'))
      await setDoc(ref, jobCreatePayload(u.uid, u.fullName, u.email))
      cleanupIds.push({ path: `jobs/${ref.id}` })
    })

    await tryOp('media_planning', 'start own shift', 'allow', async () => {
      // Clean any leftover active shift first (admin)
      await adminDb.doc(`activeShifts/${u.uid}`).delete().catch(() => undefined)
      await setDoc(doc(db, 'activeShifts', u.uid), {
        shiftId: `smoke-shift-${Date.now()}`,
        ownerUid: u.uid,
        ownerNameSnapshot: u.fullName,
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt: serverTimestamp(),
        timezone: 'Europe/Istanbul',
        createdAt: serverTimestamp(),
      })
      cleanupIds.push({ path: `activeShifts/${u.uid}` })
    })

    await tryOp('media_planning', 'approve job (should deny)', 'deny', async () => {
      await updateDoc(doc(db, 'jobs', seedJobRef.id), {
        status: 'approved',
        statusVersion: 2,
        updatedAt: serverTimestamp(),
        reviewedByUid: u.uid,
        reviewedByNameSnapshot: u.fullName,
        reviewedAt: serverTimestamp(),
        reviewNote: null,
        plannedExecutionDate: '2026-07-28T10:00',
      })
    })

    await tryOp('media_planning', 'create hrReport (should deny)', 'deny', async () => {
      await addDoc(collection(db, 'hrReports'), {
        title: 'Smoke',
        body: 'Body',
        mpuAttendances: [],
        createdByUid: u.uid,
        createdByNameSnapshot: u.fullName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    // End shift cleanup via admin so we don't leave active shift
    await adminDb.doc(`activeShifts/${u.uid}`).delete().catch(() => undefined)
    await deleteApp(app)
  }

  // ---- reporter ----
  if (byRole.has('reporter')) {
    const u = byRole.get('reporter')!
    const { app, db } = await clientFor(u.uid)
    console.log('\n[reporter]')

    await tryOp('reporter', 'read jobs', 'allow', async () => {
      const snap = await getDoc(doc(db, 'jobs', seedJobRef.id))
      if (!snap.exists()) throw new Error('missing job')
    })

    await tryOp('reporter', 'create daily report', 'allow', async () => {
      const ref = doc(collection(db, 'reporterDailyReports'))
      await setDoc(ref, {
        reportDate: '2026-07-27',
        companyCount: 1,
        companies: [
          {
            jobId: null,
            companyName: 'Smoke',
            hasNews: false,
            newsTotalKurus: null,
            newsReporterFeeKurus: null,
            newsCameramanFeeKurus: null,
            shootMinutes: 3,
            shootReporterFeeKurus: 0,
            shootCameramanFeeKurus: 0,
            vatRate: 20,
            vatBaseKurus: 0,
            vatKurus: 0,
            chargeMode: 'cash',
          },
        ],
        note: '',
        hotelExpenseKurus: 0,
        stationeryExpenseKurus: 0,
        fuelExpenseKurus: 0,
        mealExpenseKurus: 0,
        extraExpenseKurus: 0,
        operatingExpenseKurus: 0,
        employeeExpenseKurus: 0,
        totalExpenseKurus: 0,
        earningsKurus: 0,
        fieldPaidKurus: 0,
        totalReporterEarningsKurus: 0,
        totalCameramanEarningsKurus: 0,
        totalVatKurus: 0,
        editVersion: 0,
        createdByUid: u.uid,
        createdByNameSnapshot: u.fullName,
        createdByEmailSnapshot: u.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: u.uid,
        updatedByNameSnapshot: u.fullName,
        deletedAt: null,
        deletedByUid: null,
        deletedByNameSnapshot: null,
      })
      cleanupIds.push({ path: `reporterDailyReports/${ref.id}` })
    })

    await tryOp('reporter', 'mark approved job as shot', 'allow', async () => {
      await updateDoc(doc(db, 'jobs', approvedJobRef.id), {
        status: 'shot',
        statusVersion: 3,
        updatedAt: serverTimestamp(),
        reviewedByUid: u.uid,
        reviewedByNameSnapshot: u.fullName,
        reviewedAt: serverTimestamp(),
        reviewNote: null,
      })
    })

    await tryOp('reporter', 'create job (should deny)', 'deny', async () => {
      await setDoc(doc(collection(db, 'jobs')), {
        ...jobCreatePayload(u.uid, u.fullName, u.email),
        createdByRole: 'reporter',
      })
    })

    await tryOp('reporter', 'start shift (should deny)', 'deny', async () => {
      await setDoc(doc(db, 'activeShifts', u.uid), {
        shiftId: `smoke-${Date.now()}`,
        ownerUid: u.uid,
        ownerNameSnapshot: u.fullName,
        roleSnapshot: 'reporter',
        status: 'active',
        startedAt: serverTimestamp(),
        timezone: 'Europe/Istanbul',
        createdAt: serverTimestamp(),
      })
    })

    await deleteApp(app)
  }

  // ---- human_resources ----
  if (byRole.has('human_resources')) {
    const u = byRole.get('human_resources')!
    const { app, db } = await clientFor(u.uid)
    console.log('\n[human_resources]')

    await tryOp('human_resources', 'create hrReport + 8 MPU mesai', 'allow', async () => {
      const mpus = await adminDb
        .collection('users')
        .where('role', '==', 'media_planning')
        .where('isActive', '==', true)
        .limit(8)
        .get()
      const mpuAttendances = mpus.docs.map((d) => ({
        mpuUid: d.id,
        mpuNameSnapshot: String(d.data().fullName ?? 'MPU'),
        clockInTime: '10:00',
        clockOutTime: '18:30',
        absent: false,
      }))
      const ref = await addDoc(collection(db, 'hrReports'), {
        title: 'Smoke İK mesai',
        body: 'Smoke body',
        mpuAttendances,
        createdByUid: u.uid,
        createdByNameSnapshot: u.fullName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      cleanupIds.push({ path: `hrReports/${ref.id}` })
    })

    await tryOp('human_resources', 'create hiring note', 'allow', async () => {
      const ref = await addDoc(collection(db, 'hiringNotes'), {
        candidateName: 'Smoke Aday',
        note: 'Smoke not',
        attachments: [],
        createdByUid: u.uid,
        createdByNameSnapshot: u.fullName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      cleanupIds.push({ path: `hiringNotes/${ref.id}` })
    })

    await tryOp('human_resources', 'approve job (should deny)', 'deny', async () => {
      await updateDoc(doc(db, 'jobs', seedJobRef.id), {
        status: 'approved',
        statusVersion: 2,
        updatedAt: serverTimestamp(),
        reviewedByUid: u.uid,
        reviewedByNameSnapshot: u.fullName,
        reviewedAt: serverTimestamp(),
        reviewNote: null,
        plannedExecutionDate: '2026-07-28T10:00',
      })
    })

    // Soft-delete deny on a disposable clone — don't touch real media1
    const cloneUid = `smoke-freeze-${Date.now()}`
    await adminDb.doc(`users/${cloneUid}`).set({
      uid: cloneUid,
      fullName: 'Smoke Clone',
      email: 'smoke-clone@brain.local',
      role: 'media_planning',
      isActive: true,
      deletedAt: null,
      shiftDurationMinutes: null,
      timezone: 'Europe/Istanbul',
      stats: { jobsReceived: 0, jobsShot: 0, jobsCancelled: 0 },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    cleanupIds.push({ path: `users/${cloneUid}` })

    await tryOp('human_resources', 'freeze manageable account', 'allow', async () => {
      await updateDoc(doc(db, 'users', cloneUid), {
        isActive: false,
        updatedAt: serverTimestamp(),
      })
    })

    await tryOp('human_resources', 'soft-delete account (should deny)', 'deny', async () => {
      await updateDoc(doc(db, 'users', cloneUid), {
        isActive: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    await deleteApp(app)
  }

  // ---- coordinator ----
  if (byRole.has('coordinator')) {
    const u = byRole.get('coordinator')!
    const { app, db } = await clientFor(u.uid)
    console.log('\n[coordinator]')

    // Fresh pending job for approve
    const jobId = adminDb.collection('jobs').doc().id
    await adminDb.doc(`jobs/${jobId}`).set({
      ...jobCreatePayload(media.uid, media.fullName, media.email),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    cleanupIds.push({ path: `jobs/${jobId}` })

    await tryOp('coordinator', 'approve pending job', 'allow', async () => {
      await updateDoc(doc(db, 'jobs', jobId), {
        status: 'approved',
        statusVersion: 2,
        updatedAt: serverTimestamp(),
        reviewedByUid: u.uid,
        reviewedByNameSnapshot: u.fullName,
        reviewedAt: serverTimestamp(),
        reviewNote: null,
        plannedExecutionDate: '2026-07-28T10:00',
      })
    })

    await tryOp('coordinator', 'set daily region', 'allow', async () => {
      const dateId = '2099-01-01' // far future disposable
      await setDoc(doc(db, 'dailyRegions', dateId), {
        date: dateId,
        region: 'Smoke Bölge',
        updatedByUid: u.uid,
        updatedByNameSnapshot: u.fullName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      cleanupIds.push({ path: `dailyRegions/${dateId}` })
    })

    await tryOp('coordinator', 'create hrReport (should deny)', 'deny', async () => {
      await addDoc(collection(db, 'hrReports'), {
        title: 'Smoke',
        body: 'Body',
        mpuAttendances: [],
        createdByUid: u.uid,
        createdByNameSnapshot: u.fullName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    await deleteApp(app)
  }

  // ---- management ----
  if (byRole.has('management')) {
    const u = byRole.get('management')!
    const { app, db } = await clientFor(u.uid)
    console.log('\n[management]')

    const jobId = adminDb.collection('jobs').doc().id
    await adminDb.doc(`jobs/${jobId}`).set({
      ...jobCreatePayload(media.uid, media.fullName, media.email),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    cleanupIds.push({ path: `jobs/${jobId}` })

    await tryOp('management', 'approve pending job', 'allow', async () => {
      await updateDoc(doc(db, 'jobs', jobId), {
        status: 'approved',
        statusVersion: 2,
        updatedAt: serverTimestamp(),
        reviewedByUid: u.uid,
        reviewedByNameSnapshot: u.fullName,
        reviewedAt: serverTimestamp(),
        reviewNote: null,
        plannedExecutionDate: '2026-07-28T10:00',
      })
    })

    await tryOp('management', 'read managementNotifications query', 'allow', async () => {
      // Single get of a seeded notif
      const nref = adminDb.collection('managementNotifications').doc()
      await nref.set({
        type: 'hr_report',
        title: 'Smoke',
        body: 'Body',
        link: '/human-resources',
        createdByUid: u.uid,
        createdByNameSnapshot: u.fullName,
        createdAt: FieldValue.serverTimestamp(),
        readByUids: [],
      })
      cleanupIds.push({ path: `managementNotifications/${nref.id}` })
      const snap = await getDoc(doc(db, 'managementNotifications', nref.id))
      if (!snap.exists()) throw new Error('notif missing')
    })

    await tryOp('management', 'create hrReport (should deny)', 'deny', async () => {
      await addDoc(collection(db, 'hrReports'), {
        title: 'Smoke',
        body: 'Body',
        mpuAttendances: [],
        createdByUid: u.uid,
        createdByNameSnapshot: u.fullName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    await deleteApp(app)
  }

  // Cleanup disposable docs
  console.log('\nCleaning up…')
  for (const { path } of cleanupIds) {
    await adminDb.doc(path).delete().catch(() => undefined)
  }

  const failed = results.filter((r) => !r.ok)
  const passed = results.filter((r) => r.ok)
  console.log(`\n=== Summary: ${passed.length} passed, ${failed.length} failed / ${results.length} total ===`)
  if (failed.length) {
    console.log('\nFailures:')
    for (const f of failed) {
      console.log(`  - ${f.role}: ${f.action} (${f.detail ?? 'failed'})`)
    }
    process.exitCode = 1
  } else {
    console.log('\nAll role permission checks passed.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
