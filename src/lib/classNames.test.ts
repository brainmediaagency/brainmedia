import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/classNames'

describe('cn', () => {
  it('resolves conflicting Tailwind display utilities', () => {
    expect(cn('inline-flex items-center', 'hidden lg:inline-flex')).toBe(
      'items-center hidden lg:inline-flex',
    )
  })

  it('keeps non-conflicting classes', () => {
    expect(cn('px-2', 'py-1', 'text-sm')).toBe('px-2 py-1 text-sm')
  })
})
