import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import turkeyLocations from '@/data/turkeyLocations.json'
import { createJob, updatePendingJob } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import {
  createJobFormDefaultValues,
  editJobFormSchema,
  emptyContact,
  fixedCreateJobDates,
  jobFormSchema,
  MAX_JOB_CONTACTS,
  type JobFormValues,
} from '@/features/media-planning/schemas/jobFormSchema'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Toggle } from '@/components/ui/Toggle'
import { kurusToTry, tryToKurus } from '@/lib/currency'
import { nextWorkdayAfter } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { normalizeTurkishPhone } from '@/lib/phone'
import { toTitleCaseTr } from '@/lib/text'
import { cn } from '@/lib/classNames'

export type NewJobFormProps = {
  readonly?: boolean
  readonlyMessage?: string
  job?: JobDocument | null
  onSuccess?: () => void
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function toContactCount(length: number): 1 | 2 | 3 {
  if (length === 2) return 2
  if (length === 3) return 3
  return 1
}

function jobToFormValues(job: JobDocument): JobFormValues {
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
    plannedExecutionDate: job.plannedExecutionDate.slice(0, 10),
    agreedAmount: kurusToTry(job.agreedAmountKurus),
    confirmed: true,
  }
}

export function NewJobForm({
  readonly = false,
  readonlyMessage,
  job = null,
  onSuccess,
}: NewJobFormProps) {
  const { profile, isOnline } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const idempotencyKeyRef = useRef(createIdempotencyKey())
  const isEditMode = Boolean(job)
  /**
   * Create: acquired/planned dates are fixed (today / next business day).
   * Edit: dates remain editable.
   */
  const datesLocked = !isEditMode
  const skipNextAcquiredAutoFill = useRef(isEditMode)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(isEditMode ? editJobFormSchema : jobFormSchema),
    defaultValues: job ? jobToFormValues(job) : createJobFormDefaultValues(),
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contacts',
  })

  const selectedProvince = watch('province')
  const selectedDistrict = watch('district')
  const fullAddress = watch('fullAddress')
  const acquiredDate = watch('acquiredDate')
  const plannedExecutionDate = watch('plannedExecutionDate')
  const confirmed = watch('confirmed')

  const districts = useMemo(() => {
    const location = turkeyLocations.find((loc) => loc.name === selectedProvince)
    return location?.districts ?? []
  }, [selectedProvince])

  useEffect(() => {
    if (job) {
      skipNextAcquiredAutoFill.current = true
      reset(jobToFormValues(job))
    }
  }, [job, reset])

  useEffect(() => {
    if (datesLocked) return
    if (!acquiredDate) return
    if (skipNextAcquiredAutoFill.current) {
      skipNextAcquiredAutoFill.current = false
      return
    }
    const suggested = nextWorkdayAfter(acquiredDate)
    if (suggested) {
      setValue('plannedExecutionDate', suggested.slice(0, 10), { shouldValidate: true })
    }
  }, [acquiredDate, datesLocked, setValue])

  const handleProvinceChange = useCallback(
    (value: string) => {
      setValue('province', value, { shouldValidate: true, shouldDirty: true })
      // Keep district controlled in sync with options; validate so stale errors clear/update.
      setValue('district', '', { shouldValidate: true, shouldDirty: true })
    },
    [setValue],
  )

  const handleDistrictChange = useCallback(
    (value: string) => {
      setValue('district', value, { shouldValidate: true, shouldDirty: true })
    },
    [setValue],
  )

  const buildContacts = (values: JobFormValues) =>
    values.contacts.map((c: JobFormValues['contacts'][number]) => {
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
        name: c.name.trim(),
        mobilePhone: mobile,
        workPhone: work,
      }
    })

  const onSubmit = handleSubmit(async (values) => {
    if (!profile || readonly || !isOnline) return

    setSubmitting(true)
    try {
      const contacts = buildContacts(values)
      const contactCount = toContactCount(contacts.length)
      const dates = datesLocked
        ? fixedCreateJobDates()
        : {
            acquiredDate: values.acquiredDate,
            plannedExecutionDate: values.plannedExecutionDate,
          }

      const instagram = values.instagram.trim() ? values.instagram.trim() : null

      if (isEditMode && job) {
        await updatePendingJob({
          jobId: job.id,
          companyName: values.companyName,
          contacts,
          contactCount,
          province: values.province,
          district: values.district,
          fullAddress: values.fullAddress,
          instagram,
          acquiredDate: dates.acquiredDate,
          plannedExecutionDate: dates.plannedExecutionDate,
          agreedAmountKurus: tryToKurus(values.agreedAmount),
        })
        toast.success('İş kaydı güncellendi.')
        onSuccess?.()
      } else {
        await createJob({
          companyName: values.companyName,
          contacts,
          contactCount,
          province: values.province,
          district: values.district,
          fullAddress: values.fullAddress,
          instagram,
          acquiredDate: dates.acquiredDate,
          plannedExecutionDate: dates.plannedExecutionDate,
          agreedAmountKurus: tryToKurus(values.agreedAmount),
          idempotencyKey: idempotencyKeyRef.current,
          createdByUid: profile.uid,
          createdByNameSnapshot: profile.fullName,
          createdByEmailSnapshot: profile.email,
        })

        reset(createJobFormDefaultValues())
        idempotencyKeyRef.current = createIdempotencyKey()
        toast.success('İş kaydı konfirmeye gönderildi.')
        onSuccess?.()
      }
    } catch (error) {
      toast.error(mapAppError(error, 'İş kaydı gönderilemedi. Lütfen tekrar deneyin.'))
    } finally {
      setSubmitting(false)
    }
  })

  if (readonly) {
    return (
      <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted px-4 py-6 text-center">
        <p className="text-sm text-text-secondary">
          {readonlyMessage ??
            'Yeni iş kaydı oluşturmak yalnızca medya planlama kullanıcısının kendi hesabından yapılabilir.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField
        label="Firma İsmi"
        htmlFor="companyName"
        required
        error={errors.companyName?.message}
      >
        <Input
          id="companyName"
          hasError={Boolean(errors.companyName)}
          disabled={submitting || !isOnline}
          {...register('companyName', {
            onBlur: (e) => {
              setValue('companyName', toTitleCaseTr(e.target.value), {
                shouldValidate: true,
                shouldDirty: true,
              })
            },
          })}
        />
      </FormField>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="font-display text-base font-semibold text-text-primary">Yetkililer</h4>
            <p className="mt-0.5 text-sm text-text-secondary">
              En az 1, en fazla {MAX_JOB_CONTACTS} yetkili ekleyebilirsiniz.
            </p>
            {errors.contacts?.root?.message || errors.contacts?.message ? (
              <p className="mt-1 text-xs text-danger" role="alert">
                {errors.contacts?.root?.message ?? errors.contacts?.message}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting || !isOnline || fields.length >= MAX_JOB_CONTACTS}
            onClick={() => append(emptyContact())}
            className="shrink-0"
          >
            <Plus className="size-4" aria-hidden="true" />
            Yetkili ekle
          </Button>
        </div>

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="space-y-4 rounded-[var(--radius-md)] border border-border bg-surface-muted/40 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-text-secondary">Yetkili {index + 1}</p>
              {fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={submitting || !isOnline}
                  onClick={() => remove(index)}
                  aria-label={`Yetkili ${index + 1} kaldır`}
                  className="text-danger hover:bg-danger/10"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Kaldır
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <FormField
                label="Yetkili adı"
                htmlFor={`contacts.${index}.name`}
                required
                error={errors.contacts?.[index]?.name?.message}
              >
                <Input
                  id={`contacts.${index}.name`}
                  hasError={Boolean(errors.contacts?.[index]?.name)}
                  disabled={submitting || !isOnline}
                  {...register(`contacts.${index}.name`, {
                    onBlur: (e) => {
                      setValue(
                        `contacts.${index}.name`,
                        toTitleCaseTr(e.target.value),
                        { shouldValidate: true, shouldDirty: true },
                      )
                    },
                  })}
                />
              </FormField>

              <FormField
                label="Cep Telefonu"
                htmlFor={`contacts.${index}.mobilePhone`}
                required
                error={errors.contacts?.[index]?.mobilePhone?.message}
              >
                <Controller
                  name={`contacts.${index}.mobilePhone`}
                  control={control}
                  render={({ field: phoneField }) => (
                    <PhoneInput
                      id={`contacts.${index}.mobilePhone`}
                      value={phoneField.value}
                      onChange={phoneField.onChange}
                      onBlur={phoneField.onBlur}
                      error={Boolean(errors.contacts?.[index]?.mobilePhone)}
                      disabled={submitting || !isOnline}
                    />
                  )}
                />
              </FormField>

              <FormField
                label="İş Telefonu"
                htmlFor={`contacts.${index}.workPhone`}
                hint="Opsiyonel"
                error={errors.contacts?.[index]?.workPhone?.message}
              >
                <Controller
                  name={`contacts.${index}.workPhone`}
                  control={control}
                  render={({ field: phoneField }) => (
                    <PhoneInput
                      id={`contacts.${index}.workPhone`}
                      value={phoneField.value ?? ''}
                      onChange={phoneField.onChange}
                      onBlur={phoneField.onBlur}
                      error={Boolean(errors.contacts?.[index]?.workPhone)}
                      disabled={submitting || !isOnline}
                    />
                  )}
                />
              </FormField>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="İl" htmlFor="province" required error={errors.province?.message}>
          <Select
            id="province"
            value={selectedProvince}
            onChange={(e) => handleProvinceChange(e.target.value)}
            error={Boolean(errors.province)}
            disabled={submitting || !isOnline}
          >
            <option value="">İl seçin</option>
            {turkeyLocations.map((loc) => (
              <option key={loc.name} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="İlçe" htmlFor="district" required error={errors.district?.message}>
          <Select
            id="district"
            name="district"
            value={selectedDistrict}
            onChange={(e) => handleDistrictChange(e.target.value)}
            error={Boolean(errors.district)}
            disabled={submitting || !isOnline || !selectedProvince}
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
        label="Açık adres"
        htmlFor="fullAddress"
        required
        error={errors.fullAddress?.message}
      >
        <Textarea
          id="fullAddress"
          showCounter
          maxLength={500}
          value={fullAddress}
          error={Boolean(errors.fullAddress)}
          disabled={submitting || !isOnline}
          {...register('fullAddress', {
            onBlur: (e) => {
              setValue('fullAddress', toTitleCaseTr(e.target.value), {
                shouldValidate: true,
                shouldDirty: true,
              })
            },
          })}
        />
      </FormField>

      <FormField
        label="Instagram hesabı"
        htmlFor="instagram"
        hint="Opsiyonel"
        error={errors.instagram?.message}
      >
        <Input
          id="instagram"
          placeholder="@kullaniciadi"
          hasError={Boolean(errors.instagram)}
          disabled={submitting || !isOnline}
          {...register('instagram')}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="İşin alındığı tarih"
          htmlFor="acquiredDate"
          required
          hint={datesLocked ? 'Bugün (otomatik, değiştirilemez)' : undefined}
          error={errors.acquiredDate?.message}
        >
          {datesLocked ? (
            <>
              <input type="hidden" {...register('acquiredDate')} />
              <DateInput
                id="acquiredDate"
                value={acquiredDate}
                error={Boolean(errors.acquiredDate)}
                disabled
                readOnly
                tabIndex={-1}
              />
            </>
          ) : (
            <DateInput
              id="acquiredDate"
              error={Boolean(errors.acquiredDate)}
              disabled={submitting || !isOnline}
              {...register('acquiredDate')}
            />
          )}
        </FormField>

        <FormField
          label="Planlanan çekim tarihi"
          htmlFor="plannedExecutionDate"
          required
          hint={
            datesLocked
              ? 'Yarın (Pazar ise Pazartesi) — otomatik, değiştirilemez'
              : 'Pazar günleri çalışılmadığı için bir sonraki iş günü önerilir; değiştirebilirsiniz.'
          }
          error={errors.plannedExecutionDate?.message}
        >
          {datesLocked ? (
            <>
              <input type="hidden" {...register('plannedExecutionDate')} />
              <DateInput
                id="plannedExecutionDate"
                value={plannedExecutionDate}
                error={Boolean(errors.plannedExecutionDate)}
                disabled
                readOnly
                tabIndex={-1}
              />
            </>
          ) : (
            <DateInput
              id="plannedExecutionDate"
              error={Boolean(errors.plannedExecutionDate)}
              disabled={submitting || !isOnline}
              {...register('plannedExecutionDate')}
            />
          )}
        </FormField>
      </div>

        <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Anlaşılan tutar"
          htmlFor="agreedAmount"
          required
          error={errors.agreedAmount?.message}
        >
          <Controller
            name="agreedAmount"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                id="agreedAmount"
                value={field.value > 0 ? field.value : null}
                onChange={(val) => field.onChange(val ?? 0)}
                onBlur={field.onBlur}
                error={Boolean(errors.agreedAmount)}
                disabled={submitting || !isOnline}
              />
            )}
          />
        </FormField>

        <div
          className={cn(
            'flex items-center justify-between gap-4 rounded-[var(--radius-md)] border px-4 py-3 transition-colors',
            confirmed
              ? 'border-brand-cyan/40 bg-brand-cyan/5'
              : 'border-border bg-surface-muted/50',
          )}
        >
          <p className="text-sm font-medium text-text-primary">Teyit</p>
          <Controller
            name="confirmed"
            control={control}
            render={({ field }) => (
              <Toggle
                id="confirmed"
                checked={field.value}
                onChange={field.onChange}
                disabled={submitting || !isOnline}
                label={confirmed ? 'Teyit edildi' : 'Teyit et'}
              />
            )}
          />
        </div>
      </div>

      {!isOnline && (
        <p className="text-sm text-warning" role="status">
          İnternet bağlantısı olmadan iş kaydı gönderilemez.
        </p>
      )}

      <Button
        type="submit"
        loading={submitting}
        disabled={submitting || !isOnline}
        className="w-full sm:w-auto"
      >
        {isEditMode ? 'Değişiklikleri kaydet' : 'Konfirmeye gönder'}
      </Button>
    </form>
  )
}
