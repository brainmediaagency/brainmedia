import { describe, expect, it } from 'vitest'
import {
  DRIVE_CHUNK_BYTES,
  DRIVE_HARD_MAX_BYTES,
  DRIVE_SINGLE_SHOT_MAX_BYTES,
  directPutTimeoutMs,
  formatDriveWebhookError,
  parseResumableRangeEnd,
  uint8ToBase64,
  base64ToUint8Array,
} from '@/lib/driveUpload'

describe('driveUpload chunk helpers', () => {
  it('encodes binary to base64 that atob can reverse', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 10, 13])
    const b64 = uint8ToBase64(bytes)
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
    expect([...out]).toEqual([...bytes])
    expect([...base64ToUint8Array(b64)]).toEqual([...bytes])
  })

  it('keeps single-shot modest and hard max above long voice files', () => {
    // One shot still smaller than multi-chunk voice (e.g. 30 min speech)
    expect(DRIVE_SINGLE_SHOT_MAX_BYTES).toBeLessThan(3 * 1024 * 1024)
    expect(DRIVE_CHUNK_BYTES).toBeGreaterThan(100_000)
    expect(DRIVE_CHUNK_BYTES).toBeLessThanOrEqual(512 * 1024)
    // 30 min @ 128 kbps worst-case ≈ 29 MB; still under hard max
    expect(DRIVE_HARD_MAX_BYTES).toBeGreaterThan(30 * 1024 * 1024)
  })
})

describe('direct Drive upload helpers (v28)', () => {
  it('parses the committed byte from a Drive Range header', () => {
    expect(parseResumableRangeEnd('bytes=0-12345')).toBe(12345)
    expect(parseResumableRangeEnd('bytes=0-0')).toBe(0)
  })

  it('returns null when Range is missing or unreadable (CORS)', () => {
    expect(parseResumableRangeEnd(null)).toBeNull()
    expect(parseResumableRangeEnd(undefined)).toBeNull()
    expect(parseResumableRangeEnd('')).toBeNull()
    expect(parseResumableRangeEnd('garbage')).toBeNull()
  })

  it('scales the PUT stall guard with size, never below 45s, caps slice at 3m', () => {
    expect(directPutTimeoutMs(1)).toBe(45_000)
    // One 2 MB direct slice at ~16 KB/s floor → ~128s
    expect(directPutTimeoutMs(2 * 1024 * 1024)).toBe(128_000)
    // Unusually large single payload still hard-capped
    expect(directPutTimeoutMs(80 * 1024 * 1024)).toBe(180_000)
  })
})

describe('formatDriveWebhookError (kameraman v28 false-positive)', () => {
  const v28 = {
    service: 'brain-sheets-drive-webhook-v28',
    version: 'v28',
  }

  it('does not ask to update Code.gs when Drive resumable fails on v28', () => {
    const message = formatDriveWebhookError(
      { ...v28, ok: false, error: 'Drive resumable session failed' },
      'fallback',
    )
    expect(message).not.toMatch(/Code\.gs|script güncelle|v24\+|v27\+|New version/i)
    expect(message).toMatch(/Drive/)
  })

  it('does not treat invalid islem as stale when version is v28', () => {
    const message = formatDriveWebhookError(
      { ...v28, ok: false, error: 'Invalid islem' },
      'fallback',
    )
    expect(message).not.toMatch(/Code\.gs|New version/i)
  })

  it('still asks to update Code.gs for invalid islem without a current version', () => {
    const message = formatDriveWebhookError(
      { ok: false, error: 'Invalid islem' },
      'fallback',
    )
    expect(message).toMatch(/Code\.gs/)
  })
})
