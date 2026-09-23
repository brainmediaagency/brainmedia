/** Keep in sync with `findRow_` helpers in `scripts/sheets-webhook/Code.gs`. */

/** Normalize company name for Excel row match (spaces + Turkish case). */
export function normalizeFirmaKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR')
}

export function foldTrAscii(value: string): string {
  return value
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

/**
 * Aggressive company key: drop punctuation, Ltd/Şti, and Turkish diacritics so
 * "Tevhid Seda Ltd Şti" ≈ "Tevhid Seda Ltd. Şti." and "Altuğ" ≈ "Altug".
 */
export function compactFirmaKey(value: string): string {
  return foldTrAscii(normalizeFirmaKey(value))
    .replace(/[.'’`]/g, '')
    .replace(/\b(ltd|sti|as|inc|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function pad2(n: string): string {
  return n.length === 1 ? `0${n}` : n
}

/** Calendar day `yyyy-MM-dd` from TR/ISO dates (optional time). */
export function tarihDayKey(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (dmy) return `${dmy[3]}-${pad2(dmy[2]!)}-${pad2(dmy[1]!)}`
  return null
}

export function phoneDigitsKey(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('90') && digits.length >= 12) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.length >= 10 ? digits : ''
}

export function isOpenSonDurum(value: string): boolean {
  const s = value.trim().toLocaleLowerCase('tr-TR')
  return !s || s === 'konfirme' || s === 'onay bekliyor'
}

export function firmaContainsMatch(a: string, b: string): boolean {
  const ca = compactFirmaKey(a)
  const cb = compactFirmaKey(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  if (ca.length < 5 || cb.length < 5) return false
  return ca.includes(cb) || cb.includes(ca)
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const prev = new Array<number>(n + 1)
  const cur = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]!
  }
  return prev[n]!
}

export function firmaFuzzyMatch(a: string, b: string): boolean {
  const ca = compactFirmaKey(a)
  const cb = compactFirmaKey(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  const maxLen = Math.max(ca.length, cb.length)
  if (maxLen < 5) return false
  const dist = levenshtein(ca, cb)
  return dist <= (maxLen >= 10 ? 2 : 1)
}

function isoToUtcDays(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year!, month! - 1, day!) / 86_400_000
}

function dayDistance(day: string | null, targets: Set<string>): number | null {
  if (!day || targets.size === 0) return null
  let best = Infinity
  const n = isoToUtcDays(day)
  for (const target of targets) {
    best = Math.min(best, Math.abs(n - isoToUtcDays(target)))
  }
  return best
}

export type SheetMatchRow = {
  row: number
  jobId?: string
  firma: string
  tarih: string
  tel?: string
  sonDurum?: string
  firmaSahibi?: string
}

export type SheetMatchQuery = {
  jobId?: string
  firmaAdi?: string
  tarih?: string
  plannedTarih?: string
  cekTarih?: string
  acquiredTarih?: string
  telNo?: string
  firmaSahibi?: string
}

function scoreSheetRow(
  row: SheetMatchRow,
  query: {
    firmaAdi: string
    firmaCompact: string
    phoneKey: string
    sahibiKey: string
    dayKeys: Set<string>
  },
): number {
  const compactHit = Boolean(
    query.firmaCompact && compactFirmaKey(row.firma) === query.firmaCompact,
  )
  const containsHit =
    !compactHit && Boolean(query.firmaAdi) && firmaContainsMatch(query.firmaAdi, row.firma)
  const fuzzyHit =
    !compactHit &&
    !containsHit &&
    Boolean(query.firmaAdi) &&
    firmaFuzzyMatch(query.firmaAdi, row.firma)
  const phoneHit = Boolean(
    query.phoneKey && phoneDigitsKey(row.tel || '') === query.phoneKey,
  )
  const sahibiHit = Boolean(
    query.sahibiKey && normalizeFirmaKey(row.firmaSahibi || '') === query.sahibiKey,
  )
  if (!compactHit && !containsHit && !fuzzyHit && !phoneHit && !sahibiHit) {
    return 0
  }

  let score = 0
  if (compactHit) score += 400
  else if (containsHit) score += 300
  else if (fuzzyHit) score += 250
  if (phoneHit) score += 80
  if (sahibiHit) score += 40
  if (isOpenSonDurum(row.sonDurum || '')) score += 30

  const dist = dayDistance(tarihDayKey(row.tarih), query.dayKeys)
  if (dist === 0) score += 500
  else if (dist === 1) score += 350
  else if (dist != null && dist < 60) score += Math.max(0, 200 - dist)

  return score
}

/**
 * Pick an existing Excel row. Never invents a new row.
 * JOB ID wins. If that id is missing, only score legacy rows with an empty
 * JOB ID — never overwrite a row owned by a different Firestore job.
 */
export function pickSheetRow(
  rows: SheetMatchRow[],
  query: SheetMatchQuery,
): number | null {
  const qJob = (query.jobId || '').trim()
  if (qJob) {
    let found: number | null = null
    for (const row of rows) {
      if (String(row.jobId || '').trim() === qJob) found = row.row
    }
    if (found != null) return found
  }

  const dayKeys = new Set(
    [query.tarih, query.plannedTarih, query.cekTarih, query.acquiredTarih]
      .map((value) => (value ? tarihDayKey(value) : null))
      .filter((key): key is string => Boolean(key)),
  )
  const scored = {
    firmaAdi: query.firmaAdi || '',
    firmaCompact: compactFirmaKey(query.firmaAdi || ''),
    phoneKey: phoneDigitsKey(query.telNo || ''),
    sahibiKey: normalizeFirmaKey(query.firmaSahibi || ''),
    dayKeys,
  }

  let bestRow = -1
  let bestScore = 0
  for (const row of rows) {
    if (qJob && String(row.jobId || '').trim()) continue
    const score = scoreSheetRow(row, scored)
    if (score > bestScore || (score === bestScore && score > 0 && row.row > bestRow)) {
      bestScore = score
      bestRow = row.row
    }
  }
  return bestRow > 1 ? bestRow : null
}
