import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isSheetsWebhookConfigured,
  isSheetsWebhookVersionStale,
  SHEETS_WEBHOOK_KAMERAMAN_DRIVE_VERSION,
  SHEETS_WEBHOOK_MIN_VERSION,
  webhookSupportsKameramanDrive,
  webhookVersionNumber,
} from '@/lib/sheetsWebhook'

describe('sheetsWebhook', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is configured when URL is set (no secret required)', () => {
    vi.stubEnv('VITE_SHEETS_WEBHOOK_URL', 'https://script.google.com/macros/s/x/exec')
    expect(isSheetsWebhookConfigured()).toBe(true)
  })

  it('is not configured when URL missing', () => {
    vi.stubEnv('VITE_SHEETS_WEBHOOK_URL', '')
    expect(isSheetsWebhookConfigured()).toBe(false)
  })

  it('treats v13 as fresh (OPS-04 min version)', () => {
    expect(SHEETS_WEBHOOK_MIN_VERSION).toBe(10)
    expect(
      isSheetsWebhookVersionStale({
        ok: true,
        service: 'brain-sheets-drive-webhook-v13',
        version: 'v13',
        features: [
          'upsertJobRow',
          'updateSonDurum',
          'updateDkHaber',
          'uploadFile',
          'uploadResult',
          'driveStorageUsage',
          'pushNotify',
        ],
      }),
    ).toBe(false)
  })

  it('marks v9 / missing features as stale', () => {
    expect(
      isSheetsWebhookVersionStale({
        service: 'brain-sheets-drive-webhook-v9',
        version: 'v9',
        features: ['upsertJobRow', 'updateDkHaber', 'pushNotify'],
      }),
    ).toBe(true)
    expect(
      isSheetsWebhookVersionStale({
        service: 'brain-sheets-drive-webhook-v13',
        version: 'v13',
        features: ['upsertJobRow'],
      }),
    ).toBe(true)
  })

  it('treats live v28 as kameraman-ready (no script-update nag)', () => {
    expect(SHEETS_WEBHOOK_KAMERAMAN_DRIVE_VERSION).toBe(20)
    expect(
      webhookVersionNumber({
        service: 'brain-sheets-drive-webhook-v28',
        version: 'v28',
      }),
    ).toBe(28)
    expect(
      webhookSupportsKameramanDrive({
        service: 'brain-sheets-drive-webhook-v28',
        version: 'v28',
      }),
    ).toBe(true)
    expect(
      webhookSupportsKameramanDrive({
        service: 'brain-sheets-drive-webhook-v19',
        version: 'v19',
      }),
    ).toBe(false)
  })
})
