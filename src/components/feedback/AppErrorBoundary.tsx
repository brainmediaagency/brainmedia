import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ErrorState } from '@/components/ui/ErrorState'
import { APP_ROUTES } from '@/config/routes'
import { getDefaultRouteForRole } from '@/config/permissions'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { mapAppError, reportClientError } from '@/lib/errors'

type BoundaryProps = {
  children: ReactNode
}

type BoundaryState = {
  error: Error | null
}

function AppErrorFallback({
  error,
  onRetry,
}: {
  error: Error
  onRetry: () => void
}) {
  const { claims } = useAuth()
  const homePath = claims ? getDefaultRouteForRole(claims.role) : APP_ROUTES.login

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <ErrorState
        title="Uygulamada bir hata oluştu"
        message={mapAppError(
          error,
          'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
        )}
        onRetry={onRetry}
        action={
          <Link
            to={homePath}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[image:var(--gradient-primary)] px-5 text-sm font-medium text-white shadow-[0_2px_8px_-2px_rgba(6,182,212,0.5)] transition-all hover:brightness-110"
          >
            Ana sayfaya dön
          </Link>
        }
        className="w-full max-w-lg"
      />
    </main>
  )
}

class AppErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error, { componentStack: info.componentStack })
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return <AppErrorFallback error={this.state.error} onRetry={this.reset} />
    }
    return this.props.children
  }
}

/**
 * The pathname key clears a previous render error when navigation succeeds,
 * without remounting global providers such as AuthProvider.
 */
export function AppErrorBoundary({ children }: BoundaryProps) {
  const { pathname } = useLocation()
  return <AppErrorBoundaryInner key={pathname}>{children}</AppErrorBoundaryInner>
}
