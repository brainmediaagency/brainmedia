import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildSheetsEmbedUrl,
  buildSheetsEditUrl,
  extractSpreadsheetId,
  getGoogleSheetsEmbedConfig,
} from '@/config/googleSheets'

describe('googleSheets config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('extracts spreadsheet id from docs URL', () => {
    expect(
      extractSpreadsheetId(
        'https://docs.google.com/spreadsheets/d/abc123_XYZ/edit?usp=sharing',
      ),
    ).toBe('abc123_XYZ')
    expect(extractSpreadsheetId('https://example.com')).toBeNull()
  })

  it('builds edit and embed URLs', () => {
    expect(buildSheetsEditUrl('sheetId1')).toBe(
      'https://docs.google.com/spreadsheets/d/sheetId1/edit',
    )
    expect(buildSheetsEmbedUrl('sheetId1')).toBe(
      'https://docs.google.com/spreadsheets/d/sheetId1/edit?usp=sharing&rm=minimal',
    )
  })

  it('prefers embed URL override', () => {
    vi.stubEnv(
      'VITE_GOOGLE_SHEETS_EMBED_URL',
      'https://docs.google.com/spreadsheets/d/overrideId/edit?rm=minimal',
    )
    vi.stubEnv('VITE_GOOGLE_SHEETS_ID', 'ignoredId')
    expect(getGoogleSheetsEmbedConfig()).toEqual({
      embedUrl:
        'https://docs.google.com/spreadsheets/d/overrideId/edit?rm=minimal',
      openUrl: 'https://docs.google.com/spreadsheets/d/overrideId/edit',
    })
  })

  it('derives from spreadsheet id when embed URL missing', () => {
    vi.stubEnv('VITE_GOOGLE_SHEETS_EMBED_URL', '')
    vi.stubEnv('VITE_GOOGLE_SHEETS_ID', 'onlyId')
    expect(getGoogleSheetsEmbedConfig()).toEqual({
      embedUrl:
        'https://docs.google.com/spreadsheets/d/onlyId/edit?usp=sharing&rm=minimal',
      openUrl: 'https://docs.google.com/spreadsheets/d/onlyId/edit',
    })
  })

  it('returns null when neither env is set', () => {
    vi.stubEnv('VITE_GOOGLE_SHEETS_EMBED_URL', '')
    vi.stubEnv('VITE_GOOGLE_SHEETS_ID', '')
    expect(getGoogleSheetsEmbedConfig()).toBeNull()
  })
})
