import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { loginSchema } from '@/features/auth/schemas/loginSchema'
import { formatTimer } from '@/lib/date'

const useAuthMock = vi.fn()

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/lib/firebase/app', () => ({
  getFirebaseApp: vi.fn(),
  isEmulatorMode: () => true,
}))

vi.mock('@/lib/firebase/auth', () => ({
  getFirebaseAuth: vi.fn(() => ({ currentUser: null })),
}))

vi.mock('@/lib/firebase/firestore', () => ({
  getDb: vi.fn(),
}))

import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'

describe('loginSchema', () => {
  it('requires email and password', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false)
    expect(
      loginSchema.safeParse({
        email: 'media@brain.local',
        password: 'secret12',
        rememberMe: true,
      }).success,
    ).toBe(true)
  })
})

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('redirects unauthenticated users to login', () => {
    useAuthMock.mockReturnValue({
      user: null,
      profile: null,
      claims: null,
      loading: false,
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/media-planning']}>
        <Routes>
          <Route
            path="/media-planning"
            element={
              <ProtectedRoute routeKey="media-planning">
                <div>Gizli içerik</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login sayfası</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('Gizli içerik')).not.toBeInTheDocument()
    expect(screen.getByText('Login sayfası')).toBeInTheDocument()
  })

  it('renders content when role is allowed', () => {
    useAuthMock.mockReturnValue({
      user: { uid: '1', email: 'a@b.c', displayName: 'A' },
      profile: null,
      claims: {
        role: 'media_planning',
        active: true,
        emailVerified: true,
      },
      loading: false,
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/media-planning']}>
        <Routes>
          <Route
            path="/media-planning"
            element={
              <ProtectedRoute routeKey="media-planning">
                <div>Gizli içerik</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Gizli içerik')).toBeInTheDocument()
  })
})

describe('ShiftTimer display helper', () => {
  it('keeps zero-padded digital format', () => {
    expect(formatTimer(45)).toBe('00:00:45')
  })
})

describe('OfflineBanner', () => {
  it('shows offline message when visible', async () => {
    const { OfflineBanner } = await import('@/components/ui/OfflineBanner')
    render(<OfflineBanner visible />)
    expect(
      screen.getByText(/İnternet bağlantısı bulunamadı/i),
    ).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders custom message', async () => {
    const { EmptyState } = await import('@/components/ui/EmptyState')
    render(<EmptyState title="Boş" description="Henüz kayıt yok." />)
    expect(screen.getByText('Henüz kayıt yok.')).toBeInTheDocument()
  })
})

describe('Button loading', () => {
  it('disables while loading', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const onClick = vi.fn()
    const { Button } = await import('@/components/ui/Button')
    render(
      <Button loading onClick={onClick}>
        Konfirmeye gönder
      </Button>,
    )
    const btn = screen.getByRole('button', { name: /Konfirmeye gönder/i })
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
