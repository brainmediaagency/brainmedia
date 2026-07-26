import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary'
import { RouteTransitionPreloader } from '@/components/layout/RouteTransitionPreloader'

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppErrorBoundary>
          <RouteTransitionPreloader />
          <AppRouter />
        </AppErrorBoundary>
      </BrowserRouter>
    </AppProviders>
  )
}
