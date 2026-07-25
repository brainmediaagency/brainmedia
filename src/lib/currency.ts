export function tryToKurus(amount: number): number {
  return Math.round(amount * 100)
}

export function kurusToTry(kurus: number): number {
  return kurus / 100
}

export function formatTryFromKurus(kurus: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(kurusToTry(kurus))
}

export function formatTryInput(amount: number | null): string {
  if (amount === null) return ''
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function parseTryInput(value: string): number | null {
  const cleaned = value
    .replace(/[₺\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  return parsed
}
