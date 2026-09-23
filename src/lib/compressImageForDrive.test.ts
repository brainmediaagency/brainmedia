import { describe, expect, it } from 'vitest'
import { jpegDriveFileName, scaleSize } from '@/lib/compressImageForDrive'

describe('compressImageForDrive helpers', () => {
  it('rewrites names to .jpg after re-encode', () => {
    expect(jpegDriveFileName('Z_raporu.PNG')).toBe('Z_raporu.jpg')
    expect(jpegDriveFileName('photo heic.heic')).toMatch(/\.jpg$/)
    expect(jpegDriveFileName('')).toBe('photo.jpg')
  })

  it('scales longest edge down while preserving aspect', () => {
    expect(scaleSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(scaleSize(1000, 800, 1600)).toEqual({ width: 1000, height: 800 })
  })
})
