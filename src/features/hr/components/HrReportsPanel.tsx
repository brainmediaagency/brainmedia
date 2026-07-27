import { useEffect, useMemo, useState, type FocusEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  formatHrMpuAttendanceEntry,
  summarizeHrMpuAttendances,
  type HrMpuAttendanceEntry,
  type HrReport,
} from '@/features/hr/types/hr'
import {
  createHrReport,
  subscribeOwnHrReports,
  updateHrReport,
} from '@/features/hr/services/hrReportService'
import {
  isHrClockOutAfterIn,
  isOptionalHrShiftTime,
} from '@/features/hr/utils/hrShiftTimes'
import { subscribeMediaPlanners } from '@/features/users/services/userService'
import type { UserProfile } from '@/features/users/types/user'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateTimeTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { toTitleCaseTr } from '@/lib/text'

const DEFAULT_CLOCK_IN = '10:00'
const DEFAULT_CLOCK_OUT = '18:30'

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Başlık en az 2 karakter.')
    .max(200)
    .transform(toTitleCaseTr),
  body: z
    .string()
    .trim()
    .min(1, 'Rapor metni zorunlu.')
    .max(10000)
    .transform(toTitleCaseTr),
})

type FormValues = z.infer<typeof schema>

const emptyForm: FormValues = {
  title: '',
  body: '',
}

function OptionalTimeField({
  label,
  enabled,
  onEnabledChange,
  value,
  onChange,
  disabled,
  id,
}: {
  label: string
  enabled: boolean
  onEnabledChange: (next: boolean) => void
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  id: string
}) {
  const toggleId = `${id}-toggle`
  return (
    <div className="space-y-2 rounded-[var(--radius-sm)] border border-border bg-surface-muted/30 p-3">
      <Toggle
        id={toggleId}
        checked={enabled}
        disabled={disabled}
        label={label}
        onChange={onEnabledChange}
      />
      {enabled ? (
        <FormField label="Saat" htmlFor={id}>
          <Input
            id={id}
            type="time"
            step={60}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </FormField>
      ) : (
        <p className="text-xs text-text-secondary">İşaretleyip açtıktan sonra saat girin.</p>
      )}
    </div>
  )
}

export type HrReportsPanelProps = {
  sectionNumber?: string
  defaultOpen?: boolean
}

export function HrReportsPanel({
  sectionNumber = '04',
  defaultOpen = false,
}: HrReportsPanelProps) {
  const { profile } = useAuth()
  const [reports, setReports] = useState<HrReport[]>([])
  const [planners, setPlanners] = useState<UserProfile[]>([])
  const [plannersLoading, setPlannersLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mpuAttendances, setMpuAttendances] = useState<HrMpuAttendanceEntry[]>([])

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardIndex, setWizardIndex] = useState(0)
  const [draftInEnabled, setDraftInEnabled] = useState(false)
  const [draftOutEnabled, setDraftOutEnabled] = useState(false)
  const [draftIn, setDraftIn] = useState(DEFAULT_CLOCK_IN)
  const [draftOut, setDraftOut] = useState(DEFAULT_CLOCK_OUT)
  const [draftError, setDraftError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm,
  })

  const currentPlanner = wizardOpen ? (planners[wizardIndex] ?? null) : null
  const wizardProgress = useMemo(() => {
    if (!wizardOpen || planners.length === 0) return null
    return `${wizardIndex + 1} / ${planners.length}`
  }, [wizardOpen, wizardIndex, planners.length])

  const titleCaseOnBlur =
    (field: 'title' | 'body') => (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(field, toTitleCaseTr(e.target.value), {
        shouldValidate: true,
        shouldDirty: true,
      })
    }

  useEffect(() => {
    if (!profile?.uid) return
    setLoading(true)
    return subscribeOwnHrReports(
      profile.uid,
      (next) => {
        setReports(next)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [profile?.uid])

  useEffect(() => {
    setPlannersLoading(true)
    return subscribeMediaPlanners(
      (users) => {
        setPlanners(users)
        setPlannersLoading(false)
      },
      () => setPlannersLoading(false),
    )
  }, [])

  const loadWizardStep = (index: number, existing: HrMpuAttendanceEntry[]) => {
    const planner = planners[index]
    if (!planner) return
    const prior = existing.find((entry) => entry.mpuUid === planner.uid)
    if (prior && !prior.absent) {
      const hasIn = Boolean(prior.clockInTime)
      const hasOut = Boolean(prior.clockOutTime)
      setDraftInEnabled(hasIn)
      setDraftOutEnabled(hasOut)
      setDraftIn(prior.clockInTime ?? DEFAULT_CLOCK_IN)
      setDraftOut(prior.clockOutTime ?? DEFAULT_CLOCK_OUT)
    } else {
      setDraftInEnabled(false)
      setDraftOutEnabled(false)
      setDraftIn(DEFAULT_CLOCK_IN)
      setDraftOut(DEFAULT_CLOCK_OUT)
    }
    setDraftError(null)
  }

  const resetWizardDraft = () => {
    setDraftInEnabled(false)
    setDraftOutEnabled(false)
    setDraftIn(DEFAULT_CLOCK_IN)
    setDraftOut(DEFAULT_CLOCK_OUT)
    setDraftError(null)
  }

  const startWizard = () => {
    if (planners.length === 0) {
      toast.error('Aktif MPU bulunamadı.')
      return
    }
    setWizardOpen(true)
    setWizardIndex(0)
    loadWizardStep(0, mpuAttendances)
  }

  const upsertEntry = (entry: HrMpuAttendanceEntry) => {
    setMpuAttendances((prev) => {
      const without = prev.filter((item) => item.mpuUid !== entry.mpuUid)
      return [...without, entry]
    })
  }

  const advanceWizard = (entry: HrMpuAttendanceEntry) => {
    upsertEntry(entry)
    const nextIndex = wizardIndex + 1
    if (nextIndex >= planners.length) {
      setWizardOpen(false)
      setWizardIndex(0)
      resetWizardDraft()
      toast.success('Mesai girişi tamamlandı.')
      return
    }
    setWizardIndex(nextIndex)
    loadWizardStep(nextIndex, [...mpuAttendances.filter((e) => e.mpuUid !== entry.mpuUid), entry])
  }

  const markAbsentAndContinue = () => {
    if (!currentPlanner) return
    advanceWizard({
      mpuUid: currentPlanner.uid,
      mpuNameSnapshot: currentPlanner.fullName,
      clockInTime: null,
      clockOutTime: null,
      absent: true,
    })
  }

  const saveTimesAndContinue = () => {
    if (!currentPlanner) return
    const clockIn = draftInEnabled ? draftIn : ''
    const clockOut = draftOutEnabled ? draftOut : ''
    if (draftInEnabled && !isOptionalHrShiftTime(draftIn)) {
      setDraftError('Geçerli giriş saati girin.')
      return
    }
    if (draftOutEnabled && !isOptionalHrShiftTime(draftOut)) {
      setDraftError('Geçerli çıkış saati girin.')
      return
    }
    if (!draftInEnabled && !draftOutEnabled) {
      setDraftError('Giriş, çıkış veya “İşe gelmedi” seçin.')
      return
    }
    if (!isHrClockOutAfterIn(clockIn, clockOut)) {
      setDraftError('Çıkış saati girişten sonra olmalı.')
      return
    }
    advanceWizard({
      mpuUid: currentPlanner.uid,
      mpuNameSnapshot: currentPlanner.fullName,
      clockInTime: draftInEnabled ? draftIn : null,
      clockOutTime: draftOutEnabled ? draftOut : null,
      absent: false,
    })
  }

  const cancelWizard = () => {
    setWizardOpen(false)
    setWizardIndex(0)
    resetWizardDraft()
  }

  const clearAttendances = () => {
    setMpuAttendances([])
    cancelWizard()
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!profile) return
    setSubmitting(true)
    try {
      if (editingId) {
        await updateHrReport({
          id: editingId,
          title: values.title,
          body: values.body,
          mpuAttendances,
          createdByUid: profile.uid,
        })
        toast.success('Rapor güncellendi.')
      } else {
        await createHrReport({
          title: values.title,
          body: values.body,
          mpuAttendances,
          createdByUid: profile.uid,
          createdByNameSnapshot: profile.fullName,
        })
        toast.success('Rapor yöneticiye gönderildi.')
      }
      reset(emptyForm)
      setMpuAttendances([])
      setEditingId(null)
      cancelWizard()
    } catch (error) {
      toast.error(mapAppError(error, 'Rapor kaydedilemedi.'))
    } finally {
      setSubmitting(false)
    }
  })

  const startEdit = (report: HrReport) => {
    setEditingId(report.id)
    reset({
      title: report.title,
      body: report.body,
    })
    setMpuAttendances(report.mpuAttendances)
    cancelWizard()
  }

  return (
    <AccordionSection
      number={sectionNumber}
      title="Rapor Girişi"
      description="Yöneticiye rapor gönderin. Mesai gir ile MPU’ları sırayla işaretleyebilirsiniz."
      defaultOpen={defaultOpen}
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormField label="Başlık" htmlFor="hr-report-title" error={errors.title?.message}>
          <Input
            id="hr-report-title"
            disabled={submitting || wizardOpen}
            {...register('title', { onBlur: titleCaseOnBlur('title') })}
          />
        </FormField>
        <FormField label="Rapor" htmlFor="hr-report-body" error={errors.body?.message}>
          <Textarea
            id="hr-report-body"
            rows={6}
            disabled={submitting || wizardOpen}
            showCounter
            maxLength={10000}
            {...register('body', { onBlur: titleCaseOnBlur('body') })}
          />
        </FormField>

        <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-muted/30 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-text-primary">MPU mesai (opsiyonel)</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Mesai gir dedikten sonra her MPU sırayla gelir; giriş/çıkış veya işe gelmedi seçin.
              </p>
            </div>
            {!wizardOpen ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting || plannersLoading || planners.length === 0}
                  onClick={startWizard}
                >
                  Mesai gir
                </Button>
                {mpuAttendances.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={submitting}
                    onClick={clearAttendances}
                  >
                    Mesaiyi temizle
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {plannersLoading ? <Skeleton className="h-24 w-full" /> : null}

          {!plannersLoading && planners.length === 0 ? (
            <p className="text-xs text-text-secondary">Aktif MPU bulunamadı.</p>
          ) : null}

          {wizardOpen && currentPlanner ? (
            <div className="space-y-3 rounded-[var(--radius-sm)] border border-border bg-surface p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                    {wizardProgress}
                  </p>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-text-primary">
                    {currentPlanner.fullName}
                  </h3>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={submitting}
                  onClick={cancelWizard}
                >
                  İptal
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <OptionalTimeField
                  id="hr-wizard-clock-in"
                  label="Giriş saati"
                  enabled={draftInEnabled}
                  onEnabledChange={(next) => {
                    setDraftInEnabled(next)
                    if (next) setDraftIn((current) => current || DEFAULT_CLOCK_IN)
                    setDraftError(null)
                  }}
                  value={draftIn}
                  onChange={(next) => {
                    setDraftIn(next)
                    setDraftError(null)
                  }}
                  disabled={submitting}
                />
                <OptionalTimeField
                  id="hr-wizard-clock-out"
                  label="Çıkış saati"
                  enabled={draftOutEnabled}
                  onEnabledChange={(next) => {
                    setDraftOutEnabled(next)
                    if (next) setDraftOut((current) => current || DEFAULT_CLOCK_OUT)
                    setDraftError(null)
                  }}
                  value={draftOut}
                  onChange={(next) => {
                    setDraftOut(next)
                    setDraftError(null)
                  }}
                  disabled={submitting}
                />
              </div>

              {draftError ? (
                <p className="text-sm text-danger" role="alert">
                  {draftError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={saveTimesAndContinue}
                >
                  {wizardIndex + 1 >= planners.length
                    ? 'Kaydet ve bitir'
                    : 'Kaydet ve sonraki'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={markAbsentAndContinue}
                >
                  İşe gelmedi
                </Button>
              </div>
            </div>
          ) : null}

          {!wizardOpen && mpuAttendances.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-text-primary">
              {mpuAttendances.map((entry) => (
                <li key={entry.mpuUid} className="font-medium">
                  {formatHrMpuAttendanceEntry(entry)}
                </li>
              ))}
            </ul>
          ) : null}

          {!wizardOpen && mpuAttendances.length === 0 && !plannersLoading ? (
            <p className="text-xs text-text-secondary">
              Henüz mesai girilmedi. İsterseniz “Mesai gir” ile başlayın.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            loading={submitting}
            disabled={submitting || wizardOpen}
          >
            {editingId ? 'Değişiklikleri kaydet' : 'Raporu gönder'}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              disabled={submitting || wizardOpen}
              onClick={() => {
                setEditingId(null)
                reset(emptyForm)
                setMpuAttendances([])
                cancelWizard()
              }}
            >
              Vazgeç
            </Button>
          )}
        </div>
      </form>

      <div className="mt-8 space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-text-primary">Raporlarım</h3>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : reports.length === 0 ? (
          <EmptyState title="Rapor yok" description="Henüz rapor göndermediniz." />
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => {
              const summary = summarizeHrMpuAttendances(report.mpuAttendances)
              return (
                <CollapsibleListItem
                  key={report.id}
                  title={report.title}
                  subtitle={[
                    report.updatedAt
                      ? formatDateTimeTr(report.updatedAt.toDate())
                      : null,
                    summary,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  action={
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(report)}
                    >
                      Düzenle
                    </Button>
                  }
                >
                  {report.mpuAttendances.length > 0 ? (
                    <ul className="mb-2 space-y-1 text-sm font-medium text-text-primary">
                      {report.mpuAttendances.map((entry) => (
                        <li key={entry.mpuUid}>
                          {formatHrMpuAttendanceEntry(entry)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                    {report.body}
                  </p>
                </CollapsibleListItem>
              )
            })}
          </ul>
        )}
      </div>
    </AccordionSection>
  )
}
