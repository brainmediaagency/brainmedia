import { initializeApp } from 'firebase-admin/app'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

initializeApp()

/**
 * Formerly auto-forwarded approved jobs to the reporter calendar.
 * Visibility is now time-based (same-day on confirm, later days at 21:00).
 * Kept as a no-op so an accidental Functions deploy cannot revive the old flag.
 */
export const autoForwardJobsToReporter = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Europe/Istanbul',
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async () => {
    logger.info(
      'autoForwardJobsToReporter is retired; shooting calendars unlock by Istanbul date/21:00.',
    )
  },
)
