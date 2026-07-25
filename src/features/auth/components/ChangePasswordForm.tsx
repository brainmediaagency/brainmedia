import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/features/auth/schemas/changePasswordSchema'
import { changePassword } from '@/features/auth/services/authService'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { mapAppError } from '@/lib/errors'

interface ChangePasswordFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function ChangePasswordForm({
  onSuccess,
  onCancel,
}: ChangePasswordFormProps) {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      reset()
      toast.success('Şifreniz güncellendi.')
      onSuccess?.()
    } catch (error) {
      toast.error(mapAppError(error, 'Şifre değiştirilemedi. Tekrar deneyin.'))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4" noValidate>
      <FormField
        label="Mevcut şifre"
        htmlFor="current-password"
        required
        error={errors.currentPassword?.message}
      >
        <div className="relative">
          <Input
            id="current-password"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            hasError={Boolean(errors.currentPassword)}
            disabled={submitting}
            className="pr-11"
            {...register('currentPassword')}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex touch-target items-center justify-center px-3 text-text-secondary hover:text-text-primary"
            aria-label={showCurrent ? 'Mevcut şifreyi gizle' : 'Mevcut şifreyi göster'}
            disabled={submitting}
          >
            {showCurrent ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </FormField>

      <FormField
        label="Yeni şifre"
        htmlFor="new-password"
        required
        error={errors.newPassword?.message}
        hint="En az 8 karakter."
      >
        <div className="relative">
          <Input
            id="new-password"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            hasError={Boolean(errors.newPassword)}
            disabled={submitting}
            className="pr-11"
            {...register('newPassword')}
          />
          <button
            type="button"
            onClick={() => setShowNew((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex touch-target items-center justify-center px-3 text-text-secondary hover:text-text-primary"
            aria-label={showNew ? 'Yeni şifreyi gizle' : 'Yeni şifreyi göster'}
            disabled={submitting}
          >
            {showNew ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </FormField>

      <FormField
        label="Yeni şifre (tekrar)"
        htmlFor="confirm-password"
        required
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          hasError={Boolean(errors.confirmPassword)}
          disabled={submitting}
          {...register('confirmPassword')}
        />
      </FormField>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Vazgeç
          </Button>
        ) : null}
        <Button
          type="submit"
          loading={submitting}
          disabled={submitting}
          className="w-full sm:w-auto"
        >
          Şifreyi güncelle
        </Button>
      </div>
    </form>
  )
}
