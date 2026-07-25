import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  createAccountSchema,
  type CreateAccountFormValues,
} from '@/features/account-admin/schemas/createAccountSchema'
import { createManagedAccount } from '@/features/account-admin/services/accountAdminService'
import { getManageableRoles } from '@/features/account-admin/utils/accountPermissions'
import { SHOW_MESAI_UI } from '@/config/featureFlags'
import { ROLE_DISPLAY_NAMES, type UserRole } from '@/config/roles'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { mapAppError } from '@/lib/errors'

export function CreateAccountForm({ onCreated }: { onCreated?: () => void }) {
  const { profile, claims } = useAuth()
  const actorRole = claims?.role ?? profile?.role
  const [submitting, setSubmitting] = useState(false)

  const manageableRoles = actorRole ? getManageableRoles(actorRole) : []

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateAccountFormValues>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: (manageableRoles[0] ?? 'media_planning') as UserRole,
      shiftDurationMinutes: '360',
    },
  })

  const selectedRole = watch('role')

  useEffect(() => {
    if (manageableRoles.length > 0 && !manageableRoles.includes(selectedRole)) {
      reset((current) => ({
        ...current,
        role: manageableRoles[0]!,
      }))
    }
  }, [manageableRoles, selectedRole, reset])

  if (!profile || !actorRole || manageableRoles.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Hesap oluşturma yetkiniz bulunmuyor.
      </p>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const rawShift = values.shiftDurationMinutes?.trim() ?? ''
      const shift =
        values.role === 'media_planning' && rawShift
          ? Number(rawShift)
          : null

      await createManagedAccount({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role: values.role,
        shiftDurationMinutes:
          shift != null && Number.isInteger(shift) && shift > 0 ? shift : null,
        actor: { uid: profile.uid, role: actorRole },
      })

      toast.success('Hesap oluşturuldu. Kullanıcı giriş yapabilir.')
      reset({
        fullName: '',
        email: '',
        password: '',
        role: manageableRoles[0]!,
        shiftDurationMinutes: '360',
      })
      onCreated?.()
    } catch (error) {
      toast.error(mapAppError(error, 'Hesap oluşturulamadı.'))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
      <FormField label="Ad Soyad" htmlFor="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" disabled={submitting} {...register('fullName')} />
      </FormField>

      <FormField label="E-posta" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          disabled={submitting}
          {...register('email')}
        />
      </FormField>

      <FormField
        label="Geçici şifre"
        htmlFor="password"
        hint="En az 8 karakter. Kullanıcıya iletin."
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="text"
          autoComplete="new-password"
          disabled={submitting}
          {...register('password')}
        />
      </FormField>

      <FormField label="Rol" htmlFor="role" error={errors.role?.message}>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Select id="role" disabled={submitting} {...field}>
              {manageableRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_DISPLAY_NAMES[role]}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>

      {SHOW_MESAI_UI && selectedRole === 'media_planning' && (
        <FormField
          label="Mesai süresi (dakika)"
          htmlFor="shiftDurationMinutes"
          error={errors.shiftDurationMinutes?.message}
        >
          <Input
            id="shiftDurationMinutes"
            type="number"
            min={1}
            disabled={submitting}
            {...register('shiftDurationMinutes')}
          />
        </FormField>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={submitting} disabled={submitting}>
          Hesap oluştur
        </Button>
      </div>
    </form>
  )
}
