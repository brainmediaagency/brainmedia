/**
 * UI / UX smoke — accessibility roles, keyboard targets, loading states.
 * Renders in jsdom only; no network / Firebase / Drive.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TabNav } from '@/components/ui/TabNav'
import { Button } from '@/components/ui/Button'
import { usePageTab } from '@/hooks/usePageTab'
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'
import { sanitizeAppPath } from '@/lib/appPath'
import {
  REPORTER_SECTIONS,
  REPORTER_VIEWER_SECTIONS,
} from '@/config/navSections'

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

function PageTabProbe({
  tabs,
  defaultTab,
}: {
  tabs: readonly string[]
  defaultTab: string
}) {
  const [tab, setTab] = usePageTab(tabs, defaultTab)
  return (
    <div>
      <span data-testid="active-tab">{tab}</span>
      <button type="button" onClick={() => setTab(tabs[1] ?? defaultTab)}>
        next
      </button>
    </div>
  )
}

describe('QA · UI TabNav a11y', () => {
  it('exposes tablist / tab roles and selected state', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <TabNav
        aria-label="Muhabir bölümleri"
        items={[
          { id: 'jobs', label: 'Çekim Takvimi' },
          { id: 'cash', label: 'Kasa' },
        ]}
        activeId="jobs"
        onChange={onChange}
      />,
    )
    expect(
      screen.getByRole('tablist', { name: 'Muhabir bölümleri' }),
    ).toBeInTheDocument()
    const cash = screen.getByRole('tab', { name: 'Kasa' })
    expect(screen.getByRole('tab', { name: 'Çekim Takvimi' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(cash).toHaveAttribute('aria-selected', 'false')
    await user.click(cash)
    expect(onChange).toHaveBeenCalledWith('cash')
  })
})

describe('QA · UI Button UX', () => {
  it('loading disables interaction and does not double-fire', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Kaydet
      </Button>,
    )
    const btn = screen.getByRole('button', { name: /Kaydet/i })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('QA · UI usePageTab deep-link', () => {
  it('falls back when tab id invalid (e.g. ?tab=cash on viewer)', () => {
    const viewerIds = REPORTER_VIEWER_SECTIONS.map((s) => s.id)
    render(
      <MemoryRouter initialEntries={['/reporter?tab=cash']}>
        <PageTabProbe tabs={viewerIds} defaultTab="jobs" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('active-tab')).toHaveTextContent('jobs')
  })

  it('accepts cash only when in valid tab list (muhabir)', () => {
    const ids = REPORTER_SECTIONS.map((s) => s.id)
    render(
      <MemoryRouter initialEntries={['/reporter?tab=cash']}>
        <PageTabProbe tabs={ids} defaultTab="jobs" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('active-tab')).toHaveTextContent('cash')
  })
})

describe('QA · UI ProtectedRoute UX', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('loading state does not flash forbidden content', () => {
    useAuthMock.mockReturnValue({
      user: null,
      profile: null,
      claims: null,
      loading: true,
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })
    render(
      <MemoryRouter>
        <ProtectedRoute routeKey="management">
          <div>Gizli yönetim</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Gizli yönetim')).not.toBeInTheDocument()
    expect(screen.getByText(/Oturum doğrulanıyor/i)).toBeInTheDocument()
  })

  it('MPU cannot render management protected content', () => {
    useAuthMock.mockReturnValue({
      user: { uid: '1', email: 'm@b.c', displayName: 'M' },
      profile: { uid: '1', role: 'media_planning' },
      claims: { role: 'media_planning' },
      loading: false,
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/management']}>
        <Routes>
          <Route
            path="/management"
            element={
              <ProtectedRoute routeKey="management">
                <div>Gizli yönetim</div>
              </ProtectedRoute>
            }
          />
          <Route path="/media-planning" element={<div>MPU ana</div>} />
          <Route path="/unauthorized" element={<div>Yetkisiz</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Gizli yönetim')).not.toBeInTheDocument()
    expect(screen.getByText('MPU ana')).toBeInTheDocument()
  })
})

describe('QA · deep link safety (push / inbox open)', () => {
  it('rejects absolute and protocol-relative URLs', () => {
    expect(sanitizeAppPath('https://phish.example/x')).toBe('/management')
    expect(sanitizeAppPath('javascript:alert(1)')).toBe('/management')
    expect(sanitizeAppPath('/human-resources?tab=reports')).toBe(
      '/human-resources?tab=reports',
    )
  })
})
