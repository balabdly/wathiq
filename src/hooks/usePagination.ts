/**
 * usePagination.ts — hook مشترك للتصفح الصفحي
 * PaginationBar مبني بـ React.createElement حتى يبقى الملف .ts صالحاً بدون JSX
 * الاستخدام:
 *   const { page, from, to, setPage, setTotal, total, PaginationBar } = usePagination(50)
 */

import { useState, useCallback, createElement, type ReactElement, type CSSProperties } from 'react'

export type UsePaginationReturn = {
  page:         number
  pageSize:     number
  from:         number
  to:           number
  totalPages:   number
  setPage:      (p: number) => void
  setTotal:     (n: number) => void
  total:        number
  PaginationBar: (props: { color?: string }) => ReactElement | null
}

export function usePagination(pageSize = 50): UsePaginationReturn {
  const [page,  setPageState] = useState(1)
  const [total, setTotal]     = useState(0)

  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const setPage = useCallback((p: number) => {
    setPageState(Math.max(1, Math.min(p, Math.ceil(total / pageSize) || 1)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [total, pageSize])

  function navBtn(key: string, label: string, onClick: () => void, disabled: boolean, small = false): ReactElement {
    return createElement('button', {
      key, onClick, disabled,
      style: {
        width: '32px', height: '32px', borderRadius: '8px',
        border: '1px solid var(--border)', background: 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1, fontSize: small ? '0.75rem' : '0.82rem',
      } as CSSProperties,
    }, label)
  }

  function PaginationBar({ color = '#1a56db' }: { color?: string }): ReactElement | null {
    if (total <= pageSize) return null

    const pages: number[] = []
    const delta = 2
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) pages.push(i)

    const numBtn = (p: number, active: boolean) => createElement('button', {
      key: 'p' + p, onClick: () => setPage(p), style: btnStyle(active, color),
    }, String(p))
    const ellipsis = (k: string) => createElement('span', {
      key: k, style: { color: 'var(--text3)', padding: '0 4px' } as CSSProperties,
    }, '…')

    const numbers: ReactElement[] = []
    if (pages[0] > 1) {
      numbers.push(numBtn(1, false))
      if (pages[0] > 2) numbers.push(ellipsis('e-start'))
    }
    pages.forEach(p => numbers.push(numBtn(p, p === page)))
    if (pages[pages.length - 1] < totalPages) {
      if (pages[pages.length - 1] < totalPages - 1) numbers.push(ellipsis('e-end'))
      numbers.push(numBtn(totalPages, false))
    }

    return createElement('div', {
      style: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 16px', borderTop: '1px solid var(--border)',
        background: 'var(--bg2)', flexWrap: 'wrap', gap: '10px',
      } as CSSProperties,
    },
      createElement('div', { key: 'info', style: { fontSize: '0.82rem', color: 'var(--text3)' } as CSSProperties },
        'عرض ',
        createElement('strong', { key: 'f' }, String(from + 1)),
        ' — ',
        createElement('strong', { key: 't' }, String(Math.min(to + 1, total))),
        ' من ',
        createElement('strong', { key: 'tt' }, total.toLocaleString()),
        ' سجل'
      ),
      createElement('div', { key: 'nav', style: { display: 'flex', gap: '4px', alignItems: 'center' } as CSSProperties },
        navBtn('first', '«', () => setPage(1), page === 1, true),
        navBtn('prev',  '›', () => setPage(page - 1), page === 1),
        ...numbers,
        navBtn('next',  '‹', () => setPage(page + 1), page === totalPages),
        navBtn('last',  '»', () => setPage(totalPages), page === totalPages, true),
      ),
      createElement('div', { key: 'pg', style: { fontSize: '0.78rem', color: 'var(--text3)' } as CSSProperties },
        `صفحة ${page} من ${totalPages}`)
    )
  }

  return { page, pageSize, from, to, totalPages, setPage, setTotal, total, PaginationBar }
}

function btnStyle(active: boolean, color: string): CSSProperties {
  return {
    minWidth: '32px', height: '32px', padding: '0 6px', borderRadius: '8px',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? color : 'white',
    color: active ? 'white' : 'var(--text3)',
    cursor: 'pointer', fontWeight: active ? 700 : 400, fontSize: '0.82rem',
  }
}
