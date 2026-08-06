/**
 * Simulated end-user journeys as pure product rules (no browser, no live data).
 */
import { describe, expect, it } from 'vitest'
import { canAccessRoute } from '@/config/permissions'
import {
  isAllowedTransition,
  getStatsDelta,
} from '@/features/jobs/utils/jobTransitions'
import {
  isNotificationVisibleForRole,
  isOwnActionNotification,
  mergeNotificationFeeds,
} from '@/features/notifications/services/notificationService'
import type { AppNotification } from '@/features/notifications/types'
import { sanitizeAppPath } from '@/lib/appPath'
import { reportNetCashKurus } from '@/features/cash/services/companyCashService'
import { isValidDateOnly, statsAttributionDateOnly } from '@/lib/date'

function notif(
  partial: Partial<AppNotification> & Pick<AppNotification, 'id' | 'type'>,
): AppNotification {
  return {
    title: 't',
    body: 'b',
    link: '/management',
    createdAt: null,
    createdByUid: 'actor',
    readByUids: [],
    source: 'management',
    ...partial,
  }
}

describe('QA · journey · MPU creates job', () => {
  it('MPU reaches media-planning only; cannot open İK or management desks', () => {
    expect(canAccessRoute('media_planning', 'media-planning')).toBe(true)
    expect(canAccessRoute('media_planning', 'human-resources')).toBe(false)
    expect(canAccessRoute('media_planning', 'management')).toBe(false)
  })

  it('pending → approved is allowed; rejected cannot jump to shot', () => {
    expect(isAllowedTransition('pending', 'approved')).toBe(true)
    expect(isAllowedTransition('rejected', 'shot')).toBe(false)
    expect(isAllowedTransition('pending', 'shot')).toBe(false)
  })

  it('stats delta on approve increments jobsReceived', () => {
    expect(getStatsDelta('pending', 'approved')).toEqual({
      jobsReceived: 1,
      jobsShot: 0,
      jobsCancelled: 0,
    })
  })
})

describe('QA · journey · management reviews notifications', () => {
  it('sees İK report; MPU would not if filter applied', () => {
    const hr = notif({ id: '1', type: 'hr_report' })
    expect(isNotificationVisibleForRole(hr, 'management')).toBe(true)
    expect(isNotificationVisibleForRole(hr, 'media_planning')).toBe(false)
  })

  it('hides own non-region actions from actor', () => {
    const own = notif({
      id: '2',
      type: 'job_created',
      createdByUid: 'mgr-1',
    })
    expect(isOwnActionNotification(own, 'mgr-1')).toBe(true)
    expect(isOwnActionNotification(own, 'other')).toBe(false)
  })

  it('merge keeps newest-first cap', () => {
    const older = notif({
      id: 'a',
      type: 'job_created',
      createdAt: { toMillis: () => 1 } as AppNotification['createdAt'],
    })
    const newer = notif({
      id: 'b',
      type: 'job_created',
      createdAt: { toMillis: () => 99 } as AppNotification['createdAt'],
    })
    const merged = mergeNotificationFeeds([[older], [newer]], 40)
    expect(merged[0]?.id).toBe('b')
  })
})

describe('QA · journey · muhabir daily cash', () => {
  it('net cash is fieldPaid − expense', () => {
    expect(
      reportNetCashKurus({
        fieldPaidKurus: 100_00,
        totalExpenseKurus: 40_00,
      }),
    ).toBe(60_00)
  })

  it('deep links stay relative (no open-redirect to evil.com)', () => {
    expect(sanitizeAppPath('https://evil.com')).toBe('/management')
    expect(sanitizeAppPath('//evil.com')).toBe('/management')
    expect(sanitizeAppPath('/reporter?tab=cash')).toBe('/reporter?tab=cash')
  })
})

describe('QA · journey · month-end stats attribution', () => {
  it('uses Istanbul date-only validation for ops dates', () => {
    expect(isValidDateOnly('2026-08-06')).toBe(true)
    expect(isValidDateOnly('06-08-2026')).toBe(false)
  })

  it('last day of month maps to next month for stats attribution', () => {
    expect(statsAttributionDateOnly('2026-03-31')).toBe('2026-04-01')
    expect(statsAttributionDateOnly('2026-03-30')).toBe('2026-03-30')
  })
})

describe('QA · journey · kameraman inbox silence', () => {
  it('kameraman never sees broadcast or management types in filter', () => {
    for (const type of [
      'region_created',
      'job_created',
      'daily_report',
      'hr_report',
    ] as const) {
      expect(
        isNotificationVisibleForRole(notif({ id: type, type }), 'kameraman'),
      ).toBe(false)
    }
  })
})
