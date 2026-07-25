import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { UserProfile } from '@/features/users/types/user'
import {
  freezeManagedAccount,
  softDeleteManagedAccount,
  subscribeManagedUsers,
  unfreezeManagedAccount,
} from '@/features/account-admin/services/accountAdminService'
import { canSoftDeleteAccounts } from '@/features/account-admin/utils/accountPermissions'
import { ROLE_DISPLAY_NAMES } from '@/config/roles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { mapAppError } from '@/lib/errors'

export function AccountsList() {
  const { profile, claims } = useAuth()
  const actorRole = claims?.role ?? profile?.role
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (!actorRole) {
      setUsers([])
      setLoading(false)
      return
    }

    setLoading(true)
    return subscribeManagedUsers(
      actorRole,
      (next) => {
        setUsers(next)
        setLoading(false)
      },
      () => {
        setLoading(false)
        toast.error('Kullanıcı listesi yüklenemedi.')
      },
    )
  }, [actorRole])

  if (!profile || !actorRole) return null

  const actor = { uid: profile.uid, role: actorRole }
  const canDelete = canSoftDeleteAccounts(actorRole)

  const runAction = async (
    uid: string,
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    setBusyUid(uid)
    try {
      await action()
      toast.success(successMessage)
    } catch (error) {
      toast.error(mapAppError(error, 'İşlem başarısız.'))
    } finally {
      setBusyUid(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title="Kullanıcı yok"
        description="Henüz yönetilebilir bir hesap bulunmuyor."
      />
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell header>Ad Soyad</TableCell>
              <TableCell header>E-posta</TableCell>
              <TableCell header>Rol</TableCell>
              <TableCell header>Durum</TableCell>
              <TableCell header>İşlem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.uid === profile.uid
              const busy = busyUid === user.uid
              return (
                <TableRow key={user.uid}>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{ROLE_DISPLAY_NAMES[user.role]}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={user.isActive ? 'active' : 'rejected'}
                      label={user.isActive ? 'Aktif' : 'Dondurulmuş'}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {!isSelf && (
                        <>
                          {user.isActive ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              loading={busy}
                              disabled={busy}
                              onClick={() =>
                                void runAction(
                                  user.uid,
                                  () => freezeManagedAccount(user.uid, actor),
                                  'Hesap donduruldu.',
                                )
                              }
                            >
                              Dondur
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              loading={busy}
                              disabled={busy}
                              onClick={() =>
                                void runAction(
                                  user.uid,
                                  () => unfreezeManagedAccount(user.uid, actor),
                                  'Hesap aktifleştirildi.',
                                )
                              }
                            >
                              Aktifleştir
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() => setDeleteTarget(user)}
                            >
                              Sil
                            </Button>
                          )}
                        </>
                      )}
                      {isSelf && (
                        <span className="text-xs text-text-secondary">Sizin hesabınız</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {users.map((user) => {
          const isSelf = user.uid === profile.uid
          const busy = busyUid === user.uid
          return (
            <MobileDataCard
              key={user.uid}
              title={user.fullName}
              subtitle={user.email}
              badge={
                <StatusBadge
                  status={user.isActive ? 'active' : 'rejected'}
                  label={user.isActive ? 'Aktif' : 'Dondurulmuş'}
                />
              }
              rows={[{ label: 'Rol', value: ROLE_DISPLAY_NAMES[user.role] }]}
              footer={
                isSelf ? (
                  <p className="text-xs text-text-secondary">Sizin hesabınız</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {user.isActive ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        loading={busy}
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            user.uid,
                            () => freezeManagedAccount(user.uid, actor),
                            'Hesap donduruldu.',
                          )
                        }
                      >
                        Dondur
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        loading={busy}
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            user.uid,
                            () => unfreezeManagedAccount(user.uid, actor),
                            'Hesap aktifleştirildi.',
                          )
                        }
                      >
                        Aktifleştir
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        className="w-full"
                        disabled={busy}
                        onClick={() => setDeleteTarget(user)}
                      >
                        Sil
                      </Button>
                    )}
                  </div>
                )
              }
            />
          )
        })}
      </div>

      {canDelete && (
        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          title="Hesabı sil"
          description={
            deleteTarget
              ? `${deleteTarget.fullName} (${deleteTarget.email}) hesabı silinsin mi? Kullanıcı giriş yapamaz. Bu işlem soft-delete’tir.`
              : undefined
          }
          confirmLabel="Sil"
          destructive
          loading={busyUid === deleteTarget?.uid}
          onConfirm={() => {
            if (!deleteTarget) return
            void runAction(
              deleteTarget.uid,
              () => softDeleteManagedAccount(deleteTarget.uid, actor),
              'Hesap silindi.',
            ).then(() => setDeleteTarget(null))
          }}
        />
      )}
    </>
  )
}
