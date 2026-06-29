'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/hooks/useStore'
import { visitsApi, projectsApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Plus, Search, Eye, Pencil, Trash2, X, Save,
  ClipboardCheck, ArrowRight, Camera, ClipboardList
} from 'lucide-react'
import type { Visit } from '@/types'
import toast from 'react-hot-toast'

const VisitModal  = dynamic(() => import('./VisitModal'),  { ssr: false })
const VisitDetail = dynamic(() => import('./VisitDetail'), { ssr: false })
import PhotoUploader from './PhotoUploader'

const VISIT_TYPES = [
  { id: 'جودة',     icon: '🔍', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'سلامة',    icon: '🛡️', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d' },
  { id: 'كهربائية', icon: '⚡', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'ميدانية',  icon: '🏗️', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac' },
]

// ══════════════════════════════════════
// مودال الإجراء التصحيحي (موحّد)
// ══════════════════════════════════════
// ══ مودال: تصحيح الملاحظة (المرحلة 2) ══
function CorrectiveModal({ visit, onClose, onSave }: {
  visit: Visit
  onClose: () => void
  onSave: (report: string, attachments: string[]) => Promise<void>
}) {
  const v = visit as any
  const [notes,   setNotes]   = useState(v.correction_notes || '')
  const [photos,  setPhotos]  = useState<{name:string;data:string}[]>(
    v.correction_files?.map((f:any) => ({ name: f.name, data: f.data || f.url || '' })) || []
  )
  const [saving,  setSaving]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notes.trim()) { toast.error('أدخل تفاصيل التصحيح'); return }
    setSaving(true)
    await onSave(notes.trim(), photos.map(p => p.data))
    setSaving(false)
  }

  const sevStyle: Record<string,{bg:string;color:string}> = {
    'عالي':  {bg:'#fef2f2',color:'#c81e1e'},
    'متوسط': {bg:'#fffbeb',color:'#e6820a'},
    'منخفض':{bg:'#ecfdf5',color:'#0ea77b'},
  }
  const sev = sevStyle[v.severity] || sevStyle['متوسط']

  return (
    <div className="modal-overlay" onMouseDown={e => { (e.currentTarget as any)._md = e.target }} onClick={e => { if (e.target === e.currentTarget && (e.currentTarget as any)._md === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔧 تسجيل التصحيح
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* بيانات الملاحظة */}
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 14px', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 700, color: '#c81e1e', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>⚠️ {visit.corrective || visit.notes}</span>
                {v.severity && <span style={{ padding: '2px 8px', borderRadius: '10px', background: sev.bg, color: sev.color, fontSize: '0.72rem' }}>{v.severity}</span>}
              </div>
              {v.responsible_name && <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>المسؤول: {v.responsible_name}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                تفاصيل التصحيح المُنفَّذ <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="input" style={{ minHeight: '90px', resize: 'none' }}
                placeholder="صف الإجراء التصحيحي الذي تم تنفيذه..." />
            </div>
            <PhotoUploader photos={photos} onChange={setPhotos} label="صور / مرفقات التصحيح" />
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving || !notes.trim()} className="btn btn-primary" style={{ background: '#0ea77b' }}>
              {saving ? 'جاري الحفظ...' : '✅ تسجيل التصحيح'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══ مودال: اعتماد التصحيح (مهندس السلامة/الجودة — المرحلة 3) ══
function ApprovalModal({ visit, approverName, onClose, onApprove }: {
  visit: Visit
  approverName: string
  onClose: () => void
  onApprove: (id: number, notes: string) => Promise<void>
}) {
  const v = visit as any
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onApprove(visit.id, notes)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { (e.currentTarget as any)._md = e.target }} onClick={e => { if (e.target === e.currentTarget && (e.currentTarget as any)._md === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>🛡️ اعتماد التصحيح</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* ملخص الملاحظة */}
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', fontSize: '0.82rem', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>الملاحظة: {visit.corrective}</div>
              {v.responsible_name && <div style={{ color: '#6b7280' }}>المسؤول: {v.responsible_name}</div>}
            </div>
            {/* تقرير التصحيح */}
            {v.correction_notes && (
              <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.72rem', color: '#0ea77b', fontWeight: 700, marginBottom: '4px' }}>✅ تقرير التصحيح</div>
                <div style={{ fontSize: '0.85rem' }}>{v.correction_notes}</div>
                {v.correction_files?.length > 0 && (
                  <PhotoUploader
                    photos={v.correction_files.map((f:any) => ({ name: f.name, data: f.data || f.url || '' }))}
                    onChange={() => {}}
                    label={`مرفقات التصحيح (${v.correction_files.length})`}
                  />
                )}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>ملاحظات الاعتماد (اختياري)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="input" style={{ minHeight: '70px', resize: 'none' }}
                placeholder="أي ملاحظات إضافية عند الاعتماد..." />
            </div>
            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.78rem', color: '#1a56db', fontWeight: 600 }}>
              🛡️ ستعتمد هذه الملاحظة باسمك: {approverName}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ background: '#1a56db' }}>
              {saving ? 'جاري الحفظ...' : '🛡️ اعتماد التصحيح'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
export default function VisitsPage() {
  const { tenant, activeBranch, visits, setVisits, projects, setProjects, currentUser } = useStore()
  const perms = (currentUser?.permissions || []) as string[]
  const canEdit = perms.some(p => p.startsWith('visits'))

  // أنواع الزيارات المسموح بها حسب الدور
  const allowedTypes: string[] = perms.includes('visits')
    ? ['جودة', 'سلامة', 'كهربائية', 'ميدانية']
    : [
        perms.includes('visits_quality')    ? 'جودة'     : null,
        perms.includes('visits_safety')     ? 'سلامة'    : null,
        perms.includes('visits_electrical') ? 'كهربائية' : null,
        perms.includes('visits_field')      ? 'ميدانية'  : null,
      ].filter(Boolean) as string[]

  const [loading,          setLoading]          = useState(true)
  const [search,           setSearch]           = useState('')
  const [showModal,        setShowModal]        = useState(false)
  const [editVisit,        setEditVisit]        = useState<Visit | null>(null)
  const [detailVisit,      setDetail]           = useState<Visit | null>(null)
  const [correctiveVisit,  setCorrectiveVisit]  = useState<Visit | null>(null)
  const [approvalVisit,    setApprovalVisit]    = useState<Visit | null>(null)
  const [selectedType,     setSelectedType]     = useState<string | null>(null)
  const [statusTab,        setStatusTab]        = useState('all')
  const [projectFilter,    setProjectFilter]    = useState('')


  useEffect(() => { loadVisits() }, [tenant?.id, activeBranch?.id])

  async function loadVisits() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const { data } = await visitsApi.getAll(tenant.id, activeBranch.id)
    setVisits(data || [])
    setLoading(false)
  }

  async function loadProjects() {
    if (!tenant || !activeBranch || projects.length > 0) return
    const { data } = await projectsApi.getAll(tenant.id, activeBranch.id)
    setProjects(data || [])
  }

  async function handleDelete(v: Visit) {
    if (currentUser?.role !== 'admin') { toast.error('⛔ الحذف للأدمن فقط'); return }
    if (!confirm('حذف هذه الزيارة نهائياً؟')) return
    await visitsApi.delete(v.id)
    await loadVisits()
    toast.success('تم الحذف')
  }

  async function handleSave(data: Partial<Visit>) {
    if (!tenant || !activeBranch) return
    const payload: any = { ...data, tenant_id: tenant.id, branch_id: activeBranch.id, project_id: data.project_id ? Number(data.project_id) : null }
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
    const { error } = await visitsApi.upsert(payload)
    if (error) { toast.error('خطأ: ' + (error as any)?.message); return }
    await loadVisits()
    setShowModal(false); setEditVisit(null)
    toast.success(editVisit ? 'تم التعديل' : 'تمت الإضافة ✅')
  }

  async function handleResolve(id: number, report: string, attachments: string[] = []) {
    if (!tenant) return
    // تحويل attachments (data URLs) إلى objects
    const correctionFiles = attachments.map((d, i) => ({ name: `تصحيح-${i+1}.jpg`, data: d }))
    const { error } = await supabase.from('visits').update({
      correction_notes: report,
      correction_files: correctionFiles.length > 0 ? correctionFiles : null,
      correction_date:  new Date().toISOString().split('T')[0],
      lifecycle:        'تصحيح',
      resolved_by:      currentUser?.name || '',
    }).eq('id', id).eq('tenant_id', tenant.id)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await loadVisits()
    setCorrectiveVisit(null); setDetail(null)
    toast.success('✅ تم تسجيل التصحيح — في انتظار الاعتماد')
  }

  async function handleApprove(id: number, notes: string) {
    if (!tenant) return
    const { error } = await supabase.from('visits').update({
      resolved_report: notes || 'تم الاعتماد',
      resolved_date:   new Date().toISOString().split('T')[0],
      resolved_by:     currentUser?.name || '',
      approval_notes:  notes || null,
      approved_by:     currentUser?.name || '',
      approved_date:   new Date().toISOString().split('T')[0],
      lifecycle:       'اعتماد',
      status:          'مغلق',
    }).eq('id', id).eq('tenant_id', tenant.id)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await loadVisits()
    setApprovalVisit(null); setDetail(null)
    toast.success('✅ تم اعتماد التصحيح وإغلاق الملاحظة')
  }

  // حسابات KPIs
  const openNCR   = visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
  const totalOk   = visits.filter(v => v.specs === 'مطابق').length
  const matchRate = visits.length ? Math.round(totalOk / visits.length * 100) : 0

  // الفلترة المدمجة
  const q = search.toLowerCase()
  const filtered = visits.filter(v => {
    const matchType    = !selectedType || v.type === selectedType
    // فلترة تلقائية حسب الصلاحيات — لو allowedTypes محدودة
    const matchAllowed = allowedTypes.length === 0 || allowedTypes.includes(v.type)
    const matchProject = !projectFilter || String(v.project_id) === projectFilter
    const matchStatus  =
      statusTab === 'all'    ? true :
      statusTab === 'ok'     ? v.specs === 'مطابق' :
      statusTab === 'open'   ? (v.specs === 'غير مطابق' && !v.resolved_report) :
      statusTab === 'closed' ? (v.specs === 'غير مطابق' && !!v.resolved_report) : true
    const matchSearch  = !q || v.engineer.toLowerCase().includes(q) ||
      ((v as any).location || '').toLowerCase().includes(q) ||
      (v.notes || '').toLowerCase().includes(q)
    return matchType && matchAllowed && matchProject && matchStatus && matchSearch
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardCheck style={{ width: '22px', height: '22px', color: '#1a56db' }} />
            الزيارات الفنية
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
            {visits.length} زيارة إجمالية
            {loading && <span style={{ width: '12px', height: '12px', border: '2px solid #e5e7eb', borderTopColor: '#6b7280', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite', marginRight: '8px' }} />}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditVisit(null); loadProjects(); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> زيارة جديدة
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الزيارات', value: visits.length,  color: '#1a56db', bg: '#eff6ff', icon: '📋' },
          { label: 'مطابق',           value: totalOk,         color: '#0ea77b', bg: '#ecfdf5', icon: '✅' },
          { label: 'NCR مفتوحة',      value: openNCR,         color: '#c81e1e', bg: openNCR > 0 ? '#fef2f2' : '#f9fafb', icon: '⚠️' },
          { label: 'نسبة المطابقة',   value: matchRate + '%', color: matchRate >= 80 ? '#0ea77b' : '#e6820a', bg: '#f9fafb', icon: '📊' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>{k.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر — 3 قوائم منسدلة + بحث */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 2fr', gap: '10px', alignItems: 'center' }}>

        {/* النوع */}
        <select value={selectedType || ''} onChange={e => setSelectedType(e.target.value || null)} className="select">
          <option value="">🔎 كل الأنواع</option>
          {VISIT_TYPES.filter(t => allowedTypes.length === 0 || allowedTypes.includes(t.id)).map(t => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.id} ({visits.filter(v => v.type === t.id).length})
            </option>
          ))}
        </select>

        {/* المشروع */}
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="select">
          <option value="">📁 كل المشاريع</option>
          {projects
            .filter(p => visits.some(v => v.project_id === p.id))
            .map(p => (
              <option key={p.id} value={String(p.id)}>
                {p.name} ({visits.filter(v => v.project_id === p.id).length})
              </option>
            ))
          }
        </select>

        {/* الحالة */}
        <select value={statusTab} onChange={e => setStatusTab(e.target.value)} className="select">
          <option value="all">📋 كل الحالات</option>
          <option value="ok">✅ مطابق</option>
          <option value="open">⚠️ NCR مفتوحة</option>
          <option value="closed">✓ NCR مغلقة</option>
        </select>

        {/* البحث */}
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input" style={{ paddingRight: '36px', fontSize: '0.82rem' }}
            placeholder="بحث بالمهندس أو الموقع..." />
        </div>
      </div>

      {/* زر مسح الفلاتر */}
      {(search || selectedType || projectFilter || statusTab !== 'all') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => { setSearch(''); setSelectedType(null); setProjectFilter(''); setStatusTab('all') }}
            className="btn btn-ghost" style={{ fontSize: '0.78rem', color: '#c81e1e' }}>
            <X style={{ width: '13px', height: '13px' }} /> مسح الفلاتر
          </button>
        </div>
      )}

      {/* الجدول */}
      {filtered.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <ClipboardCheck style={{ width: '48px', height: '48px', color: '#e5e7eb', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', fontWeight: 600 }}>لا توجد زيارات</p>
          <p style={{ color: '#d1d5db', fontSize: '0.78rem' }}>جرّب تغيير الفلتر أو أضف زيارة جديدة</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                {['النوع', 'التاريخ', 'المهندس', 'المشروع', 'النتيجة', 'الحالة', ''].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => {
                const isNCR    = v.specs === 'غير مطابق'
                const isOpen   = isNCR && !v.resolved_report
                const isClosed = isNCR && !!v.resolved_report
                const vt       = VISIT_TYPES.find(t => t.id === v.type)
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border)', background: isOpen ? '#fff8f8' : i % 2 === 0 ? 'white' : '#fafafa', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = isOpen ? '#fff8f8' : i % 2 === 0 ? 'white' : '#fafafa')}>

                    {/* النوع */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: vt?.bg || '#f3f4f6', color: vt?.color || '#6b7280' }}>
                        {vt?.icon} {v.type}
                      </span>
                    </td>

                    {/* التاريخ */}
                    <td style={{ padding: '12px 14px', color: 'var(--text3)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {formatDate(v.date)}
                    </td>

                    {/* المهندس */}
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{v.engineer}</td>

                    {/* المشروع */}
                    <td style={{ padding: '12px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>
                      {projects.find(p => p.id === v.project_id)?.name || '—'}
                    </td>

                    {/* النتيجة */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                        background: isNCR ? '#fef2f2' : '#ecfdf5',
                        color:      isNCR ? '#c81e1e' : '#0ea77b',
                      }}>
                        {isNCR ? '❌ غير مطابق' : '✅ مطابق'}
                      </span>
                    </td>

                    {/* الحالة */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {isNCR ? (() => {
                          const lc = (v as any).lifecycle || 'رصد'
                          const lcStyle: Record<string,{bg:string;color:string;icon:string}> = {
                            'رصد':     { bg:'#fffbeb', color:'#e6820a', icon:'👁️' },
                            'تصحيح':  { bg:'#eff6ff', color:'#1a56db', icon:'🔧' },
                            'اعتماد': { bg:'#ecfdf5', color:'#0ea77b', icon:'🛡️' },
                          }
                          const s = lcStyle[lc] || lcStyle['رصد']
                          return (
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: s.bg, color: s.color }}>
                              {s.icon} {lc}
                            </span>
                          )
                        })() : (
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#0ea77b' }}>
                            ✅ مطابق
                          </span>
                        )}
                        {isNCR && (v as any).severity && (
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700,
                            background: (v as any).severity === 'عالي' ? '#fef2f2' : (v as any).severity === 'متوسط' ? '#fffbeb' : '#ecfdf5',
                            color:      (v as any).severity === 'عالي' ? '#c81e1e' : (v as any).severity === 'متوسط' ? '#e6820a' : '#0ea77b' }}>
                            {(v as any).severity === 'عالي' ? '🔴' : (v as any).severity === 'متوسط' ? '🟡' : '🟢'} {(v as any).severity}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* الإجراءات */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setDetail(v)} title="تفاصيل"
                          style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}>
                          <Eye style={{ width: '13px', height: '13px' }} />
                        </button>
                        {isNCR && canEdit && (v as any).lifecycle !== 'تصحيح' && (v as any).lifecycle !== 'اعتماد' && (
                          <button onClick={() => setCorrectiveVisit(v)} title="تسجيل التصحيح"
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            🔧
                          </button>
                        )}
                        {isNCR && canEdit && (v as any).lifecycle === 'تصحيح' && (
                          <button onClick={() => setApprovalVisit(v)} title="اعتماد التصحيح"
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            🛡️
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button onClick={() => { setEditVisit(v); loadProjects(); setShowModal(true) }} title="تعديل"
                              style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--text3)' }}>
                              <Pencil style={{ width: '13px', height: '13px' }} />
                            </button>
                            <button onClick={() => handleDelete(v)} title="حذف"
                              style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                              <Trash2 style={{ width: '13px', height: '13px' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text3)' }}>
            {filtered.length} زيارة معروضة من أصل {visits.length}
          </div>
        </div>
      )}

      {/* المودالات */}
      {showModal && (
        <VisitModal visit={editVisit} projects={projects} allowedTypes={allowedTypes} onClose={() => { setShowModal(false); setEditVisit(null) }} onSave={handleSave} />
      )}
      {detailVisit && <VisitDetail visit={detailVisit} onClose={() => setDetail(null)} />}
      {correctiveVisit && (
        <CorrectiveModal visit={correctiveVisit}
          onClose={() => setCorrectiveVisit(null)}
          onSave={async (report, attachments) => { await handleResolve(correctiveVisit.id, report, attachments) }} />
      )}
      {approvalVisit && (
        <ApprovalModal visit={approvalVisit}
          approverName={currentUser?.name || ''}
          onClose={() => setApprovalVisit(null)}
          onApprove={handleApprove} />
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
