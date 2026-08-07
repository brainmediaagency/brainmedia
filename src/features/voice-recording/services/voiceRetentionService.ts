import {
  collection,
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { fromZonedTime } from 'date-fns-tz'
import { COMPANY_TIMEZONE } from '@/config/roles'
import { getDb } from '@/lib/firebase/firestore'
import { todayDateOnlyIstanbul } from '@/lib/date'
import { addDaysDateOnly } from '@/features/hr/utils/hrRetentionSchedule'
import { trashDriveFile } from '@/lib/driveUpload'
import { UserFacingError, mapAppError } from '@/lib/errors'

/** Keep voice recordings for this many calendar days (Istanbul). */
export const VOICE_RETENTION_DAYS = 3

const BATCH_READ = 50

/** Istanbul calendar date: recordings created before this day are expired. */
export function getVoiceRetentionCutoffDate(
  today: string = todayDateOnlyIstanbul(),
): string {
  return addDaysDateOnly(today, -VOICE_RETENTION_DAYS)
}

/** Pure predicate: created before (today − VOICE_RETENTION_DAYS) midnight Istanbul. */
export function isVoiceRecordingExpired(
  createdAtMs: number,
  today: string = todayDateOnlyIstanbul(),
): boolean {
  const cutoffDate = getVoiceRetentionCutoffDate(today)
  const cutoffMs = fromZonedTime(
    `${cutoffDate}T00:00:00`,
    COMPANY_TIMEZONE,
  ).getTime()
  return createdAtMs < cutoffMs
}

function retentionCutoffTimestamp(
  today: string = todayDateOnlyIstanbul(),
): Timestamp {
  // Delete anything strictly older than (today − VOICE_RETENTION_DAYS).
  const cutoffDate = getVoiceRetentionCutoffDate(today)
  const start = fromZonedTime(`${cutoffDate}T00:00:00`, COMPANY_TIMEZONE)
  return Timestamp.fromDate(start)
}

/**
 * Deletes voice recordings older than {@link VOICE_RETENTION_DAYS},
 * oldest first (`createdAt` ascending). Safe to run from multiple clients.
 */
export async function purgeExpiredVoiceRecordings(): Promise<{
  deleted: number
  cutoffDate: string
}> {
  const today = todayDateOnlyIstanbul()
  const cutoffDate = getVoiceRetentionCutoffDate(today)
  const cutoff = retentionCutoffTimestamp(today)
  let deleted = 0

  try {
    for (;;) {
      const snap = await getDocs(
        query(
          collection(getDb(), 'voiceRecordings'),
          where('createdAt', '<', cutoff),
          orderBy('createdAt', 'asc'),
          limit(BATCH_READ),
        ),
      )
      if (snap.empty) break

      for (const item of snap.docs) {
        try {
          const data = item.data() as { driveFileId?: string }
          const driveFileId = String(data.driveFileId ?? '').trim()
          await deleteDoc(item.ref)
          if (driveFileId) void trashDriveFile(driveFileId)
          deleted += 1
        } catch {
          // Concurrent delete / permission — continue with remaining.
        }
      }

      if (snap.size < BATCH_READ) break
    }

    return { deleted, cutoffDate }
  } catch (error) {
    throw new UserFacingError(
      mapAppError(error, 'Eski ses kayıtları temizlenemedi.'),
    )
  }
}
