import type { ReactNode } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/classNames'

export type EditableDetailRowProps = {
  label: string
  displayValue: string
  canEdit: boolean
  isEditing: boolean
  saving: boolean
  error?: string | null
  onStartEdit: () => void
  onCancel: () => void
  onSave: () => void
  children?: ReactNode
  className?: string
}

export function EditableDetailRow({
  label,
  displayValue,
  canEdit,
  isEditing,
  saving,
  error,
  onStartEdit,
  onCancel,
  onSave,
  children,
  className,
}: EditableDetailRowProps) {
  if (isEditing) {
    return (
      <div className={cn('space-y-2 border-b border-border py-3 last:border-b-0', className)}>
        <dt className="text-sm text-text-secondary">{label}</dt>
        <dd className="space-y-2">
          {children}
          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={onCancel}
              aria-label="İptal"
            >
              <X className="size-3.5" aria-hidden />
              İptal
            </Button>
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={saving}
              onClick={() => void onSave()}
              aria-label="Kaydet"
            >
              <Check className="size-3.5" aria-hidden />
              Kaydet
            </Button>
          </div>
        </dd>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3',
        className,
      )}
    >
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="flex items-start justify-between gap-2 sm:justify-end">
        <span className="text-sm font-medium text-text-primary sm:text-right">
          {displayValue}
        </span>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-text-secondary"
            aria-label={`${label} düzenle`}
            onClick={onStartEdit}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
        )}
      </dd>
    </div>
  )
}
