import { Navigate } from 'react-router-dom'
import { brandConfig } from '@/config/brand'
import { getDefaultRouteForRole } from '@/config/permissions'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { AppFooter } from '@/components/layout/AppFooter'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

function BrandPanel() {
  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-[image:var(--gradient-sidebar)] px-8 pb-8 pt-[max(2rem,calc(var(--safe-top)+1rem))] text-white lg:p-12 lg:pt-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-16 top-12 size-48 rotate-12 rounded-3xl bg-brand-cyan/25 blur-2xl" />
        <div className="absolute right-8 top-24 size-32 rounded-full bg-brand-pink/30 blur-xl" />
        <div className="absolute bottom-16 left-1/3 size-56 -rotate-6 rounded-[2rem] bg-brand-blue/25 blur-2xl" />
        <div className="absolute -bottom-10 right-0 size-40 rounded-full bg-brand-orange/20 blur-xl" />
      </div>

      <div className="relative z-10">
        <BrandLogo variant="white" className="h-9 w-auto max-w-[200px] sm:h-10 sm:max-w-[240px]" />
        <p className="mt-2 text-sm text-white/65">{brandConfig.companyName}</p>
      </div>

      <div className="relative z-10 mt-10 max-w-md">
        <h1 className="text-3xl font-semibold leading-tight lg:text-4xl">
          Operasyonlarınızı tek merkezden yönetin
        </h1>
        <p className="mt-4 text-base text-white/75">{brandConfig.tagline}</p>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { user, claims, loading } = useAuth()

  if (loading) {
    return <LoadingScreen message="Oturum kontrol ediliyor…" />
  }

  if (user && claims) {
    return <Navigate to={getDefaultRouteForRole(claims.role)} replace />
  }

  return (
    <div className="flex min-h-screen min-h-dvh max-w-full flex-col overflow-x-clip lg:flex-row">
      <BrandPanel />

      <div className="relative flex flex-1 items-center justify-center bg-surface px-6 pb-[max(1.5rem,var(--safe-bottom))] pt-6 lg:p-12">
        <div className="absolute right-[max(1rem,var(--safe-right))] top-[max(1rem,var(--safe-top))] lg:right-6 lg:top-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <h1 className="text-2xl font-semibold text-text-primary">Giriş Yap</h1>
            <p className="mt-2 text-sm text-text-secondary">
              {brandConfig.productName} hesabınızla devam edin.
            </p>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-2xl font-semibold text-text-primary">Giriş Yap</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Kurumsal hesabınızla oturum açın.
            </p>
          </div>

          <div className="mt-8">
            <LoginForm />
          </div>

          <AppFooter className="mt-12 border-border/70" />
        </div>
      </div>
    </div>
  )
}
