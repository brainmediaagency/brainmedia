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
  it('allows management to create şef accounts', () => {
    expect(canManageRole('management', 'sef')).toBe(true)
    expect(canManageRole('coordinator', 'sef')).toBe(false)
    expect(canManageRole('human_resources', 'sef')).toBe(false)
  })
})
