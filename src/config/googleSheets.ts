/**
 * Google Sheets embed config for the coordinator/management Excel tab.
 *
 * Prefer `VITE_GOOGLE_SHEETS_EMBED_URL` (full iframe URL).
 * Or set `VITE_GOOGLE_SHEETS_ID` and we build the editable embed URL.
 *
 * Unrelated to `VITE_SHEETS_WEBHOOK_*` (Apps Script job log). Share the sheet
 * with coordinator Google accounts as Editor for in-iframe editing.
 */

function trimEnv(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Extract spreadsheet ID from a docs.google.com spreadsheets URL when possible. */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? null
}

export function buildSheetsEditUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
}

export function buildSheetsEmbedUrl(spreadsheetId: string): string {
  return `${buildSheetsEditUrl(spreadsheetId)}?usp=sharing&rm=minimal`
}

export type GoogleSheetsEmbedConfig = {
  /** URL used inside the iframe (editable when shared as Editor). */
  embedUrl: string
  /** Full Sheets UI — fallback when iframe/cookies fail. */
  openUrl: string
}

export function getGoogleSheetsEmbedConfig(): GoogleSheetsEmbedConfig | null {
  const embedOverride = trimEnv(import.meta.env.VITE_GOOGLE_SHEETS_EMBED_URL)
  const spreadsheetId = trimEnv(import.meta.env.VITE_GOOGLE_SHEETS_ID)

  if (embedOverride) {
    const idFromUrl = extractSpreadsheetId(embedOverride)
    return {
      embedUrl: embedOverride,
      openUrl: idFromUrl ? buildSheetsEditUrl(idFromUrl) : embedOverride,
    }
  }

  if (spreadsheetId) {
    return {
      embedUrl: buildSheetsEmbedUrl(spreadsheetId),
      openUrl: buildSheetsEditUrl(spreadsheetId),
    }
  }

  return null
}
