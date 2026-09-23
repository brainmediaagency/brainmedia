import { describe, expect, it } from 'vitest'
import {
  instagramProfileUrl,
  mapsSearchUrl,
  telHref,
  whatsappHref,
} from '@/features/jobs/utils/jobDetailLinks'

describe('jobDetailLinks', () => {
  it('builds Instagram URLs from handles and keeps full URLs', () => {
    expect(instagramProfileUrl('@studio')).toBe(
      'https://www.instagram.com/studio/',
    )
    expect(instagramProfileUrl('https://instagram.com/studio')).toBe(
      'https://instagram.com/studio',
    )
    expect(instagramProfileUrl('  ')).toBeNull()
  })

  it('builds a Google Maps search URL', () => {
    expect(mapsSearchUrl('Kadıköy, İstanbul')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Kad%C4%B1k%C3%B6y%2C%20%C4%B0stanbul',
    )
    expect(mapsSearchUrl('')).toBeNull()
  })

  it('builds tel and WhatsApp hrefs from Turkish mobiles', () => {
    expect(telHref('0532 111 22 33')).toBe('tel:+905321112233')
    expect(whatsappHref('0532 111 22 33')).toBe('https://wa.me/905321112233')
    expect(whatsappHref('abc')).toBeNull()
  })
})
