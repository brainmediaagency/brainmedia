/**
 * Safe in-app path for inbox / push deep links.
 * Only relative paths starting with a single `/` are allowed
 * (rejects absolute http(s) and protocol-relative URLs).
 */
export function sanitizeAppPath(
  path: string | null | undefined,
  fallback = '/management',
): string {
  const trimmed = (path ?? '').trim()
  if (!trimmed) return fallback
  if (/^https?:/i.test(trimmed) || trimmed.startsWith('//')) return fallback
  if (!trimmed.startsWith('/')) return fallback
  // Disallow schemes / backslash escapes inside the path.
  if (trimmed.includes(':') || trimmed.includes('\\')) return fallback
  return trimmed.slice(0, 200)
}

/** Origin + relative path for Web Push click URLs. */
export function absoluteAppUrl(path: string): string {
  const origin =
    (typeof window !== 'undefined' && window.location?.origin) ||
    'https://brain-c5fcb.web.app'
  return `${origin}${sanitizeAppPath(path)}`
}
