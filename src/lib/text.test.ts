import { describe, expect, it } from 'vitest'
import { toTitleCaseTr } from '@/lib/text'

describe('toTitleCaseTr', () => {
  it('capitalizes each word with Turkish İ/i', () => {
    expect(toTitleCaseTr('istanbul medya')).toBe('İstanbul Medya')
    // ASCII I → Turkish ı under tr-TR (intentional locale behavior).
    expect(toTitleCaseTr('ALI VELİ')).toBe('Alı Veli')
    expect(toTitleCaseTr('ALİ VELİ')).toBe('Ali Veli')
    expect(toTitleCaseTr('  bornova  merkez  ')).toBe('  Bornova  Merkez  ')
  })
})
