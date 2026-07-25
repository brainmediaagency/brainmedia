import { FirebaseError } from 'firebase/app'
import type { UserRole } from '@/config/roles'
import { createAuthUserOnSecondary } from '@/lib/firebase/secondaryAuth'
import {
  createUserProfileDoc,
  setUserActiveState,
  softDeleteUserProfile,
  getUserProfile,
  subscribeManagedUsers,
} from '@/features/users/services/userService'
import {
  canManageRole,
  canSoftDeleteAccounts,
  isAccountAdminRole,
} from '@/features/account-admin/utils/accountPermissions'
import { UserFacingError, mapAppError } from '@/lib/errors'

export type CreateManagedAccountInput = {
  fullName: string
  email: string
  password: string
  role: UserRole
  shiftDurationMinutes?: number | null
  actor: { uid: string; role: UserRole }
}

export async function createManagedAccount(
  input: CreateManagedAccountInput,
): Promise<{ uid: string }> {
  if (!isAccountAdminRole(input.actor.role)) {
    throw new UserFacingError('Bu işlem için yetkiniz bulunmuyor.')
  }
  if (!canManageRole(input.actor.role, input.role)) {
    throw new UserFacingError('Bu rol için hesap oluşturamazsınız.')
  }

  const email = input.email.trim().toLowerCase()
  let createdUid: string | null = null

  try {
    const user = await createAuthUserOnSecondary({
      email,
      password: input.password,
      displayName: input.fullName.trim(),
    })
    createdUid = user.uid

    await createUserProfileDoc({
      uid: user.uid,
      fullName: input.fullName,
      email,
      role: input.role,
      shiftDurationMinutes:
        input.role === 'media_planning'
          ? (input.shiftDurationMinutes ?? null)
          : null,
    })

    return { uid: user.uid }
  } catch (error) {
    if (error instanceof UserFacingError) throw error

    if (error instanceof FirebaseError) {
      if (error.code === 'auth/email-already-in-use') {
        throw new UserFacingError('Bu e-posta ile zaten bir hesap var.')
      }
      if (error.code === 'auth/invalid-email') {
        throw new UserFacingError('Geçersiz e-posta adresi.')
      }
      if (error.code === 'auth/weak-password') {
        throw new UserFacingError('Şifre çok zayıf. Daha güçlü bir şifre seçin.')
      }
    }

    throw new UserFacingError(
      mapAppError(error, 'Hesap oluşturulamadı. Lütfen tekrar deneyin.'),
    )
  } finally {
    // Auth user may exist without profile if profile write failed.
    // Soft note: hard Auth cleanup requires Admin CLI on Spark.
    void createdUid
  }
}

export async function freezeManagedAccount(
  targetUid: string,
  actor: { uid: string; role: UserRole },
): Promise<void> {
  await mutateManagedAccountActive(targetUid, actor, false)
}

export async function unfreezeManagedAccount(
  targetUid: string,
  actor: { uid: string; role: UserRole },
): Promise<void> {
  await mutateManagedAccountActive(targetUid, actor, true)
}

async function mutateManagedAccountActive(
  targetUid: string,
  actor: { uid: string; role: UserRole },
  isActive: boolean,
): Promise<void> {
  if (!isAccountAdminRole(actor.role)) {
    throw new UserFacingError('Bu işlem için yetkiniz bulunmuyor.')
  }
  if (actor.uid === targetUid) {
    throw new UserFacingError('Kendi hesabınızı donduramaz / çözemezsiniz.')
  }

  const target = await getUserProfile(targetUid)
  if (!target || target.deletedAt != null) {
    throw new UserFacingError('Kullanıcı bulunamadı.')
  }
  if (!canManageRole(actor.role, target.role)) {
    throw new UserFacingError('Bu kullanıcıyı yönetme yetkiniz yok.')
  }

  try {
    await setUserActiveState(targetUid, isActive)
  } catch (error) {
    throw new UserFacingError(
      mapAppError(
        error,
        isActive
          ? 'Hesap aktifleştirilemedi.'
          : 'Hesap dondurulamadı.',
      ),
    )
  }
}

export async function softDeleteManagedAccount(
  targetUid: string,
  actor: { uid: string; role: UserRole },
): Promise<void> {
  if (!isAccountAdminRole(actor.role) || !canSoftDeleteAccounts(actor.role)) {
    throw new UserFacingError('Bu işlem için yetkiniz bulunmuyor.')
  }
  if (actor.uid === targetUid) {
    throw new UserFacingError('Kendi hesabınızı silemezsiniz.')
  }

  const target = await getUserProfile(targetUid)
  if (!target || target.deletedAt != null) {
    throw new UserFacingError('Kullanıcı bulunamadı.')
  }
  if (!canManageRole(actor.role, target.role)) {
    throw new UserFacingError('Bu kullanıcıyı silme yetkiniz yok.')
  }

  try {
    await softDeleteUserProfile(targetUid)
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Hesap silinemedi.'))
  }
}

export { subscribeManagedUsers }
