import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'E-posta adresi gereklidir.')
    .email('Geçerli bir e-posta adresi girin.'),
  password: z
    .string()
    .min(1, 'Şifre gereklidir.')
    .min(8, 'Şifre en az 8 karakter olmalıdır.'),
  rememberMe: z.boolean(),
})

export type LoginFormValues = z.infer<typeof loginSchema>
