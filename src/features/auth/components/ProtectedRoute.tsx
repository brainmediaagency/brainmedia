import { Navigate, useLocation } from 'react-router-dom'
import type { AppRouteKey } from '@/config/permissions'
import { canAccessRoute, getDefaultRouteForRole } from '@/config/permissions'
import { APP_ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

interface ProtectedRouteProps {
  routeKey?: AppRouteKey
  children: React.ReactNode
}

export function ProtectedRoute({ routeKey, children }: ProtectedRouteProps) {
  const { user, claims, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen message="Oturum doğrulanıyor…" />
  }

  if (!user || !claims) {
    return <Navigate to={APP_ROUTES.login} state={{ from: location }} replace />
  }

  if (routeKey && !canAccessRoute(claims.role, routeKey)) {
    const fallbackPath = getDefaultRouteForRole(claims.role)

    if (location.pathname === fallbackPath) {
      return <Navigate to={APP_ROUTES.unauthorized} replace />
    }

    return <Navigate to={fallbackPath} replace />
  }

  return children
}
