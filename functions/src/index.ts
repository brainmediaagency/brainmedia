import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

initializeApp()

const TIME_ZONE = 'Europe/Istanbul'
/** Inclusive start hour (09:00). */
const WINDOW_START_HOUR = 9
/** Exclusive end hour (21:00 → last run window until 20:59). */
const WINDOW_END_HOUR = 21

const SYSTEM_FORWARD_UID = 'system-auto-forward'
const SYSTEM_FORWARD_NAME = 'Otomatik iletim'

const BATCH_LIMIT = 200

function istanbulHourNow(now = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return Number(hourStr)
}

function isWithinForwardWindow(now = new Date()): boolean {
  const hour = istanbulHourNow(now)
  return hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR
}

/**
 * Her 15 dakikada bir çalışır.
 * İstanbul 09:00–21:00 arasında: status=approved && forwardedToReporter=false
 * işleri muhabir çekim takvimine iletir.
 *
 * Not: Scheduled functions Blaze gerektirir. Spark’ta client
 * `AutoForwardJobsGuard` yedek olarak çalışır.
 */
export const autoForwardJobsToReporter = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: TIME_ZONE,
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    if (!isWithinForwardWindow()) {
      logger.info('Outside forward window (09:00–21:00 Europe/Istanbul); skip.')
      return
    }

    const db = getFirestore()
    const snap = await db
      .collection('jobs')
      .where('status', '==', 'approved')
      .where('forwardedToReporter', '==', false)
      .limit(BATCH_LIMIT)
      .get()

    if (snap.empty) {
      logger.info('No approved unforwarded jobs.')
      return
    }

    let forwarded = 0
    let batch = db.batch()
    let ops = 0

    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        forwardedToReporter: true,
        forwardedToReporterByUid: SYSTEM_FORWARD_UID,
        forwardedToReporterByNameSnapshot: SYSTEM_FORWARD_NAME,
        forwardedToReporterAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      ops += 1
      forwarded += 1

      if (ops >= 400) {
        await batch.commit()
        batch = db.batch()
        ops = 0
      }
    }

    if (ops > 0) {
      await batch.commit()
    }

    logger.info(`Auto-forwarded ${forwarded} job(s) to reporters.`, {
      forwarded,
      scanned: snap.size,
    })
  },
)
