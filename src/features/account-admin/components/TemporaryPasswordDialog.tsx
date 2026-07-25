import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export type TemporaryPasswordDialogProps = {
  open: boolean
  onClose: () => void
  fullName: string
  email: string
  temporaryPassword: string
}

export function TemporaryPasswordDialog({
  open,
  onClose,
  fullName,
  email,
  temporaryPassword,
}: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false)

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword)
      setCopied(true)
      toast.success('Şifre panoya kopyalandı.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Kopyalanamadı. Şifreyi elle seçip kopyalayın.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Geçici şifre oluşturuldu"
      description={`${fullName} (${email}) için Firebase Auth şifresi güncellendi. Bu şifreyi kullanıcıya iletin; ekranı kapattıktan sonra tekrar gösterilmez.`}
    >
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted/60 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Geçici şifre
          </p>
          <p className="mt-2 break-all font-mono text-lg font-semibold text-text-primary">
            {temporaryPassword}
          </p>
        </div>
        <p className="text-sm text-text-secondary">
          Kullanıcı bu şifreyle giriş yaptıktan sonra üst çubuktan{' '}
          <strong>Hesap</strong> ile kendi şifresini değiştirmelidir. Eski
          oturumlar geçersiz kılınır.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Kapat
          </Button>
          <Button type="button" variant="primary" onClick={() => void copyPassword()}>
            {copied ? 'Kopyalandı' : 'Şifreyi kopyala'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
