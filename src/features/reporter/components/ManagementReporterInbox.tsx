import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import type { ReporterZReport } from '@/features/reporter/types/reporter'
import {
  fetchDailyReportsInRange,
  softDeleteDailyReport,
  backfillDailyReportJobClaims,
} from '@/features/reporter/services/dailyReportService'
import { fetchZReportsInRange } from '@/features/reporter/services/zReportService'
import { hasZReportForDaily } from '@/features/reporter/utils/zReportMatch'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDateOnlyLongTr, formatDateTimeTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'
import { Camera, Eye, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ReporterDailyReportForm } from '@/features/reporter/components/ReporterDailyReportForm'
import { DailyReportReadableCard } from '@/features/reporter/components/DailyReportReadableCard'
import { DailyReportDetailBody } from '@/features/reporter/components/DailyReportDetailBody'

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type ManagementReporterInboxProps = {
  startNumber?: number
  /** Which inbox panels to show. Defaults to both. */
  view?: 'daily' | 'z' | 'both'
}

export function ManagementReporterInbox({
  startNumber = 10,
  view = 'both',
}: ManagementReporterInboxProps) {
  const { user, profile } = useAuth()
  const defaults = useMemo(() => {
    const end = new Date()
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { start: toDateInputValue(start), end: toDateInputValue(end) }
  }, [])

  const [dailyStart, setDailyStart] = useState(defaults.start)
  const [dailyEnd, setDailyEnd] = useState(defaults.end)
  const [dailyReports, setDailyReports] = useState<ReporterDailyReport[]>([])
  const [dailyZReports, setDailyZReports] = useState<ReporterZReport[]>([])
  const [dailyLoading, setDailyLoading] = useState(true)

  const [zStart, setZStart] = useState(defaults.start)
  const [zEnd, setZEnd] = useState(defaults.end)
  const [zReports, setZReports] = useState<ReporterZReport[]>([])
  const [zLoading, setZLoading] = useState(true)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [detailReport, setDetailReport] = useState<ReporterDailyReport | null>(null)
  const [editingReport, setEditingReport] = useState<ReporterDailyReport | null>(null)
  const [deletingReport, setDeletingReport] = useState<ReporterDailyReport | null>(null)
  const [deletingReportNow, setDeletingReportNow] = useState(false)

  const loadDaily = useCallback(async () => {
    if (!dailyStart || !dailyEnd || dailyStart > dailyEnd) {
      toast.error('Geçerli bir tarih aralığı seçin.')
      return
    }
    setDailyLoading(true)
    try {
      const [reports, zForRange] = await Promise.all([
        fetchDailyReportsInRange({ startDate: dailyStart, endDate: dailyEnd }),
        fetchZReportsInRange({ startDate: dailyStart, endDate: dailyEnd }),
      ])
      setDailyReports(reports)
      setDailyZReports(zForRange)
      // Legacy reports: stamp jobs.dailyReportId so the picker excludes them.
      void backfillDailyReportJobClaims(reports)
    } catch (error) {
      toast.error(mapAppError(error, 'Günlük raporlar yüklenemedi.'))
    } finally {
      setDailyLoading(false)
    }
  }, [dailyStart, dailyEnd])

  const loadZ = useCallback(async () => {
    if (!zStart || !zEnd || zStart > zEnd) {
      toast.error('Geçerli bir tarih aralığı seçin.')
      return
    }
    setZLoading(true)
    try {
      setZReports(await fetchZReportsInRange({ startDate: zStart, endDate: zEnd }))
    } catch (error) {
      toast.error(mapAppError(error, 'Z raporları yüklenemedi.'))
    } finally {
      setZLoading(false)
    }
  }, [zStart, zEnd])

  useEffect(() => {
    if (view === 'daily' || view === 'both') {
      void loadDaily()
    }
  }, [loadDaily, view])

  useEffect(() => {
    if (view === 'z' || view === 'both') {
      void loadZ()
    }
  }, [loadZ, view])

  const dailySection = String(startNumber).padStart(2, '0')
  const zSection = String(startNumber + 1).padStart(2, '0')

  async function confirmDeleteReport() {
    if (!user || !profile || !deletingReport) return
    if (profile.role !== 'management' && profile.role !== 'coordinator') return
    setDeletingReportNow(true)
    try {
      await softDeleteDailyReport(deletingReport.id, {
        uid: user.uid,
        name: profile.fullName,
        role: profile.role,
      })
      toast.success('Rapor silindi.')
      setDeletingReport(null)
      await loadDaily()
    } catch (error) {
      toast.error(mapAppError(error, 'Rapor silinemedi.'))
    } finally {
      setDeletingReportNow(false)
    }
  }

  const dailyPanel = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField label="Başlangıç" htmlFor="mgmt-daily-start">
          <DateInput
            id="mgmt-daily-start"
            value={dailyStart}
            onChange={(e) => setDailyStart(e.target.value)}
          />
        </FormField>
        <FormField label="Bitiş" htmlFor="mgmt-daily-end">
          <DateInput
            id="mgmt-daily-end"
            value={dailyEnd}
            onChange={(e) => setDailyEnd(e.target.value)}
          />
        </FormField>
        <Button type="button" onClick={() => void loadDaily()} loading={dailyLoading}>
          Filtrele
        </Button>
      </div>

      {dailyLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : dailyReports.length === 0 ? (
        <EmptyState
          title="Rapor yok"
          description="Seçilen aralıkta günlük rapor bulunmuyor."
        />
      ) : (
        <ul className="space-y-3 stagger-children">
          {dailyReports.map((report) => {
            const zEntered = hasZReportForDaily(report, dailyZReports)
            return (
              <DailyReportReadableCard
                key={report.id}
                report={report}
                zReportEntered={zEntered}
                actions={
                  <div className="flex gap-1.5 sm:gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setDetailReport(report)}
                      aria-label="Rapor detayı"
                    >
                      <Eye className="size-4 sm:mr-1.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Detay</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingReport(report)}
                      aria-label="Raporu düzenle"
                    >
                      <Pencil className="size-4 sm:mr-1.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Düzenle</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => setDeletingReport(report)}
                      aria-label="Raporu sil"
                    >
                      <Trash2 className="size-4 sm:mr-1.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Sil</span>
                    </Button>
                  </div>
                }
              />
            )
          })}
        </ul>
      )}
    </div>
  )

  const zPanel = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField label="Başlangıç" htmlFor="mgmt-z-start">
          <DateInput
            id="mgmt-z-start"
            value={zStart}
            onChange={(e) => setZStart(e.target.value)}
          />
        </FormField>
        <FormField label="Bitiş" htmlFor="mgmt-z-end">
          <DateInput
            id="mgmt-z-end"
            value={zEnd}
            onChange={(e) => setZEnd(e.target.value)}
          />
        </FormField>
        <Button type="button" onClick={() => void loadZ()} loading={zLoading}>
          Filtrele
        </Button>
      </div>

      {zLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : zReports.length === 0 ? (
        <EmptyState
          title="Z raporu yok"
          description="Seçilen aralıkta Z raporu bildirimi bulunmuyor."
        />
      ) : (
        <ul className="space-y-3 stagger-children">
          {zReports.map((item) => (
            <li
              key={item.id}
              className="interactive-lift flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--cat-cyan-border)] bg-[color:var(--cat-cyan-bg)] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-display font-semibold text-text-primary">
                  {item.createdByNameSnapshot}
                  <span className="ml-2 text-sm font-normal text-text-secondary">
                    ({item.createdByEmailSnapshot})
                  </span>
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue">
                  <Camera className="size-3.5" aria-hidden="true" />
                  Z raporu alındı
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {item.createdAt ? formatDateTimeTr(item.createdAt.toDate()) : '—'}
                </p>
              </div>
              {item.photoDownloadUrl ? (
                <button
                  type="button"
                  className="overflow-hidden rounded-[var(--radius-sm)] border border-border shadow-[var(--shadow-xs)] transition-transform hover:scale-[1.03]"
                  onClick={() => setPhotoUrl(item.photoDownloadUrl)}
                >
                  <img
                    src={item.photoDownloadUrl}
                    alt="Z raporu fotoğrafı"
                    className="h-16 w-16 object-cover"
                  />
                </button>
              ) : (
                <span className="text-xs text-text-secondary">Fotoğraf yok</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      {view === 'daily' && dailyPanel}

      {view === 'z' && zPanel}

      {view === 'both' && (
        <>
          <AccordionSection
            number={dailySection}
            title="Muhabir Günlük Raporları"
            description="Seçilen tarih aralığında muhabirlerin gönderdiği günlük raporlar."
            defaultOpen
          >
            {dailyPanel}
          </AccordionSection>

          <AccordionSection
            number={zSection}
            title="Z Raporları"
            description="Muhabirlerin Z raporu alındı bildirimleri."
          >
            {zPanel}
          </AccordionSection>
        </>
      )}

      <Modal
        open={photoUrl !== null}
        onClose={() => setPhotoUrl(null)}
        title="Z raporu fotoğrafı"
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Z raporu fotoğrafı büyük görünüm"
            className="max-h-[70vh] w-full object-contain"
          />
        ) : null}
      </Modal>

      <Drawer
        open={detailReport !== null}
        onClose={() => setDetailReport(null)}
        title={
          detailReport
            ? `${formatDateOnlyLongTr(detailReport.reportDate)} tarihli rapor`
            : 'Rapor detayı'
        }
        description={
          detailReport
            ? `${detailReport.createdByNameSnapshot} · gelir, gider ve Z durumu`
            : undefined
        }
        side="right"
        className="max-w-2xl"
      >
        {detailReport ? (
          <DailyReportDetailBody
            report={detailReport}
            zReportEntered={hasZReportForDaily(detailReport, dailyZReports)}
          />
        ) : null}
      </Drawer>

      <Drawer
        open={editingReport !== null}
        onClose={() => setEditingReport(null)}
        title="Muhabir raporunu düzenle"
        description="Değişiklikler kayıt geçmişinde saklanır."
        side="right"
        className="max-w-2xl"
      >
        {editingReport ? (
          <ReporterDailyReportForm
            report={editingReport}
            onCancel={() => setEditingReport(null)}
            onSaved={() => {
              setEditingReport(null)
              void loadDaily()
            }}
          />
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={deletingReport !== null}
        onClose={() => setDeletingReport(null)}
        onConfirm={() => void confirmDeleteReport()}
        title="Muhabir raporu silinsin mi?"
        description="Rapor listelerden kaldırılır; denetim geçmişi korunur."
        confirmLabel="Raporu sil"
        destructive
        loading={deletingReportNow}
      />
    </div>
  )
}
