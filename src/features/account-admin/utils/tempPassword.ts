/** Unambiguous alphabet (no 0/O/1/l) — matches Apps Script generator style. */
const TEMP_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Client-side helper for tests / display rules (server generates the live password). */
export function isValidTemporaryPasswordFormat(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 72 &&
    [...password].every((ch) => TEMP_PASSWORD_ALPHABET.includes(ch))
  )
}

export function generateTemporaryPassword(length = 10): string {
  const n = Math.max(8, Math.min(72, Math.floor(length)))
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < n; i += 1) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i]! % TEMP_PASSWORD_ALPHABET.length]!
  }
  return out
}
