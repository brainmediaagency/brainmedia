import { describe, expect, it } from 'vitest'
import {
  DRIVE_CHUNK_BYTES,
  DRIVE_HARD_MAX_BYTES,
  DRIVE_SINGLE_SHOT_MAX_BYTES,
  directPutTimeoutMs,
  parseResumableRangeEnd,
  uint8ToBase64,
} from '@/lib/driveUpload'

describe('driveUpload chunk helpers', () => {
  it('encodes binary to base64 that atob can reverse', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 10, 13])
    const b64 = uint8ToBase64(bytes)
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
    expect([...out]).toEqual([...bytes])
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

  it('scales the PUT stall guard with size, never below 2 minutes', () => {
    expect(directPutTimeoutMs(1)).toBe(120_000)
    // 30 min voice at 24 kbps ≈ 5.4 MB → ~173 s at the 32 KB/s floor
    const thirtyMinVoice = 5.4 * 1024 * 1024
    expect(directPutTimeoutMs(thirtyMinVoice)).toBeGreaterThan(120_000)
    expect(directPutTimeoutMs(thirtyMinVoice)).toBeLessThan(300_000)
    // Worst-case 29 MB still gets a finite, generous window
    expect(directPutTimeoutMs(29 * 1024 * 1024)).toBeLessThan(1_200_000)
  })
})
