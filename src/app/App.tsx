import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary'
import { RouteTransitionPreloader } from '@/components/layout/RouteTransitionPreloader'
import { PullToRefresh } from '@/components/ui/PullToRefresh'

export function App() {
  return (
    <AppProviders>
      <BrowserRouter useTransitions={false}>
        <AppErrorBoundary>
          <RouteTransitionPreloader />
          <PullToRefresh />
          <AppRouter />
        </AppErrorBoundary>
      </BrowserRouter>
    </AppProviders>
  )
}
