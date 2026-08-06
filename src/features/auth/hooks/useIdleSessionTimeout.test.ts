import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdleSessionTimeout } from '@/features/auth/hooks/useIdleSessionTimeout'

describe('useIdleSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onIdle after idleMs', () => {
    const onIdle = vi.fn()
    renderHook(() =>
      useIdleSessionTimeout({ enabled: true, onIdle, idleMs: 5_000 }),
    )
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5_000)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('does not fire onIdle when suppressed (e.g. voice recording)', () => {
    const onIdle = vi.fn()
    renderHook(() =>
      useIdleSessionTimeout({
        enabled: true,
        onIdle,
        idleMs: 5_000,
        isSuppressed: () => true,
      }),
    )
    vi.advanceTimersByTime(5_000)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5_000)
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('does not run while disabled', () => {
    const onIdle = vi.fn()
    renderHook(() =>
      useIdleSessionTimeout({ enabled: false, onIdle, idleMs: 5_000 }),
    )
    vi.advanceTimersByTime(10_000)
    expect(onIdle).not.toHaveBeenCalled()
  })
})
