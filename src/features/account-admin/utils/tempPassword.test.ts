import { describe, expect, it } from 'vitest'
import {
  generateTemporaryPassword,
  isValidTemporaryPasswordFormat,
} from '@/features/account-admin/utils/tempPassword'
import {
  canManageRole,
  isAccountAdminRole,
} from '@/features/account-admin/utils/accountPermissions'

describe('generateTemporaryPassword', () => {
  it('creates 10-char unambiguous passwords by default', () => {
    const password = generateTemporaryPassword()
    expect(password).toHaveLength(10)
    expect(isValidTemporaryPasswordFormat(password)).toBe(true)
  })

  it('avoids ambiguous characters', () => {
    for (let i = 0; i < 20; i += 1) {
      const password = generateTemporaryPassword(12)
      expect(password).not.toMatch(/[0O1l]/)
    }
  })
})

describe('password reset permissions', () => {
  it('allows İK to reset media_planning / reporter / HR', () => {
    expect(isAccountAdminRole('human_resources')).toBe(true)
    expect(canManageRole('human_resources', 'media_planning')).toBe(true)
    expect(canManageRole('human_resources', 'reporter')).toBe(true)
    expect(canManageRole('human_resources', 'human_resources')).toBe(true)
    expect(canManageRole('human_resources', 'management')).toBe(false)
  })
})
