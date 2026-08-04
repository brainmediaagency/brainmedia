import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import turkeyLocations from '@/data/turkeyLocations.json'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  jobPlannedDay,
  updatePendingJob,
} from '@/features/jobs/services/jobService'
import {
  SHEET_SON_DURUM,
  upsertJobRowToSheet,
} from '@/features/jobs/services/sheetsExport'
import {
  MAX_JOB_CONTACTS,
  emptyContact,
} from '@/features/media-planning/schemas/jobFormSchema'
import { Button } from '@/components/ui/Button'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  combineJobDateAndTime,
  isJobScheduleOnOrAfter,
  isValidDateOnly,
  isValidJobTimeLocal,
} from '@/lib/date'
import { kurusToTry, tryToKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'
import { normalizeTurkishPhone } from '@/lib/phone'
import { toTitleCaseTr } from '@/lib/text'

export type ApprovedJobEditFormProps = {
  job: JobDocument
  onSuccess: (job: JobDocument) => void
  onCancel: () => void
}

/** Matches konfirme / günlük takvim window: full + half hours 09:00–21:00. */
const EXECUTION_TIME_HOUR_START = 9
const EXECUTION_TIME_HOUR_END = 21

function buildExecutionTimeOptions(): string[] {
  const options: string[] = []
  for (let h = EXECUTION_TIME_HOUR_START; h <= EXECUTION_TIME_HOUR_END; h += 1) {
    const hour = String(h).padStart(2, '0')
    options.push(`${hour}:00`)
    if (h < EXECUTION_TIME_HOUR_END) options.push(`${hour}:30`)
  }
  return options
}

const EXECUTION_TIME_OPTIONS = buildExecutionTimeOptions()

function extractPlannedParts(planned: string): { date: string; time: string } {
  const date = planned.slice(0, 10)
  const time =
    planned.length >= 16 && planned[10] === 'T' ? planned.slice(11, 16) : '09:00'
  return {
    date: isValidDateOnly(date) ? date : '',
    time: isValidJobTimeLocal(time) ? time : '09:00',
  }
}

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Yetkili adı en az 2 karakter olmalıdır.')
    .max(100, 'Yetkili adı en fazla 100 karakter olabilir.'),
  mobilePhone: z.string().min(1, 'Cep telefonu gereklidir.'),
  workPhone: z.string(),
})

const approvedJobEditObjectSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'Firma adı en az 2 karakter olmalıdır.')
    .max(120, 'Firma adı en fazla 120 karakter olabilir.'),
  contacts: z.array(contactSchema).min(1).max(MAX_JOB_CONTACTS),
  province: z.string().min(1, 'İl seçimi gereklidir.'),
  district: z.string().min(1, 'İlçe seçimi gereklidir.'),
  fullAddress: z
    .string()
    .trim()
    .min(10, 'Adres en az 10 karakter olmalıdır.')
    .max(500, 'Adres en fazla 500 karakter olabilir.'),
  instagram: z.string().max(100),
  acquiredDate: z.string().refine(isValidDateOnly, 'Geçerli bir iş alım tarihi girin.'),
  plannedDate: z.string().refine(isValidDateOnly, 'Geçerli bir çekim tarihi girin.'),
  plannedTime: z
    .string()
    .refine(isValidJobTimeLocal, 'Geçerli bir çekim saati seçin.'),
  agreedAmount: z.number().positive("Anlaşılan tutar 0'dan büyük olmalıdır."),
})

const approvedJobEditSchema = approvedJobEditObjectSchema.superRefine((data, ctx) => {
  const planned = combineJobDateAndTime(data.plannedDate, data.plannedTime)
  if (!isJobScheduleOnOrAfter(planned, data.acquiredDate)) {
    ctx.addIssue({
      code: 'custom',
      path: ['plannedDate'],
      message: 'Planlanan çekim, iş alım tarihinden önce olamaz.',
    })
  }
})

type ApprovedJobEditValues = z.infer<typeof approvedJobEditObjectSchema>

function toContactCount(length: number): 1 | 2 | 3 {
  if (length === 2) return 2
  if (length === 3) return 3
  return 1
}

function jobToValues(job: JobDocument): ApprovedJobEditValues {
  const planned = extractPlannedParts(job.plannedExecutionDate)
  const contacts =
    job.contacts.length > 0
      ? job.contacts.slice(0, MAX_JOB_CONTACTS).map((c) => ({
          name: c.name,
          mobilePhone: c.mobilePhone,
          workPhone: c.workPhone ?? '',
        }))
      : [emptyContact()]

  return {
    companyName: job.companyName,
    contacts,
    province: job.province,
    district: job.district,
    fullAddress: job.fullAddress,
    instagram: job.instagram ?? '',
    acquiredDate: job.acquiredDate.slice(0, 10),
    plannedDate: planned.date,
    plannedTime: planned.time,
    agreedAmount: kurusToTry(job.agreedAmountKurus),
  }
}

export function ApprovedJobEditForm({
  job,
  onSuccess,
  onCancel,
}: ApprovedJobEditFormProps) {
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ApprovedJobEditValues>({
    resolver: zodResolver(approvedJobEditSchema),
    defaultValues: jobToValues(job),
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contacts',
  })

  const selectedProvince = watch('province')

  const districts = useMemo(() => {
    const location = turkeyLocations.find((loc) => loc.name === selectedProvince)
    return location?.districts ?? []
  }, [selectedProvince])

  useEffect(() => {
    reset(jobToValues(job))
  }, [job, reset])

  const handleProvinceChange = useCallback(
    (value: string) => {
      setValue('province', value, { shouldValidate: true, shouldDirty: true })
      setValue('district', '', { shouldValidate: true, shouldDirty: true })
    },
    [setValue],
  )

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const contacts = values.contacts.map((c) => {
        const mobile = normalizeTurkishPhone(c.mobilePhone)
        if (!mobile) {
          throw new Error('USER_Geçerli bir cep telefonu girin.')
        }
        const workRaw = (c.workPhone ?? '').trim()
        const work = workRaw ? normalizeTurkishPhone(workRaw) : null
        if (workRaw && !work) {
          throw new Error('USER_Geçerli bir iş telefonu girin.')
        }
        return {
          name: toTitleCaseTr(c.name.trim()),
          mobilePhone: mobile,
          workPhone: work,
        }
      })

      const previousDay = jobPlannedDay(job)
      const plannedExecutionDate = combineJobDateAndTime(
        values.plannedDate,
        values.plannedTime,
      )

      const updated = await updatePendingJob({
        jobId: job.id,
        companyName: toTitleCaseTr(values.companyName.trim()),
        contacts,
        contactCount: toContactCount(contacts.length),
        province: values.province,
        district: values.district,
        fullAddress: toTitleCaseTr(values.fullAddress.trim()),
        instagram: values.instagram.trim() ? values.instagram.trim() : null,
        acquiredDate: values.acquiredDate,
        plannedExecutionDate,
        agreedAmountKurus: tryToKurus(values.agreedAmount),
      })

      const newDay = jobPlannedDay(updated)
      if (previousDay && newDay && previousDay !== newDay) {
        toast.success(
          `İş kaydı güncellendi · çekim takvimi ${newDay} gününe taşındı.`,
        )
      } else {
        toast.success('İş kaydı güncellendi.')
      }
      onSuccess(updated)

      try {
        await upsertJobRowToSheet(updated, SHEET_SON_DURUM.approved, {
          plannedExecutionDate: updated.plannedExecutionDate,
        })
      } catch (error) {
        toast.warning(
          mapAppError(
            error,
            'Firestore kaydı tamam. Excel (Sheets) güncellenemedi — Excel sekmesinden kontrol edin.',
          ),
        )
      }
    } catch (error) {
      toast.error(mapAppError(error, 'İş kaydı güncellenemedi.'))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <p className="text-sm text-text-secondary">
        Planlanan çekim tarihi veya saati değişirse kayıt o güne / saate yerleşir;
        gelecek bir zamana alınırsa Çekim Durumu listesinden çıkar.
      </p>

      <FormField
        label="Firma adı"
        htmlFor="approved-edit-company"
        error={errors.companyName?.message}
        required
      >
        <Input
          id="approved-edit-company"
          {...register('companyName')}
          disabled={submitting}
        />
      </FormField>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Yetkili {index + 1}
              </p>
              {fields.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Kaldır
                </Button>
              ) : null}
            </div>
            <FormField
              label="Ad soyad"
              htmlFor={`approved-edit-contact-name-${index}`}
              error={errors.contacts?.[index]?.name?.message}
              required
            >
              <Input
                id={`approved-edit-contact-name-${index}`}
                {...register(`contacts.${index}.name`)}
                disabled={submitting}
              />
            </FormField>
            <FormField
              label="Cep telefonu"
              htmlFor={`approved-edit-contact-mobile-${index}`}
              error={errors.contacts?.[index]?.mobilePhone?.message}
              required
            >
              <Controller
                control={control}
                name={`contacts.${index}.mobilePhone`}
                render={({ field: phoneField }) => (
                  <PhoneInput
                    id={`approved-edit-contact-mobile-${index}`}
                    value={phoneField.value}
                    onChange={phoneField.onChange}
                    onBlur={phoneField.onBlur}
                    error={Boolean(errors.contacts?.[index]?.mobilePhone)}
                    disabled={submitting}
                  />
                )}
              />
            </FormField>
          </div>
        ))}
        {fields.length < MAX_JOB_CONTACTS ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={submitting}
            onClick={() => append(emptyContact())}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Yetkili ekle
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="İl"
          htmlFor="approved-edit-province"
          error={errors.province?.message}
          required
        >
          <Select
            id="approved-edit-province"
            value={selectedProvince}
            onChange={(e) => handleProvinceChange(e.target.value)}
            error={Boolean(errors.province)}
            disabled={submitting}
          >
            <option value="">İl seçin</option>
            {turkeyLocations.map((loc) => (
              <option key={loc.name} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="İlçe"
          htmlFor="approved-edit-district"
          error={errors.district?.message}
          required
        >
          <Select
            id="approved-edit-district"
            {...register('district')}
            error={Boolean(errors.district)}
            disabled={submitting || !selectedProvince}
          >
            <option value="">İlçe seçin</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        label="Adres"
        htmlFor="approved-edit-address"
        error={errors.fullAddress?.message}
        required
      >
        <Textarea
          id="approved-edit-address"
          rows={3}
          {...register('fullAddress')}
          error={Boolean(errors.fullAddress)}
          disabled={submitting}
        />
      </FormField>

      <FormField
        label="Instagram"
        htmlFor="approved-edit-instagram"
        error={errors.instagram?.message}
      >
        <Input
          id="approved-edit-instagram"
          {...register('instagram')}
          disabled={submitting}
          placeholder="@kullanici (opsiyonel)"
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="İş alım tarihi"
          htmlFor="approved-edit-acquired"
          error={errors.acquiredDate?.message}
          required
        >
          <DateInput
            id="approved-edit-acquired"
            {...register('acquiredDate')}
            error={Boolean(errors.acquiredDate)}
            disabled={submitting}
          />
        </FormField>
        <FormField
          label="Anlaşılan tutar"
          htmlFor="approved-edit-amount"
          error={errors.agreedAmount?.message}
          required
        >
          <Controller
            control={control}
            name="agreedAmount"
            render={({ field }) => (
              <CurrencyInput
                id="approved-edit-amount"
                value={field.value}
                onChange={(value) => field.onChange(value ?? 0)}
                error={Boolean(errors.agreedAmount)}
                disabled={submitting}
              />
            )}
          />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Planlanan çekim tarihi"
          htmlFor="approved-edit-planned-date"
          error={errors.plannedDate?.message}
          required
        >
          <DateInput
            id="approved-edit-planned-date"
            {...register('plannedDate')}
            error={Boolean(errors.plannedDate)}
            disabled={submitting}
          />
        </FormField>
        <FormField
          label="Planlanan çekim saati"
          htmlFor="approved-edit-planned-time"
          error={errors.plannedTime?.message}
          required
        >
          <Select
            id="approved-edit-planned-time"
            {...register('plannedTime')}
            error={Boolean(errors.plannedTime)}
            disabled={submitting}
          >
            <option value="">Saat seçin</option>
            {EXECUTION_TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={onCancel}
        >
          Vazgeç
        </Button>
        <Button type="submit" loading={submitting}>
          Kaydet
        </Button>
      </div>
    </form>
  )
}
