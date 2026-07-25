import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { APP_ROUTES } from '@/config/routes'
import { getDefaultRouteForRole } from '@/config/permissions'
import { useAuth } from '@/features/auth/hooks/useAuth'
export function UnauthorizedPage() {
  const { claims } = useAuth()
  const homePath = claims ? getDefaultRouteForRole(claims.role) : APP_ROUTES.login

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-danger/10 text-danger">
        <ShieldAlert className="size-8" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold text-text-primary">Yetkisiz Erişim</h1>
      <p className="mt-3 max-w-md text-sm text-text-secondary">
        Bu sayfaya erişim yetkiniz bulunmuyor. Erişim gerektiğini düşünüyorsanız yöneticinizle
        iletişime geçin.
      </p>
      <Link
        to={homePath}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[image:var(--gradient-primary)] px-5 text-sm font-medium text-white shadow-[0_2px_8px_-2px_rgba(6,182,212,0.5)] transition-all hover:brightness-110"
      >
        Ana sayfaya dön
      </Link>
    </div>
  )
}
