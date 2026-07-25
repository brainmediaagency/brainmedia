import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { AppFooter } from '@/components/layout/AppFooter'
import { APP_ROUTES } from '@/config/routes'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen min-h-dvh max-w-full flex-col items-center justify-center overflow-x-clip bg-app-background px-6 pb-[max(1.5rem,var(--safe-bottom))] pt-[max(1.5rem,var(--safe-top))]">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-8 shadow-[var(--shadow-md)]">
        <div className="mb-6">
          <BrandLogo variant="blue" className="h-7 w-auto max-w-[160px]" />
          <h1 className="mt-4 text-2xl font-semibold text-text-primary">
            Şifre yardımı
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Sistem hesapları gerçek e-posta kutusu kullanmadığı için e-posta ile
            şifre sıfırlama gönderilemez.
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="mt-6 text-center text-sm text-text-secondary">
          Hesabınız var mı?{' '}
          <Link
            to={APP_ROUTES.login}
            className="font-medium text-brand-blue hover:text-brand-cyan"
          >
            Giriş yapın
          </Link>
        </p>
      </div>
      <AppFooter className="mt-8 w-full max-w-md" />
    </div>
  )
}
