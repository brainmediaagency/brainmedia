import { describe, expect, it } from 'vitest'
import { absoluteAppUrl, sanitizeAppPath } from '@/lib/appPath'

describe('sanitizeAppPath', () => {
  it('allows relative app paths', () => {
    expect(sanitizeAppPath('/management')).toBe('/management')
    expect(sanitizeAppPath('/reporter?tab=daily-reports')).toBe(
      '/reporter?tab=daily-reports',
    )
  })

  it('rejects absolute and protocol-relative attacker URLs', () => {
    expect(sanitizeAppPath('https://evil.example/phish')).toBe('/management')
    expect(sanitizeAppPath('http://evil.example')).toBe('/management')
    expect(sanitizeAppPath('//evil.example/x')).toBe('/management')
    expect(sanitizeAppPath('javascript:alert(1)')).toBe('/management')
    expect(sanitizeAppPath('management')).toBe('/management')
  })
})

describe('absoluteAppUrl', () => {
  it('prefixes origin onto sanitized relative paths', () => {
    expect(absoluteAppUrl('/management')).toMatch(/\/management$/)
    expect(absoluteAppUrl('https://evil.example')).toMatch(/\/management$/)
  })
})
