import { FirebaseError } from 'firebase/app'

const GENERIC_AUTH_ERROR =
  'Giriş bilgileri doğrulanamadı. Bilgilerinizi kontrol ederek tekrar deneyin.'

export function mapAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      // Firebase returns invalid-credential for both unknown e-mail and wrong
      // password (email enumeration protection), so keep them in one message.
      case 'auth/invalid-email':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'E-posta veya şifre hatalı. Tarayıcınız eski kayıtlı şifreyi doldurmuş olabilir; şifre alanını temizleyip elle yazın.'
      case 'auth/user-disabled':
        return 'Hesabınız devre dışı bırakılmış. Yöneticinizle iletişime geçin.'
      case 'auth/too-many-requests':
        return 'Çok fazla hatalı giriş denemesi yapıldı. Birkaç dakika bekleyip tekrar deneyin.'
      case 'auth/network-request-failed':
        return 'İnternet bağlantısı bulunamadı. Bağlantınızı kontrol ederek tekrar deneyin.'
      default:
        return GENERIC_AUTH_ERROR
    }
  }
  return GENERIC_AUTH_ERROR
}

export function mapAppError(error: unknown, fallback: string): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return 'Bu işlem için yetkiniz bulunmuyor.'
      case 'unavailable':
      case 'deadline-exceeded':
        return 'Sunucuya şu an ulaşılamıyor. Lütfen tekrar deneyin.'
      case 'failed-precondition':
        return 'İşlem şu an tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyin.'
      case 'already-exists':
        return 'Bu kayıt zaten mevcut.'
      default:
        return fallback
    }
  }
  if (error instanceof Error && error.message) {
    if (error.message.startsWith('USER_')) {
      return error.message.replace(/^USER_/, '')
    }
  }
  return fallback
}

export class UserFacingError extends Error {
  constructor(message: string) {
    super(`USER_${message}`)
    this.name = 'UserFacingError'
  }
}

export function reportClientError(
  error: unknown,
  info?: { componentStack?: string | null },
): void {
  console.error('[AppErrorBoundary]', error, info?.componentStack ?? '')
}
