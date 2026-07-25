import { z } from 'zod'
import { USER_ROLES } from '@/config/roles'

export const createAccountSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Ad soyad en az 2 karakter olmalıdır.')
    .max(120, 'Ad soyad en fazla 120 karakter olabilir.'),
  email: z.email('Geçerli bir e-posta girin.'),
  password: z
    .string()
    .min(8, 'Şifre en az 8 karakter olmalıdır.')
    .max(72, 'Şifre en fazla 72 karakter olabilir.'),
  role: z.enum(USER_ROLES),
  shiftDurationMinutes: z.string().optional(),
})

export type CreateAccountFormValues = z.infer<typeof createAccountSchema>
