import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary'

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppErrorBoundary>
          <AppRouter />
        </AppErrorBoundary>
      </BrowserRouter>
    </AppProviders>
  )
}
