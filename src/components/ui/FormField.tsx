import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
} from 'react'
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

  const childArray = Children.toArray(children)
  let enhancedChild: ReactNode = children

  if (childArray.length === 1 && isValidElement(childArray[0])) {
    const child = childArray[0] as ReactElement<FieldChildProps>
    // Only inject props into custom components (Input, Select, Controller…).
    // DOM tags and fragments keep structure as authored.
    enhancedChild =
      typeof child.type !== 'string'
        ? cloneElement(child, {
            id: fieldId,
            'aria-describedby': describedBy,
            ...(error ? { 'aria-invalid': true as const } : {}),
          })
        : child
  }

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
