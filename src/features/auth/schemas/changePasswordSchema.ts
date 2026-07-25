import { z } from 'zod'

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Mevcut şifre gereklidir.'),
    newPassword: z
      .string()
      .min(8, 'Yeni şifre en az 8 karakter olmalıdır.')
      .max(72, 'Yeni şifre en fazla 72 karakter olabilir.'),
    confirmPassword: z
      .string()
      .min(1, 'Yeni şifre tekrarı gereklidir.'),
  })
  .superRefine((values, ctx) => {
    if (values.newPassword !== values.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Yeni şifreler eşleşmiyor.',
      })
    }
    if (
      values.currentPassword.length > 0
      && values.newPassword === values.currentPassword
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'Yeni şifre mevcut şifreden farklı olmalıdır.',
      })
    }
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
