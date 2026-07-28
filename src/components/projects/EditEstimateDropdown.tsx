'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Package, HardHat, ClipboardList, Plus } from 'lucide-react'

type Props = {
  projectId: number
  /** هل وُجدت مقايسة محفوظة (بنود مواد أو أعمال) */
  hasEstimate?: boolean
  /** أيقونة صغيرة بجانب العين في القائمة */
  iconOnly?: boolean
  /** زر نصي داخل صفحة المقايسة */
  asButton?: boolean
}

export default function EditEstimateDropdown({ projectId, hasEstimate = false, iconOnly, asButton }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const base = `/projects/planning/${projectId}/boq`

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function go(section?: 'materials' | 'works') {
    setOpen(false)
    const q = section ? `?section=${section}` : ''
    router.push(`${base}${q}`)
  }

  function goCreate() {
    router.push(base)
  }

  // ── لا مقايسة بعد: زر إنشاء فقط ──
  if (!hasEstimate) {
    if (asButton) return null
    return (
      <button
        type="button"
        onClick={goCreate}
        className="btn btn-ghost"
        style={{
          padding: iconOnly ? '6px 10px' : '6px 12px',
          color: '#0ea77b',
          border: '1px solid #86efac',
        }}
        title="إنشاء مقايسة"
      >
        <Plus style={{ width: '16px', height: '16px' }} />
        {!iconOnly && <span style={{ marginRight: '4px' }}>إنشاء مقايسة</span>}
      </button>
    )
  }

  const menu = open ? (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: '4px',
      minWidth: '200px', background: 'white', borderRadius: '10px',
      border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      overflow: 'hidden',
    }}>
      <button type="button" onClick={() => go('materials')} className="btn btn-ghost" style={{
        width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 14px', fontSize: '0.8rem', color: '#4338ca',
      }}>
        <Package style={{ width: '14px', height: '14px' }} /> تعديل مقايسة المواد
      </button>
      <button type="button" onClick={() => go('works')} className="btn btn-ghost" style={{
        width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 14px', fontSize: '0.8rem', color: '#1a56db',
        borderTop: '1px solid var(--border)',
      }}>
        <HardHat style={{ width: '14px', height: '14px' }} /> تعديل مقايسة الأعمال
      </button>
      <button type="button" onClick={() => go()} className="btn btn-ghost" style={{
        width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 14px', fontSize: '0.8rem',
        borderTop: '1px solid var(--border)',
      }}>
        <ClipboardList style={{ width: '14px', height: '14px' }} /> تعديل المقايسة كاملة
      </button>
    </div>
  ) : null

  if (asButton) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen(v => !v)} className="btn btn-ghost" style={{
          fontSize: '0.82rem', color: '#1a56db', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}>
          <Pencil style={{ width: '14px', height: '14px' }} /> تعديل المقايسة
        </button>
        {menu}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="btn btn-ghost"
        style={{
          padding: iconOnly ? '6px 10px' : '6px 12px',
          color: '#1a56db',
          border: '1px solid #bfdbfe',
        }}
        title="تعديل المقايسة"
      >
        <Pencil style={{ width: '16px', height: '16px' }} />
        {!iconOnly && <span style={{ marginRight: '4px' }}>تعديل المقايسة</span>}
      </button>
      {menu}
    </div>
  )
}
