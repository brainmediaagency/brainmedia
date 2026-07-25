import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateProfile } from 'firebase/auth'
import { toast } from 'sonner'
import {
  changeFullNameSchema,
  type ChangeFullNameFormValues,
} from '@/features/auth/schemas/changeFullNameSchema'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { updateOwnFullName } from '@/features/users/services/userService'
import { getFirebaseAuth } from '@/lib/firebase/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { mapAppError } from '@/lib/errors'

interface ChangeFullNameFormProps {
  onSuccess?: () => void
}

export function ChangeFullNameForm({ onSuccess }: ChangeFullNameFormProps) {
  const { profile, refresh } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ChangeFullNameFormValues>({
    resolver: zodResolver(changeFullNameSchema),
    defaultValues: { fullName: profile?.fullName ?? '' },
  })

  useEffect(() => {
    reset({ fullName: profile?.fullName ?? '' })
  }, [profile?.fullName, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!profile?.uid) return
    setSubmitting(true)
    try {
      await updateOwnFullName(profile.uid, values.fullName)
      const authUser = getFirebaseAuth().currentUser
      if (authUser) {
        try {
          await updateProfile(authUser, { displayName: values.fullName.trim() })
        } catch {
          // Firestore is source of truth; Auth displayName is best-effort.
        }
      }
      await refresh()
      toast.success('Ad soyad güncellendi.')
      onSuccess?.()
    } catch (error) {
      toast.error(mapAppError(error, 'Ad soyad güncellenemedi.'))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4" noValidate>
      <FormField
        label="Ad soyad"
        htmlFor="profile-full-name"
        required
        error={errors.fullName?.message}
        hint="Rapor ve iş kayıtlarında görünen adınız."
      >
        <Input
          id="profile-full-name"
          autoComplete="name"
          hasError={Boolean(errors.fullName)}
          disabled={submitting}
          {...register('fullName')}
        />
      </FormField>

      <Button
        type="submit"
        loading={submitting}
        disabled={submitting || !isDirty}
        className="w-full sm:w-auto sm:self-end"
      >
        Adı kaydet
      </Button>
    </form>
  )
}
