'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ExternalLink, Plus, Shield, CheckCircle, Zap, Hammer, Leaf, Eye } from 'lucide-react'

const TYPE_CFG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; qhsePath?: string; label: string }> = {
  'سلامة':    { icon: <Shield    size={12} />, label: 'سلامة',    color: '#e6820a', bg: '#fffbeb', border: '#fcd34d', qhsePath: '/qhse/safety'      },
  'جودة':     { icon: <CheckCircle size={12} />, label: 'جودة',  color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', qhsePath: '/qhse/quality'     },
  'بيئة':     { icon: <Leaf      size={12} />, label: 'بيئة',     color: '#059669', bg: '#ecfdf5', border: '#6ee7b7', qhsePath: '/qhse/environment' },
  'كهربائية': { icon: <Zap       size={12} />, label: 'كهربائية', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  'ميدانية':  { icon: <Hammer    size={12} />, label: 'ميدانية',  color: '#0ea77b', bg: '#ecfdf5', border: '#86efac' },
  'متابعة':   { icon: <Eye       size={12} />, label: 'متابعة',   color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
}

const LIFECYCLE_COLORS: Record<string, string> = {
  'رصد': '#e6820a', 'إسناد': '#7c3aed', 'تصحيح': '#1a56db', 'اعتماد': '#0ea77b'
}

interface Props {
  projectId: number
  onAddVisit?: () => void  // لفتح VisitModal من الخارج
}

export default function ProjectVisitsTab({ projectId, onAddVisit }: Props) {
  const router = useRouter()
  const { tenant } = useStore()
  const [visits,     setVisits]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    if (!tenant || !projectId) return
    setLoading(true)
    supabase.from('visits')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('project_id', projectId)
      .order('date', { ascending: false })
      .then(({ data }) => { setVisits(data || []); setLoading(false) })
  }, [tenant?.id, projectId])

  const existingTypes = Array.from(new Set(visits.map(v => v.type))).filter(Boolean)
  const filtered = typeFilter === 'all' ? visits : visits.filter(v => v.type === typeFilter)

  // إحصائيات
  const total   = visits.length
  const open    = visits.filter(v => v.status === 'مفتوح').length
  const ncr     = visits.filter(v => v.specs === 'غير مطابق').length
  const safety  = visits.filter(v => v.type === 'سلامة').length
  const quality = visits.filter(v => v.type === 'جودة').length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 24, height: 24, border: '2px solid var(--bg2)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} dir="rtl">

      {/* KPIs صغيرة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[
          { label: 'إجمالي',     value: total,   color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
          { label: 'مفتوحة',    value: open,    color: open > 0 ? '#b91c1c' : '#065f46', bg: open > 0 ? '#fef2f2' : '#f0fdf4', border: open > 0 ? '#fecaca' : '#bbf7d0' },
          { label: 'مخالفات',   value: ncr,     color: ncr  > 0 ? '#b91c1c' : '#374151', bg: ncr > 0 ? '#fef2f2' : '#f9fafb', border: ncr > 0 ? '#fecaca' : '#e5e7eb' },
          { label: 'سلامة',     value: safety,  color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
          { label: 'جودة',      value: quality, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: k.bg, border: `1px solid ${k.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.68rem', color: '#374151', marginTop: 1 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* أزرار الإضافة */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* زيارة ميدانية من هنا */}
        {onAddVisit && (
          <button onClick={onAddVisit}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #0ea77b30', background: '#ecfdf5', color: '#065f46', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600 }}>
            <Plus size={13} /> زيارة ميدانية
          </button>
        )}
        {/* روابط QHSE */}
        {[
          { label: '🛡️ زيارة سلامة', path: '/qhse/safety',      color: '#e6820a', bg: '#fffbeb' },
          { label: '🔍 زيارة جودة',   path: '/qhse/quality',     color: '#1a56db', bg: '#eff6ff' },
          { label: '🌿 زيارة بيئية',  path: '/qhse/environment', color: '#059669', bg: '#ecfdf5' },
        ].map(link => (
          <button key={link.path} onClick={() => router.push(link.path)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8,
              border: `1px solid ${link.color}30`, background: link.bg, color: link.color,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600 }}>
            {link.label} <ExternalLink size={10} />
          </button>
        ))}
      </div>

      {/* فلتر بسيط بالنوع */}
      {existingTypes.length > 1 && (
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8, width: 'fit-content' }}>
          <button onClick={() => setTypeFilter('all')}
            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600,
              background: typeFilter === 'all' ? 'white' : 'transparent',
              color:      typeFilter === 'all' ? '#1a56db' : 'var(--text3)' }}>
            الكل ({total})
          </button>
          {existingTypes.map(t => {
            const cfg   = TYPE_CFG[t]
            const count = visits.filter(v => v.type === t).length
            return (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
                  background: typeFilter === t ? (cfg?.bg || 'white') : 'transparent',
                  color:      typeFilter === t ? (cfg?.color || '#374151') : 'var(--text3)' }}>
                {cfg?.icon} {t} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* جدول الزيارات */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', background: '#f8fafc', borderRadius: 10 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <p style={{ fontSize: '0.85rem' }}>لا توجد زيارات مرتبطة بهذا المشروع بعد</p>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                {['النوع','التاريخ','المهندس','الموقع','النتيجة','الحالة / دورة الحياة',''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const cfg  = TYPE_CFG[v.type]
                const lc   = v.lifecycle || ''
                const lcColor = LIFECYCLE_COLORS[lc]
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 8,
                        fontSize: 10, fontWeight: 700, background: cfg?.bg || '#f9fafb', color: cfg?.color || '#374151', border: `1px solid ${cfg?.border || '#e5e7eb'}` }}>
                        {cfg?.icon} {v.type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {new Date(v.date).toLocaleDateString('ar-SA')}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{v.engineer}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text3)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.location || '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        background: v.specs === 'مطابق' ? '#ecfdf5' : '#fef2f2',
                        color:      v.specs === 'مطابق' ? '#065f46' : '#b91c1c' }}>
                        {v.specs === 'مطابق' ? '✅' : '❌'} {v.specs}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600, width: 'fit-content',
                          background: v.status === 'مغلق' ? '#ecfdf5' : '#fef3c7',
                          color:      v.status === 'مغلق' ? '#065f46' : '#92400e' }}>
                          {v.status}
                        </span>
                        {lc && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: lcColor || 'var(--text3)' }}>
                            {lc}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '6px' }}>
                      {cfg?.qhsePath ? (
                        <button onClick={() => router.push(cfg.qhsePath!)}
                          style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${cfg.color}30`, background: cfg.bg, cursor: 'pointer', fontSize: 10, color: cfg.color, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <ExternalLink size={9} /> {v.type}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
