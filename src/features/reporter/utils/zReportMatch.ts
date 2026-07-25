import { dateToDateOnlyIstanbul } from '@/lib/date'
import type {
  ReporterDailyReport,
  ReporterZReport,
} from '@/features/reporter/types/reporter'

/**
 * Aynı muhabirin, günlük rapor günü (`reportDate`) içinde oluşturduğu Z raporu var mı.
 * Z kayıtlarında ayrı reportDate yok; İstanbul takvim günü `createdAt` kullanılır.
 */
export function hasZReportForDaily(
  daily: Pick<ReporterDailyReport, 'reportDate' | 'createdByUid'>,
  zReports: ReporterZReport[],
): boolean {
  return zReports.some((z) => {
    if (z.createdByUid !== daily.createdByUid || !z.createdAt) return false
    return dateToDateOnlyIstanbul(z.createdAt.toDate()) === daily.reportDate
  })
}
