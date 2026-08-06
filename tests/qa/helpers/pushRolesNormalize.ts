/**
 * Apps Script `normalizePushRoles_` (Code.gs v23) — pure mirror for offline QA.
 * Client and webhook must stay in sync; tests fail if allowlist drops kameraman etc.
 */
import { USER_ROLES, type UserRole } from '@/config/roles'

/** Same set as scripts/sheets-webhook/Code.gs ROLES_PUSH. */
export const WEBHOOK_PUSH_ROLES: readonly UserRole[] = [
  'media_planning',
  'reporter',
  'human_resources',
  'coordinator',
  'management',
  'kameraman',
]

export function normalizePushRoles(
  rolesRaw: unknown,
  audience: unknown,
  allRoles: readonly string[] = WEBHOOK_PUSH_ROLES,
): string[] {
  const allowed = new Set(allRoles)
  if (Array.isArray(rolesRaw) && rolesRaw.length > 0) {
    const out: string[] = []
    const seen = new Set<string>()
    for (const raw of rolesRaw) {
      const role = String(raw ?? '').trim()
      if (!role || !allowed.has(role) || seen.has(role)) continue
      seen.add(role)
      out.push(role)
    }
    if (out.length > 0) return out
  }
  // audience all / null / invalid → expand to allowlist (includes kameraman)
  void audience
  return [...allRoles]
}

/** Client oneSignalPush build rules (role branch vs audience all vs externalIds). */
export function resolveClientPushTarget(input: {
  roles?: UserRole[]
  audience?: 'all'
  externalIds?: string[]
  excludeExternalIds?: string[]
}): {
  mode: 'external' | 'roles' | 'all'
  externalIds?: string[]
  roles?: UserRole[]
  audience?: 'all'
  excludeExternalIds?: string[]
} {
  const externalIds = (input.externalIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20)
  const excludeExternalIds = (input.excludeExternalIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20)

  if (externalIds.length > 0) {
    const targets = externalIds.filter((id) => !excludeExternalIds.includes(id))
    if (targets.length === 0) return { mode: 'external', externalIds: [] }
    return { mode: 'external', externalIds: targets }
  }
  if (input.roles && input.roles.length > 0) {
    return {
      mode: 'roles',
      roles: input.roles,
      excludeExternalIds:
        excludeExternalIds.length > 0 ? excludeExternalIds : undefined,
    }
  }
  return {
    mode: 'all',
    audience: input.audience ?? 'all',
    excludeExternalIds:
      excludeExternalIds.length > 0 ? excludeExternalIds : undefined,
  }
}

/** Does every user role have a OneSignal tag path? */
export function assertPushRoleAllowlistComplete(): void {
  for (const role of USER_ROLES) {
    if (!WEBHOOK_PUSH_ROLES.includes(role)) {
      throw new Error(`Push allowlist missing role: ${role}`)
    }
  }
}
