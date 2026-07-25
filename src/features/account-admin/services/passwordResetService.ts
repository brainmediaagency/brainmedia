import type { UserRole } from '@/config/roles'
import {
  canManageRole,
  isAccountAdminRole,
} from '@/features/account-admin/utils/accountPermissions'
import { getUserProfile } from '@/features/users/services/userService'
import {
  getSheetsWebhookUrl,
  getWebhookIdToken,
  isSheetsWebhookConfigured,
  isSheetsWebhookVersionStale,
} from '@/lib/sheetsWebhook'
import { UserFacingError, mapAppError } from '@/lib/errors'

export type ResetManagedPasswordResult = {
  targetUid: string
  email: string
  temporaryPassword: string
}

/**
 * Ask Apps Script (v19+) to set a new random Auth password for a managed user.
 * Requires Script property FIREBASE_SERVICE_ACCOUNT_JSON on the webhook.
 */
export async function resetManagedAccountPassword(
  targetUid: string,
  actor: { uid: string; role: UserRole },
): Promise<ResetManagedPasswordResult> {
  if (!isAccountAdminRole(actor.role)) {
    throw new UserFacingError('Bu işlem için yetkiniz bulunmuyor.')
  }
  if (actor.uid === targetUid) {
    throw new UserFacingError(
      'Kendi şifrenizi buradan sıfırlayamazsınız. Üst çubuktan Hesap → Şifre değiştirin.',
    )
  }

  const target = await getUserProfile(targetUid)
  if (!target || target.deletedAt != null) {
    throw new UserFacingError('Kullanıcı bulunamadı.')
  }
  if (!canManageRole(actor.role, target.role)) {
    throw new UserFacingError('Bu kullanıcının şifresini sıfırlama yetkiniz yok.')
  }
  if (!target.isActive) {
    throw new UserFacingError(
      'Dondurulmuş hesabın şifresi sıfırlanamaz. Önce hesabı aktifleştirin.',
    )
  }

  if (!isSheetsWebhookConfigured()) {
    throw new UserFacingError(
      'Şifre sıfırlama için Sheets webhook yapılandırılmamış (VITE_SHEETS_WEBHOOK_URL).',
    )
  }

  const url = getSheetsWebhookUrl()
  if (!url) {
    throw new UserFacingError('Sheets webhook URL bulunamadı.')
  }

  try {
    const idToken = await getWebhookIdToken()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'resetUserPassword',
        targetUid,
        idToken,
      }),
    })
    const text = await response.text()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = null
    }

    if (parsed && parsed.ok === true) {
      const temporaryPassword = String(parsed.temporaryPassword ?? '').trim()
      if (temporaryPassword.length < 8) {
        throw new UserFacingError(
          'Webhook geçici şifre döndürmedi. Apps Script v19+ ve FIREBASE_SERVICE_ACCOUNT_JSON kontrol edin.',
        )
      }
      return {
        targetUid: String(parsed.targetUid ?? targetUid),
        email: String(parsed.email ?? target.email),
        temporaryPassword,
      }
    }

    const err =
      parsed && typeof parsed.error === 'string' ? parsed.error : text
    const detail =
      parsed && typeof parsed.detail === 'string' ? parsed.detail : ''
    const combined = [err, detail].filter(Boolean).join(' — ')

    if (/FIREBASE_SERVICE_ACCOUNT_JSON/i.test(combined)) {
      throw new UserFacingError(
        'Şifre sıfırlama için Apps Script’e FIREBASE_SERVICE_ACCOUNT_JSON ekleyip New version yayınlayın.',
      )
    }
    if (/stale|unknown action|resetUserPassword/i.test(combined)) {
      throw new UserFacingError(
        'Webhook eski sürümde. Code.gs v19’u yapıştırıp New version yayınlayın.',
      )
    }
    if (/forbidden/i.test(combined)) {
      throw new UserFacingError('Bu kullanıcının şifresini sıfırlama yetkiniz yok.')
    }
    if (/unauthorized/i.test(combined)) {
      throw new UserFacingError(
        'Oturum doğrulanamadı. Çıkış yapıp tekrar giriş yaptıktan sonra deneyin.',
      )
    }
    if (combined.trim()) {
      throw new UserFacingError(`Şifre sıfırlanamadı: ${combined}`)
    }
    throw new UserFacingError('Şifre sıfırlanamadı.')
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(
      mapAppError(error, 'Şifre sıfırlanamadı. Bağlantıyı kontrol edip tekrar deneyin.'),
    )
  }
}

/** Optional preflight — soft check that webhook advertises resetUserPassword. */
export async function isPasswordResetWebhookReady(): Promise<boolean> {
  const url = getSheetsWebhookUrl()
  if (!url) return false
  try {
    const response = await fetch(url, { method: 'GET' })
    const text = await response.text()
    const parsed = JSON.parse(text) as {
      ok?: boolean
      service?: string
      version?: string
      features?: string[]
    }
    if (isSheetsWebhookVersionStale(parsed)) return false
    return parsed.features?.includes('resetUserPassword') === true
  } catch {
    return false
  }
}
