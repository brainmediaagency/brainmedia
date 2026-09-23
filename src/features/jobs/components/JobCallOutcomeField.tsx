import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { cn } from '@/lib/classNames'
import { mapAppError } from '@/lib/errors'
import type { JobDocument } from '@/features/jobs/types/job'
import { updateJobCallOutcome } from '@/features/jobs/services/jobService'
import {
  JOB_CALL_OUTCOME_LABELS,
  MANUAL_JOB_CALL_OUTCOMES,
  isManualJobCallOutcome,
  type ManualJobCallOutcome,
} from '@/features/jobs/utils/jobCallOutcome'
import type { UserRole } from '@/config/roles'

const OUTCOME_BUTTON_CLASS: Record<
  ManualJobCallOutcome,
  { idle: string; active: string }
> = {
  busy: {
    idle: 'border-brand-blue/45 bg-brand-blue/12 text-brand-blue hover:bg-brand-blue/20',
    active: 'border-brand-blue bg-brand-blue text-white ring-2 ring-brand-blue/50',
  },
  unanswered: {
    idle: 'border-success/45 bg-success/12 text-success hover:bg-success/20',
    active: 'border-success bg-success text-white ring-2 ring-success/50',
  },
  unreachable: {
    idle: 'border-danger/45 bg-danger/12 text-danger hover:bg-danger/20',
    active: 'border-danger bg-danger text-white ring-2 ring-danger/50',
  },
}

export function JobCallOutcomeField({
  job,
  actor,
  disabled,
  onUpdated,
}: {
  job: JobDocument
  actor: { uid: string; fullName: string; role: UserRole }
  disabled: boolean
  onUpdated?: (job: JobDocument) => void
}) {
  const current =
    job.callOutcome && job.callOutcome !== 'reached' ? job.callOutcome : ''
  const [selected, setSelected] = useState<ManualJobCallOutcome | ''>(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(current)
  }, [job.id, current])

  const canSubmit =
    selected !== '' && selected !== current && !disabled && !saving

  async function handleUpdate() {
    if (!canSubmit || !isManualJobCallOutcome(selected)) return
    setSaving(true)
    try {
      const updated = await updateJobCallOutcome(job.id, actor, selected)
      onUpdated?.(updated)
      toast.success(
        `Arama durumu ${JOB_CALL_OUTCOME_LABELS[selected]} olarak güncellendi.`,
      )
    } catch (error) {
      toast.error(mapAppError(error, 'Arama durumu güncellenemedi.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormField
      label="Arama son durum"
      hint="Meşgul, ulaşılamıyor veya cevapsız güncellemesi şef, koordinatör, yönetim ve işi açan MPU’ya gider. Konfirme edilince otomatik Ulaşıldı olur; ekstra bildirim yok."
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {MANUAL_JOB_CALL_OUTCOMES.map((value) => {
            const active = selected === value
            const tone = OUTCOME_BUTTON_CLASS[value]
            return (
              <button
                key={value}
                type="button"
                disabled={disabled || saving}
                aria-pressed={active}
                onClick={() => setSelected(value)}
                className={cn(
                  'min-h-11 rounded-[10px] border px-3 text-sm font-medium transition-colors',
                  active ? tone.active : tone.idle,
                  (disabled || saving) && 'cursor-not-allowed opacity-60',
                )}
              >
                {JOB_CALL_OUTCOME_LABELS[value]}
              </button>
            )
          })}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          loading={saving}
          disabled={!canSubmit}
          onClick={() => void handleUpdate()}
        >
          Güncelle
        </Button>
      </div>
    </FormField>
  )
}
