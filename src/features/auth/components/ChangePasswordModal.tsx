import { ChangeFullNameForm } from '@/features/auth/components/ChangeFullNameForm'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { Modal } from '@/components/ui/Modal'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
}

/** Account self-service: display name + password (no email reset). */
export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hesabım"
      description="Ad soyadınızı güncelleyin veya şifrenizi değiştirin."
      className="max-w-lg"
    >
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Ad soyad</h3>
          <ChangeFullNameForm />
        </section>

        <div className="border-t border-border" />

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Şifre</h3>
          <p className="text-xs text-text-secondary">
            Mevcut şifrenizi girin, ardından yenisini belirleyin. E-posta ile
            sıfırlama kullanılmaz.
          </p>
          <ChangePasswordForm onSuccess={onClose} onCancel={onClose} />
        </section>
      </div>
    </Modal>
  )
}
