import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ReporterDailyReportForm } from '@/features/reporter/components/ReporterDailyReportForm'
import { DailyReportReadableCard } from '@/features/reporter/components/DailyReportReadableCard'
import {
  fetchMyDailyReports,
  softDeleteDailyReport,
  backfillDailyReportJobClaims,
} from '@/features/reporter/services/dailyReportService'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'

export function ReporterMyReports() {
  const { user, profile } = useAuth()
  const [reports, setReports] = useState<ReporterDailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ReporterDailyReport | null>(null)
  const [deleting, setDeleting] = useState<ReporterDailyReport | null>(null)
  const [deletingNow, setDeletingNow] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const mine = await fetchMyDailyReports(user.uid)
      setReports(mine)
      void backfillDailyReportJobClaims(mine)
    } catch (error) {
      toast.error(mapAppError(error, 'Raporlarınız yüklenemedi.'))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmDelete() {
    if (!user || !profile || !deleting) return
    setDeletingNow(true)
    try {
      await softDeleteDailyReport(deleting.id, {
        uid: user.uid,
        name: profile.fullName,
        role: 'reporter',
      })
      toast.success('Rapor silindi.')
      setDeleting(null)
      await load()
    } catch (error) {
      toast.error(mapAppError(error, 'Rapor silinemedi.'))
    } finally {
      setDeletingNow(false)
    }
  }

  return (
    <>
      <AccordionSection
        number="03"
        title="Gönderdiğim Raporlar"
        description="Günlük raporlarınızı görüntüleyin, düzenleyin veya silin."
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState title="Rapor yok" description="Henüz günlük rapor göndermediniz." />
        ) : (
          <ul className="space-y-3 stagger-children">
            {reports.map((report) => (
              <DailyReportReadableCard
                key={report.id}
                report={report}
                actions={
                  <div className="flex gap-1.5 sm:gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(report)}
                      aria-label="Raporu düzenle"
                    >
                      <Pencil className="size-4 sm:mr-1.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Düzenle</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleting(report)}
                      aria-label="Raporu sil"
                    >
                      <Trash2 className="size-4 sm:mr-1.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Sil</span>
                    </Button>
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </AccordionSection>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Günlük raporu düzenle"
        description="Değişiklikler kayıt geçmişinde saklanır."
        side="right"
        className="max-w-2xl"
      >
        {editing ? (
          <ReporterDailyReportForm
            report={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              void load()
            }}
          />
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Rapor silinsin mi?"
        description="Rapor listelerden kaldırılır; işlem geçmişi denetim için korunur."
        confirmLabel="Raporu sil"
        destructive
        loading={deletingNow}
      />
    </>
  )
}
