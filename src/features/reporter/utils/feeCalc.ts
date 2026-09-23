import { tryToKurus, parseTryInput, formatTryFromKurus } from '@/lib/currency'

/** TRY per shoot minute */
export const SHOOT_RATE_TRY_PER_MINUTE = 5000
export const SHOOT_RATE_PER_MINUTE_KURUS = tryToKurus(SHOOT_RATE_TRY_PER_MINUTE)

export const NEWS_REPORTER_RATE = 0.15
export const NEWS_CAMERAMAN_RATE = 0.1
/** Default çekim muhabir payı; kişiye özel override `UserProfile.shootReporterRate`. */
export const SHOOT_REPORTER_RATE = 0.08
export const SHOOT_CAMERAMAN_RATE = 0.02

export const VAT_RATES = [14, 17, 20] as const
export const VAT_RATE_OPTIONS = VAT_RATES
export type VatRate = (typeof VAT_RATES)[number]

export { formatTryFromKurus }

/** Geçerli override yoksa varsayılan %8. */
export function resolveShootReporterRate(
  override: number | null | undefined,
): number {
  if (
    typeof override === 'number' &&
    Number.isFinite(override) &&
    override > 0 &&
    override <= 1
  ) {
    return override
  }
  return SHOOT_REPORTER_RATE
}

export function formatShootReporterRatePercent(
  override: number | null | undefined,
): string {
  return String(Math.round(resolveShootReporterRate(override) * 100))
}

/**
 * Recover çekim muhabir oranı from a stored fee row (reports do not persist the rate).
 * Returns null when there is no billable base (0–1 dk) or the fee is unusable.
 */
export function inferShootReporterRateFromFee(
  minutes: number,
  shootReporterFeeKurus: number,
): number | null {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  const billableMinutes = Math.max(0, safeMinutes - 1)
  const feeBaseKurus = tryToKurus(billableMinutes * SHOOT_RATE_TRY_PER_MINUTE)
  if (feeBaseKurus <= 0) return null
  const fee = Math.max(0, Math.round(shootReporterFeeKurus))
  const rate = fee / feeBaseKurus
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) return null
  return rate
}

export function isVatRate(value: unknown): value is VatRate {
  return value === 14 || value === 17 || value === 20
}

export function parseTryToKurus(value: string | undefined | null): number {
  const parsed = parseTryInput((value ?? '').trim())
  return tryToKurus(Math.max(0, parsed ?? 0))
}

/**
 * Create: empty → 0.
 * Update: empty keeps previous (avoids wiping “Sahaya ödenen” on unrelated edits).
 * Explicit "0" still zeros.
 */
export function resolveFieldPaidKurusForWrite(
  fieldPaidTry: string | undefined | null,
  previousFieldPaidKurus?: number | null,
): number {
  const trimmed = (fieldPaidTry ?? '').trim()
  if (trimmed === '') {
    const prev = Math.max(0, Math.trunc(Number(previousFieldPaidKurus ?? 0) || 0))
    return prev
  }
  return parseTryToKurus(trimmed)
}

export function calcVatKurus(baseKurus: number, vatRate: VatRate): number {
  return Math.round(Math.max(0, baseKurus) * (vatRate / 100))
}

export function shootGrossTotalKurus(minutes: number): number {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  return tryToKurus(safeMinutes * SHOOT_RATE_TRY_PER_MINUTE)
}

export function calcNewsFeesFromTry(totalTry: number): {
  totalKurus: number
  reporterFeeKurus: number
  cameramanFeeKurus: number
} {
  const totalKurus = tryToKurus(Math.max(0, totalTry))
  return {
    totalKurus,
    reporterFeeKurus: Math.round(totalKurus * NEWS_REPORTER_RATE),
    cameramanFeeKurus: Math.round(totalKurus * NEWS_CAMERAMAN_RATE),
  }
}

export function calcShootFeesFromMinutes(
  minutes: number,
  shootReporterRate: number | null | undefined = SHOOT_REPORTER_RATE,
): {
  minutes: number
  billableMinutes: number
  firstMinuteKasaKurus: number
  feeBaseKurus: number
  grossTotalKurus: number
  reporterFeeKurus: number
  cameramanFeeKurus: number
} {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  const billableMinutes = Math.max(0, safeMinutes - 1)
  const firstMinuteKasaKurus = safeMinutes >= 1 ? tryToKurus(SHOOT_RATE_TRY_PER_MINUTE) : 0
  const feeBaseKurus = tryToKurus(billableMinutes * SHOOT_RATE_TRY_PER_MINUTE)
  const reporterRate = resolveShootReporterRate(shootReporterRate)
  return {
    minutes: safeMinutes,
    billableMinutes,
    firstMinuteKasaKurus,
    feeBaseKurus,
    grossTotalKurus: shootGrossTotalKurus(safeMinutes),
    reporterFeeKurus: Math.round(feeBaseKurus * reporterRate),
    cameramanFeeKurus: Math.round(feeBaseKurus * SHOOT_CAMERAMAN_RATE),
  }
}

export function calcCompanyVatBaseKurus(input: {
  hasNews: boolean
  newsTotalKurus: number
  shootMinutes: number
}): number {
  const news = input.hasNews ? input.newsTotalKurus : 0
  return news + shootGrossTotalKurus(input.shootMinutes)
}

export type CompanyFeeInput = {
  companyName: string
  /** İptal satırı — ücret/KDV sıfır. */
  cancelled?: boolean
  hasNews: boolean
  /** Haber iş tutarı (matrah); primler ve KDV bu tutardan. */
  newsTotalKurus: number | null
  shootMinutes: number
  vatRate: VatRate
  /** `cash` = KDV hesaplanmaz / eklenmez. */
  chargeMode?: 'vat' | 'cash'
  /** Kişiye özel çekim muhabir oranı; yoksa %8. */
  shootReporterRate?: number | null
}

export type BuiltReporterCompany = {
  companyName: string
  cancelled: boolean
  hasNews: boolean
  newsTotalKurus: number | null
  newsReporterFeeKurus: number | null
  newsCameramanFeeKurus: number | null
  shootMinutes: number
  shootReporterFeeKurus: number
  shootCameramanFeeKurus: number
  vatRate: VatRate
  vatBaseKurus: number
  vatKurus: number
  chargeMode: 'vat' | 'cash'
}

export function buildReporterCompany(input: CompanyFeeInput): BuiltReporterCompany {
  if (input.cancelled) {
    return {
      companyName: input.companyName.trim(),
      cancelled: true,
      hasNews: false,
      newsTotalKurus: null,
      newsReporterFeeKurus: null,
      newsCameramanFeeKurus: null,
      shootMinutes: 0,
      shootReporterFeeKurus: 0,
      shootCameramanFeeKurus: 0,
      vatRate: input.vatRate,
      vatBaseKurus: 0,
      vatKurus: 0,
      chargeMode: 'cash',
    }
  }

  const shoot = calcShootFeesFromMinutes(
    input.shootMinutes,
    input.shootReporterRate,
  )
  const news =
    input.hasNews && input.newsTotalKurus !== null
      ? {
          newsTotalKurus: input.newsTotalKurus,
          newsReporterFeeKurus: Math.round(input.newsTotalKurus * NEWS_REPORTER_RATE),
          newsCameramanFeeKurus: Math.round(input.newsTotalKurus * NEWS_CAMERAMAN_RATE),
        }
      : {
          newsTotalKurus: null,
          newsReporterFeeKurus: null,
          newsCameramanFeeKurus: null,
        }

  const vatBaseKurus = calcCompanyVatBaseKurus({
    hasNews: input.hasNews,
    newsTotalKurus: news.newsTotalKurus ?? 0,
    shootMinutes: shoot.minutes,
  })
  const chargeMode = input.chargeMode === 'cash' ? 'cash' : 'vat'

  return {
    companyName: input.companyName.trim(),
    cancelled: false,
    hasNews: input.hasNews,
    newsTotalKurus: news.newsTotalKurus,
    newsReporterFeeKurus: news.newsReporterFeeKurus,
    newsCameramanFeeKurus: news.newsCameramanFeeKurus,
    shootMinutes: shoot.minutes,
    shootReporterFeeKurus: shoot.reporterFeeKurus,
    shootCameramanFeeKurus: shoot.cameramanFeeKurus,
    vatRate: input.vatRate,
    vatBaseKurus,
    vatKurus: chargeMode === 'cash' ? 0 : calcVatKurus(vatBaseKurus, input.vatRate),
    chargeMode,
  }
}

export function sumCompanyFees(companies: BuiltReporterCompany[]): {
  companies: BuiltReporterCompany[]
  totalReporterEarningsKurus: number
  totalCameramanEarningsKurus: number
  totalVatBaseKurus: number
  totalVatKurus: number
  /** Matrah + KDV (kasaya geçen toplam gelir) */
  totalIncomeKurus: number
} {
  const totals = companies.reduce(
    (acc, c) => ({
      totalReporterEarningsKurus:
        acc.totalReporterEarningsKurus +
        (c.newsReporterFeeKurus ?? 0) +
        c.shootReporterFeeKurus,
      totalCameramanEarningsKurus:
        acc.totalCameramanEarningsKurus +
        (c.newsCameramanFeeKurus ?? 0) +
        c.shootCameramanFeeKurus,
      totalVatBaseKurus: acc.totalVatBaseKurus + c.vatBaseKurus,
      totalVatKurus: acc.totalVatKurus + c.vatKurus,
    }),
    {
      totalReporterEarningsKurus: 0,
      totalCameramanEarningsKurus: 0,
      totalVatBaseKurus: 0,
      totalVatKurus: 0,
    },
  )
  return {
    companies,
    ...totals,
    totalIncomeKurus: totals.totalVatBaseKurus + totals.totalVatKurus,
  }
}

export function buildDailyReportFees(inputs: CompanyFeeInput[]) {
  return sumCompanyFees(inputs.map(buildReporterCompany))
}
