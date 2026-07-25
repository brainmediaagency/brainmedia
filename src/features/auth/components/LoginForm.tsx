import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { APP_ROUTES } from '@/config/routes'
import {
  loginSchema,
  type LoginFormValues,
} from '@/features/auth/schemas/loginSchema'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { mapAppError } from '@/lib/errors'

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      await login({
        email: values.email.trim(),
        password: values.password,
        rememberMe: values.rememberMe,
      })
      onSuccess?.()
    } catch (error) {
      toast.error(
        mapAppError(
          error,
          'Giriş bilgileri doğrulanamadı. Bilgilerinizi kontrol ederek tekrar deneyin.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5" noValidate>
      <FormField
        label="E-posta"
        htmlFor="email"
        required
        error={errors.email?.message}
      >
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ornek@brain.com"
          hasError={Boolean(errors.email)}
          disabled={submitting}
          {...register('email')}
        />
      </FormField>

      <FormField
        label="Şifre"
        htmlFor="password"
        required
        error={errors.password?.message}
      >
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            hasError={Boolean(errors.password)}
            disabled={submitting}
            className="pr-11"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex touch-target items-center justify-center px-3 text-text-secondary hover:text-text-primary"
            aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            disabled={submitting}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </FormField>

      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="size-4 rounded border-border text-brand-cyan focus:ring-brand-cyan"
            disabled={submitting}
            {...register('rememberMe')}
          />
          Beni hatırla
        </label>
        <Link
          to={APP_ROUTES.forgotPassword}
          className="text-sm font-medium text-brand-blue hover:text-brand-cyan"
        >
          Şifre yardımı
        </Link>
      </div>

      <Button type="submit" loading={submitting} disabled={submitting} className="w-full">
        Giriş Yap
      </Button>
    </form>
  )
}
