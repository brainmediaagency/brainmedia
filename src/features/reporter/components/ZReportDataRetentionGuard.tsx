import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { runDueZReportRetentionPurge } from '@/features/reporter/services/zReportRetentionService'
import {
  HR_RETENTION_WARN_MAX_SHOWS,
  formatHrRetentionPurgeLabel,
  getUpcomingHrRetentionCycle,
  isInHrRetentionWarningWindow,
  readHrRetentionWarnCount,
  writeHrRetentionWarnCount,
} from '@/features/hr/utils/hrRetentionSchedule'
import { mapAppError } from '@/lib/errors'
import { todayDateOnlyIstanbul } from '@/lib/date'

function canManageZReportRetention(role: string | undefined): boolean {
  return role === 'management' || role === 'coordinator'
}

function warnStorageUid(uid: string): string {
  // Namespace separately from İK warnings so counts do not collide.
  return `z:${uid}`
}

/**
 * Warns yönetim + koordinatör in the last 3 days before each 2-month purge.
 * Triggers the due purge when they open the app on/after the purge day.
 * Same calendar schedule as İK / iş görüşmesi retention.
 */
export function ZReportDataRetentionGuard() {
  const { user, profile, loading } = useAuth()
  const [open, setOpen] = useState(false)

  const today = todayDateOnlyIstanbul()
  const cycle = useMemo(() => getUpcomingHrRetentionCycle(today), [today])
  const inWarnWindow = isInHrRetentionWarningWindow(today, cycle)

  useEffect(() => {
    if (loading || !user || !profile || !canManageZReportRetention(profile.role)) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        await runDueZReportRetentionPurge({
          uid: user.uid,
          fullName: profile.fullName,
        })
      } catch (error) {
        if (!cancelled) {
          toast.error(mapAppError(error, 'Eski Z raporları temizlenemedi.'))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loading, user, profile])

  useEffect(() => {
    if (loading || !user || !profile || !canManageZReportRetention(profile.role)) {
      setOpen(false)
      return
    }
    if (!inWarnWindow) {
      setOpen(false)
      return
    }

    const shown = readHrRetentionWarnCount(
      warnStorageUid(user.uid),
      cycle.purgeDate,
    )
    if (shown >= HR_RETENTION_WARN_MAX_SHOWS) {
      setOpen(false)
      return
    }

    setOpen(true)
  }, [loading, user, profile, inWarnWindow, cycle.purgeDate])

  function dismissWarning() {
    if (!user) {
      setOpen(false)
      return
    }
    const key = warnStorageUid(user.uid)
    const next = Math.min(
      HR_RETENTION_WARN_MAX_SHOWS,
      readHrRetentionWarnCount(key, cycle.purgeDate) + 1,
    )
    writeHrRetentionWarnCount(key, cycle.purgeDate, next)
    setOpen(false)
  }

  if (!canManageZReportRetention(profile?.role)) return null

  const purgeLabel = formatHrRetentionPurgeLabel(cycle.purgeDate)

  return (
    <Modal
      open={open}
      onClose={dismissWarning}
      title="Z raporları silinecek"
      description={`${purgeLabel} tarihinde eski Z raporları kalıcı olarak silinecek.`}
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Bu uyarı, silme tarihinden önceki son 3 günde uygulamaya her girişinizde
          en fazla {HR_RETENTION_WARN_MAX_SHOWS} kez gösterilir. Gerekli kayıtları
          önceden dışa aktarmanızı öneririz.
        </p>
        <p className="text-sm text-text-secondary">
          Sonraki temizlikler iki ayda bir ayın 1’inde yapılır (ör. 1 Kasım, 1 Ocak,
          1 Mart) — İK kayıtlarıyla aynı takvim.
        </p>
        <div className="flex justify-end">
          <Button type="button" onClick={dismissWarning}>
            Anladım
          </Button>
        </div>
      </div>
    </Modal>
  )
}
