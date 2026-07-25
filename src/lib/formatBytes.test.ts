import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STORAGE_QUOTA_BYTES,
  formatBytesTr,
  formatStorageUsageTr,
} from '@/lib/formatBytes'

describe('formatBytesTr', () => {
  it('formats bytes and larger units with tr-TR', () => {
    expect(formatBytesTr(0)).toBe('0 B')
    expect(formatBytesTr(512)).toBe('512 B')
    expect(formatBytesTr(1024)).toMatch(/KB/)
    expect(formatBytesTr(1.2 * 1024 * 1024)).toMatch(/MB/)
  })

  it('formats used / quota pair', () => {
    expect(formatStorageUsageTr(0, DEFAULT_STORAGE_QUOTA_BYTES)).toMatch(
      /0 B \/ 15 GB/,
    )
  })
})
