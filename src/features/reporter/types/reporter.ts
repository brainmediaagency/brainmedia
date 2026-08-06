import type { Timestamp } from 'firebase/firestore'
import type { VatRate } from '@/features/reporter/utils/feeCalc'

export type ReporterDailyCompany = {
  /** Seçilen işin `jobs` doc id'si; eski raporlarda boş string olabilir. */
  jobId: string
  companyName: string
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
  /** `cash` = nakit (KDV yok); eski kayıtlarda yoksa `vat` kabul. */
  chargeMode: 'vat' | 'cash'
}

export type ReporterDailyReport = {
  id: string
  /** Rapor günü `yyyy-MM-dd` (İstanbul). */
  reportDate: string
  companyCount: number
  companies: ReporterDailyCompany[]
  note: string
  hotelExpenseKurus: number
  stationeryExpenseKurus: number
  fuelExpenseKurus: number
  extraExpenseKurus: number
  /** Otel + kırtasiye + yakıt + ekstra */
  operatingExpenseKurus: number
  /** Muhabir + kameraman ücretleri toplamı */
  employeeExpenseKurus: number
  /** Saha giderleri + ücretler (KDV hariç) */
  totalExpenseKurus: number
  /** Toplam gelir = KDV matrahı + KDV (kasaya geçen tutar) */
  earningsKurus: number
  /** Kasadan sahaya giderler için verilen tutar */
  fieldPaidKurus: number
  totalReporterEarningsKurus: number
  totalCameramanEarningsKurus: number
  totalVatKurus: number
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  editVersion: number
  updatedByUid: string
  updatedByNameSnapshot: string
  deletedAt: Timestamp | null
  deletedByUid: string | null
  deletedByNameSnapshot: string | null
}

export type ReporterDailyReportHistoryAction = 'create' | 'update' | 'soft_delete'

export type ReporterDailyReportHistory = {
  id: string
  action: ReporterDailyReportHistoryAction
  version: number
  actorUid: string
  actorNameSnapshot: string
  actorRole: 'reporter' | 'coordinator' | 'management'
  createdAt: Timestamp | null
}

export type ReporterZReport = {
  id: string
  confirmed: true
  photoStoragePath: string | null
  photoDownloadUrl: string | null
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
