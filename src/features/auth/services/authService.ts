import { FirebaseError } from 'firebase/app'
import {
  EmailAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import { isUserRole } from '@/config/roles'
import { getUserProfile } from '@/features/users/services/userService'
import type { AuthClaims } from '@/features/users/types/user'
import type { AuthSession, AuthUser, LoginCredentials } from '@/features/auth/types/auth'
import { getFirebaseAuth } from '@/lib/firebase/auth'
import { mapAuthError, UserFacingError } from '@/lib/errors'

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  }
}

/**
 * Session authority is the Firestore profile (Spark-compatible provisioning).
 * Custom claims remain optional compatibility signals for legacy accounts.
 */
export async function loadAuthSession(user: User): Promise<AuthSession> {
  const profile = await getUserProfile(user.uid)
  if (!profile) {
    throw new UserFacingError(
      'Kullanıcı profili bulunamadı. Yöneticinizle iletişime geçin.',
    )
  }

  if (profile.deletedAt != null) {
    throw new UserFacingError(
      'Hesabınız silinmiş. Destek ekibiyle iletişime geçin.',
    )
  }

  if (!profile.isActive) {
    throw new UserFacingError(
      'Hesabınız dondurulmuş. Destek ekibiyle iletişime geçin.',
    )
  }

  if (!isUserRole(profile.role)) {
    throw new UserFacingError(
      'Hesabınıza tanımlı rol geçersiz. Yöneticinizle iletişime geçin.',
    )
  }

  // Legacy claim freeze (Admin SDK / scripts) still honored when present.
  const tokenResult = await user.getIdTokenResult(true)
  if (tokenResult.claims.active === false) {
    throw new UserFacingError(
      'Hesabınız şu anda aktif değil. Destek ekibiyle iletişime geçin.',
    )
  }

  const claims: AuthClaims = {
    role: profile.role,
    active: true,
    emailVerified: user.emailVerified,
  }

  return {
    user: toAuthUser(user),
    profile,
    claims,
  }
}

async function signOutSilently(): Promise<void> {
  try {
    await signOut(getFirebaseAuth())
  } catch {
    // Ignore sign-out errors during cleanup
  }
}

export async function loginWithEmail(
  credentials: LoginCredentials,
): Promise<AuthSession> {
  const auth = getFirebaseAuth()

  try {
    await setPersistence(
      auth,
      credentials.rememberMe ? browserLocalPersistence : browserSessionPersistence,
    )
    const credential = await signInWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password,
    )
    return await loadAuthSession(credential.user)
  } catch (error) {
    await signOutSilently()

    if (error instanceof UserFacingError) {
      throw error
    }

    throw new UserFacingError(withAuthErrorCode(mapAuthError(error), error))
  }
}

/**
 * Support hint: 400 alone cannot separate a wrong password from Google's
 * temporary IP lockout, so the raw code is surfaced on the login screen.
 */
function withAuthErrorCode(message: string, error: unknown): string {
  if (error instanceof FirebaseError && error.code.startsWith('auth/')) {
    return `${message} (${error.code.replace('auth/', '')})`
  }
  return message
}

/**
 * In-app password change for internal @brain.com-style logins.
 * Email reset is not used — those addresses have no real inbox.
 */
export async function changePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user?.email) {
    throw new UserFacingError(
      'Oturum bulunamadı. Çıkış yapıp tekrar giriş yapın.',
    )
  }

  try {
    const credential = EmailAuthProvider.credential(
      user.email,
      input.currentPassword,
    )
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, input.newPassword)
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapPasswordChangeError(error))
  }
}

function mapPasswordChangeError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code)
    switch (code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Mevcut şifre yanlış.'
      case 'auth/weak-password':
        return 'Yeni şifre çok zayıf. Daha güçlü bir şifre seçin.'
      case 'auth/requires-recent-login':
        return 'Güvenlik için çıkış yapıp tekrar giriş yaptıktan sonra deneyin.'
      case 'auth/too-many-requests':
        return 'Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.'
      case 'auth/network-request-failed':
        return 'İnternet bağlantısı bulunamadı. Bağlantınızı kontrol ederek tekrar deneyin.'
      default:
        break
    }
  }
  return mapAuthError(error)
}

export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth())
}
