import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { toast } from 'sonner'
import type { AuthSession, AuthUser, LoginCredentials } from '@/features/auth/types/auth'
import {
  loadAuthSession,
  loginWithEmail,
  logout as authLogout,
} from '@/features/auth/services/authService'
import { useIdleSessionTimeout } from '@/features/auth/hooks/useIdleSessionTimeout'
import type { AuthClaims, UserProfile } from '@/features/users/types/user'
import { subscribeUserProfile } from '@/features/users/services/userService'
import { getFirebaseAuth } from '@/lib/firebase/auth'
import { logoutOneSignal } from '@/lib/onesignal'
import { UserFacingError } from '@/lib/errors'

interface AuthContextValue {
  user: AuthUser | null
  profile: UserProfile | null
  claims: AuthClaims | null
  loading: boolean
  isOnline: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [claims, setClaims] = useState<AuthClaims | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const forcedLogoutRef = useRef(false)

  const applySession = useCallback((session: AuthSession | null) => {
    if (!session) {
      setUser(null)
      setProfile(null)
      setClaims(null)
      return
    }

    setUser(session.user)
    setProfile(session.profile)
    setClaims(session.claims)
  }, [])

  const refresh = useCallback(async () => {
    const firebaseUser = getFirebaseAuth().currentUser
    if (!firebaseUser) {
      applySession(null)
      return
    }

    try {
      const session = await loadAuthSession(firebaseUser)
      applySession(session)
    } catch (error) {
      await authLogout()
      applySession(null)
      if (error instanceof UserFacingError) {
        throw error
      }
      throw error
    }
  }, [applySession])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (!firebaseUser) {
        applySession(null)
        setLoading(false)
        return
      }

      try {
        const session = await loadAuthSession(firebaseUser)
        applySession(session)
      } catch {
        await authLogout()
        applySession(null)
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [applySession])

  // Mid-session freeze / soft-delete: logout if profile becomes inactive.
  useEffect(() => {
    if (!user?.uid || loading) return

    forcedLogoutRef.current = false
    const uid = user.uid

    return subscribeUserProfile(uid, async (nextProfile) => {
      if (forcedLogoutRef.current) return
      if (!nextProfile) return

      const frozen = nextProfile.isActive === false
      const deleted = nextProfile.deletedAt != null
      if (!frozen && !deleted) {
        setProfile(nextProfile)
        return
      }

      forcedLogoutRef.current = true
      toast.error(
        deleted
          ? 'Hesabınız silindi. Oturumunuz sonlandırıldı.'
          : 'Hesabınız donduruldu. Oturumunuz sonlandırıldı.',
      )
      try {
        await logoutOneSignal()
        await authLogout()
      } finally {
        applySession(null)
      }
    })
  }, [user?.uid, loading, applySession])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const session = await loginWithEmail(credentials)
      applySession(session)
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    await logoutOneSignal()
    await authLogout()
    applySession(null)
  }, [applySession])

  const handleIdleTimeout = useCallback(async () => {
    toast.info('Oturumunuz hareketsizlik nedeniyle sonlandırıldı.')
    await logout()
  }, [logout])

  useIdleSessionTimeout({
    enabled: Boolean(user) && !loading,
    onIdle: handleIdleTimeout,
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      claims,
      loading,
      isOnline,
      login,
      logout,
      refresh,
    }),
    [user, profile, claims, loading, isOnline, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}
