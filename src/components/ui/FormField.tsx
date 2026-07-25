import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from 'react'
import { cn } from '@/lib/classNames'

type FieldChildProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export type FormFieldProps = {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId()
  const fieldId = htmlFor ?? generatedId
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const child = Children.only(children)
  const enhancedChild =
    isValidElement(child) && typeof child.type !== 'string'
      ? cloneElement(child as ReactElement<FieldChildProps>, {
          id: fieldId,
          'aria-describedby': describedBy,
          ...(error ? { 'aria-invalid': true } : {}),
        })
      : child

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (zorunlu)</span>}
      </label>
      {enhancedChild}
      {hint && !error && (
        <p id={hintId} className="text-xs leading-snug text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
