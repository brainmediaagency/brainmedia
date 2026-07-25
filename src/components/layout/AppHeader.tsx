import { useState } from 'react'
import { KeyRound, LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ChangePasswordModal } from '@/features/auth/components/ChangePasswordModal'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from '@/components/ui/RoleBadge'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { UserAvatar } from '@/components/ui/UserAvatar'

interface AppHeaderProps {
  onMenuClick: () => void
}

function firstNameOf(fullName: string): string {
  const first = fullName.trim().split(/\s+/).filter(Boolean)[0]
  return first ?? fullName
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { profile, claims, logout } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)

  const displayName = profile?.fullName ?? 'Kullanıcı'
  const shortName = firstNameOf(displayName)

  return (
    <>
      <header className="flex h-[var(--header-height)] min-w-0 max-w-full items-center gap-1.5 overflow-hidden border-b border-border bg-surface/85 px-3 sm:gap-3 sm:px-4 lg:gap-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="touch-target flex shrink-0 items-center justify-center rounded-[var(--radius-md)] text-text-primary hover:bg-surface-muted lg:hidden"
            aria-label="Menüyü aç"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm text-text-secondary">
              <span className="hidden sm:inline">Merhaba, </span>
              <span className="font-medium text-text-primary sm:hidden">
                {shortName}
              </span>
              <span className="hidden font-medium text-text-primary sm:inline">
                {displayName}
              </span>
            </p>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-0.5 sm:gap-2 md:gap-3">
          <NotificationBell />
          {claims?.role ? (
            <RoleBadge role={claims.role} className="hidden lg:inline-flex" />
          ) : null}
          <ThemeToggle className="shrink-0" />
          <UserAvatar name={displayName} size="sm" className="hidden md:inline-flex" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPasswordOpen(true)}
            aria-label="Hesap ayarları"
            className="relative z-10 shrink-0 gap-2 px-2 sm:px-3"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Hesap</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
            aria-label="Çıkış yap"
            className="relative z-10 shrink-0 gap-2 px-2 sm:px-3"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Çıkış</span>
          </Button>
        </div>
      </header>

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </>
  )
}
