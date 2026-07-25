import { z } from 'zod'
import {
  combineJobDateAndTime,
  compareJobSchedule,
  isValidDateOnly,
  isValidJobTimeLocal,
  nextWorkdayAfter,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { isValidTurkishPhone } from '@/lib/phone'
import { toTitleCaseTr } from '@/lib/text'

export { combineJobDateAndTime, isValidJobTimeLocal }

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Yetkili adı en az 2 karakter olmalıdır.')
    .max(100, 'Yetkili adı en fazla 100 karakter olabilir.')
    .transform(toTitleCaseTr),
  mobilePhone: z
    .string()
    .min(1, 'Cep telefonu gereklidir.')
    .refine(isValidTurkishPhone, 'Geçerli bir cep telefonu girin.'),
  workPhone: z.string().refine(
    (v) => v.trim() === '' || isValidTurkishPhone(v.trim()),
    'Geçerli bir iş telefonu girin.',
  ),
})

export const MAX_JOB_CONTACTS = 3

const jobFormObjectSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'Firma adı en az 2 karakter olmalıdır.')
    .max(120, 'Firma adı en fazla 120 karakter olabilir.')
    .transform(toTitleCaseTr),
  contacts: z
    .array(contactSchema)
    .min(1, 'En az bir yetkili ekleyin.')
    .max(MAX_JOB_CONTACTS, `En fazla ${MAX_JOB_CONTACTS} yetkili eklenebilir.`),
  province: z.string().min(1, 'İl seçimi gereklidir.'),
  district: z.string().min(1, 'İlçe seçimi gereklidir.'),
  fullAddress: z
    .string()
    .trim()
    .min(10, 'Adres en az 10 karakter olmalıdır.')
    .max(500, 'Adres en fazla 500 karakter olabilir.')
    .transform(toTitleCaseTr),
  instagram: z
    .string()
    .trim()
    .max(100, 'Instagram en fazla 100 karakter olabilir.'),
  acquiredDate: z
    .string()
    .min(1, 'İş alım tarihi gereklidir.')
    .refine(isValidDateOnly, 'Geçerli bir tarih girin.'),
  plannedExecutionDate: z
    .string()
    .min(1, 'Planlanan çekim tarihi gereklidir.')
    .refine(isValidDateOnly, 'Geçerli bir tarih girin.'),
  agreedAmount: z
    .number({ error: 'Anlaşılan tutar gereklidir.' })
    .gt(0, "Anlaşılan tutar 0'dan büyük olmalıdır."),
  confirmed: z.boolean(),
})

function withJobDateRules(
  schema: typeof jobFormObjectSchema,
  options: { allowPastPlannedDate: boolean },
) {
  return schema.superRefine((data, ctx) => {
    if (
      !options.allowPastPlannedDate &&
      data.plannedExecutionDate < todayDateOnlyIstanbul()
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Planlanan çekim tarihi geçmiş bir gün olamaz.',
        path: ['plannedExecutionDate'],
      })
    }

    if (compareJobSchedule(data.plannedExecutionDate, data.acquiredDate) < 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Planlanan çekim, iş alım tarihinden önce olamaz.',
        path: ['plannedExecutionDate'],
      })
    }
  })
}

/** Create: planned date cannot be in the past. */
export const jobFormSchema = withJobDateRules(jobFormObjectSchema, {
  allowPastPlannedDate: false,
})

/**
 * Edit pending job: keep acquired ≤ planned, but allow an already-submitted
 * past planned date so MPU can still fix details before konfirme.
 */
export const editJobFormSchema = withJobDateRules(jobFormObjectSchema, {
  allowPastPlannedDate: true,
})

export type JobFormValues = z.infer<typeof jobFormObjectSchema>
export type JobContactFormValues = z.infer<typeof contactSchema>

export function emptyContact(): JobContactFormValues {
  return { name: '', mobilePhone: '', workPhone: '' }
}

/** Fixed create-form dates: acquired = today (Istanbul); planned = tomorrow, skip Sunday. */
export function fixedCreateJobDates(now: Date = new Date()): {
  acquiredDate: string
  plannedExecutionDate: string
} {
  const acquiredDate = todayDateOnlyIstanbul(now)
  const planned = nextWorkdayAfter(acquiredDate)
  return {
    acquiredDate,
    plannedExecutionDate: planned.slice(0, 10),
  }
}

export function createJobFormDefaultValues(now: Date = new Date()): JobFormValues {
  const { acquiredDate, plannedExecutionDate } = fixedCreateJobDates(now)
  return {
    companyName: '',
    contacts: [emptyContact()],
    province: '',
    district: '',
    fullAddress: '',
    instagram: '',
    acquiredDate,
    plannedExecutionDate,
    agreedAmount: 0,
    confirmed: false,
  }
}
