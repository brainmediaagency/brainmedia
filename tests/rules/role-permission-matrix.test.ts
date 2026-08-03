/**
 * Final role × action permission matrix against firestore.rules.
 * Each role proves its allowed writes/reads and key denials.
 */
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
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const PROJECT_ID = 'brain-workspace-role-matrix'
const RULES_PATH = resolve(process.cwd(), 'firestore.rules')

let testEnv: RulesTestEnvironment

function authClaims(role: string) {
  return {
    email: `${role}@brain.local`,
    email_verified: true,
    active: true,
    role,
  }
}

async function seedUser(uid: string, role: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      uid,
      fullName: `User ${uid}`,
      email: `${uid}@brain.local`,
      role,
      isActive: true,
      deletedAt: null,
      shiftDurationMinutes: null,
      timezone: 'Europe/Istanbul',
      stats: { jobsReceived: 0, jobsShot: 0, jobsCancelled: 0 },
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
      { name: 'Ali Veli', mobilePhone: '+905551112233', workPhone: null },
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
    idempotencyKey: 'idem-matrix-12345678',
    ...overrides,
  }
}

function dbFor(uid: string, role: string) {
  return testEnv.authenticatedContext(uid, authClaims(role)).firestore()
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await Promise.all([
    seedUser('media1', 'media_planning'),
    seedUser('reporter1', 'reporter'),
    seedUser('hr1', 'human_resources'),
    seedUser('coord1', 'coordinator'),
    seedUser('mgmt1', 'management'),
    seedUser('cam1', 'kameraman'),
  ])
})

describe('Role matrix — media_planning', () => {
  it('can create own pending job', async () => {
    const db = dbFor('media1', 'media_planning')
    await assertSucceeds(
      setDoc(doc(db, 'jobs', 'job-mp'), {
        ...jobPayload(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('can start and end own shift', async () => {
    const db = dbFor('media1', 'media_planning')
    await assertSucceeds(
      setDoc(doc(db, 'activeShifts', 'media1'), {
        shiftId: 'shift-mp-1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt: serverTimestamp(),
        timezone: 'Europe/Istanbul',
        createdAt: serverTimestamp(),
      }),
    )

    const startedAt = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'activeShifts', 'media1'), {
        shiftId: 'shift-mp-1',
        ownerUid: 'media1',
        ownerNameSnapshot: 'User media1',
        roleSnapshot: 'media_planning',
        status: 'active',
        startedAt,
        timezone: 'Europe/Istanbul',
        createdAt: startedAt,
      })
    })

    const batch = writeBatch(db)
    batch.set(doc(db, 'users', 'media1', 'attendanceLogs', 'shift-mp-1'), {
      shiftId: 'shift-mp-1',
      ownerUid: 'media1',
      ownerNameSnapshot: 'User media1',
      roleSnapshot: 'media_planning',
      status: 'completed',
      startedAt,
      endedAt: serverTimestamp(),
      workedMinutes: 60,
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

  it('cannot approve pending job', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job-mp'), jobPayload())
    })
    const db = dbFor('media1', 'media_planning')
    await assertFails(
      updateDoc(doc(db, 'jobs', 'job-mp'), {
        status: 'approved',
        statusVersion: 2,
        updatedAt: serverTimestamp(),
        reviewedByUid: 'media1',
        reviewedByNameSnapshot: 'User media1',
        reviewedAt: serverTimestamp(),
        reviewNote: null,
        plannedExecutionDate: '2026-07-10T10:00',
      }),
    )
  })

  it('cannot create hrReport', async () => {
    const db = dbFor('media1', 'media_planning')
    await assertFails(
      setDoc(doc(db, 'hrReports', 'hr-mp'), {
        title: 'Yetkisiz',
        body: 'İçerik',
        mpuAttendances: [],
        createdByUid: 'media1',
        createdByNameSnapshot: 'User media1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('Role matrix — reporter', () => {
  it('can read jobs and create daily report', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })
    const db = dbFor('reporter1', 'reporter')
    await assertSucceeds(getDoc(doc(db, 'jobs', 'job1')))
    await assertSucceeds(
      setDoc(doc(db, 'reporterDailyReports', 'rd1'), {
        reportDate: '2026-07-27',
        companyCount: 1,
        companies: [
          {
            jobId: null,
            companyName: 'Firma',
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
        createdByUid: 'reporter1',
        createdByNameSnapshot: 'User reporter1',
        createdByEmailSnapshot: 'reporter1@brain.local',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: 'reporter1',
        updatedByNameSnapshot: 'User reporter1',
        deletedAt: null,
        deletedByUid: null,
        deletedByNameSnapshot: null,
      }),
    )
  })

  it('can mark approved job as shot', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'jobs', 'job-shot'),
        jobPayload({ status: 'approved', statusVersion: 2 }),
      )
    })
    const db = dbFor('reporter1', 'reporter')
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job-shot'), {
        status: 'shot',
        statusVersion: 3,
        updatedAt: serverTimestamp(),
        reviewedByUid: 'reporter1',
        reviewedByNameSnapshot: 'User reporter1',
        reviewedAt: serverTimestamp(),
        reviewNote: null,
      }),
    )
  })

  it('cannot create job or start shift', async () => {
    const db = dbFor('reporter1', 'reporter')
    await assertFails(
      setDoc(doc(db, 'jobs', 'job-rep'), {
        ...jobPayload({
          createdByUid: 'reporter1',
          createdByRole: 'reporter',
          createdByNameSnapshot: 'User reporter1',
          createdByEmailSnapshot: 'reporter1@brain.local',
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(doc(db, 'activeShifts', 'reporter1'), {
        shiftId: 's-rep',
        ownerUid: 'reporter1',
        ownerNameSnapshot: 'User reporter1',
        roleSnapshot: 'reporter',
        status: 'active',
        startedAt: serverTimestamp(),
        timezone: 'Europe/Istanbul',
        createdAt: serverTimestamp(),
      }),
    )
  })
})

describe('Role matrix — human_resources', () => {
  it('can create hrReport with up to 20 MPU attendances', async () => {
    const db = dbFor('hr1', 'human_resources')
    const mpuAttendances = Array.from({ length: 20 }, (_, i) => ({
      mpuUid: `mpu${i}`,
      mpuNameSnapshot: `MPU ${i}`,
      clockInTime: '10:00',
      clockOutTime: '18:30',
      absent: false,
    }))
    await assertSucceeds(
      setDoc(doc(db, 'hrReports', 'hr-ok'), {
        title: 'Günlük İK',
        body: 'Özet metin',
        mpuAttendances,
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('can create hiring note and freeze MPU', async () => {
    const db = dbFor('hr1', 'human_resources')
    await assertSucceeds(
      setDoc(doc(db, 'hiringNotes', 'hn1'), {
        candidateName: 'Aday',
        note: 'Not',
        attachments: [],
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'media1'), {
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('cannot soft-delete accounts or approve jobs', async () => {
    const db = dbFor('hr1', 'human_resources')
    await assertFails(
      updateDoc(doc(db, 'users', 'media1'), {
        isActive: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })
    await assertFails(
      updateDoc(doc(db, 'jobs', 'job1'), {
        status: 'approved',
        statusVersion: 2,
        updatedAt: serverTimestamp(),
        reviewedByUid: 'hr1',
        reviewedByNameSnapshot: 'User hr1',
        reviewedAt: serverTimestamp(),
        reviewNote: null,
        plannedExecutionDate: '2026-07-10T10:00',
      }),
    )
  })

  it('can start own shift', async () => {
    const db = dbFor('hr1', 'human_resources')
    await assertSucceeds(
      setDoc(doc(db, 'activeShifts', 'hr1'), {
        shiftId: 'shift-hr-1',
        ownerUid: 'hr1',
        ownerNameSnapshot: 'User hr1',
        roleSnapshot: 'human_resources',
        status: 'active',
        startedAt: serverTimestamp(),
        timezone: 'Europe/Istanbul',
        createdAt: serverTimestamp(),
      }),
    )
  })
})

describe('Role matrix — coordinator', () => {
  it('can approve pending job', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
    })
    const db = dbFor('coord1', 'coordinator')
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job1'), {
        status: 'approved',
        statusVersion: 2,
        updatedAt: serverTimestamp(),
        reviewedByUid: 'coord1',
        reviewedByNameSnapshot: 'User coord1',
        reviewedAt: serverTimestamp(),
        reviewNote: null,
        plannedExecutionDate: '2026-07-10T10:00',
      }),
    )
  })

  it('can set daily region and soft-delete MPU', async () => {
    const db = dbFor('coord1', 'coordinator')
    await assertSucceeds(
      setDoc(doc(db, 'dailyRegions', '2026-07-27'), {
        date: '2026-07-27',
        region: 'Kadıköy',
        updatedByUid: 'coord1',
        updatedByNameSnapshot: 'User coord1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'media1'), {
        isActive: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('can read hrReports but cannot create them', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'hrReports', 'hr1'), {
        title: 'Rapor',
        body: 'Body',
        mpuAttendances: [],
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    const db = dbFor('coord1', 'coordinator')
    await assertSucceeds(getDoc(doc(db, 'hrReports', 'hr1')))
    await assertFails(
      setDoc(doc(db, 'hrReports', 'hr-coord'), {
        title: 'Yetkisiz',
        body: 'Body',
        mpuAttendances: [],
        createdByUid: 'coord1',
        createdByNameSnapshot: 'User coord1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('Role matrix — management', () => {
  it('can approve job, soft-delete, read management notifications', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job1'), jobPayload())
      await setDoc(doc(ctx.firestore(), 'managementNotifications', 'n1'), {
        type: 'hr_report',
        title: 'Başlık',
        body: 'Body',
        link: '/human-resources',
        createdByUid: 'hr1',
        createdByNameSnapshot: 'User hr1',
        createdAt: Timestamp.now(),
        readByUids: [],
      })
    })
    const db = dbFor('mgmt1', 'management')
    await assertSucceeds(getDoc(doc(db, 'managementNotifications', 'n1')))
    await assertSucceeds(
      updateDoc(doc(db, 'jobs', 'job1'), {
        status: 'approved',
        statusVersion: 2,
        updatedAt: serverTimestamp(),
        reviewedByUid: 'mgmt1',
        reviewedByNameSnapshot: 'User mgmt1',
        reviewedAt: serverTimestamp(),
        reviewNote: null,
        plannedExecutionDate: '2026-07-10T10:00',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'media1'), {
        isActive: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('cannot create hrReport as management', async () => {
    const db = dbFor('mgmt1', 'management')
    await assertFails(
      setDoc(doc(db, 'hrReports', 'hr-mgmt'), {
        title: 'Yetkisiz',
        body: 'Body',
        mpuAttendances: [],
        createdByUid: 'mgmt1',
        createdByNameSnapshot: 'User mgmt1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('Role matrix — kameraman', () => {
  it('can read jobs but cannot create jobs or daily reports', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'jobs', 'job-cam'), jobPayload())
    })
    const db = dbFor('cam1', 'kameraman')
    await assertSucceeds(getDoc(doc(db, 'jobs', 'job-cam')))
    await assertFails(
      setDoc(doc(db, 'jobs', 'job-cam-write'), {
        ...jobPayload(),
        createdByUid: 'cam1',
        createdByNameSnapshot: 'User cam1',
        createdByEmailSnapshot: 'cam1@brain.local',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(doc(db, 'reporterDailyReports', 'rd-cam'), {
        reportDate: '2026-08-03',
        companyCount: 0,
        companies: [],
        note: '',
        hotelExpenseKurus: 0,
        stationeryExpenseKurus: 0,
        fuelExpenseKurus: 0,
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
        createdByUid: 'cam1',
        createdByNameSnapshot: 'User cam1',
        createdByEmailSnapshot: 'cam1@brain.local',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: 'cam1',
        updatedByNameSnapshot: 'User cam1',
      }),
    )
  })

  it('cannot read management notifications', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'managementNotifications', 'n-cam'), {
        type: 'job_created',
        title: 'T',
        body: 'B',
        link: '/jobs',
        createdByUid: 'media1',
        createdByNameSnapshot: 'User media1',
        createdAt: Timestamp.now(),
        readByUids: [],
      })
    })
    await assertFails(
      getDoc(doc(dbFor('cam1', 'kameraman'), 'managementNotifications', 'n-cam')),
    )
  })
})

describe('Role matrix — cross-role denials', () => {
  it('reporter and media cannot read management notifications', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'managementNotifications', 'n1'), {
        type: 'job_created',
        title: 'T',
        body: 'B',
        link: '/jobs',
        createdByUid: 'media1',
        createdByNameSnapshot: 'User media1',
        createdAt: Timestamp.now(),
        readByUids: [],
      })
    })
    await assertFails(
      getDoc(doc(dbFor('reporter1', 'reporter'), 'managementNotifications', 'n1')),
    )
    await assertFails(
      getDoc(doc(dbFor('media1', 'media_planning'), 'managementNotifications', 'n1')),
    )
    await assertFails(
      getDoc(doc(dbFor('hr1', 'human_resources'), 'managementNotifications', 'n1')),
    )
  })

  it('only authenticated roles can read dailyRegions', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dailyRegions', '2026-07-27'), {
        date: '2026-07-27',
        region: 'Beşiktaş',
        updatedByUid: 'coord1',
        updatedByNameSnapshot: 'User coord1',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    for (const [uid, role] of [
      ['media1', 'media_planning'],
      ['reporter1', 'reporter'],
      ['hr1', 'human_resources'],
      ['coord1', 'coordinator'],
      ['mgmt1', 'management'],
      ['cam1', 'kameraman'],
    ] as const) {
      await assertSucceeds(
        getDoc(doc(dbFor(uid, role), 'dailyRegions', '2026-07-27')),
      )
    }
    await assertFails(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'dailyRegions', '2026-07-27')),
    )
  })
})
