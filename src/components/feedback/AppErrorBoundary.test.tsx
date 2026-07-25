import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary'

const useAuthMock = vi.fn()

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

function Boom(): never {
  throw new Error('USER_Test hatası')
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ claims: null })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders healthy children', () => {
    render(
      <MemoryRouter>
        <AppErrorBoundary>
          <p>Uygulama hazır</p>
        </AppErrorBoundary>
      </MemoryRouter>,
    )

    expect(screen.getByText('Uygulama hazır')).toBeInTheDocument()
  })

  it('shows a recoverable Turkish fallback after a render error', () => {
    render(
      <MemoryRouter>
        <AppErrorBoundary>
          <Boom />
        </AppErrorBoundary>
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Test hatası')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ana sayfaya dön' })).toHaveAttribute(
      'href',
      '/login',
    )
  })
})
