export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Normalize Turkish phone numbers to +90XXXXXXXXXX when possible. */
export function normalizeTurkishPhone(input: string): string | null {
  let digits = digitsOnly(input)
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('90') && digits.length === 12) {
    return `+${digits}`
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+90${digits.slice(1)}`
  }
  if (digits.length === 10 && digits.startsWith('5')) {
    return `+90${digits}`
  }
  return null
}

export function formatPhoneDisplay(normalized: string): string {
  const digits = digitsOnly(normalized)
  const local = digits.startsWith('90') ? digits.slice(2) : digits
  if (local.length !== 10) return normalized
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`
}

export function isValidTurkishPhone(input: string): boolean {
  return normalizeTurkishPhone(input) !== null
}
