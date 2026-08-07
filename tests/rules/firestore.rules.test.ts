import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const PROJECT_ID = 'brain-workspace-rules-test'
const RULES_PATH = resolve(process.cwd(), 'firestore.rules')

let testEnv: RulesTestEnvironment

function authClaims(
  role: string,
  extras: { active?: boolean; emailVerified?: boolean } = {},
) {
  return {
    email: `${role}@brain.local`,
    email_verified: extras.emailVerified ?? true,
    active: extras.active ?? true,
    role,
  }
}

async function seedUser(
  uid: string,
  role: string,
  opts: {
    shiftDurationMinutes?: number | null
    isActive?: boolean
    stats?: { jobsReceived: number; jobsShot: number; jobsCancelled: number }
  } = {},
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', uid), {
      uid,
      fullName: `User ${uid}`,
      email: `${uid}@brain.local`,
      role,
      isActive: opts.isActive ?? true,
      deletedAt: null,
      shiftDurationMinutes: opts.shiftDurationMinutes ?? null,
      timezone: 'Europe/Istanbul',
      stats: opts.stats ?? { jobsReceived: 0, jobsShot: 0, jobsCancelled: 0 },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  })
}

function jobPayload(overrides: Record<string, unknown> = {}) {
  return {
    companyName: 'Test Firma',
    companyNameNormalized: 'test firma',
    contactPersonName: 'Ali Veli',
    contactPhone: '+905551112233',
    contactCount: 1,
    contacts: [
      {
        name: 'Ali Veli',
        mobilePhone: '+905551112233',
        workPhone: null,
      },
    ],
    province: 'İstanbul',
    district: 'Kadıköy',
    fullAddress: 'Caferağa Mahallesi örnek sokak no 1',
    instagram: null,
    acquiredDate: '2026-07-01',
    plannedExecutionDate: '2026-07-10',
    agreedAmountKurus: 150000,
    currency: 'TRY',
    status: 'pending',
    statusVersion: 1,
    createdByUid: 'media1',
    createdByNameSnapshot: 'User media1',
    createdByEmailSnapshot: 'media1@brain.local',
    createdByRole: 'media_planning',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    reviewedByUid: null,
    reviewedByNameSnapshot: null,
    reviewedAt: null,
    reviewNote: null,
    forwardedToReporter: false,
    forwardedToReporterByUid: null,
    forwardedToReporterByNameSnapshot: null,
    forwardedToReporterAt: null,
    dailyReportId: null,
    idempotencyKey: 'idem-key-12345678',
    ...overrides,
  }
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8180),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('Authentication and roles', () => {
  it('1. unauthenticated users cannot read protected data', async () => {
    await seedUser('media1', 'media_planning')
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users', 'media1')))
  })

  it('2. user without profile cannot read', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(getDoc(doc(db, 'users', 'other')))
  })

  it('3. inactive profile user cannot read', async () => {
    await seedUser('media1', 'media_planning', { isActive: false })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(getDoc(doc(db, 'users', 'media1')))
  })

  it('4. media planning can read own profile and jobs', async () => {
    await seedUser('media1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'media1')))
    await assertSucceeds(getDoc(doc(db, 'jobs', 'job1')))
  })

  it('5. media planning cannot read another planner job', async () => {
    await seedUser('media1', 'media_planning')
    await seedUser('media2', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job2'),
        jobPayload({ createdByUid: 'media2', createdByNameSnapshot: 'User media2' }),
      )
    })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(getDoc(doc(db, 'jobs', 'job2')))
  })

  it('6. reporter can read jobs', async () => {
    await seedUser('reporter1', 'reporter')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })
    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'jobs', 'job1')))
  })

  it('7. human resources can read jobs', async () => {
    await seedUser('hr1', 'human_resources')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })
    const db = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'jobs', 'job1')))
  })

  it('8. coordinator can read jobs', async () => {
    await seedUser('coord1', 'coordinator')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'jobs', 'job1')))
  })

  it('9. coordinator cannot read management profile', async () => {
    await seedUser('mgmt1', 'management')
    await seedUser('coord1', 'coordinator')
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertFails(getDoc(doc(db, 'users', 'mgmt1')))
  })

  it('9b. HR can list and read manageable account profiles', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('hr2', 'human_resources')
    await seedUser('media1', 'media_planning')
    await seedUser('reporter1', 'reporter')
    await seedUser('coord1', 'coordinator')
    await seedUser('mgmt1', 'management')
    const db = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()

    await assertSucceeds(getDoc(doc(db, 'users', 'media1')))
    await assertSucceeds(getDoc(doc(db, 'users', 'reporter1')))
    await assertSucceeds(getDoc(doc(db, 'users', 'hr2')))
    await assertFails(getDoc(doc(db, 'users', 'coord1')))
    await assertFails(getDoc(doc(db, 'users', 'mgmt1')))

    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'users'),
          where('role', 'in', [
            'media_planning',
            'reporter',
            'human_resources',
          ]),
          orderBy('fullName', 'asc'),
          limit(100),
        ),
      ),
    )
  })

  it('10. management can read required data', async () => {
    await seedUser('mgmt1', 'management')
    await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
      await setDoc(doc(ctx.firestore(), 'users', 'media1', 'attendanceLogs', 's1'), {
        shiftId: 's1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'completed',
        startedAt: Timestamp.now(),
        endedAt: Timestamp.now(),
        workedMinutes: 360,
        timezone: 'Europe/Istanbul',
        finalizedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'media1')))
    await assertSucceeds(getDoc(doc(db, 'jobs', 'job1')))
    await assertSucceeds(getDoc(doc(db, 'users', 'media1', 'attendanceLogs', 's1')))
  })
})

describe('Job create', () => {
  beforeEach(async () => {
    await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
  })

  it('11. media planning can create pending job with own uid', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertSucceeds(
      setDoc(doc(db, 'jobs', 'job-new'), {
        ...jobPayload(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('12. cannot create job for another uid', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'jobs', 'job-bad'), {
        ...jobPayload({ createdByUid: 'media2' }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('13. cannot create approved job', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'jobs', 'job-bad'), {
        ...jobPayload({ status: 'approved' }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('14. cannot create job with negative amount', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'jobs', 'job-bad'), {
        ...jobPayload({ agreedAmountKurus: -100 }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('15. cannot create job with extra fields', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'jobs', 'job-bad'), {
        ...jobPayload(),
        hackerField: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('16. cannot invent client createdAt timestamp', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'jobs', 'job-bad'), {
        ...jobPayload({
          createdAt: Timestamp.fromMillis(Date.now() - 86_400_000),
          updatedAt: Timestamp.fromMillis(Date.now() - 86_400_000),
        }),
      }),
    )
  })
})

describe('Job update', () => {
  beforeEach(async () => {
    await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
    await seedUser('coord1', 'coordinator')
    await seedUser('mgmt1', 'management')
    await seedUser('reporter1', 'reporter')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })
  })

  it('18. media planning cannot update job status', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'jobs', 'job1'), {
        status: 'approved',
        statusVersion: 2,
      }),
    )
  })

  it('18b. media planning can edit own pending job content', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job1'), {
        companyName: 'Test Firma Updated',
        companyNameNormalized: 'test firma updated',
        contactPersonName: 'Ali Veli',
        contactPhone: '+905551112233',
        contactCount: 1,
        contacts: [
          {
            name: 'Ali Veli',
            mobilePhone: '+905551112233',
            workPhone: null,
          },
        ],
        province: 'İstanbul',
        district: 'Kadıköy',
        fullAddress: 'Caferağa Mahallesi örnek sokak no 1',
        acquiredDate: '2026-07-01',
        plannedExecutionDate: '2026-07-10',
        agreedAmountKurus: 160000,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('18c. media planning cannot edit another planner pending job', async () => {
    await seedUser('media2', 'media_planning', { shiftDurationMinutes: 360 })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job-other'),
        jobPayload({ createdByUid: 'media2', createdByNameSnapshot: 'User media2', createdByEmailSnapshot: 'media2@brain.local' }),
      )
    })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'jobs', 'job-other'), {
        companyName: 'Hacked',
        companyNameNormalized: 'hacked',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('18d. management can reschedule approved job content (date/time)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job-approved'),
        jobPayload({
          status: 'approved',
          statusVersion: 2,
          plannedExecutionDate: '2026-07-10T14:00',
          reviewedByUid: 'mgmt1',
          reviewedByNameSnapshot: 'User mgmt1',
          reviewedAt: Timestamp.now(),
        }),
      )
    })
    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job-approved'), {
        companyName: 'Test Firma',
        companyNameNormalized: 'test firma',
        contactPersonName: 'Ali Veli',
        contactPhone: '+905551112233',
        contactCount: 1,
        contacts: [
          {
            name: 'Ali Veli',
            mobilePhone: '+905551112233',
            workPhone: null,
          },
        ],
        province: 'İstanbul',
        district: 'Kadıköy',
        fullAddress: 'Caferağa Mahallesi örnek sokak no 1',
        instagram: null,
        acquiredDate: '2026-07-01',
        plannedExecutionDate: '2026-08-15T11:00',
        agreedAmountKurus: 150000,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('18e. media planning cannot edit approved job content', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job-approved-2'),
        jobPayload({
          status: 'approved',
          statusVersion: 2,
          plannedExecutionDate: '2026-07-10T14:00',
          reviewedByUid: 'mgmt1',
          reviewedByNameSnapshot: 'User mgmt1',
          reviewedAt: Timestamp.now(),
        }),
      )
    })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'jobs', 'job-approved-2'), {
        companyName: 'Test Firma',
        companyNameNormalized: 'test firma',
        contactPersonName: 'Ali Veli',
        contactPhone: '+905551112233',
        contactCount: 1,
        contacts: [
          {
            name: 'Ali Veli',
            mobilePhone: '+905551112233',
            workPhone: null,
          },
        ],
        province: 'İstanbul',
        district: 'Kadıköy',
        fullAddress: 'Caferağa Mahallesi örnek sokak no 1',
        instagram: null,
        acquiredDate: '2026-07-01',
        plannedExecutionDate: '2026-08-15T11:00',
        agreedAmountKurus: 150000,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('19-20. coordinator/management can approve with stats+history', async () => {
    for (const actor of [
      { uid: 'coord1', role: 'coordinator', name: 'User coord1' },
      { uid: 'mgmt1', role: 'management', name: 'User mgmt1' },
    ]) {
      await testEnv.clearFirestore()
      await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
      await seedUser(actor.uid, actor.role)
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
      })

      const db = testEnv
        .authenticatedContext(actor.uid, authClaims(actor.role))
        .firestore()

      // Use batched-like sequential writes in a transaction via rules unit testing
      // We simulate with withSecurityRulesDisabled for complex multi-doc then verify
      // Actually we need atomic client writes - use runTransaction from the authenticated sdk
      const { runTransaction, collection: col } = await import('firebase/firestore')
      await assertSucceeds(
        runTransaction(db, async (tx) => {
          const jobRef = doc(db, 'jobs', 'job1')
          const userRef = doc(db, 'users', 'media1')
          const jobSnap = await tx.get(jobRef)
          const userSnap = await tx.get(userRef)
          const stats = userSnap.data()!.stats as {
            jobsReceived: number
            jobsShot: number
            jobsCancelled: number
          }
          tx.update(jobRef, {
            status: 'approved',
            statusVersion: 2,
            plannedExecutionDate: '2026-07-10T14:00',
            reviewedByUid: actor.uid,
            reviewedByNameSnapshot: actor.name,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            reviewNote: null,
          })
          tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
            version: 2,
            fromStatus: 'pending',
            toStatus: 'approved',
            actorUid: actor.uid,
            actorNameSnapshot: actor.name,
            actorRole: actor.role,
            note: null,
            createdAt: serverTimestamp(),
          })
          tx.update(userRef, {
            stats: {
              ...stats,
              jobsReceived: stats.jobsReceived + 1,
            },
            updatedAt: serverTimestamp(),
          })
          void jobSnap
        }),
      )
    }
  })

  it('20a. management can approve date-only planned → datetime (same-day early time vs date-only acquired)', async () => {
    await testEnv.clearFirestore()
    await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
    await seedUser('mgmt1', 'management')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          acquiredDate: '2026-07-10',
          plannedExecutionDate: '2026-07-10',
        }),
      )
    })

    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')

    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const userRef = doc(db, 'users', 'media1')
        const userSnap = await tx.get(userRef)
        const stats = userSnap.data()!.stats as {
          jobsReceived: number
          jobsShot: number
          jobsCancelled: number
        }
        tx.update(jobRef, {
          status: 'approved',
          statusVersion: 2,
          // Same calendar day as date-only acquired, before legacy T09:00 normalize
          plannedExecutionDate: '2026-07-10T08:00',
          reviewedByUid: 'mgmt1',
          reviewedByNameSnapshot: 'User mgmt1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: null,
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 2,
          fromStatus: 'pending',
          toStatus: 'approved',
          actorUid: 'mgmt1',
          actorNameSnapshot: 'User mgmt1',
          actorRole: 'management',
          note: null,
          createdAt: serverTimestamp(),
        })
        tx.update(userRef, {
          stats: {
            ...stats,
            jobsReceived: stats.jobsReceived + 1,
          },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('20a2. approve fails when planned datetime calendar day is before date-only acquired', async () => {
    await testEnv.clearFirestore()
    await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
    await seedUser('mgmt1', 'management')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          acquiredDate: '2026-07-10',
          plannedExecutionDate: '2026-07-12',
        }),
      )
    })

    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')

    await assertFails(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const userRef = doc(db, 'users', 'media1')
        const userSnap = await tx.get(userRef)
        const stats = userSnap.data()!.stats as {
          jobsReceived: number
          jobsShot: number
          jobsCancelled: number
        }
        tx.update(jobRef, {
          status: 'approved',
          statusVersion: 2,
          plannedExecutionDate: '2026-07-09T14:00',
          reviewedByUid: 'mgmt1',
          reviewedByNameSnapshot: 'User mgmt1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: null,
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 2,
          fromStatus: 'pending',
          toStatus: 'approved',
          actorUid: 'mgmt1',
          actorNameSnapshot: 'User mgmt1',
          actorRole: 'management',
          note: null,
          createdAt: serverTimestamp(),
        })
        tx.update(userRef, {
          stats: {
            ...stats,
            jobsReceived: stats.jobsReceived + 1,
          },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('20b. media planner can mark own approved job as shot with stats+history', async () => {
    await testEnv.clearFirestore()
    await seedUser('media1', 'media_planning', {
      shiftDurationMinutes: 360,
      stats: { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 },
    })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'approved',
          statusVersion: 2,
          reviewedByUid: 'coord1',
          reviewedByNameSnapshot: 'User coord1',
          reviewedAt: Timestamp.now(),
        }),
      )
    })

    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const userRef = doc(db, 'users', 'media1')
        const userSnap = await tx.get(userRef)
        await tx.get(jobRef)
        const stats = userSnap.data()!.stats as {
          jobsReceived: number
          jobsShot: number
          jobsCancelled: number
        }
        tx.update(jobRef, {
          status: 'shot',
          statusVersion: 3,
          reviewedByUid: 'media1',
          reviewedByNameSnapshot: 'User media1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: null,
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 3,
          fromStatus: 'approved',
          toStatus: 'shot',
          actorUid: 'media1',
          actorNameSnapshot: 'User media1',
          actorRole: 'media_planning',
          note: null,
          createdAt: serverTimestamp(),
        })
        tx.update(userRef, {
          stats: {
            ...stats,
            jobsShot: stats.jobsShot + 1,
          },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('20c. reporter can read media_planning owner profile (needed for shot tx)', async () => {
    await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
    await seedUser('reporter1', 'reporter')
    await seedUser('mgmt1', 'management')
    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'media1')))
    await assertFails(getDoc(doc(db, 'users', 'mgmt1')))
  })

  it('20d. reporter can mark approved job as shot with stats+history (daily report)', async () => {
    await testEnv.clearFirestore()
    await seedUser('media1', 'media_planning', {
      shiftDurationMinutes: 360,
      stats: { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 },
    })
    await seedUser('reporter1', 'reporter')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'approved',
          statusVersion: 2,
          reviewedByUid: 'coord1',
          reviewedByNameSnapshot: 'User coord1',
          reviewedAt: Timestamp.now(),
        }),
      )
    })

    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    const { runTransaction, collection: col, increment, updateDoc } = await import(
      'firebase/firestore'
    )
    // Production path (shot-17): job+history only — no users/{owner} in the TX.
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const selfRef = doc(db, 'users', 'reporter1')
        await tx.get(selfRef)
        await tx.get(jobRef)
        tx.update(jobRef, {
          status: 'shot',
          statusVersion: 3,
          reviewedByUid: 'reporter1',
          reviewedByNameSnapshot: 'User reporter1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: null,
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 3,
          fromStatus: 'approved',
          toStatus: 'shot',
          actorUid: 'reporter1',
          actorNameSnapshot: 'User reporter1',
          actorRole: 'reporter',
          note: null,
          createdAt: serverTimestamp(),
        })
      }),
    )
    // Deferred owner stats (best-effort after shot).
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'media1'), {
        'stats.jobsShot': increment(1),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('20d2. reporter daily-report create with jobId + chargeMode succeeds', async () => {
    await seedUser('reporter1', 'reporter')
    const reporterDb = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    const { writeBatch } = await import('firebase/firestore')
    const reportBatch = writeBatch(reporterDb)
    reportBatch.set(doc(reporterDb, 'reporterDailyReports', 'd-jobid'), {
      reportDate: '2026-07-20',
      companyCount: 1,
      companies: [
        {
          jobId: 'job1abc',
          companyName: 'Firma A',
          hasNews: false,
          newsTotalKurus: null,
          newsReporterFeeKurus: null,
          newsCameramanFeeKurus: null,
          shootMinutes: 3,
          shootReporterFeeKurus: 80000,
          shootCameramanFeeKurus: 20000,
          vatRate: 20,
          vatBaseKurus: 1500000,
          vatKurus: 300000,
          chargeMode: 'vat',
        },
      ],
      note: '',
      hotelExpenseKurus: 0,
      stationeryExpenseKurus: 0,
      fuelExpenseKurus: 0,
      extraExpenseKurus: 0,
      operatingExpenseKurus: 0,
      employeeExpenseKurus: 100000,
      totalExpenseKurus: 400000,
      earningsKurus: 1800000,
      fieldPaidKurus: 0,
      totalReporterEarningsKurus: 80000,
      totalCameramanEarningsKurus: 20000,
      totalVatKurus: 300000,
      createdByUid: 'reporter1',
      createdByNameSnapshot: 'User reporter1',
      createdByEmailSnapshot: 'reporter1@brain.local',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      editVersion: 0,
      updatedByUid: 'reporter1',
      updatedByNameSnapshot: 'User reporter1',
      deletedAt: null,
      deletedByUid: null,
      deletedByNameSnapshot: null,
    })
    reportBatch.set(doc(reporterDb, 'reporterDailyReports', 'd-jobid', 'history', '0'), {
      action: 'create',
      version: 0,
      actorUid: 'reporter1',
      actorNameSnapshot: 'User reporter1',
      actorRole: 'reporter',
      createdAt: serverTimestamp(),
    })
    await assertSucceeds(reportBatch.commit())
  })

  it('FUNC-04: reporter daily report with 10 companies succeeds', async () => {
    await seedUser('reporter1', 'reporter')
    const reporterDb = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    const { writeBatch } = await import('firebase/firestore')
    const mkCompany = (name: string, jobId: string) => ({
      jobId,
      companyName: name,
      hasNews: false,
      newsTotalKurus: null,
      newsReporterFeeKurus: null,
      newsCameramanFeeKurus: null,
      shootMinutes: 3,
      shootReporterFeeKurus: 80000,
      shootCameramanFeeKurus: 20000,
      vatRate: 20,
      vatBaseKurus: 1500000,
      vatKurus: 300000,
      chargeMode: 'vat' as const,
    })
    const companies = Array.from({ length: 10 }, (_, i) =>
      mkCompany(`Firma ${i + 1}`, `job-f04-${i + 1}`),
    )
    const reportBatch = writeBatch(reporterDb)
    reportBatch.set(doc(reporterDb, 'reporterDailyReports', 'd-ten'), {
      reportDate: '2026-07-20',
      companyCount: 10,
      companies,
      note: '',
      hotelExpenseKurus: 0,
      stationeryExpenseKurus: 0,
      fuelExpenseKurus: 0,
      extraExpenseKurus: 0,
      operatingExpenseKurus: 0,
      employeeExpenseKurus: 1_000_000,
      totalExpenseKurus: 4_000_000,
      earningsKurus: 18_000_000,
      fieldPaidKurus: 0,
      totalReporterEarningsKurus: 800_000,
      totalCameramanEarningsKurus: 200_000,
      totalVatKurus: 3_000_000,
      createdByUid: 'reporter1',
      createdByNameSnapshot: 'User reporter1',
      createdByEmailSnapshot: 'reporter1@brain.local',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      editVersion: 0,
      updatedByUid: 'reporter1',
      updatedByNameSnapshot: 'User reporter1',
      deletedAt: null,
      deletedByUid: null,
      deletedByNameSnapshot: null,
    })
    reportBatch.set(doc(reporterDb, 'reporterDailyReports', 'd-ten', 'history', '0'), {
      action: 'create',
      version: 0,
      actorUid: 'reporter1',
      actorNameSnapshot: 'User reporter1',
      actorRole: 'reporter',
      createdAt: serverTimestamp(),
    })
    await assertSucceeds(reportBatch.commit())
  })

  it('FUNC-04: second company with invalid chargeMode fails', async () => {
    await seedUser('reporter1', 'reporter')
    const reporterDb = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    const { writeBatch } = await import('firebase/firestore')
    const valid = {
      jobId: 'job-a',
      companyName: 'Firma A',
      hasNews: false,
      newsTotalKurus: null,
      newsReporterFeeKurus: null,
      newsCameramanFeeKurus: null,
      shootMinutes: 3,
      shootReporterFeeKurus: 80000,
      shootCameramanFeeKurus: 20000,
      vatRate: 20,
      vatBaseKurus: 1500000,
      vatKurus: 300000,
      chargeMode: 'vat',
    }
    const reportBatch = writeBatch(reporterDb)
    reportBatch.set(doc(reporterDb, 'reporterDailyReports', 'd-bad2'), {
      reportDate: '2026-07-20',
      companyCount: 2,
      companies: [valid, { ...valid, jobId: 'job-b', companyName: 'Firma B', chargeMode: 'hack' }],
      note: '',
      hotelExpenseKurus: 0,
      stationeryExpenseKurus: 0,
      fuelExpenseKurus: 0,
      extraExpenseKurus: 0,
      operatingExpenseKurus: 0,
      employeeExpenseKurus: 200000,
      totalExpenseKurus: 800000,
      earningsKurus: 3600000,
      fieldPaidKurus: 0,
      totalReporterEarningsKurus: 160000,
      totalCameramanEarningsKurus: 40000,
      totalVatKurus: 600000,
      createdByUid: 'reporter1',
      createdByNameSnapshot: 'User reporter1',
      createdByEmailSnapshot: 'reporter1@brain.local',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      editVersion: 0,
      updatedByUid: 'reporter1',
      updatedByNameSnapshot: 'User reporter1',
      deletedAt: null,
      deletedByUid: null,
      deletedByNameSnapshot: null,
    })
    reportBatch.set(doc(reporterDb, 'reporterDailyReports', 'd-bad2', 'history', '0'), {
      action: 'create',
      version: 0,
      actorUid: 'reporter1',
      actorNameSnapshot: 'User reporter1',
      actorRole: 'reporter',
      createdAt: serverTimestamp(),
    })
    await assertFails(reportBatch.commit())
  })

  it('20d3. reporter can claim and release dailyReportId on a job', async () => {
    await seedUser('reporter1', 'reporter')
    await seedUser('media1', 'media_planning', {
      stats: { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 },
    })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'approved',
          statusVersion: 2,
          reviewedByUid: 'coord1',
          reviewedByNameSnapshot: 'User coord1',
          reviewedAt: Timestamp.now(),
          dailyReportId: null,
        }),
      )
    })
    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job1'), {
        dailyReportId: 'report-abc',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job1'), {
        dailyReportId: null,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('20d4. reporter cannot overwrite another report dailyReportId claim', async () => {
    await seedUser('reporter1', 'reporter')
    await seedUser('media1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'approved',
          statusVersion: 2,
          dailyReportId: 'other-report',
        }),
      )
    })
    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'jobs', 'job1'), {
        dailyReportId: 'my-report',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('20d5. reporter cannot claim dailyReportId when job status is pending', async () => {
    await seedUser('reporter1', 'reporter')
    await seedUser('media1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'pending',
          statusVersion: 1,
          dailyReportId: null,
        }),
      )
    })
    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'jobs', 'job1'), {
        dailyReportId: 'report-pending',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('20d6. reporter can claim dailyReportId when job status is shot', async () => {
    await seedUser('reporter1', 'reporter')
    await seedUser('media1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'shot',
          statusVersion: 3,
          dailyReportId: null,
        }),
      )
    })
    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job1'), {
        dailyReportId: 'report-shot',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('20d7. reporter can release dailyReportId even when job is pending', async () => {
    await seedUser('reporter1', 'reporter')
    await seedUser('media1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'pending',
          statusVersion: 1,
          dailyReportId: 'legacy-claim',
        }),
      )
    })
    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job1'), {
        dailyReportId: null,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('21. reporter cannot update status', async () => {
    const db = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertFails(updateDoc(doc(db, 'jobs', 'job1'), { status: 'approved' }))
  })

  it('22. pending cannot jump to shot', async () => {
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')
    await assertFails(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const userRef = doc(db, 'users', 'media1')
        await tx.get(jobRef)
        await tx.get(userRef)
        tx.update(jobRef, {
          status: 'shot',
          statusVersion: 2,
          reviewedByUid: 'coord1',
          reviewedByNameSnapshot: 'User coord1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: null,
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 2,
          fromStatus: 'pending',
          toStatus: 'shot',
          actorUid: 'coord1',
          actorNameSnapshot: 'User coord1',
          actorRole: 'coordinator',
          note: null,
          createdAt: serverTimestamp(),
        })
      }),
    )
  })

  it('20c. management can reject pending with stats+history', async () => {
    await testEnv.clearFirestore()
    await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
    await seedUser('mgmt1', 'management')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })

    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')

    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const userRef = doc(db, 'users', 'media1')
        const userSnap = await tx.get(userRef)
        const stats = userSnap.data()!.stats as {
          jobsReceived: number
          jobsShot: number
          jobsCancelled: number
        }
        tx.update(jobRef, {
          status: 'rejected',
          statusVersion: 2,
          reviewedByUid: 'mgmt1',
          reviewedByNameSnapshot: 'User mgmt1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: null,
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 2,
          fromStatus: 'pending',
          toStatus: 'rejected',
          actorUid: 'mgmt1',
          actorNameSnapshot: 'User mgmt1',
          actorRole: 'management',
          note: null,
          createdAt: serverTimestamp(),
        })
        tx.update(userRef, {
          stats: { ...stats },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('20d. management can cancel approved with stats+history', async () => {
    await testEnv.clearFirestore()
    await seedUser('media1', 'media_planning', {
      shiftDurationMinutes: 360,
      stats: { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 },
    })
    await seedUser('mgmt1', 'management')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'approved',
          statusVersion: 2,
          plannedExecutionDate: '2026-07-10T14:00',
          reviewedByUid: 'mgmt1',
          reviewedByNameSnapshot: 'User mgmt1',
          reviewedAt: Timestamp.now(),
        }),
      )
    })

    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')

    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const userRef = doc(db, 'users', 'media1')
        const userSnap = await tx.get(userRef)
        const stats = userSnap.data()!.stats as {
          jobsReceived: number
          jobsShot: number
          jobsCancelled: number
        }
        tx.update(jobRef, {
          status: 'cancelled',
          statusVersion: 3,
          reviewedByUid: 'mgmt1',
          reviewedByNameSnapshot: 'User mgmt1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: 'iptal nedeni',
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 3,
          fromStatus: 'approved',
          toStatus: 'cancelled',
          actorUid: 'mgmt1',
          actorNameSnapshot: 'User mgmt1',
          actorRole: 'management',
          note: 'iptal nedeni',
          createdAt: serverTimestamp(),
        })
        tx.update(userRef, {
          stats: {
            ...stats,
            jobsCancelled: stats.jobsCancelled + 1,
          },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('20e. coordinator can cancel pending (48h auto-cancel) with stats+history', async () => {
    await testEnv.clearFirestore()
    await seedUser('media1', 'media_planning', { shiftDurationMinutes: 360 })
    await seedUser('coord1', 'coordinator')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })

    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')

    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const userRef = doc(db, 'users', 'media1')
        const userSnap = await tx.get(userRef)
        const stats = userSnap.data()!.stats as {
          jobsReceived: number
          jobsShot: number
          jobsCancelled: number
        }
        tx.update(jobRef, {
          status: 'cancelled',
          statusVersion: 2,
          reviewedByUid: 'coord1',
          reviewedByNameSnapshot: 'User coord1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: 'Otomatik iptal: 48 saat içinde konfirme edilmedi.',
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 2,
          fromStatus: 'pending',
          toStatus: 'cancelled',
          actorUid: 'coord1',
          actorNameSnapshot: 'User coord1',
          actorRole: 'coordinator',
          note: 'Otomatik iptal: 48 saat içinde konfirme edilmedi.',
          createdAt: serverTimestamp(),
        })
        tx.update(userRef, {
          stats: {
            ...stats,
            jobsCancelled: stats.jobsCancelled + 1,
          },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('20f. media planning cannot cancel own pending job', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')
    await assertFails(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        const userRef = doc(db, 'users', 'media1')
        const userSnap = await tx.get(userRef)
        const stats = userSnap.data()!.stats as {
          jobsReceived: number
          jobsShot: number
          jobsCancelled: number
        }
        tx.update(jobRef, {
          status: 'cancelled',
          statusVersion: 2,
          reviewedByUid: 'media1',
          reviewedByNameSnapshot: 'User media1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: 'iptal',
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 2,
          fromStatus: 'pending',
          toStatus: 'cancelled',
          actorUid: 'media1',
          actorNameSnapshot: 'User media1',
          actorRole: 'media_planning',
          note: 'iptal',
          createdAt: serverTimestamp(),
        })
        tx.update(userRef, {
          stats: {
            ...stats,
            jobsCancelled: stats.jobsCancelled + 1,
          },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('23. approved cannot become rejected', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({ status: 'approved', statusVersion: 2 }),
      )
    })
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')
    await assertFails(
      runTransaction(db, async (tx) => {
        const jobRef = doc(db, 'jobs', 'job1')
        await tx.get(jobRef)
        await tx.get(doc(db, 'users', 'media1'))
        tx.update(jobRef, {
          status: 'rejected',
          statusVersion: 3,
          reviewedByUid: 'coord1',
          reviewedByNameSnapshot: 'User coord1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: 'no',
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 3,
          fromStatus: 'approved',
          toStatus: 'rejected',
          actorUid: 'coord1',
          actorNameSnapshot: 'User coord1',
          actorRole: 'coordinator',
          note: 'no',
          createdAt: serverTimestamp(),
        })
      }),
    )
  })

  it('24. statusVersion must increment by 1', async () => {
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')
    await assertFails(
      runTransaction(db, async (tx) => {
        await tx.get(doc(db, 'jobs', 'job1'))
        await tx.get(doc(db, 'users', 'media1'))
        tx.update(doc(db, 'jobs', 'job1'), {
          status: 'approved',
          statusVersion: 5,
          reviewedByUid: 'coord1',
          reviewedByNameSnapshot: 'User coord1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: null,
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 5,
          fromStatus: 'pending',
          toStatus: 'approved',
          actorUid: 'coord1',
          actorNameSnapshot: 'User coord1',
          actorRole: 'coordinator',
          note: null,
          createdAt: serverTimestamp(),
        })
        tx.update(doc(db, 'users', 'media1'), {
          stats: { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('25. approval without correct stats delta fails', async () => {
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    const { runTransaction, collection: col } = await import('firebase/firestore')
    await assertFails(
      runTransaction(db, async (tx) => {
        await tx.get(doc(db, 'jobs', 'job1'))
        await tx.get(doc(db, 'users', 'media1'))
        tx.update(doc(db, 'jobs', 'job1'), {
          status: 'approved',
          statusVersion: 2,
          reviewedByUid: 'coord1',
          reviewedByNameSnapshot: 'User coord1',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reviewNote: null,
        })
        tx.set(doc(col(db, 'jobs', 'job1', 'history')), {
          version: 2,
          fromStatus: 'pending',
          toStatus: 'approved',
          actorUid: 'coord1',
          actorNameSnapshot: 'User coord1',
          actorRole: 'coordinator',
          note: null,
          createdAt: serverTimestamp(),
        })
        tx.update(doc(db, 'users', 'media1'), {
          stats: { jobsReceived: 0, jobsShot: 0, jobsCancelled: 0 },
          updatedAt: serverTimestamp(),
        })
      }),
    )
  })

  it('27. job cannot be deleted', async () => {
    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    await assertFails(deleteDoc(doc(db, 'jobs', 'job1')))
  })

  it('28-29. history cannot be updated or deleted', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1', 'history', 'h1'), {
        version: 1,
        fromStatus: null,
        toStatus: 'pending',
        actorUid: 'media1',
        actorNameSnapshot: 'User media1',
        actorRole: 'media_planning',
        note: null,
        createdAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'jobs', 'job1', 'history', 'h1'), { note: 'hack' }),
    )
    await assertFails(deleteDoc(doc(db, 'jobs', 'job1', 'history', 'h1')))
  })
})

describe('Attendance', () => {
  beforeEach(async () => {
    await seedUser('media1', 'media_planning')
    await seedUser('media2', 'media_planning')
    await seedUser('mgmt1', 'management')
    await seedUser('coord1', 'coordinator')
  })

  it('30. media planning can start own active shift', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertSucceeds(
      setDoc(doc(db, 'activeShifts', 'media1'), {
        shiftId: 'shift-1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt: serverTimestamp(),
        timezone: 'Europe/Istanbul',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('31. cannot start shift for another uid', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'activeShifts', 'media2'), {
        shiftId: 'shift-1',
        ownerUid: 'media2',
        ownerNameSnapshot: 'User media2',
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt: serverTimestamp(),
        timezone: 'Europe/Istanbul',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('33. cannot include plannedDurationMinutes on create', async () => {
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'activeShifts', 'media1'), {
        shiftId: 'shift-1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt: serverTimestamp(),
        plannedDurationMinutes: 360,
        timezone: 'Europe/Istanbul',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('34. active shift cannot be updated', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'activeShifts', 'media1'), {
        shiftId: 'shift-1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt: Timestamp.now(),
        timezone: 'Europe/Istanbul',
        createdAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'activeShifts', 'media1'), {
        ownerNameSnapshot: 'Hacked',
      }),
    )
  })

  it('35. delete without log fails; manual end with server time succeeds', async () => {
    const startedAt = Timestamp.fromMillis(Date.now() - 5 * 60_000)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'activeShifts', 'media1'), {
        shiftId: 'shift-1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt,
        timezone: 'Europe/Istanbul',
        createdAt: startedAt,
      })
    })

    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()

    await assertFails(deleteDoc(doc(db, 'activeShifts', 'media1')))

    const { writeBatch } = await import('firebase/firestore')
    const batch = writeBatch(db)
    batch.set(doc(db, 'users', 'media1', 'attendanceLogs', 'shift-1'), {
      shiftId: 'shift-1',
      ownerUid: 'media1',
      ownerNameSnapshot: 'User media1',
      roleSnapshot: 'media_planning',
      status: 'completed',
      startedAt,
      endedAt: serverTimestamp(),
      workedMinutes: 5,
      timezone: 'Europe/Istanbul',
      finalizedAt: serverTimestamp(),
      editVersion: 0,
      lastEditedByUid: null,
      lastEditedByNameSnapshot: null,
      lastEditedAt: null,
      lastEditReason: null,
    })
    batch.delete(doc(db, 'activeShifts', 'media1'))
    await assertSucceeds(batch.commit())
  })

  it('36-38. endedAt/workedMinutes/shiftId manipulation fails', async () => {
    const startedAt = Timestamp.fromMillis(Date.now() - 10 * 60_000)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'activeShifts', 'media1'), {
        shiftId: 'shift-1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt,
        timezone: 'Europe/Istanbul',
        createdAt: startedAt,
      })
    })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    const { writeBatch } = await import('firebase/firestore')

    const badEnd = writeBatch(db)
    badEnd.set(doc(db, 'users', 'media1', 'attendanceLogs', 'shift-1'), {
      shiftId: 'shift-1',
      ownerUid: 'media1',
      ownerNameSnapshot: 'User media1',
      roleSnapshot: 'media_planning',
      status: 'completed',
      startedAt,
      endedAt: Timestamp.fromMillis(startedAt.toMillis() + 10 * 60_000),
      workedMinutes: 10,
      timezone: 'Europe/Istanbul',
      finalizedAt: serverTimestamp(),
    })
    badEnd.delete(doc(db, 'activeShifts', 'media1'))
    await assertFails(badEnd.commit())

    const badMinutes = writeBatch(db)
    badMinutes.set(doc(db, 'users', 'media1', 'attendanceLogs', 'shift-1'), {
      shiftId: 'shift-1',
      ownerUid: 'media1',
      ownerNameSnapshot: 'User media1',
      roleSnapshot: 'media_planning',
      status: 'completed',
      startedAt,
      endedAt: serverTimestamp(),
      workedMinutes: 999,
      timezone: 'Europe/Istanbul',
      finalizedAt: serverTimestamp(),
    })
    badMinutes.delete(doc(db, 'activeShifts', 'media1'))
    await assertFails(badMinutes.commit())

    const badId = writeBatch(db)
    badId.set(doc(db, 'users', 'media1', 'attendanceLogs', 'wrong-id'), {
      shiftId: 'wrong-id',
      ownerUid: 'media1',
      ownerNameSnapshot: 'User media1',
      roleSnapshot: 'media_planning',
      status: 'completed',
      startedAt,
      endedAt: serverTimestamp(),
      workedMinutes: 10,
      timezone: 'Europe/Istanbul',
      finalizedAt: serverTimestamp(),
    })
    badId.delete(doc(db, 'activeShifts', 'media1'))
    await assertFails(badId.commit())
  })

  it('40-41. completed log immutable', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'media1', 'attendanceLogs', 's1'), {
        shiftId: 's1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'completed',
        startedAt: Timestamp.now(),
        endedAt: Timestamp.now(),
        workedMinutes: 60,
        timezone: 'Europe/Istanbul',
        finalizedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'users', 'media1', 'attendanceLogs', 's1'), {
        workedMinutes: 1,
      }),
    )
    await assertFails(deleteDoc(doc(db, 'users', 'media1', 'attendanceLogs', 's1')))
  })

  it('42. user cannot read another user log', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'media2', 'attendanceLogs', 's1'), {
        shiftId: 's1',
        ownerUid: 'media2',
        ownerNameSnapshot: 'User media2',
        roleSnapshot: 'media_planning',
        status: 'completed',
        startedAt: Timestamp.now(),
        endedAt: Timestamp.now(),
        workedMinutes: 60,
        timezone: 'Europe/Istanbul',
        finalizedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(getDoc(doc(db, 'users', 'media2', 'attendanceLogs', 's1')))
  })

  it('43. management can read logs', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'media1', 'attendanceLogs', 's1'), {
        shiftId: 's1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'completed',
        startedAt: Timestamp.now(),
        endedAt: Timestamp.now(),
        workedMinutes: 60,
        timezone: 'Europe/Istanbul',
        finalizedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'media1', 'attendanceLogs', 's1')))
  })

  it('44. coordinator can read attendance logs', async () => {
    await seedUser('coord1', 'coordinator')
    await seedUser('media1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'media1', 'attendanceLogs', 's1'), {
        shiftId: 's1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'completed',
        startedAt: Timestamp.now(),
        endedAt: Timestamp.now(),
        workedMinutes: 60,
        timezone: 'Europe/Istanbul',
        finalizedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'media1', 'attendanceLogs', 's1')))
  })

  it('45. human resources can read attendance logs', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('media1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'media1', 'attendanceLogs', 's1'), {
        shiftId: 's1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'completed',
        startedAt: Timestamp.now(),
        endedAt: Timestamp.now(),
        workedMinutes: 60,
        timezone: 'Europe/Istanbul',
        finalizedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'media1', 'attendanceLogs', 's1')))
  })
})

describe('HR reports and hiring notes', () => {
  it('HR can create and read own report; management and coordinator can read', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('mgmt1', 'management')
    await seedUser('coord1', 'coordinator')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()
    await assertSucceeds(
      setDoc(doc(hrDb, 'hrReports', 'r1'), {
        title: 'Haftalık özet',
        body: 'Detay metin',
        mpuAttendances: [],
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(getDoc(doc(hrDb, 'hrReports', 'r1')))

    const mgmtDb = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    await assertSucceeds(getDoc(doc(mgmtDb, 'hrReports', 'r1')))

    const coordDb = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertSucceeds(getDoc(doc(coordDb, 'hrReports', 'r1')))
  })

  it('HR can create report when name snapshot differs slightly from profile', async () => {
    await seedUser('hr1', 'human_resources')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()
    await assertSucceeds(
      setDoc(doc(hrDb, 'hrReports', 'r-name'), {
        title: 'İsim farkı',
        body: 'Detay',
        mpuAttendances: [],
        createdByUid: 'hr1',
        createdByNameSnapshot: 'Farklı İsim',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('HR can create and update report with MPU attendances and absent', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('mpu1', 'media_planning')
    await seedUser('mpu2', 'media_planning')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()

    await assertSucceeds(
      setDoc(doc(hrDb, 'hrReports', 'r-attend'), {
        title: 'Günlük mesai',
        body: 'Özet',
        mpuAttendances: [
          {
            mpuUid: 'mpu1',
            mpuNameSnapshot: 'User mpu1',
            clockInTime: '10:00',
            clockOutTime: '18:30',
            absent: false,
          },
          {
            mpuUid: 'mpu2',
            mpuNameSnapshot: 'User mpu2',
            clockInTime: null,
            clockOutTime: null,
            absent: true,
          },
        ],
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )

    await assertSucceeds(
      updateDoc(doc(hrDb, 'hrReports', 'r-attend'), {
        title: 'Günlük mesai güncel',
        body: 'Özet 2',
        mpuAttendances: [
          {
            mpuUid: 'mpu1',
            mpuNameSnapshot: 'User mpu1',
            clockInTime: '06:57',
            clockOutTime: null,
            absent: false,
          },
        ],
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('HR can create report with 20 MPU attendances (rules budget)', async () => {
    await seedUser('hr1', 'human_resources')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()

    const mpuAttendances = Array.from({ length: 20 }, (_, i) => ({
      mpuUid: `mpu${i}`,
      mpuNameSnapshot: `User mpu${i}`,
      clockInTime: '10:00',
      clockOutTime: '18:30',
      absent: false,
    }))

    await assertSucceeds(
      setDoc(doc(hrDb, 'hrReports', 'r-20'), {
        title: '20 MPU mesai',
        body: 'Özet',
        mpuAttendances,
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects more than 20 MPU attendances', async () => {
    await seedUser('hr1', 'human_resources')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()

    const mpuAttendances = Array.from({ length: 21 }, (_, i) => ({
      mpuUid: `mpu${i}`,
      mpuNameSnapshot: `User mpu${i}`,
      clockInTime: '10:00',
      clockOutTime: '18:30',
      absent: false,
    }))

    await assertFails(
      setDoc(doc(hrDb, 'hrReports', 'r-21'), {
        title: '21 MPU',
        body: 'Özet',
        mpuAttendances,
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('HR can create hiring note; coordinator can read', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('coord1', 'coordinator')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()
    await assertSucceeds(
      setDoc(doc(hrDb, 'hiringNotes', 'n1'), {
        candidateName: 'Aday Adı',
        note: 'Görüşme notu',
        attachments: [],
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    const coordDb = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertSucceeds(getDoc(doc(coordDb, 'hiringNotes', 'n1')))
  })
})

describe('Users write lock', () => {
  it('media planning cannot update own stats without updatedAt / huge jump', async () => {
    await seedUser('media1', 'media_planning')
    const db = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'users', 'media1'), {
        stats: { jobsReceived: 99, jobsShot: 0, jobsCancelled: 0 },
      }),
    )
  })

  it('SEC-06: coordinator cannot set arbitrary huge stats absolute values', async () => {
    await seedUser('media1', 'media_planning', {
      stats: { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 },
    })
    await seedUser('coord1', 'coordinator')
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'users', 'media1'), {
        stats: { jobsReceived: 999999, jobsShot: 0, jobsCancelled: 0 },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('SEC-06: coordinator can bump a single counter by +1', async () => {
    await seedUser('media1', 'media_planning', {
      stats: { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 },
    })
    await seedUser('coord1', 'coordinator')
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'media1'), {
        stats: { jobsReceived: 2, jobsShot: 0, jobsCancelled: 0 },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('SEC-06: multi-counter bump in one write fails', async () => {
    await seedUser('media1', 'media_planning', {
      stats: { jobsReceived: 1, jobsShot: 0, jobsCancelled: 0 },
    })
    await seedUser('coord1', 'coordinator')
    const db = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertFails(
      updateDoc(doc(db, 'users', 'media1'), {
        stats: { jobsReceived: 2, jobsShot: 1, jobsCancelled: 0 },
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('Account admin freeze / soft-delete', () => {
  it('İK can read and list manageable users', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('media1', 'media_planning')
    await seedUser('reporter1', 'reporter')
    await seedUser('mgmt1', 'management')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()

    await assertSucceeds(getDoc(doc(hrDb, 'users', 'media1')))
    await assertSucceeds(getDoc(doc(hrDb, 'users', 'reporter1')))
    await assertFails(getDoc(doc(hrDb, 'users', 'mgmt1')))

    await assertSucceeds(
      getDocs(
        query(
          collection(hrDb, 'users'),
          where('role', 'in', ['media_planning', 'reporter', 'human_resources']),
        ),
      ),
    )
  })

  it('İK can freeze and unfreeze manageable accounts', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('media1', 'media_planning')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()

    await assertSucceeds(
      updateDoc(doc(hrDb, 'users', 'media1'), {
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(doc(hrDb, 'users', 'media1'), {
        isActive: true,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('İK cannot soft-delete accounts', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('media1', 'media_planning')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()

    await assertFails(
      updateDoc(doc(hrDb, 'users', 'media1'), {
        isActive: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('management and coordinator can soft-delete manageable accounts', async () => {
    await seedUser('mgmt1', 'management')
    await seedUser('coord1', 'coordinator')
    await seedUser('media1', 'media_planning')
    await seedUser('media2', 'media_planning')

    const mgmtDb = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(mgmtDb, 'users', 'media1'), {
        isActive: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )

    const coordDb = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(coordDb, 'users', 'media2'), {
        isActive: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('İK cannot freeze self or management accounts', async () => {
    await seedUser('hr1', 'human_resources')
    await seedUser('mgmt1', 'management')
    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()

    await assertFails(
      updateDoc(doc(hrDb, 'users', 'hr1'), {
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(hrDb, 'users', 'mgmt1'), {
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('Reporter reports', () => {
  it('reporter cannot claim jobs (claim removed)', async () => {
    await seedUser('reporter1', 'reporter')
    await seedUser('media1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job1'),
        jobPayload({
          status: 'approved',
          statusVersion: 2,
          reviewedByUid: 'mgmt1',
          reviewedByNameSnapshot: 'Mgmt',
          reviewedAt: Timestamp.now(),
          forwardedToReporter: true,
          forwardedToReporterByUid: 'mgmt1',
          forwardedToReporterByNameSnapshot: 'Mgmt',
          forwardedToReporterAt: Timestamp.now(),
        }),
      )
    })

    const db1 = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    await assertFails(
      updateDoc(doc(db1, 'jobs', 'job1'), {
        claimedByUid: 'reporter1',
        claimedByNameSnapshot: 'User reporter1',
        claimedByEmailSnapshot: 'reporter1@brain.local',
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('reporter can create daily report; HR and management can read', async () => {
    await seedUser('reporter1', 'reporter')
    await seedUser('hr1', 'human_resources')
    await seedUser('mgmt1', 'management')
    const reporterDb = testEnv
      .authenticatedContext('reporter1', authClaims('reporter'))
      .firestore()
    const { writeBatch } = await import('firebase/firestore')
    const reportBatch = writeBatch(reporterDb)
    reportBatch.set(doc(reporterDb, 'reporterDailyReports', 'd1'), {
        reportDate: '2026-07-20',
        companyCount: 1,
        companies: [
          {
            companyName: 'Firma A',
            hasNews: true,
            newsTotalKurus: 100000,
            newsReporterFeeKurus: 15000,
            newsCameramanFeeKurus: 10000,
            shootMinutes: 3,
            shootReporterFeeKurus: 80000,
            shootCameramanFeeKurus: 20000,
            vatRate: 20,
            vatBaseKurus: 1600000,
            vatKurus: 320000,
            chargeMode: 'vat',
          },
        ],
        note: 'Not',
        hotelExpenseKurus: 0,
        stationeryExpenseKurus: 0,
        fuelExpenseKurus: 0,
        extraExpenseKurus: 0,
        operatingExpenseKurus: 0,
        employeeExpenseKurus: 125000,
        totalExpenseKurus: 445000,
        earningsKurus: 1920000,
        fieldPaidKurus: 0,
        totalReporterEarningsKurus: 95000,
        totalCameramanEarningsKurus: 30000,
        totalVatKurus: 320000,
        createdByUid: 'reporter1',
        createdByNameSnapshot: 'User reporter1',
        createdByEmailSnapshot: 'reporter1@brain.local',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editVersion: 0,
        updatedByUid: 'reporter1',
        updatedByNameSnapshot: 'User reporter1',
        deletedAt: null,
        deletedByUid: null,
        deletedByNameSnapshot: null,
      })
    reportBatch.set(doc(reporterDb, 'reporterDailyReports', 'd1', 'history', '0'), {
      action: 'create',
      version: 0,
      actorUid: 'reporter1',
      actorNameSnapshot: 'User reporter1',
      actorRole: 'reporter',
      createdAt: serverTimestamp(),
    })
    await assertSucceeds(reportBatch.commit())

    const hrDb = testEnv
      .authenticatedContext('hr1', authClaims('human_resources'))
      .firestore()
    await assertSucceeds(getDoc(doc(hrDb, 'reporterDailyReports', 'd1')))

    const mgmtDb = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    await assertSucceeds(getDoc(doc(mgmtDb, 'reporterDailyReports', 'd1')))

    const updateBatch = writeBatch(mgmtDb)
    updateBatch.update(doc(mgmtDb, 'reporterDailyReports', 'd1'), {
      note: 'Yönetim düzeltmesi',
      editVersion: 1,
      updatedAt: serverTimestamp(),
      updatedByUid: 'mgmt1',
      updatedByNameSnapshot: 'User mgmt1',
    })
    updateBatch.set(
      doc(mgmtDb, 'reporterDailyReports', 'd1', 'history', '1'),
      {
        action: 'update',
        version: 1,
        actorUid: 'mgmt1',
        actorNameSnapshot: 'User mgmt1',
        actorRole: 'management',
        createdAt: serverTimestamp(),
      },
    )
    await assertSucceeds(updateBatch.commit())

    const deleteBatch = writeBatch(mgmtDb)
    deleteBatch.update(doc(mgmtDb, 'reporterDailyReports', 'd1'), {
      deletedAt: serverTimestamp(),
      deletedByUid: 'mgmt1',
      deletedByNameSnapshot: 'User mgmt1',
      editVersion: 2,
      updatedAt: serverTimestamp(),
      updatedByUid: 'mgmt1',
      updatedByNameSnapshot: 'User mgmt1',
    })
    deleteBatch.set(
      doc(mgmtDb, 'reporterDailyReports', 'd1', 'history', '2'),
      {
        action: 'soft_delete',
        version: 2,
        actorUid: 'mgmt1',
        actorNameSnapshot: 'User mgmt1',
        actorRole: 'management',
        createdAt: serverTimestamp(),
      },
    )
    await assertSucceeds(deleteBatch.commit())
  })
})

describe('System storageUsage', () => {
  it('management and coordinator can read; clients cannot write', async () => {
    await seedUser('mgmt1', 'management')
    await seedUser('coord1', 'coordinator')
    await seedUser('media1', 'media_planning')

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'system', 'storageUsage'), {
        usedBytes: 1024,
        quotaBytes: 5 * 1024 * 1024 * 1024,
        objectCount: 1,
        updatedAt: Timestamp.now(),
        source: 'test',
      })
    })

    const mgmt = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    const coord = testEnv
      .authenticatedContext('coord1', authClaims('coordinator'))
      .firestore()
    const media = testEnv
      .authenticatedContext('media1', authClaims('media_planning'))
      .firestore()

    await assertSucceeds(getDoc(doc(mgmt, 'system', 'storageUsage')))
    await assertSucceeds(getDoc(doc(coord, 'system', 'storageUsage')))
    await assertFails(getDoc(doc(media, 'system', 'storageUsage')))
    await assertFails(
      setDoc(doc(mgmt, 'system', 'storageUsage'), {
        usedBytes: 0,
        quotaBytes: 5 * 1024 * 1024 * 1024,
        objectCount: 0,
        updatedAt: Timestamp.now(),
      }),
    )
  })
})

describe('Financial and audit mutations', () => {
  it('management can edit attendance with matching audit history', async () => {
    await seedUser('media1', 'media_planning')
    await seedUser('mgmt1', 'management')
    const previousStart = Timestamp.fromMillis(Date.now() - 3 * 60 * 60_000)
    const previousEnd = Timestamp.fromMillis(Date.now() - 2 * 60 * 60_000)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'media1', 'attendanceLogs', 's1'), {
        shiftId: 's1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'completed',
        startedAt: previousStart,
        endedAt: previousEnd,
        workedMinutes: 60,
        timezone: 'Europe/Istanbul',
        finalizedAt: previousEnd,
        editVersion: 0,
        lastEditedByUid: null,
        lastEditedByNameSnapshot: null,
        lastEditedAt: null,
        lastEditReason: null,
      })
    })

    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    const newStart = Timestamp.fromMillis(Date.now() - 4 * 60 * 60_000)
    const newEnd = Timestamp.fromMillis(Date.now() - 2 * 60 * 60_000)
    const { writeBatch } = await import('firebase/firestore')
    const batch = writeBatch(db)
    batch.update(doc(db, 'users', 'media1', 'attendanceLogs', 's1'), {
      startedAt: newStart,
      endedAt: newEnd,
      workedMinutes: 120,
      editVersion: 1,
      lastEditedByUid: 'mgmt1',
      lastEditedByNameSnapshot: 'User mgmt1',
      lastEditedAt: serverTimestamp(),
      lastEditReason: 'Eksik giriş düzeltildi',
    })
    batch.set(doc(db, 'users', 'media1', 'attendanceLogs', 's1', 'history', '1'), {
      version: 1,
      actorUid: 'mgmt1',
      actorNameSnapshot: 'User mgmt1',
      actorRole: 'management',
      reason: 'Eksik giriş düzeltildi',
      previousStartedAt: previousStart,
      previousEndedAt: previousEnd,
      previousWorkedMinutes: 60,
      newStartedAt: newStart,
      newEndedAt: newEnd,
      newWorkedMinutes: 120,
      createdAt: serverTimestamp(),
    })
    await assertSucceeds(batch.commit())
  })
})

describe('Reaction daily winners (legacy read-only)', () => {
  it('cannot create new reactionDailyWinner after hoop migration', async () => {
    await seedUser('player1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reactionDailyScores', '2026-07-23_player1'), {
        date: '2026-07-23',
        uid: 'player1',
        fullName: 'User player1',
        attempts: [420],
        bestMs: 420,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('player1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'reactionDailyWinners', '2026-07-23'), {
        date: '2026-07-23',
        uid: 'player1',
        fullName: 'User player1',
        bestMs: 420,
        finalizedAt: serverTimestamp(),
      }),
    )
  })

  it('cannot forge reactionDailyWinner without matching score', async () => {
    await seedUser('player1', 'media_planning')
    const db = testEnv
      .authenticatedContext('player1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'reactionDailyWinners', '2026-07-22'), {
        date: '2026-07-22',
        uid: 'player1',
        fullName: 'User player1',
        bestMs: 100,
        finalizedAt: serverTimestamp(),
      }),
    )
  })

  it('cannot forge reactionDailyWinner with mismatched bestMs', async () => {
    await seedUser('player1', 'media_planning')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reactionDailyScores', '2026-07-21_player1'), {
        date: '2026-07-21',
        uid: 'player1',
        fullName: 'User player1',
        attempts: [500],
        bestMs: 500,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('player1', authClaims('media_planning'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'reactionDailyWinners', '2026-07-21'), {
        date: '2026-07-21',
        uid: 'player1',
        fullName: 'User player1',
        bestMs: 100,
        finalizedAt: serverTimestamp(),
      }),
    )
  })
})

describe('Hoop daily scores (test: mgmt/coord only)', () => {
  it('management can create first shot and append beyond 6', async () => {
    await seedUser('mgmt1', 'management')
    const db = testEnv
      .authenticatedContext('mgmt1', authClaims('management'))
      .firestore()
    const ref = doc(db, 'hoopDailyScores', '2026-08-07_mgmt1')
    await assertSucceeds(
      setDoc(ref, {
        date: '2026-08-07',
        uid: 'mgmt1',
        fullName: 'User mgmt1',
        attempts: [1],
        makes: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(ref, {
        attempts: [1, 0],
        makes: 1,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('reporter cannot create hoop scores during test gate', async () => {
    await seedUser('rep1', 'reporter')
    const db = testEnv
      .authenticatedContext('rep1', authClaims('reporter'))
      .firestore()
    await assertFails(
      setDoc(doc(db, 'hoopDailyScores', '2026-08-07_rep1'), {
        date: '2026-08-07',
        uid: 'rep1',
        fullName: 'User rep1',
        attempts: [1],
        makes: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('management can exceed former 6-shot list cap', async () => {
    await seedUser('mgmt2', 'management')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'hoopDailyScores', '2026-08-07_mgmt2'), {
        date: '2026-08-07',
        uid: 'mgmt2',
        fullName: 'User mgmt2',
        attempts: [1, 1, 1, 1, 1, 1],
        makes: 6,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    const db = testEnv
      .authenticatedContext('mgmt2', authClaims('management'))
      .firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'hoopDailyScores', '2026-08-07_mgmt2'), {
        attempts: [1, 1, 1, 1, 1, 1, 0],
        makes: 6,
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

// silence unused imports when tree-shaken oddly
void getDocs
void query
void where
void collection
