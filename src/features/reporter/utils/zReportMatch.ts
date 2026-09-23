import { dateToDateOnlyIstanbul } from '@/lib/date'
import type {
  ReporterDailyReport,
  ReporterZReport,
} from '@/features/reporter/types/reporter'

/**
 * Aynı muhabirin, günlük rapor günü (`reportDate`) içinde oluşturduğu Z raporu.
 * Z kayıtlarında ayrı reportDate yok; İstanbul takvim günü `createdAt` kullanılır.
 */
export function findZReportForDaily(
  daily: Pick<ReporterDailyReport, 'reportDate' | 'createdByUid'>,
  zReports: ReporterZReport[],
): ReporterZReport | null {
  return (
    zReports.find((z) => {
      if (z.createdByUid !== daily.createdByUid || !z.createdAt) return false
      return dateToDateOnlyIstanbul(z.createdAt.toDate()) === daily.reportDate
    }) ?? null
  )
}

export function hasZReportForDaily(
  daily: Pick<ReporterDailyReport, 'reportDate' | 'createdByUid'>,
  zReports: ReporterZReport[],
): boolean {
  return findZReportForDaily(daily, zReports) != null
}
