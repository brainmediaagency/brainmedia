import { Link } from 'react-router-dom'
import { APP_ROUTES } from '@/config/routes'

/**
 * Internal @brain.com logins have no real inbox — no Firebase email reset.
 * Self-service: Hesap (name + password) while logged in.
 * Locked out: İK / yönetim / koordinatör “Şifre sıfırla” ile geçici şifre verir.
 */
export function ForgotPasswordForm() {
  return (
    <div className="flex flex-col gap-4 text-sm text-text-secondary">
      <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted/60 px-4 py-3">
        <p className="font-medium text-text-primary">Şifrenizi biliyor musunuz?</p>
        <p className="mt-1">
          Giriş yaptıktan sonra üst çubuktaki <strong>Hesap</strong> ile ad
          soyadınızı ve şifrenizi kendiniz güncelleyebilirsiniz.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted/60 px-4 py-3">
        <p className="font-medium text-text-primary">Şifrenizi unuttunuz mu?</p>
        <p className="mt-1">
          İnsan kaynakları, yönetim veya koordinatörden geçici şifre isteyin
          (Hesaplar → Şifre sıfırla). Size iletilen şifreyle giriş yaptıktan
          sonra hemen üst çubuktan değiştirin.
        </p>
      </div>

      <Link
        to={APP_ROUTES.login}
        className="text-center text-sm font-medium text-brand-blue hover:text-brand-cyan"
      >
        Giriş sayfasına dön
      </Link>
    </div>
  )
}
