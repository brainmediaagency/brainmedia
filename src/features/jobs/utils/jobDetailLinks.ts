import { digitsOnly, normalizeTurkishPhone } from '@/lib/phone'

/** Instagram profile URL from a handle (`@foo`) or full URL. */
export function instagramProfileUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const handle = trimmed
    .replace(/^@/, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
    .trim()
  if (!handle) return null
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`
}

export function mapsSearchUrl(query: string): string | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
}

export function telHref(phone: string): string | null {
  const normalized = normalizeTurkishPhone(phone)
  if (normalized) return `tel:${normalized}`
  const digits = digitsOnly(phone)
  return digits.length >= 10 ? `tel:+${digits}` : null
}

export function whatsappHref(phone: string): string | null {
  const normalized = normalizeTurkishPhone(phone)
  if (!normalized) return null
  return `https://wa.me/${digitsOnly(normalized)}`
}
