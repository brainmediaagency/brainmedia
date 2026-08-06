import { describe, expect, it } from 'vitest'
import {
  DRIVE_CHUNK_BYTES,
  DRIVE_HARD_MAX_BYTES,
  DRIVE_SINGLE_SHOT_MAX_BYTES,
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

  it('keeps single-shot under chunk size and hard max above long voice files', () => {
    expect(DRIVE_SINGLE_SHOT_MAX_BYTES).toBeLessThan(DRIVE_CHUNK_BYTES * 3)
    expect(DRIVE_CHUNK_BYTES).toBeGreaterThan(100_000)
    // 25 min @ ~128 kbps ≈ 24 MB — must fit under hard max
    expect(DRIVE_HARD_MAX_BYTES).toBeGreaterThan(30 * 1024 * 1024)
  })
})
