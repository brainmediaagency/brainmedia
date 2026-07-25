import { useEffect, useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE = 10

export type UseClientPaginationOptions = {
  pageSize?: number
  /** When this value changes, page resets to 1 (e.g. filter key). */
  resetKey?: unknown
}

export type ClientPaginationResult<T> = {
  page: number
  setPage: (page: number | ((current: number) => number)) => void
  totalPages: number
  pageSize: number
  pageItems: T[]
  rangeStart: number
  rangeEnd: number
  totalCount: number
  showControls: boolean
}

/**
 * Client-side slice pagination for in-memory lists (queues, filtered jobs).
 */
export function useClientPagination<T>(
  items: readonly T[],
  options: UseClientPaginationOptions = {},
): ClientPaginationResult<T> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const [page, setPage] = useState(1)
  const totalCount = items.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  useEffect(() => {
    setPage(1)
  }, [options.resetKey, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize) as T[]
  }, [items, page, pageSize])

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  return {
    page,
    setPage,
    totalPages,
    pageSize,
    pageItems,
    rangeStart,
    rangeEnd,
    totalCount,
    showControls: totalCount > pageSize,
  }
}
