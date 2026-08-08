import { describe, expect, it } from 'vitest'
import { jpegDriveFileName } from '@/lib/compressImageForDrive'

describe('compressImageForDrive helpers', () => {
  it('rewrites names to .jpg after re-encode', () => {
    expect(jpegDriveFileName('Z_raporu.PNG')).toBe('Z_raporu.jpg')
    expect(jpegDriveFileName('photo heic.heic')).toMatch(/\.jpg$/)
    expect(jpegDriveFileName('')).toBe('photo.jpg')
  })
})
