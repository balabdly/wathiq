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

const VISIT_TYPES = [
  { id: 'جودة',     icon: '🔍', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'سلامة',    icon: '🛡️', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d' },
  { id: 'كهربائية', icon: '⚡', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'ميدانية',  icon: '🏗️', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac' },
]

// ══════════════════════════════════════
// مودال الإجراء التصحيحي (موحّد)
// ══════════════════════════════════════
function CorrectiveModal({ visit, onClose, onSave }: {
  visit: Visit
  onClose: () => void
  onSave: (report: string, attachments: string[]) => Promise<void>
}) {
  const [report,      setReport]      = useState(visit.resolved_report || '')
  const [files,       setFiles]       = useState<File[]>([])
  const [previews,    setPreviews]    = useState<string[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const isClosed = !!visit.resolved_report

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selected])
    selected.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => setPreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!report.trim()) { toast.error('أدخل تقرير الإجراء التصحيحي'); return }
    setSaving(true)
    setUploading(files.length > 0)
    // رفع المرفقات إلى Supabase Storage
    const uploadedUrls: string[] = []
    for (const file of files) {
      const ext  = file.name.split('.').pop()
      const path = `ncr/${visit.id}/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('attachments').upload(path, file, { upsert: true })
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path)
        uploadedUrls.push(urlData.publicUrl)
      }
    }
    setUploading(false)
    await onSave(report.trim(), uploadedUrls)
    setSaving(false)
  }

  // render CorrectiveModal...
  return (
    <div className="modal-overlay" onMouseDown={(e) => { (e.currentTarget as any)._md = e.target }} onClick={(e) => { if (e.target === e.currentTarget && (e.currentTarget as any)._md === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>📋 إغلاق NCR — إجراء تصحيحي</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', fontSize: '0.82rem', color: '#c81e1e' }}>
            ⚠️ {visit.corrective || visit.notes || 'مخالفة تحتاج إجراء تصحيحي'}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>تقرير الإجراء التصحيحي <span style={{ color: '#c81e1e' }}>*</span></label>
            <textarea value={report} onChange={e => setReport(e.target.value)}
              className="input" style={{ minHeight: '90px', resize: 'none' }}
              placeholder="اكتب تفاصيل الإجراء التصحيحي المتخذ..." />
          </div>
          {isClosed && (
            <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '8px', padding: '12px', fontSize: '0.82rem', color: '#0ea77b' }}>
              ✅ تم إغلاق NCR مسبقاً — {visit.resolved_by} في {formatDate(visit.resolved_date || '')}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          {!isClosed && (
            <button onClick={handleSubmit} disabled={saving || !report.trim()} className="btn btn-primary" style={{ background: '#0ea77b' }}>
              {saving ? 'جاري الحفظ...' : '✅ إغلاق NCR'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
export default function VisitsPage() {
  const { tenant, activeBranch, visits, setVisits, projects, setProjects, currentUser } = useStore()
  const [loading,          setLoading]          = useState(true)
  const [search,           setSearch]           = useState('')
  const [showModal,        setShowModal]        = useState(false)
  const [editVisit,        setEditVisit]        = useState<Visit | null>(null)
  const [detailVisit,      setDetail]           = useState<Visit | null>(null)
  const [correctiveVisit,  setCorrectiveVisit]  = useState<Visit | null>(null)
  const [selectedType,     setSelectedType]     = useState<string | null>(null)
  const [statusTab,        setStatusTab]        = useState('all')
  const [projectFilter,    setProjectFilter]    = useState('')

  const canEdit = currentUser?.permissions?.some(p => p.startsWith('visits'))

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
    const { error } = await supabase.from('visits').update({
      resolved_report: report, resolved_date: new Date().toISOString().split('T')[0],
      resolved_by: currentUser?.name || '', status: 'مغلق', specs: 'مطابق',
      ncr_attachments: attachments.length > 0 ? attachments : undefined,
    }).eq('id', id).eq('tenant_id', tenant.id)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await loadVisits()
    setCorrectiveVisit(null); setDetail(null)
    toast.success('✅ تم إغلاق NCR')
  }

  // حسابات KPIs
  const openNCR   = visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
  const totalOk   = visits.filter(v => v.specs === 'مطابق').length
  const matchRate = visits.length ? Math.round(totalOk / visits.length * 100) : 0

  // الفلترة المدمجة
  const q = search.toLowerCase()
  const filtered = visits.filter(v => {
    const matchType    = !selectedType || v.type === selectedType
    const matchProject = !projectFilter || String(v.project_id) === projectFilter
    const matchStatus  =
      statusTab === 'all'    ? true :
      statusTab === 'ok'     ? v.specs === 'مطابق' :
      statusTab === 'open'   ? (v.specs === 'غير مطابق' && !v.resolved_report) :
      statusTab === 'closed' ? (v.specs === 'غير مطابق' && !!v.resolved_report) : true
    const matchSearch  = !q || v.engineer.toLowerCase().includes(q) ||
      ((v as any).location || '').toLowerCase().includes(q) ||
      (v.notes || '').toLowerCase().includes(q)
    return matchType && matchProject && matchStatus && matchSearch
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
          {VISIT_TYPES.map(t => (
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
                      {isOpen ? (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: '#fef2f2', color: '#c81e1e' }}>
                          ⚠️ NCR مفتوحة
                        </span>
                      ) : isClosed ? (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#0ea77b' }}>
                          ✓ NCR مغلقة
                        </span>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: '#f0fdf4', color: '#0ea77b' }}>
                          ✓ مغلق
                        </span>
                      )}
                    </td>

                    {/* الإجراءات */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setDetail(v)} title="تفاصيل"
                          style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}>
                          <Eye style={{ width: '13px', height: '13px' }} />
                        </button>
                        {isOpen && canEdit && (
                          <button onClick={() => setCorrectiveVisit(v)} title="إغلاق NCR"
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            <ClipboardList style={{ width: '13px', height: '13px' }} />
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
        <VisitModal visit={editVisit} projects={projects} onClose={() => { setShowModal(false); setEditVisit(null) }} onSave={handleSave} />
      )}
      {detailVisit && <VisitDetail visit={detailVisit} onClose={() => setDetail(null)} />}
      {correctiveVisit && (
        <CorrectiveModal visit={correctiveVisit}
          onClose={() => setCorrectiveVisit(null)}
          onSave={async (report, attachments) => { await handleResolve(correctiveVisit.id, report, attachments) }} />
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
