import { AccordionSection } from '@/components/ui/AccordionSection'
import { CreateAccountForm } from '@/features/account-admin/components/CreateAccountForm'
import { AccountsList } from '@/features/account-admin/components/AccountsList'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { canSoftDeleteAccounts } from '@/features/account-admin/utils/accountPermissions'

export type AccountAdminDashboardProps = {
  /** First section number, e.g. "01" or "04" */
  startNumber?: number
}

function padSection(n: number): string {
  return String(n).padStart(2, '0')
}

export function AccountAdminDashboard({
  startNumber = 1,
}: AccountAdminDashboardProps) {
  const { profile, claims } = useAuth()
  const actorRole = claims?.role ?? profile?.role
  const canDelete = actorRole ? canSoftDeleteAccounts(actorRole) : false

  return (
    <div className="space-y-8">
      <AccordionSection
        number={padSection(startNumber)}
        title="Yeni Hesap"
        description="Yeni kullanıcı Firebase Auth ve uygulama profilinde oluşturulur."
      >
        <div className="max-w-xl">
          <CreateAccountForm />
        </div>
      </AccordionSection>

      <AccordionSection
        number={padSection(startNumber + 1)}
        title="Hesaplar"
        description={
          canDelete
            ? 'Dondurulan hesaplar giriş yapamaz. Silme soft-delete uygular. Şifre unutulursa “Şifre sıfırla” ile rastgele geçici şifre oluşturun; kullanıcı giriş sonrası üst çubuktan değiştirir.'
            : 'Dondurulan hesaplar giriş yapamaz. Şifre unutulursa “Şifre sıfırla” ile rastgele geçici şifre oluşturun; kullanıcı giriş sonrası üst çubuktan değiştirir.'
        }
      >
        <AccountsList />
      </AccordionSection>
    </div>
  )
}
