import { useEffect, useState } from 'react'
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Building2, Coins, NotebookPen, Plus, Receipt, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CategoryPanel } from '@/components/ui/CategoryPanel'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  dailyReportSchema,
  type DailyReportFormValues,
} from '@/features/reporter/schemas/dailyReportSchema'
import {
  createDailyReport,
  updateDailyReport,
} from '@/features/reporter/services/dailyReportService'
import type { ReporterDailyReport } from '@/features/reporter/types/reporter'
import {
  buildDailyReportFees,
  formatShootReporterRatePercent,
  formatTryFromKurus,
  parseTryToKurus,
  resolveFieldPaidKurusForWrite,
  shootGrossTotalKurus,
  VAT_RATE_OPTIONS,
  type VatRate,
} from '@/features/reporter/utils/feeCalc'
import { getUserProfile } from '@/features/users/services/userService'
import { UserFacingError, mapAppError } from '@/lib/errors'
import { formatTryInput, kurusToTry } from '@/lib/currency'
import { todayDateOnlyIstanbul } from '@/lib/date'
import { DateInput } from '@/components/ui/DateInput'
import {
  fetchJobsForReportDate,
} from '@/features/jobs/services/jobService'
import { filterJobsVisibleForReporterEmail } from '@/features/reporter/config/reporterJobVisibility'
import { reporterAllowsPartialDayCompanies } from '@/features/reporter/config/reporterDailyReportRules'
import type { JobDocument } from '@/features/jobs/types/job'

function emptyCompany(): DailyReportFormValues['companies'][number] {
  return {
    jobId: '',
    companyName: '',
    cancelled: false,
    hasNews: false,
    newsTotalTry: '',
    chargeMode: 'vat',
    shootMinutes: '',
    vatRate: 20,
  }
}

function companyFromJob(
  job: JobDocument,
  previous?: DailyReportFormValues['companies'][number],
): DailyReportFormValues['companies'][number] {
  return {
    ...(previous ?? emptyCompany()),
    jobId: job.id,
    companyName: job.companyName,
    // Already-shot jobs cannot be cancelled from the report.
    cancelled: job.status === 'approved' ? Boolean(previous?.cancelled) : false,
  }
}

function companyNewsTotalKurus(company: {
  hasNews: boolean
  newsTotalTry: string
}): number | null {
  if (!company.hasNews) return null
  return parseTryToKurus(company.newsTotalTry)
}

function MoneyRow({ label, valueKurus }: { label: string; valueKurus: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium tabular-nums text-text-primary">
        {formatTryFromKurus(valueKurus)}
      </span>
    </div>
  )
}

export type ReporterDailyReportFormProps = {
  report?: ReporterDailyReport | null
  onSaved?: () => void
  onCancel?: () => void
}

function reportToFormValues(report: ReporterDailyReport): DailyReportFormValues {
  const leaveDayCash = report.leaveDayCash === true
  return {
    reportDate: report.reportDate || todayDateOnlyIstanbul(),
    leaveDayCash,
    companies: leaveDayCash
      ? []
      : report.companies.map((company) => ({
          jobId: company.jobId,
          companyName: company.companyName,
          cancelled: company.cancelled === true,
          hasNews: company.hasNews,
          newsTotalTry:
            company.newsTotalKurus === null
              ? ''
              : formatTryInput(kurusToTry(company.newsTotalKurus)),
          chargeMode: company.chargeMode === 'cash' ? 'cash' : 'vat',
          shootMinutes: String(company.shootMinutes),
          vatRate: company.vatRate,
        })),
    note: report.note,
    hotelExpenseTry: formatTryInput(kurusToTry(report.hotelExpenseKurus)),
    stationeryExpenseTry: formatTryInput(kurusToTry(report.stationeryExpenseKurus)),
    fuelExpenseTry: formatTryInput(kurusToTry(report.fuelExpenseKurus)),
    mealExpenseTry: formatTryInput(kurusToTry(report.mealExpenseKurus ?? 0)),
    extraExpenseTry: formatTryInput(kurusToTry(report.extraExpenseKurus)),
    fieldPaidTry:
      report.fieldPaidKurus > 0 ? formatTryInput(kurusToTry(report.fieldPaidKurus)) : '',
  }
}

export function ReporterDailyReportForm({
  report = null,
  onSaved,
  onCancel,
}: ReporterDailyReportFormProps) {
  const { user, profile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  /** Fee owner may differ from editor (management inbox). */
  const [shootReporterRate, setShootReporterRate] = useState<number | null>(
    profile?.shootReporterRate ?? null,
  )

  const [dayJobs, setDayJobs] = useState<JobDocument[]>([])
  const [dayJobsLoading, setDayJobsLoading] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DailyReportFormValues>({
    resolver: zodResolver(dailyReportSchema),
    defaultValues: {
      reportDate: todayDateOnlyIstanbul(),
      leaveDayCash: false,
      companies: [emptyCompany()],
      note: '',
      hotelExpenseTry: '',
      stationeryExpenseTry: '',
      fuelExpenseTry: '',
      mealExpenseTry: '',
      extraExpenseTry: '',
      fieldPaidTry: '',
    },
  })

  const { fields, append, replace } = useFieldArray({ control, name: 'companies' })
  const reportDate = useWatch({ control, name: 'reportDate' }) ?? ''
  const leaveDayCash = Boolean(useWatch({ control, name: 'leaveDayCash' }))
  const watchedCompanies = useWatch({ control, name: 'companies' }) ?? []
  const hotelExpenseTry = useWatch({ control, name: 'hotelExpenseTry' }) ?? ''
  const stationeryExpenseTry = useWatch({ control, name: 'stationeryExpenseTry' }) ?? ''
  const fuelExpenseTry = useWatch({ control, name: 'fuelExpenseTry' }) ?? ''
  const mealExpenseTry = useWatch({ control, name: 'mealExpenseTry' }) ?? ''
  const extraExpenseTry = useWatch({ control, name: 'extraExpenseTry' }) ?? ''
  const fieldPaidTry = useWatch({ control, name: 'fieldPaidTry' }) ?? ''

  const reporterIdentity =
    profile?.role === 'reporter'
      ? {
          email: user?.email ?? profile.email ?? null,
          uid: user?.uid ?? profile.uid ?? null,
        }
      : null
  const allowPartialDayCompanies =
    reporterAllowsPartialDayCompanies(reporterIdentity)

  const liveFees = buildDailyReportFees(
    watchedCompanies.map((c) => {
      const vatRate = (c.vatRate ?? 20) as VatRate
      return {
        companyName: c.companyName || '—',
        cancelled: Boolean(c.cancelled),
        hasNews: Boolean(c.hasNews),
        newsTotalKurus: companyNewsTotalKurus({
          hasNews: Boolean(c.hasNews),
          newsTotalTry: c.newsTotalTry,
        }),
        shootMinutes: Math.max(0, Math.min(1440, Number(c.shootMinutes) || 0)),
        vatRate,
        chargeMode: c.chargeMode === 'cash' ? 'cash' : 'vat',
        shootReporterRate,
      }
    }),
  )

  const shootReporterPercent = formatShootReporterRatePercent(shootReporterRate)
  const operatingExpenseKurus =
    parseTryToKurus(hotelExpenseTry) +
    parseTryToKurus(stationeryExpenseTry) +
    parseTryToKurus(fuelExpenseTry) +
    parseTryToKurus(mealExpenseTry) +
    parseTryToKurus(extraExpenseTry)
  const employeeExpenseKurus =
    liveFees.totalReporterEarningsKurus + liveFees.totalCameramanEarningsKurus
  const totalExpenseKurus = operatingExpenseKurus + employeeExpenseKurus
  const totalIncomeKurus = liveFees.totalIncomeKurus
  const fieldPaidKurus = resolveFieldPaidKurusForWrite(
    fieldPaidTry,
    report?.fieldPaidKurus,
  )

  useEffect(() => {
    if (report) reset(reportToFormValues(report))
  }, [report, reset])

  useEffect(() => {
    const ownerUid = report?.createdByUid ?? profile?.uid ?? null
    if (!ownerUid) {
      setShootReporterRate(null)
      return
    }
    if (ownerUid === profile?.uid) {
      setShootReporterRate(profile.shootReporterRate ?? null)
      return
    }
    let cancelled = false
    void getUserProfile(ownerUid)
      .then((owner) => {
        if (!cancelled) setShootReporterRate(owner?.shootReporterRate ?? null)
      })
      .catch(() => {
        if (!cancelled) setShootReporterRate(null)
      })
    return () => {
      cancelled = true
    }
  }, [report?.createdByUid, profile?.uid, profile?.shootReporterRate])

  useEffect(() => {
    if (leaveDayCash || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      setDayJobs([])
      return
    }
    let cancelled = false
    setDayJobsLoading(true)
    const visibilityIdentity =
      profile?.role === 'reporter'
        ? {
            email: user?.email ?? profile.email ?? null,
            uid: user?.uid ?? profile.uid ?? null,
          }
        : null
    fetchJobsForReportDate(reportDate, {
      allowDailyReportId: report?.id ?? null,
    })
      .then((jobs) => {
        if (!cancelled) {
          setDayJobs(
            filterJobsVisibleForReporterEmail(jobs, visibilityIdentity),
          )
        }
      })
      .catch((err) => {
        if (cancelled) return
        setDayJobs([])
        toast.message(mapAppError(err, 'Günün işleri yüklenemedi.'))
      })
      .finally(() => {
        if (!cancelled) setDayJobsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    reportDate,
    report?.id,
    leaveDayCash,
    profile?.role,
    profile?.email,
    profile?.uid,
    user?.email,
    user?.uid,
  ])

  // New reports: force one row per day job so nothing can be skipped
  // (except accounts allowed to file a partial day — e.g. test.muhabir).
  useEffect(() => {
    if (report || leaveDayCash || dayJobsLoading) return
    if (allowPartialDayCompanies) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return
    const previousById = new Map(
      watchedCompanies
        .filter((c) => c?.jobId)
        .map((c) => [c.jobId, c] as const),
    )
    replace(dayJobs.map((job) => companyFromJob(job, previousById.get(job.id))))
    // Intentionally omit watchedCompanies — only re-sync when day job list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dayJobs,
    dayJobsLoading,
    leaveDayCash,
    report,
    reportDate,
    replace,
    allowPartialDayCompanies,
  ])

  async function onSubmit(values: DailyReportFormValues) {
    if (!user) return
    setError(null)
    setSuccess(null)
    try {
      const leaveDay = Boolean(values.leaveDayCash)
      if (!leaveDay) {
        if (dayJobsLoading) {
          throw new UserFacingError('Günün işleri yükleniyor. Biraz bekleyip tekrar deneyin.')
        }
        if (dayJobs.length === 0) {
          throw new UserFacingError(
            'Bu günde raporlanacak iş yok. İzin günü kasası işaretleyin veya rapor tarihini kontrol edin.',
          )
        }
        const selected = new Set(
          values.companies.map((c) => c.jobId.trim()).filter(Boolean),
        )
        if (!allowPartialDayCompanies) {
          const missing = dayJobs.filter((job) => !selected.has(job.id))
          if (missing.length > 0) {
            const names = missing
              .slice(0, 3)
              .map((job) => job.companyName)
              .join(', ')
            const extra =
              missing.length > 3 ? ` ve ${missing.length - 3} iş daha` : ''
            throw new UserFacingError(
              `Bu günün tüm işlerini seçmelisiniz: ${names}${extra}.`,
            )
          }
        }
      }

      // Firestore is the only source of truth for job status / DK / fees.

      const companiesForFees = leaveDay ? [] : values.companies
      const feeSummary = buildDailyReportFees(
        companiesForFees.map((c) => {
          const vatRate = c.vatRate as VatRate
          return {
            companyName: c.companyName,
            cancelled: Boolean(c.cancelled),
            hasNews: c.hasNews,
            newsTotalKurus: companyNewsTotalKurus({
              hasNews: c.hasNews,
              newsTotalTry: c.newsTotalTry,
            }),
            shootMinutes: Number(c.shootMinutes) || 0,
            vatRate,
            chargeMode: c.chargeMode,
            shootReporterRate,
          }
        }),
      )

      const writeInput = {
        reportDate: values.reportDate,
        leaveDayCash: leaveDay,
        companies: feeSummary.companies.map((company, index) => ({
          ...company,
          jobId: companiesForFees[index]?.jobId.trim() ?? '',
        })),
        note: values.note,
        hotelExpenseKurus: parseTryToKurus(values.hotelExpenseTry),
        stationeryExpenseKurus: parseTryToKurus(values.stationeryExpenseTry),
        fuelExpenseKurus: parseTryToKurus(values.fuelExpenseTry),
        mealExpenseKurus: parseTryToKurus(values.mealExpenseTry),
        extraExpenseKurus: parseTryToKurus(values.extraExpenseTry),
        fieldPaidKurus: resolveFieldPaidKurusForWrite(
          values.fieldPaidTry,
          report?.fieldPaidKurus,
        ),
        totalReporterEarningsKurus: feeSummary.totalReporterEarningsKurus,
        totalCameramanEarningsKurus: feeSummary.totalCameramanEarningsKurus,
        totalVatKurus: feeSummary.totalVatKurus,
      }

      if (report) {
        const role = profile?.role
        if (role !== 'reporter' && role !== 'coordinator' && role !== 'management') {
          throw new UserFacingError('Bu raporu düzenleme yetkiniz bulunmuyor.')
        }
        if (!profile?.fullName) {
          throw new UserFacingError('Profil bilgileriniz yüklenemedi. Lütfen yeniden giriş yapın.')
        }
        await updateDailyReport(report.id, writeInput, {
          uid: user.uid,
          name: profile.fullName,
          role,
        })
      } else {
        if (!profile?.fullName || !profile.email) {
          throw new UserFacingError('Profil bilgileriniz yüklenemedi. Lütfen yeniden giriş yapın.')
        }
        if (profile.role !== 'reporter' && profile.role !== 'coordinator' && profile.role !== 'management') {
          throw new UserFacingError('Günlük rapor gönderme yetkiniz bulunmuyor.')
        }
        await createDailyReport({
          ...writeInput,
          createdByUid: user.uid,
          createdByNameSnapshot: profile.fullName,
          createdByEmailSnapshot: profile.email,
          actorRole:
            profile.role === 'coordinator' || profile.role === 'management'
              ? profile.role
              : 'reporter',
        })
      }
      setSuccess(report ? 'Günlük rapor güncellendi.' : 'Günlük rapor gönderildi.')
      if (!report) {
        reset({
          reportDate: todayDateOnlyIstanbul(),
          leaveDayCash: false,
          companies: [emptyCompany()],
          note: '',
          hotelExpenseTry: '',
          stationeryExpenseTry: '',
          fuelExpenseTry: '',
          mealExpenseTry: '',
          extraExpenseTry: '',
          fieldPaidTry: '',
        })
      }
      onSaved?.()
    } catch (err) {
      setError(
        err instanceof UserFacingError
          ? err.message.replace(/^USER_/, '')
          : 'Günlük rapor gönderilemedi.',
      )
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 stagger-children" noValidate>
      <CategoryPanel title="Rapor tarihi" icon={NotebookPen} tone="navy" compact>
        <FormField
          label="Rapor tarihi"
          htmlFor="report-date"
          required
          error={errors.reportDate?.message}
          hint={
            leaveDayCash
              ? 'İzin günü. İş seçilmez; kasa ve giderler kaydedilir.'
              : allowPartialDayCompanies
                ? 'Çekim gününü seçin. İstediğiniz firmaları tek tek ekleyebilirsiniz; günün tüm işlerini doldurmak zorunlu değil.'
                : 'Çekim gününü seçin. O günün tüm işleri listelenir; her biri için ücret girin veya İptal edildi işaretleyin.'
          }
        >
          <DateInput
            id="report-date"
            error={Boolean(errors.reportDate)}
            aria-invalid={Boolean(errors.reportDate)}
            max={todayDateOnlyIstanbul()}
            {...register('reportDate')}
          />
        </FormField>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-xs)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-cyan"
            checked={leaveDayCash}
            onChange={(event) => {
              const checked = event.target.checked
              setValue('leaveDayCash', checked, { shouldValidate: true })
              if (checked) {
                replace([])
              } else if ((watchedCompanies?.length ?? 0) === 0) {
                replace([emptyCompany()])
              }
            }}
          />
          <span className="text-sm font-medium text-text-primary">
            İzin günü kasası
          </span>
        </label>
        {leaveDayCash ? (
          <p className="text-xs text-text-secondary">
            Firma ve çekim seçilmez. Bu kayıt kasaya gider.
          </p>
        ) : null}
      </CategoryPanel>

      {leaveDayCash ? null : (
      <>
      <div className="space-y-3">
        {fields.map((field, index) => {
          const company = liveFees.companies[index]
          const hasNews = Boolean(watchedCompanies[index]?.hasNews)
          const isCancelled = Boolean(watchedCompanies[index]?.cancelled)
          const companyError = errors.companies?.[index]
          const selectedJob = dayJobs.find(
            (job) => job.id === watchedCompanies[index]?.jobId,
          )
          const canCancelJob = selectedJob?.status === 'approved'

          return (
            <CategoryPanel
              key={field.id}
              title={`Firma ${index + 1}`}
              description={
                isCancelled
                  ? 'İptal — kasa/ücret yok'
                  : 'Haber, çekim ve KDV bilgileri'
              }
              icon={Building2}
              tone={isCancelled ? 'orange' : 'cyan'}
              compact
            >
              <FormField
                label="Firma"
                htmlFor={`company-job-${index}`}
                required
                error={
                  companyError?.jobId?.message ?? companyError?.companyName?.message
                }
                hint={
                  !dayJobsLoading && dayJobs.length === 0
                    ? 'Bu çekim gününde rapora girilmemiş konfirme/çekilmiş iş yok. Rapor tarihini ilgili güne alın veya izin günü kasası kullanın.'
                    : allowPartialDayCompanies
                      ? 'Listeden firma seçin. İsterseniz yalnızca bir firma ile kaydedebilirsiniz.'
                      : 'Bu günün tüm işleri zorunlu. İptal edilen işler için “İptal edildi” işaretleyin.'
                }
              >
                <Controller
                  control={control}
                  name={`companies.${index}.jobId`}
                  render={({ field: f }) => {
                    const currentJobId = f.value ?? ''
                    const currentInList = dayJobs.some(
                      (job) => job.id === currentJobId,
                    )
                    return (
                      <Select
                        id={`company-job-${index}`}
                        value={currentJobId}
                        error={Boolean(companyError?.jobId)}
                        aria-invalid={Boolean(companyError?.jobId)}
                        disabled={!report && dayJobs.length > 0 && !allowPartialDayCompanies}
                        onChange={(e) => {
                          const jobId = e.target.value
                          f.onChange(jobId)
                          const job = dayJobs.find((item) => item.id === jobId)
                          setValue(
                            `companies.${index}.companyName`,
                            job?.companyName ?? '',
                            { shouldValidate: true },
                          )
                          if (job?.status !== 'approved') {
                            setValue(`companies.${index}.cancelled`, false)
                          }
                        }}
                        onBlur={f.onBlur}
                      >
                        <option value="">
                          {dayJobsLoading ? 'Yükleniyor…' : 'Firma seçin…'}
                        </option>
                        {currentJobId && !currentInList ? (
                          <option value={currentJobId}>
                            {watchedCompanies[index]?.companyName || 'Seçili firma'}
                          </option>
                        ) : null}
                        {dayJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.companyName}
                            {job.status === 'shot' ? ' (çekildi)' : ''}
                          </option>
                        ))}
                      </Select>
                    )
                  }}
                />
              </FormField>

              {canCancelJob || isCancelled ? (
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-xs)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-cyan"
                    checked={isCancelled}
                    disabled={!canCancelJob && !isCancelled}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setValue(`companies.${index}.cancelled`, checked, {
                        shouldValidate: true,
                      })
                      if (checked) {
                        setValue(`companies.${index}.hasNews`, false)
                        setValue(`companies.${index}.newsTotalTry`, '')
                        setValue(`companies.${index}.shootMinutes`, '0')
                        setValue(`companies.${index}.chargeMode`, 'cash')
                      }
                    }}
                  />
                  <span className="text-sm font-medium text-text-primary">
                    İptal edildi
                  </span>
                </label>
              ) : null}

              {isCancelled ? (
                <p className="rounded-[var(--radius-sm)] border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-text-secondary">
                  Bu iş kasaya girmez; durum “İptal edildi” olur.
                </p>
              ) : (
                <>
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-xs)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-cyan"
                  {...register(`companies.${index}.hasNews`)}
                />
                <span className="text-sm font-medium text-text-primary">Haber var</span>
              </label>

              {hasNews ? (
                <div className="space-y-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                    Haber ücreti
                  </p>
                  <FormField
                    label="Haber toplam iş tutarı (₺)"
                    htmlFor={`news-total-${index}`}
                    required
                    hint="Muhabir %15 / kameraman %10 girilen tutardan"
                    error={companyError?.newsTotalTry?.message}
                  >
                    <Input
                      id={`news-total-${index}`}
                      inputMode="decimal"
                      placeholder="0"
                      aria-invalid={Boolean(companyError?.newsTotalTry)}
                      {...register(`companies.${index}.newsTotalTry`)}
                    />
                  </FormField>
                  <MoneyRow
                    label="Muhabir payı (%15)"
                    valueKurus={company?.newsReporterFeeKurus ?? 0}
                  />
                  <MoneyRow
                    label="Kameraman payı (%10)"
                    valueKurus={company?.newsCameramanFeeKurus ?? 0}
                  />
                </div>
              ) : null}

              <fieldset className="space-y-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-blue">
                  Ödeme
                </legend>
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium ${
                      watchedCompanies[index]?.chargeMode !== 'cash'
                        ? 'border-brand-cyan bg-brand-cyan/10 text-text-primary'
                        : 'border-border/80 text-text-secondary'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      value="vat"
                      {...register(`companies.${index}.chargeMode`)}
                    />
                    + KDV
                  </label>
                  <label
                    className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium ${
                      watchedCompanies[index]?.chargeMode === 'cash'
                        ? 'border-brand-cyan bg-brand-cyan/10 text-text-primary'
                        : 'border-border/80 text-text-secondary'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      value="cash"
                      {...register(`companies.${index}.chargeMode`)}
                    />
                    Nakit
                  </label>
                </div>
                <p className="text-xs text-text-secondary">
                  {watchedCompanies[index]?.chargeMode === 'cash'
                    ? 'Nakit: KDV hesaplanmaz ve kasaya eklenmez.'
                    : `+ KDV: matrah üzerine %${watchedCompanies[index]?.vatRate ?? 20} eklenir.`}
                </p>
              </fieldset>

              <div className="space-y-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                  Çekim ücreti
                </p>
                <FormField
                  label="Çekim süresi (dakika)"
                  htmlFor={`shoot-minutes-${index}`}
                  required
                  error={companyError?.shootMinutes?.message}
                  hint={`1. dakika kasaya; muhabir %${shootReporterPercent} / kameraman %2 sonraki dakikalardan`}
                >
                  <Input
                    id={`shoot-minutes-${index}`}
                    inputMode="numeric"
                    placeholder="örn. 5"
                    aria-invalid={Boolean(companyError?.shootMinutes)}
                    {...register(`companies.${index}.shootMinutes`)}
                  />
                </FormField>
                <MoneyRow
                  label="Çekim iş tutarı (dk × 5.000 ₺)"
                  valueKurus={shootGrossTotalKurus(company?.shootMinutes ?? 0)}
                />
                <MoneyRow
                  label={`Muhabir payı (%${shootReporterPercent}, 1. dk hariç)`}
                  valueKurus={company?.shootReporterFeeKurus ?? 0}
                />
                <MoneyRow
                  label="Kameraman payı (%2, 1. dk hariç)"
                  valueKurus={company?.shootCameramanFeeKurus ?? 0}
                />
              </div>

              {watchedCompanies[index]?.chargeMode !== 'cash' ? (
                <div className="space-y-2 rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-violet">
                    KDV
                  </p>
                  <MoneyRow
                    label="KDV matrahı (haber + çekim)"
                    valueKurus={company?.vatBaseKurus ?? 0}
                  />
                  <FormField label="KDV oranı" htmlFor={`vat-rate-${index}`}>
                    <Controller
                      control={control}
                      name={`companies.${index}.vatRate`}
                      render={({ field: f }) => (
                        <Select
                          id={`vat-rate-${index}`}
                          value={String(f.value)}
                          onChange={(e) => f.onChange(Number(e.target.value) as VatRate)}
                        >
                          {VAT_RATE_OPTIONS.map((rate) => (
                            <option key={rate} value={rate}>
                              %{rate}
                            </option>
                          ))}
                        </Select>
                      )}
                    />
                  </FormField>
                  <MoneyRow
                    label={`KDV tutarı (%${company?.vatRate ?? 20})`}
                    valueKurus={company?.vatKurus ?? 0}
                  />
                </div>
              ) : (
                <p className="rounded-[var(--radius-sm)] border border-border/80 bg-surface/90 px-3 py-2.5 text-sm text-text-secondary">
                  Nakit seçildi — bu firma için KDV yok.
                </p>
              )}
                </>
              )}
            </CategoryPanel>
          )
        })}
      </div>

      {errors.companies?.message || errors.companies?.root?.message ? (
        <p className="text-sm text-danger" role="alert">
          {errors.companies.message || errors.companies.root?.message}
        </p>
      ) : null}

      {report || allowPartialDayCompanies ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => append(emptyCompany())}>
          <Plus className="size-4" aria-hidden="true" />
          Firma ekle
        </Button>
      ) : null}
      </>
      )}

      <CategoryPanel title="Not" icon={NotebookPen} tone="navy" compact>
        <FormField label="Not" htmlFor="daily-note" error={errors.note?.message}>
          <Textarea
            id="daily-note"
            rows={3}
            placeholder="Opsiyonel not"
            aria-invalid={Boolean(errors.note)}
            {...register('note')}
          />
        </FormField>
      </CategoryPanel>

      <CategoryPanel
        title="Saha giderleri"
        description="Otel, kırtasiye, benzin, yemek ve ekstra"
        icon={Receipt}
        tone="orange"
        compact
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Otel gideri (₺)"
            htmlFor="hotel-expense"
            error={errors.hotelExpenseTry?.message}
          >
            <Input
              id="hotel-expense"
              inputMode="decimal"
              placeholder="0"
              {...register('hotelExpenseTry')}
            />
          </FormField>
          <FormField
            label="Kırtasiye gideri (₺)"
            htmlFor="stationery-expense"
            error={errors.stationeryExpenseTry?.message}
          >
            <Input
              id="stationery-expense"
              inputMode="decimal"
              placeholder="0"
              {...register('stationeryExpenseTry')}
            />
          </FormField>
          <FormField
            label="Benzin gideri (₺)"
            htmlFor="fuel-expense"
            error={errors.fuelExpenseTry?.message}
          >
            <Input
              id="fuel-expense"
              inputMode="decimal"
              placeholder="0"
              {...register('fuelExpenseTry')}
            />
          </FormField>
          <FormField
            label="Yemek gideri (₺)"
            htmlFor="meal-expense"
            error={errors.mealExpenseTry?.message}
          >
            <Input
              id="meal-expense"
              inputMode="decimal"
              placeholder="0"
              {...register('mealExpenseTry')}
            />
          </FormField>
          <FormField
            label="Ekstra giderler (₺)"
            htmlFor="extra-expense"
            error={errors.extraExpenseTry?.message}
          >
            <Input
              id="extra-expense"
              inputMode="decimal"
              placeholder="0"
              {...register('extraExpenseTry')}
            />
          </FormField>
        </div>
      </CategoryPanel>

      <CategoryPanel title="Gider özeti" icon={Receipt} tone="pink" compact>
        <MoneyRow
          label="Saha giderleri (otel + kırtasiye + benzin + yemek + ekstra)"
          valueKurus={operatingExpenseKurus}
        />
        <MoneyRow
          label="+ Saha ücretleri (muhabir + kameraman)"
          valueKurus={employeeExpenseKurus}
        />
        <MoneyRow label="Toplam gider" valueKurus={totalExpenseKurus} />
      </CategoryPanel>

      <div className="grid gap-3 sm:grid-cols-2">
        <CategoryPanel
          title="Toplam gelir"
          description="Kasaya matrah + KDV tutarı geçer"
          icon={Coins}
          tone="violet"
          compact
        >
          <MoneyRow label="Matrah" valueKurus={liveFees.totalVatBaseKurus} />
          <MoneyRow label="+ KDV" valueKurus={liveFees.totalVatKurus} />
          <div className="border-t border-white/60 pt-2">
            <MoneyRow label="Toplam" valueKurus={totalIncomeKurus} />
          </div>
        </CategoryPanel>

        <CategoryPanel
          title="Sahaya ödenen"
          description="Kasadan verilen para"
          icon={Wallet}
          tone="success"
          compact
        >
          <FormField
            label="Sahaya ödenen tutar (₺)"
            htmlFor="field-paid"
            hint={
              report
                ? 'Boş bırakılırsa önceki tutar korunur; sıfırlamak için 0 yazın'
                : 'Boş bırakılırsa 0 kabul edilir'
            }
            error={errors.fieldPaidTry?.message}
          >
            <Input
              id="field-paid"
              inputMode="decimal"
              placeholder="0"
              aria-invalid={Boolean(errors.fieldPaidTry)}
              {...register('fieldPaidTry')}
            />
          </FormField>
        </CategoryPanel>
      </div>

      <CategoryPanel title="Net kasa etkisi" icon={Wallet} tone="navy" compact>
        <MoneyRow label="Kasa etkisi (rapor geliri)" valueKurus={totalIncomeKurus} />
        <MoneyRow label="Kasa etkisi (sahaya ödenen)" valueKurus={-fieldPaidKurus} />
        <div className="border-t border-white/60 pt-2">
          <MoneyRow
            label="Net kasa etkisi"
            valueKurus={totalIncomeKurus - fieldPaidKurus}
          />
        </div>
      </CategoryPanel>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-success" role="status">
          {success}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Vazgeç
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting
            ? report
              ? 'Güncelleniyor…'
              : 'Gönderiliyor…'
            : report
              ? 'Raporu güncelle'
              : 'Günlük raporu gönder'}
        </Button>
      </div>
    </form>
  )
}
