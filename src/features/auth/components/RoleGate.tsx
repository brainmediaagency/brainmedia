import type { ReactNode } from 'react'
import type { UserRole } from '@/config/roles'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface RoleGateProps {
  roles: UserRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const { claims } = useAuth()

  if (!claims || !roles.includes(claims.role)) {
    return fallback
  }

  return children
}
