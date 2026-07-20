import { useEffect, useMemo } from 'react'
import { usePagination } from '@/hooks/usePagination'

/** تصفح عميلي لقائمة مُصفّاة — 10 عناصر افتراضياً */
export function useFilteredPagination<T>(items: T[], pageSize = 10, resetKey?: string | number) {
  const { page, setPage, setTotal, total, PaginationBar } = usePagination(pageSize)

  useEffect(() => {
    setTotal(items.length)
  }, [items.length, setTotal])

  useEffect(() => {
    setPage(1)
  }, [resetKey, setPage])

  const paginated = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  )

  return { paginated, PaginationBar, page, total, pageSize }
}
