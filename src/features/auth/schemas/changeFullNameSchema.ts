import { z } from 'zod'

export const changeFullNameSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Ad soyad en az 2 karakter olmalıdır.')
    .max(120, 'Ad soyad en fazla 120 karakter olabilir.'),
})

export type ChangeFullNameFormValues = z.infer<typeof changeFullNameSchema>
