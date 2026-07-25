import type { AuthClaims, UserProfile } from '@/features/users/types/user'

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
}

export interface AuthSession {
  user: AuthUser
  profile: UserProfile
  claims: AuthClaims
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe: boolean
}
