import { useEffect, useState, type FocusEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { HrReport } from '@/features/hr/types/hr'
import {
  createHrReport,
  subscribeOwnHrReports,
  updateHrReport,
} from '@/features/hr/services/hrReportService'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateTimeTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { toTitleCaseTr } from '@/lib/text'

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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', body: '' },
  })

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

  const onSubmit = handleSubmit(async (values) => {
    if (!profile) return
    setSubmitting(true)
    try {
      if (editingId) {
        await updateHrReport({ id: editingId, ...values })
        toast.success('Rapor güncellendi.')
      } else {
        await createHrReport({
          ...values,
          createdByUid: profile.uid,
          createdByNameSnapshot: profile.fullName,
        })
        toast.success('Rapor yöneticiye gönderildi.')
      }
      reset({ title: '', body: '' })
      setEditingId(null)
    } catch (error) {
      toast.error(mapAppError(error, 'Rapor kaydedilemedi.'))
    } finally {
      setSubmitting(false)
    }
  })

  const startEdit = (report: HrReport) => {
    setEditingId(report.id)
    setValue('title', report.title)
    setValue('body', report.body)
  }

  return (
    <AccordionSection
      number={sectionNumber}
      title="Rapor Girişi"
      description="Yöneticiye rapor gönderin. Gönderdiğiniz raporları düzenleyebilirsiniz."
      defaultOpen={defaultOpen}
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormField label="Başlık" htmlFor="hr-report-title" error={errors.title?.message}>
          <Input
            id="hr-report-title"
            disabled={submitting}
            {...register('title', { onBlur: titleCaseOnBlur('title') })}
          />
        </FormField>
        <FormField label="Rapor" htmlFor="hr-report-body" error={errors.body?.message}>
          <Textarea
            id="hr-report-body"
            rows={6}
            disabled={submitting}
            showCounter
            maxLength={10000}
            {...register('body', { onBlur: titleCaseOnBlur('body') })}
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={submitting} disabled={submitting}>
            {editingId ? 'Değişiklikleri kaydet' : 'Raporu gönder'}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => {
                setEditingId(null)
                reset({ title: '', body: '' })
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
            {reports.map((report) => (
              <CollapsibleListItem
                key={report.id}
                title={report.title}
                subtitle={
                  report.updatedAt ? formatDateTimeTr(report.updatedAt.toDate()) : '—'
                }
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
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {report.body}
                </p>
              </CollapsibleListItem>
            ))}
          </ul>
        )}
      </div>
    </AccordionSection>
  )
}
