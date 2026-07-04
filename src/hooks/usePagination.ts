/**
 * usePagination.ts — hook مشترك للتصفح الصفحي
 *
 * يستخدم Supabase .range() لجلب الصفحة الحالية فقط
 * بدل جلب كل البيانات ثم تقطيعها في JavaScript
 *
 * الاستخدام:
 *   const { page, pageSize, from, to, setPage, PaginationBar } = usePagination(50)
 */

import { useState, useCallback } from 'react'

export type PaginationState = {
  page:     number
  pageSize: number
  from:     number   // للـ Supabase .range(from, to)
  to:       number
}

export type UsePaginationReturn = {
  page:         number
  pageSize:     number
  from:         number
  to:           number
  totalPages:   number
  setPage:      (p: number) => void
  setTotal:     (n: number) => void
  total:        number
  PaginationBar: (props: { color?: string }) => JSX.Element | null
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

  function PaginationBar({ color = '#1a56db' }: { color?: string }) {
    if (total <= pageSize) return null

    const pages: number[] = []
    const delta = 2
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
      pages.push(i)
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', flexWrap: 'wrap', gap: '10px' }}>
        {/* معلومات */}
        <div style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
          عرض <strong>{from + 1}</strong> — <strong>{Math.min(to + 1, total)}</strong> من <strong>{total.toLocaleString()}</strong> سجل
        </div>

        {/* أزرار التنقل */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* الأول */}
          <button
            onClick={() => setPage(1)} disabled={page === 1}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: '0.75rem' }}>
            «
          </button>
          {/* السابق */}
          <button
            onClick={() => setPage(page - 1)} disabled={page === 1}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: '0.82rem' }}>
            ›
          </button>

          {/* أرقام الصفحات */}
          {pages[0] > 1 && (
            <>
              <button onClick={() => setPage(1)} style={btnStyle(false, color)}>1</button>
              {pages[0] > 2 && <span style={{ color: 'var(--text3)', padding: '0 4px' }}>…</span>}
            </>
          )}
          {pages.map(p => (
            <button key={p} onClick={() => setPage(p)} style={btnStyle(p === page, color)}>
              {p}
            </button>
          ))}
          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && <span style={{ color: 'var(--text3)', padding: '0 4px' }}>…</span>}
              <button onClick={() => setPage(totalPages)} style={btnStyle(false, color)}>{totalPages}</button>
            </>
          )}

          {/* التالي */}
          <button
            onClick={() => setPage(page + 1)} disabled={page === totalPages}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontSize: '0.82rem' }}>
            ‹
          </button>
          {/* الأخير */}
          <button
            onClick={() => setPage(totalPages)} disabled={page === totalPages}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontSize: '0.75rem' }}>
            »
          </button>
        </div>

        {/* حجم الصفحة — placeholder للمستقبل */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
          صفحة {page} من {totalPages}
        </div>
      </div>
    )
  }

  return { page, pageSize, from, to, totalPages, setPage, setTotal, total, PaginationBar }
}

// ────────────────────────────────────
function btnStyle(active: boolean, color: string): React.CSSProperties {
  return {
    minWidth:   '32px',
    height:     '32px',
    padding:    '0 6px',
    borderRadius: '8px',
    border:     `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? color : 'white',
    color:      active ? 'white' : 'var(--text3)',
    cursor:     'pointer',
    fontWeight: active ? 700 : 400,
    fontSize:   '0.82rem',
  }
}
