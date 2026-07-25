import { Navigate, Route, Routes } from 'react-router-dom'
import { APP_ROUTES } from '@/config/routes'
import { getDefaultRouteForRole } from '@/config/permissions'
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { LoginPage } from '@/pages/LoginPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { MediaPlanningPage } from '@/pages/MediaPlanningPage'
import { CoordinatorPage } from '@/pages/CoordinatorPage'
import { HumanResourcesPage } from '@/pages/HumanResourcesPage'
import { ManagementPage } from '@/pages/ManagementPage'
import { ReporterPage } from '@/pages/ReporterPage'
import { NewsSitesPage } from '@/pages/NewsSitesPage'
import { GamePage } from '@/pages/GamePage'

function RootRedirect() {
  const { user, claims, loading } = useAuth()

  if (loading) {
    return <LoadingScreen message="Yönlendiriliyor…" />
  }

  if (!user || !claims) {
    return <Navigate to={APP_ROUTES.login} replace />
  }

  return <Navigate to={getDefaultRouteForRole(claims.role)} replace />
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path={APP_ROUTES.login} element={<LoginPage />} />
      <Route path={APP_ROUTES.forgotPassword} element={<ForgotPasswordPage />} />

      <Route
        path={APP_ROUTES.unauthorized}
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <UnauthorizedPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={APP_ROUTES.mediaPlanning}
        element={
          <ProtectedRoute routeKey="media-planning">
            <AuthenticatedLayout>
              <MediaPlanningPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={APP_ROUTES.reporter}
        element={
          <ProtectedRoute routeKey="reporter">
            <AuthenticatedLayout>
              <ReporterPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={APP_ROUTES.humanResources}
        element={
          <ProtectedRoute routeKey="human-resources">
            <AuthenticatedLayout>
              <HumanResourcesPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={APP_ROUTES.coordinator}
        element={
          <ProtectedRoute routeKey="coordinator">
            <AuthenticatedLayout>
              <CoordinatorPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={APP_ROUTES.management}
        element={
          <ProtectedRoute routeKey="management">
            <AuthenticatedLayout>
              <ManagementPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={APP_ROUTES.newsSites}
        element={
          <ProtectedRoute routeKey="news-sites">
            <AuthenticatedLayout>
              <NewsSitesPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={APP_ROUTES.game}
        element={
          <ProtectedRoute routeKey="game">
            <AuthenticatedLayout>
              <GamePage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
