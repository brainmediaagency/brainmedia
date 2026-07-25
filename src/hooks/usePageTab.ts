import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function usePageTab<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  paramName = 'tab',
): [T, (tab: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = useMemo(() => {
    const raw = searchParams.get(paramName)
    return validTabs.includes(raw as T) ? (raw as T) : defaultTab
  }, [searchParams, paramName, validTabs, defaultTab])

  const setTab = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === defaultTab) params.delete(paramName)
          else params.set(paramName, next)
          return params
        },
        { replace: true },
      )
    },
    [defaultTab, paramName, setSearchParams],
  )

  return [tab, setTab]
}
