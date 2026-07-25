import { useState, type ReactNode } from 'react'
import { AppFooter } from '@/components/layout/AppFooter'
import { AppHeader } from '@/components/layout/AppHeader'
import { MobileNavigation } from '@/components/layout/MobileNavigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { HrDataRetentionGuard } from '@/features/hr/components/HrDataRetentionGuard'
import { ReactionWinnerGuard } from '@/features/game/components/ReactionWinnerGuard'
import { AutoCancelPendingJobsGuard } from '@/features/jobs/components/AutoCancelPendingJobsGuard'
import { AutoForwardJobsGuard } from '@/features/jobs/components/AutoForwardJobsGuard'
import { OneSignalSubscribeBanner } from '@/features/notifications/components/OneSignalSubscribeBanner'
import { ZReportDataRetentionGuard } from '@/features/reporter/components/ZReportDataRetentionGuard'
import { VoiceDataRetentionGuard } from '@/features/voice-recording/components/VoiceDataRetentionGuard'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isOnline, claims } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen min-h-dvh max-w-full items-stretch overflow-x-clip bg-app-background">
      <Sidebar />
      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <HrDataRetentionGuard />
      <ZReportDataRetentionGuard />
      <VoiceDataRetentionGuard />
      <AutoForwardJobsGuard />
      <AutoCancelPendingJobsGuard />
      <ReactionWinnerGuard />

      <div className="flex min-h-screen min-h-dvh min-w-0 max-w-full flex-1 flex-col">
        <div className="app-top-stack sticky top-0 z-40 bg-surface/95 shadow-[var(--shadow-xs)] backdrop-blur-md">
          <OfflineBanner visible={!isOnline} />
          {claims?.role ? <OneSignalSubscribeBanner /> : null}
          <AppHeader onMenuClick={() => setMobileOpen(true)} />
        </div>

        <main className="flex-1 overflow-x-clip overflow-y-auto px-4 py-4 pb-[max(1rem,var(--safe-bottom))] sm:p-4 sm:pb-[max(1rem,var(--safe-bottom))] lg:p-6 lg:pb-[max(1.5rem,var(--safe-bottom))]">
          <div className="content-shell flex min-h-full max-w-full animate-fade-in flex-col">
            <div className="flex-1">{children}</div>
            <AppFooter />
          </div>
        </main>
      </div>
    </div>
  )
}
