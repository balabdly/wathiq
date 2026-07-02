'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { visitsApi, projectsApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Plus, Search, Eye, Filter, ExternalLink,
  Shield, CheckCircle, Zap, Hammer, Leaf, X
} from 'lucide-react'
import type { Visit } from '@/types'
import toast from 'react-hot-toast'

const VisitModal  = dynamic(() => import('./VisitModal'),  { ssr: false })
const VisitDetail = dynamic(() => import('./VisitDetail'), { ssr: false })

// ══ تعريف أنواع الزيارات ══
const VISIT_CONFIG: Record<string, {
  icon: React.ReactNode; label: string
  color: string; bg: string; border: string
  qhsePath?: string   // إذا كانت QHSE يوجد مسار للصفحة المتخصصة
}> = {
  'سلامة':    { icon: <Shield   size={13} />, label: 'سلامة',    color: '#e6820a', bg: '#fffbeb', border: '#fcd34d', qhsePath: '/qhse/safety'      },
  'جودة':     { icon: <CheckCircle size={13} />, label: 'جودة',  color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', qhsePath: '/qhse/quality'     },
  'بيئة':     { icon: <Leaf     size={13} />, label: 'بيئة',     color: '#059669', bg: '#ecfdf5', border: '#6ee7b7', qhsePath: '/qhse/environment' },
  'كهربائية': { icon: <Zap      size={13} />, label: 'كهربائية', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  'ميدانية':  { icon: <Hammer   size={13} />, label: 'ميدانية',  color: '#0ea77b', bg: '#ecfdf5', border: '#86efac' },
  'متابعة':   { icon: <Eye      size={13} />, label: 'متابعة',   color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
}

const LIFECYCLE_STYLE: Record<string, { bg: string; color: string }> = {
  'رصد':     { bg: '#fffbeb', color: '#e6820a' },
  'إسناد':   { bg: '#f5f3ff', color: '#7c3aed' },
  'تصحيح':  { bg: '#eff6ff', color: '#1a56db' },
  'اعتماد': { bg: '#ecfdf5', color: '#0ea77b' },
}

function TypeBadge({ type }: { type: string }) {
  const cfg = VISIT_CONFIG[type] || { icon: null, label: type, color: '#374151', bg: '#f9fafb', border: '#e5e7eb' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10,
      fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

export default function VisitsPage() {
  const router = useRouter()
  const { tenant, activeBranch, visits, setVisits, projects, setProjects, currentUser } = useStore()
  const perms  = (currentUser?.permissions || []) as string[]
  const canEdit = perms.some(p => p.startsWith('visits'))

  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [typeFilter,    setTypeFilter]    = useState<string>('all')
  const [statusFilter,  setStatusFilter]  = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [showModal,     setShowModal]     = useState(false)
  const [editVisit,     setEditVisit]     = useState<Visit | null>(null)
  const [detailVisit,   setDetail]        = useState<Visit | null>(null)

  useEffect(() => { loadAll() }, [tenant?.id, activeBranch?.id])

  async function loadAll() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const [vRes, pRes] = await Promise.all([
      visitsApi.getAll(tenant.id, activeBranch.id),
      projectsApi.getAll(tenant.id, activeBranch.id),
    ])
    setVisits(vRes.data || [])
    setProjects(pRes.data || [])
    setLoading(false)
  }

  async function handleSave(data: Partial<Visit>) {
    if (!tenant || !activeBranch) return
    const payload: any = { ...data, tenant_id: tenant.id, branch_id: activeBranch.id,
      project_id: data.project_id ? Number(data.project_id) : null }
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
    const { error } = await visitsApi.upsert(payload)
    if (error) { toast.error('خطأ: ' + (error as any)?.message); return }
    await loadAll()
    setShowModal(false); setEditVisit(null)
    toast.success(editVisit ? 'تم التعديل' : 'تمت الإضافة ✅')
  }

  // تصفية الزيارات
  const filtered = visits.filter(v => {
    if (typeFilter   !== 'all' && v.type !== typeFilter) return false
    if (statusFilter === 'open'   && v.status === 'مغلق') return false
    if (statusFilter === 'closed' && v.status !== 'مغلق') return false
    if (projectFilter && String(v.project_id) !== projectFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(v.engineer?.toLowerCase().includes(q) ||
            v.location?.toLowerCase().includes(q) ||
            (projects.find(p => p.id === v.project_id)?.name || '').toLowerCase().includes(q))) return false
    }
    return true
  })

  // KPIs
  const openVisits    = visits.filter(v => v.status === 'مفتوح').length
  const ncr           = visits.filter(v => (v as any).ncr_no).length
  const safetyCount   = visits.filter(v => v.type === 'سلامة').length
  const qualityCount  = visits.filter(v => v.type === 'جودة').length

  // أنواع موجودة في البيانات
  const existingTypes = Array.from(new Set(visits.map(v => v.type))).filter(Boolean)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--bg2)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} dir="rtl">

      {/* ══ Header ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={20} style={{ color: '#1a56db' }} />
            سجل الزيارات
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>
            {visits.length} زيارة — جودة + سلامة + بيئة + ميدانية
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* روابط سريعة للصفحات المتخصصة */}
          {[
            { label: '🛡️ زيارة سلامة', path: '/qhse/safety',      color: '#e6820a', bg: '#fffbeb' },
            { label: '🔍 زيارة جودة',   path: '/qhse/quality',     color: '#1a56db', bg: '#eff6ff' },
            { label: '🌿 زيارة بيئية',  path: '/qhse/environment', color: '#059669', bg: '#ecfdf5' },
          ].map(link => (
            <button key={link.path} onClick={() => router.push(link.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8,
                border: `1px solid ${link.color}30`, background: link.bg, color: link.color,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600 }}>
              {link.label} <ExternalLink size={11} />
            </button>
          ))}
          {canEdit && (
            <button onClick={() => { setEditVisit(null); setShowModal(true) }} className="btn btn-primary">
              <Plus size={15} /> زيارة ميدانية
            </button>
          )}
        </div>
      </div>

      {/* ══ KPIs ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { icon: '📋', value: visits.length, label: 'إجمالي الزيارات',   bg: '#f8f9fa', color: '#374151', border: '#e9ecef' },
          { icon: '🔴', value: openVisits,    label: 'زيارات مفتوحة',     bg: openVisits > 0 ? '#fef2f2' : '#f0fdf4', color: openVisits > 0 ? '#b91c1c' : '#065f46', border: openVisits > 0 ? '#fecaca' : '#bbf7d0' },
          { icon: '🛡️', value: safetyCount,   label: 'زيارات سلامة',     bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
          { icon: '🔍', value: qualityCount,  label: 'زيارات جودة',       bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 14, background: k.bg, border: `1px solid ${k.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#374151', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ══ فلاتر ══ */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* بحث */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input" style={{ paddingRight: 30 }} placeholder="بحث بالمهندس أو الموقع..." />
        </div>

        {/* فلتر النوع */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
          <button onClick={() => setTypeFilter('all')}
            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600,
              background: typeFilter === 'all' ? 'white' : 'transparent',
              color:      typeFilter === 'all' ? '#1a56db' : 'var(--text3)',
              boxShadow:  typeFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            الكل ({visits.length})
          </button>
          {existingTypes.map(t => {
            const cfg = VISIT_CONFIG[t]
            const count = visits.filter(v => v.type === t).length
            return (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                  background: typeFilter === t ? (cfg?.bg || 'white') : 'transparent',
                  color:      typeFilter === t ? (cfg?.color || '#374151') : 'var(--text3)',
                  boxShadow:  typeFilter === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {cfg?.icon} {t} ({count})
              </button>
            )
          })}
        </div>

        {/* فلتر الحالة */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="select" style={{ width: 'auto', minWidth: 130 }}>
          <option value="all">كل الحالات</option>
          <option value="open">مفتوحة فقط</option>
          <option value="closed">مغلقة فقط</option>
        </select>

        {/* فلتر المشروع */}
        {projects.length > 0 && (
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
            className="select" style={{ width: 'auto', minWidth: 160 }}>
            <option value="">كل المشاريع</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {/* إعادة الضبط */}
        {(search || typeFilter !== 'all' || statusFilter !== 'all' || projectFilter) && (
          <button onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setProjectFilter('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text3)', fontFamily: 'inherit' }}>
            <X size={12} /> إعادة ضبط
          </button>
        )}
      </div>

      {/* ══ لافتة QHSE — تظهر عند فلترة سلامة/جودة/بيئة ══ */}
      {typeFilter !== 'all' && VISIT_CONFIG[typeFilter]?.qhsePath && (
        <div style={{ padding: '12px 16px', background: VISIT_CONFIG[typeFilter].bg, border: `1px solid ${VISIT_CONFIG[typeFilter].border}`,
          borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: VISIT_CONFIG[typeFilter].color }}>
              {VISIT_CONFIG[typeFilter].icon} زيارات {typeFilter} — للعرض فقط في هذه الصفحة
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 2 }}>
              الإنشاء والتعديل وإدارة دورة الحياة يتم من صفحة {typeFilter} في QHSE
            </div>
          </div>
          <button onClick={() => router.push(VISIT_CONFIG[typeFilter].qhsePath!)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700,
              background: VISIT_CONFIG[typeFilter].color, color: 'white', whiteSpace: 'nowrap' }}>
            <ExternalLink size={13} /> انتقل لصفحة {typeFilter}
          </button>
        </div>
      )}

      {/* ══ الجدول ══ */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>لا توجد زيارات مطابقة</div>
            <div style={{ fontSize: '0.82rem' }}>جرّب تغيير الفلتر أو البحث</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['النوع','التاريخ','المهندس','المشروع / الموقع','النتيجة','الحالة','دورة الحياة',''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const proj    = projects.find(p => p.id === v.project_id)
                  const lc      = (v as any).lifecycle || ''
                  const lcStyle = LIFECYCLE_STYLE[lc]
                  const isQhse  = !!VISIT_CONFIG[v.type]?.qhsePath
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '9px 12px' }}><TypeBadge type={v.type} /></td>
                      <td style={{ padding: '9px 12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{formatDate(v.date)}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{v.engineer}</td>
                      <td style={{ padding: '9px 12px', maxWidth: 200 }}>
                        {proj && <div style={{ fontWeight: 600, fontSize: 12 }}>{proj.name}</div>}
                        {v.location && <div style={{ color: 'var(--text3)', fontSize: 11 }}>{v.location}</div>}
                        {!proj && !v.location && <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                          background: v.specs === 'مطابق' ? '#ecfdf5' : '#fef2f2',
                          color:      v.specs === 'مطابق' ? '#065f46' : '#b91c1c' }}>
                          {v.specs === 'مطابق' ? '✅ مطابق' : '❌ غير مطابق'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          background: v.status === 'مغلق' ? '#ecfdf5' : '#fef3c7',
                          color:      v.status === 'مغلق' ? '#065f46' : '#92400e' }}>
                          {v.status === 'مغلق' ? '✅ مغلق' : '🔴 مفتوح'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {lcStyle ? (
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: lcStyle.bg, color: lcStyle.color }}>
                            {lc}
                          </span>
                        ) : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setDetail(v)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>
                            👁️ تفاصيل
                          </button>
                          {/* زر التعديل — فقط لأنواع المتابعة، وليس QHSE */}
                          {!isQhse && canEdit && (
                            <button onClick={() => { setEditVisit(v); setShowModal(true) }}
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit' }}>
                              ✏️ تعديل
                            </button>
                          )}
                          {/* زر الانتقال للصفحة المتخصصة */}
                          {isQhse && (
                            <button onClick={() => router.push(VISIT_CONFIG[v.type].qhsePath!)}
                              style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${VISIT_CONFIG[v.type].color}30`, background: VISIT_CONFIG[v.type].bg, cursor: 'pointer', fontSize: 11, color: VISIT_CONFIG[v.type].color, fontFamily: 'inherit' }}>
                              <ExternalLink size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ المودالات ══ */}
      {showModal && (
        <VisitModal
          visit={editVisit}
          projects={projects}
          allowedTypes={['كهربائية', 'ميدانية', 'متابعة']}
          onClose={() => { setShowModal(false); setEditVisit(null) }}
          onSave={handleSave}
        />
      )}

      {detailVisit && (
        <VisitDetail
          visit={detailVisit}
          onClose={() => setDetail(null)}
          onEdit={canEdit && !VISIT_CONFIG[detailVisit.type]?.qhsePath ? () => {
            setDetail(null); setEditVisit(detailVisit); setShowModal(true)
          } : undefined}
        />
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
