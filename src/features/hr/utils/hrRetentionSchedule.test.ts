import { describe, expect, it } from 'vitest'
import { fromZonedTime } from 'date-fns-tz'
import { COMPANY_TIMEZONE } from '@/config/roles'
import {
  HR_RETENTION_FIRST_PURGE,
  addDaysDateOnly,
  addMonthsDateOnly,
  getDueHrRetentionPurgeDate,
  getUpcomingHrRetentionCycle,
  isCreatedBeforePurgeCutoff,
  isInHrRetentionWarningWindow,
  purgeCutoffMs,
} from '@/features/hr/utils/hrRetentionSchedule'
import {
  VOICE_RETENTION_DAYS,
  getVoiceRetentionCutoffDate,
  isVoiceRecordingExpired,
} from '@/features/voice-recording/services/voiceRetentionService'

describe('HR / Z-report 2-month retention schedule', () => {
  it('advances purge days by whole calendar months on the 1st (not 60 days)', () => {
    expect(addMonthsDateOnly('2026-09-01', 2)).toBe('2026-11-01')
    expect(addMonthsDateOnly('2026-11-01', 2)).toBe('2027-01-01')
    expect(addMonthsDateOnly('2027-01-01', 2)).toBe('2027-03-01')
  })

  it('returns null for due purge before first cycle', () => {
    expect(getDueHrRetentionPurgeDate('2026-08-31')).toBeNull()
  })

  it('returns first cycle on and after first purge day', () => {
    expect(getDueHrRetentionPurgeDate(HR_RETENTION_FIRST_PURGE)).toBe(
      '2026-09-01',
    )
    expect(getDueHrRetentionPurgeDate('2026-10-15')).toBe('2026-09-01')
    expect(getDueHrRetentionPurgeDate('2026-11-01')).toBe('2026-11-01')
    expect(getDueHrRetentionPurgeDate('2026-12-20')).toBe('2026-11-01')
  })

  it('upcoming cycle is next (or today) purge day', () => {
    expect(getUpcomingHrRetentionCycle('2026-08-01').purgeDate).toBe(
      '2026-09-01',
    )
    expect(getUpcomingHrRetentionCycle('2026-09-01').purgeDate).toBe(
      '2026-09-01',
    )
    expect(getUpcomingHrRetentionCycle('2026-09-02').purgeDate).toBe(
      '2026-11-01',
    )
  })

  it('warning window is the 3 days before purge (inclusive)', () => {
    const cycle = getUpcomingHrRetentionCycle('2026-08-29')
    expect(cycle.warnStartDate).toBe('2026-08-29')
    expect(cycle.warnEndDate).toBe('2026-08-31')
    expect(isInHrRetentionWarningWindow('2026-08-28', cycle)).toBe(false)
    expect(isInHrRetentionWarningWindow('2026-08-29', cycle)).toBe(true)
    expect(isInHrRetentionWarningWindow('2026-08-31', cycle)).toBe(true)
    expect(isInHrRetentionWarningWindow('2026-09-01', cycle)).toBe(false)
  })

  it('cutoff is Istanbul midnight of purge day; older docs selected', () => {
    const purgeDate = '2026-09-01'
    const cutoff = purgeCutoffMs(purgeDate)
    expect(cutoff).toBe(
      fromZonedTime('2026-09-01T00:00:00', COMPANY_TIMEZONE).getTime(),
    )

    const justBefore = fromZonedTime(
      '2026-08-31T23:59:59',
      COMPANY_TIMEZONE,
    ).getTime()
    const onPurgeMidnight = cutoff
    const afterPurge = fromZonedTime(
      '2026-09-01T00:00:01',
      COMPANY_TIMEZONE,
    ).getTime()

    expect(isCreatedBeforePurgeCutoff(justBefore, purgeDate)).toBe(true)
    expect(isCreatedBeforePurgeCutoff(onPurgeMidnight, purgeDate)).toBe(false)
    expect(isCreatedBeforePurgeCutoff(afterPurge, purgeDate)).toBe(false)
  })

  it('does not use rolling “exactly 60 days ago” — cycle wipes all pre-purge-day docs', () => {
    // A note created 10 days before Nov purge is still purged on Nov 1
    // (createdAt < 2026-11-01), not kept until 60 days later.
    const created = fromZonedTime(
      '2026-10-22T12:00:00',
      COMPANY_TIMEZONE,
    ).getTime()
    expect(isCreatedBeforePurgeCutoff(created, '2026-11-01')).toBe(true)
    // Same note would NOT be purged on the prior cycle day if that were due.
    expect(isCreatedBeforePurgeCutoff(created, '2026-09-01')).toBe(false)
  })
})

describe('voice recording 3-day retention', () => {
  it('cutoff date is today minus VOICE_RETENTION_DAYS calendar days', () => {
    expect(VOICE_RETENTION_DAYS).toBe(3)
    expect(getVoiceRetentionCutoffDate('2026-07-21')).toBe('2026-07-18')
    expect(addDaysDateOnly('2026-07-21', -3)).toBe('2026-07-18')
  })

  it('expires strictly before cutoff midnight Istanbul', () => {
    const today = '2026-07-21'
    const expired = fromZonedTime(
      '2026-07-17T23:59:59',
      COMPANY_TIMEZONE,
    ).getTime()
    const atCutoff = fromZonedTime(
      '2026-07-18T00:00:00',
      COMPANY_TIMEZONE,
    ).getTime()
    const kept = fromZonedTime(
      '2026-07-18T00:00:01',
      COMPANY_TIMEZONE,
    ).getTime()

    expect(isVoiceRecordingExpired(expired, today)).toBe(true)
    expect(isVoiceRecordingExpired(atCutoff, today)).toBe(false)
    expect(isVoiceRecordingExpired(kept, today)).toBe(false)
  })
})
