import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { runDueHrRetentionPurge } from '@/features/hr/services/hrRetentionService'
import {
  HR_RETENTION_WARN_MAX_SHOWS,
  formatHrRetentionPurgeLabel,
  getUpcomingHrRetentionCycle,
  isInHrRetentionWarningWindow,
  readHrRetentionWarnCount,
  writeHrRetentionWarnCount,
} from '@/features/hr/utils/hrRetentionSchedule'
import { todayDateOnlyIstanbul } from '@/lib/date'

function canManageHrRetention(role: string | undefined): boolean {
  return role === 'human_resources' || role === 'management'
}

/**
 * Warns İK + yönetim in the last 3 days before each 2-month purge (max 3 shows).
 * Also triggers the due purge when they open the app on/after the purge day.
 */
export function HrDataRetentionGuard() {
  const { user, profile, loading } = useAuth()
  const [open, setOpen] = useState(false)

  const today = todayDateOnlyIstanbul()
  const cycle = useMemo(() => getUpcomingHrRetentionCycle(today), [today])
  const inWarnWindow = isInHrRetentionWarningWindow(today, cycle)

  useEffect(() => {
    if (loading || !user || !profile || !canManageHrRetention(profile.role)) return

    void (async () => {
      try {
        await runDueHrRetentionPurge({
          uid: user.uid,
          fullName: profile.fullName,
        })
      } catch (error) {
        // Purge is best-effort on app open — don't surface permission noise as
        // "yetkiniz bulunmuyor" while the user is trying to submit a report.
        console.warn('[HrDataRetentionGuard] purge skipped', error)
      }
    })()
  }, [loading, user, profile])

  useEffect(() => {
    if (loading || !user || !profile || !canManageHrRetention(profile.role)) {
      setOpen(false)
      return
    }
    if (!inWarnWindow) {
      setOpen(false)
      return
    }

    const shown = readHrRetentionWarnCount(user.uid, cycle.purgeDate)
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
    const next = Math.min(
      HR_RETENTION_WARN_MAX_SHOWS,
      readHrRetentionWarnCount(user.uid, cycle.purgeDate) + 1,
    )
    writeHrRetentionWarnCount(user.uid, cycle.purgeDate, next)
    setOpen(false)
  }

  if (!canManageHrRetention(profile?.role)) return null

  const purgeLabel = formatHrRetentionPurgeLabel(cycle.purgeDate)

  return (
    <Modal
      open={open}
      onClose={dismissWarning}
      title="İK ve CV kayıtları silinecek"
      description={`${purgeLabel} tarihinde eski İK raporları ile işe alım notları (CV PDF’leri dahil) kalıcı olarak silinecek.`}
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Bu uyarı, silme tarihinden önceki son 3 günde uygulamaya her girişinizde
          en fazla {HR_RETENTION_WARN_MAX_SHOWS} kez gösterilir. Gerekli kayıtları
          önceden dışa aktarmanızı öneririz.
        </p>
        <p className="text-sm text-text-secondary">
          Sonraki temizlikler iki ayda bir ayın 1’inde yapılır (ör. 1 Kasım, 1 Ocak,
          1 Mart).
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
