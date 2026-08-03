import type { UserRole } from '@/config/roles'

/** Roles that can open the account-admin UI and call account APIs. */
export const ACCOUNT_ADMIN_ROLES: UserRole[] = [
  'management',
  'coordinator',
  'human_resources',
]

export function isAccountAdminRole(role: UserRole): boolean {
  return ACCOUNT_ADMIN_ROLES.includes(role)
}

/** Which roles a given admin may create / freeze / soft-delete. */
export function getManageableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === 'management') {
    return [
      'media_planning',
      'reporter',
      'human_resources',
      'coordinator',
      'management',
      'kameraman',
    ]
  }
  if (actorRole === 'coordinator' || actorRole === 'human_resources') {
    return ['media_planning', 'reporter', 'human_resources']
  }
  return []
}

export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return getManageableRoles(actorRole).includes(targetRole)
}

/** Soft-delete is management/coordinator only — İK may freeze but not delete. */
export function canSoftDeleteAccounts(actorRole: UserRole): boolean {
  return actorRole === 'management' || actorRole === 'coordinator'
}
