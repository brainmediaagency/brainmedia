import { afterEach, describe, expect, it, vi } from 'vitest'
import { canAccessRoute, getDefaultRouteForRole } from '@/config/permissions'
import { formatTimer, nextWorkdayAfter } from '@/lib/date'
import { tryToKurus, kurusToTry, parseTryInput, formatTryFromKurus } from '@/lib/currency'
import { normalizeTurkishPhone, isValidTurkishPhone } from '@/lib/phone'
import { getStatsDelta, isAllowedTransition } from '@/features/jobs/utils/jobTransitions'
import {
  editJobFormSchema,
  fixedCreateJobDates,
  jobFormSchema,
} from '@/features/media-planning/schemas/jobFormSchema'
import locations from '@/data/turkeyLocations.json'

describe('permissions', () => {
  it('maps roles to routes', () => {
    expect(canAccessRoute('media_planning', 'media-planning')).toBe(true)
    expect(canAccessRoute('media_planning', 'management')).toBe(false)
    expect(canAccessRoute('coordinator', 'management')).toBe(false)
    expect(canAccessRoute('coordinator', 'media-planning')).toBe(true)
    expect(canAccessRoute('management', 'management')).toBe(true)
    expect(canAccessRoute('human_resources', 'reporter')).toBe(true)
    expect(canAccessRoute('kameraman', 'reporter')).toBe(true)
    expect(canAccessRoute('kameraman', 'news-sites')).toBe(true)
    expect(canAccessRoute('kameraman', 'game')).toBe(true)
    expect(canAccessRoute('kameraman', 'management')).toBe(false)
    expect(canAccessRoute('management', 'kameraman-field')).toBe(true)
    expect(canAccessRoute('coordinator', 'kameraman-field')).toBe(true)
    expect(canAccessRoute('reporter', 'kameraman-field')).toBe(false)
    expect(canAccessRoute('kameraman', 'kameraman-field')).toBe(false)
    expect(getDefaultRouteForRole('reporter')).toBe('/reporter')
    expect(getDefaultRouteForRole('kameraman')).toBe('/reporter')
  })
})

describe('timer format', () => {
  it('formats HH:MM:SS', () => {
    expect(formatTimer(0)).toBe('00:00:00')
    expect(formatTimer(3661)).toBe('01:01:01')
    expect(formatTimer(-5)).toBe('00:00:00')
  })
})

describe('next workday', () => {
  it('skips Sundays after acquired date and preserves time', () => {
    // Friday -> Saturday
    expect(nextWorkdayAfter('2026-07-17')).toBe('2026-07-18T09:00')
    // Saturday -> Monday (skip Sunday)
    expect(nextWorkdayAfter('2026-07-18')).toBe('2026-07-20T09:00')
    // datetime preserves clock
    expect(nextWorkdayAfter('2026-07-17T14:30')).toBe('2026-07-18T14:30')
  })
})

describe('fixed create job dates', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses Istanbul today and tomorrow skipping Sunday only', () => {
    // Friday → acquired Fri, planned Sat
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T15:00:00+03:00'))
    expect(fixedCreateJobDates()).toEqual({
      acquiredDate: '2026-07-17',
      plannedExecutionDate: '2026-07-18',
    })

    // Saturday → acquired Sat, planned Mon (skip Sunday)
    vi.setSystemTime(new Date('2026-07-18T10:00:00+03:00'))
    expect(fixedCreateJobDates()).toEqual({
      acquiredDate: '2026-07-18',
      plannedExecutionDate: '2026-07-20',
    })

    // Sunday → acquired Sun, planned Mon
    vi.setSystemTime(new Date('2026-07-19T10:00:00+03:00'))
    expect(fixedCreateJobDates()).toEqual({
      acquiredDate: '2026-07-19',
      plannedExecutionDate: '2026-07-20',
    })
  })
})

describe('job schedule past', () => {
  it('detects overdue schedules', async () => {
    const { isJobSchedulePast } = await import('@/lib/date')
    expect(isJobSchedulePast('2020-01-01T10:00')).toBe(true)
    expect(isJobSchedulePast('2099-01-01T10:00')).toBe(false)
  })
})

describe('currency', () => {
  it('converts TRY to kuruş integer', () => {
    expect(tryToKurus(1500.5)).toBe(150050)
    expect(kurusToTry(150050)).toBe(1500.5)
    expect(parseTryInput('1.500,50')).toBe(1500.5)
    expect(formatTryFromKurus(100)).toContain('1')
  })
})

describe('phone', () => {
  it('normalizes Turkish phones', () => {
    expect(normalizeTurkishPhone('0555 111 22 33')).toBe('+905551112233')
    expect(normalizeTurkishPhone('5551112233')).toBe('+905551112233')
    expect(isValidTurkishPhone('abc')).toBe(false)
  })
})

describe('job transitions', () => {
  it('applies correct stats deltas', () => {
    expect(getStatsDelta('pending', 'approved')).toEqual({
      jobsReceived: 1,
      jobsShot: 0,
      jobsCancelled: 0,
    })
    expect(getStatsDelta('approved', 'shot')).toEqual({
      jobsReceived: 0,
      jobsShot: 1,
      jobsCancelled: 0,
    })
    expect(getStatsDelta('approved', 'cancelled')).toEqual({
      jobsReceived: 0,
      jobsShot: 0,
      jobsCancelled: 1,
    })
    expect(getStatsDelta('approved', 'pending')).toEqual({
      jobsReceived: -1,
      jobsShot: 0,
      jobsCancelled: 0,
    })
    expect(getStatsDelta('pending', 'rejected')).toEqual({
      jobsReceived: 0,
      jobsShot: 0,
      jobsCancelled: 0,
    })
    expect(getStatsDelta('pending', 'cancelled')).toEqual({
      jobsReceived: 0,
      jobsShot: 0,
      jobsCancelled: 1,
    })
    expect(isAllowedTransition('pending', 'cancelled')).toBe(true)
    expect(isAllowedTransition('pending', 'shot')).toBe(false)
    expect(isAllowedTransition('approved', 'rejected')).toBe(false)
    expect(isAllowedTransition('approved', 'pending')).toBe(true)
  })
})

describe('job form schema', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const valid = {
    companyName: 'Acme Medya',
    contacts: [
      {
        name: 'Ali Veli',
        mobilePhone: '05551112233',
        workPhone: '',
      },
    ],
    province: 'İstanbul',
    district: 'Kadıköy',
    fullAddress: 'Caferağa Mahallesi örnek sokak no 12',
    instagram: '',
    acquiredDate: '2099-07-01',
    plannedExecutionDate: '2099-07-10',
    agreedAmount: 1500.5,
    confirmed: true,
  }

  it('accepts valid payload', () => {
    const result = jobFormSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('accepts two contacts', () => {
    const result = jobFormSchema.safeParse({
      ...valid,
      contacts: [
        valid.contacts[0],
        { name: 'Ayşe Yılmaz', mobilePhone: '05552223344', workPhone: '02121234567' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty contacts', () => {
    const result = jobFormSchema.safeParse({ ...valid, contacts: [] })
    expect(result.success).toBe(false)
  })

  it('accepts without confirmation', () => {
    const result = jobFormSchema.safeParse({ ...valid, confirmed: false })
    expect(result.success).toBe(true)
  })

  it('rejects planned date before acquired date', () => {
    const result = jobFormSchema.safeParse({
      ...valid,
      plannedExecutionDate: '2026-06-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects past planned date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00+03:00'))

    const result = jobFormSchema.safeParse({
      ...valid,
      acquiredDate: '2026-07-04',
      plannedExecutionDate: '2026-07-04',
    })

    expect(result.success).toBe(false)
  })

  it('edit schema allows past planned date while pending', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00+03:00'))

    const result = editJobFormSchema.safeParse({
      ...valid,
      acquiredDate: '2026-07-04',
      plannedExecutionDate: '2026-07-04',
    })

    expect(result.success).toBe(true)
  })

  it('edit schema still rejects planned before acquired', () => {
    const result = editJobFormSchema.safeParse({
      ...valid,
      acquiredDate: '2099-07-10',
      plannedExecutionDate: '2099-07-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects datetime values on create form', () => {
    const result = jobFormSchema.safeParse({
      ...valid,
      acquiredDate: '2099-07-01T10:00',
      plannedExecutionDate: '2099-07-10T14:30',
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero amount', () => {
    const result = jobFormSchema.safeParse({ ...valid, agreedAmount: 0 })
    expect(result.success).toBe(false)
  })
})

describe('turkey locations', () => {
  it('contains 81 provinces and filters districts', () => {
    expect(locations).toHaveLength(81)
    const istanbul = locations.find((p) => p.name === 'İstanbul')
    expect(istanbul).toBeTruthy()
    expect(istanbul!.districts.length).toBeGreaterThan(30)
    expect(istanbul!.districts).toContain('Kadıköy')
  })
})
