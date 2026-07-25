import { formatSheetKazanc } from '@/features/jobs/services/sheetsExport'

export type DailyReportCompanySheetInput = {
  hasNews: boolean
  shootMinutes: number
  newsTotalKurus: number | null
  vatBaseKurus: number
  vatKurus: number
}

export type DailyReportCompanySheetFields = {
  dk: string
  haber: string
  kazanc: string
}

/**
 * Maps a saved daily-report company row to Sheets DK / HABER / KAZANÇ cells.
 * KAZANÇ = matrah + KDV (UI “Toplam gelir”); HABER = news fee when present.
 */
export function buildDailyReportCompanySheetFields(
  company: DailyReportCompanySheetInput,
): DailyReportCompanySheetFields {
  const toplamGelirKurus =
    Math.max(0, Number(company.vatBaseKurus) || 0) +
    Math.max(0, Number(company.vatKurus) || 0)
  const haberKazancKurus =
    company.hasNews && company.newsTotalKurus != null
      ? Math.max(0, Number(company.newsTotalKurus) || 0)
      : 0

  return {
    dk: String(Number(company.shootMinutes) || 0),
    haber: haberKazancKurus > 0 ? formatSheetKazanc(haberKazancKurus) : '',
    kazanc: toplamGelirKurus > 0 ? formatSheetKazanc(toplamGelirKurus) : '',
  }
}
