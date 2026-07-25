import { z } from 'zod'
import { parseTryInput } from '@/lib/currency'
import { VAT_RATES } from '@/features/reporter/utils/feeCalc'

function optionalMoneyTryField() {
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === '') return
      const parsed = parseTryInput(value)
      if (parsed === null) {
        ctx.addIssue({ code: 'custom', message: 'Geçerli bir tutar girin.' })
        return
      }
      if (parsed < 0) {
        ctx.addIssue({ code: 'custom', message: 'Tutar 0 veya daha büyük olmalı.' })
      }
    })
}

const companySchema = z
  .object({
    /** Seçilen işin Firestore `jobs` doc id'si — dropdown'dan zorunlu. */
    jobId: z.string().trim().min(1, 'Firma seçin.'),
    /** Seçilen işten snapshot; kullanıcı yazmaz. */
    companyName: z.string().trim().min(1, 'Firma seçin.').max(120),
    hasNews: z.boolean(),
    newsTotalTry: z.string(),
    /** +KDV = KDV hesapla; Nakit = KDV yok. */
    chargeMode: z.enum(['vat', 'cash']),
    shootMinutes: z
      .string()
      .trim()
      .min(1, 'Çekim dakikası zorunlu.')
      .refine((v) => /^\d+$/.test(v), 'Çekim dakikası tam sayı olmalı.')
      .refine((v) => {
        const n = Number(v)
        return n >= 0 && n <= 24 * 60
      }, 'Dakika 0–1440 arasında olmalı.'),
    vatRate: z.union([z.literal(14), z.literal(17), z.literal(20)]),
  })
  .superRefine((value, ctx) => {
    if (value.hasNews) {
      const trimmed = value.newsTotalTry.trim()
      if (trimmed === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['newsTotalTry'],
          message: 'Haber toplam tutarı zorunlu (0 kabul).',
        })
        return
      }
      const parsed = parseTryInput(trimmed)
      if (parsed === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['newsTotalTry'],
          message: 'Geçerli bir tutar girin.',
        })
      } else if (parsed < 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['newsTotalTry'],
          message: 'Haber tutarı 0 veya daha büyük olmalı.',
        })
      }
    }
    if (value.chargeMode === 'vat' && !VAT_RATES.includes(value.vatRate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['vatRate'],
        message: 'KDV oranı seçin (%14, %17 veya %20).',
      })
    }
  })

export const dailyReportSchema = z.object({
  reportDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Rapor tarihi seçin.'),
  companies: z
    .array(companySchema)
    .min(1, 'En az bir firma gerekli.')
    .max(10)
    .superRefine((companies, ctx) => {
      const seen = new Map<string, number>()
      companies.forEach((company, index) => {
        const jobId = company.jobId.trim()
        if (!jobId) return
        if (seen.has(jobId)) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'jobId'],
            message: 'Aynı firma bir raporda yalnızca bir kez seçilebilir.',
          })
        } else {
          seen.set(jobId, index)
        }
      })
    }),
  note: z.string().trim().max(10000),
  hotelExpenseTry: optionalMoneyTryField(),
  stationeryExpenseTry: optionalMoneyTryField(),
  fuelExpenseTry: optionalMoneyTryField(),
  extraExpenseTry: optionalMoneyTryField(),
  /** Boş bırakılırsa 0 kabul edilir. */
  fieldPaidTry: optionalMoneyTryField(),
})

export type DailyReportFormValues = z.infer<typeof dailyReportSchema>
