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
  onSave: (report: string) => Promise<void>
}) {
  const [report,  setReport]  = useState(visit.resolved_report || '')
  const [saving,  setSaving]  = useState(false)
  const isClosed = !!visit.resolved_report

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!report.trim()) { toast.error('أدخل تقرير الإجراء التصحيحي'); return }
    setSaving(true)
    await onSave(report.trim())
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 60 }}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: isClosed ? '#ecfdf5' : '#fffbeb', borderRadius: '10px 10px 0 0', margin: '-1px -1px 0' }}>
          <h3 style={{ fontWeight: 700, color: isClosed ? '#0ea77b' : '#e6820a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList style={{ width: '18px', height: '18px' }} />
            {isClosed ? 'تفاصيل الإجراء التصحيحي' : 'إجراء تصحيحي — NCR'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* معلومات الزيارة */}
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {visit.date     && <span>📅 {formatDate(visit.date)}</span>}
                {visit.engineer && <span>👷 {visit.engineer}</span>}
                {(visit as any).location && <span>📍 {(visit as any).location}</span>}
              </div>
              {visit.corrective && (
                <div style={{ color: '#c81e1e', marginTop: '4px' }}>
                  <span style={{ fontWeight: 600 }}>المخالفة: </span>{visit.corrective}
                </div>
              )}
            </div>

            {/* إذا كانت مغلقة — عرض فقط */}
            {isClosed ? (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text3)', marginBottom: '8px' }}>تقرير الإجراء التصحيحي:</div>
                <div style={{ padding: '12px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #86efac', fontSize: '0.875rem', lineHeight: 1.7 }}>
                  {visit.resolved_report}
                </div>
                {visit.resolved_by && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#9ca3af' }}>
                    ✅ أُغلق بواسطة: {visit.resolved_by}
                    {visit.resolved_date && ` — ${formatDate(visit.resolved_date)}`}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  تقرير الإجراء التصحيحي <span style={{ color: '#c81e1e' }}>*</span>
                </label>
                <textarea
                  value={report}
                  onChange={e => setReport(e.target.value)}
                  className="input"
                  style={{ minHeight: '120px', resize: 'none' }}
                  placeholder="صف الإجراء التصحيحي المتخذ لإغلاق هذه المخالفة..."
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              {isClosed ? 'إغلاق' : 'إلغاء'}
            </button>
            {!isClosed && (
              <button type="submit" disabled={saving || !report.trim()} className="btn btn-primary" style={{ background: '#0ea77b' }}>
                {saving
                  ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  : <Save style={{ width: '14px', height: '14px' }} />}
                إغلاق NCR
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function VisitsPage() {
  const { tenant, activeBranch, visits, setVisits, projects, setProjects, currentUser } = useStore()
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [specsFilter, setSpecs]         = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [editVisit, setEditVisit]       = useState<Visit | null>(null)
  const [detailVisit, setDetail]        = useState<Visit | null>(null)
  const [correctiveVisit, setCorrectiveVisit] = useState<Visit | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)

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
    if (!confirm('حذف هذه الزيارة؟')) return
    await visitsApi.delete(v.id)
    await loadVisits()
    toast.success('تم الحذف')
  }

  async function handleSave(data: Partial<Visit>) {
    if (!tenant || !activeBranch) return
    const { error } = await visitsApi.upsert({
      ...data, tenant_id: tenant.id, branch_id: activeBranch.id,
      project_id: data.project_id ? Number(data.project_id) : undefined,
    })
    if (error) { toast.error(`حدث خطأ: ${(error as any)?.message}`); return }
    await loadVisits()
    setShowModal(false); setEditVisit(null)
    toast.success(editVisit ? 'تم التعديل' : 'تم إضافة الزيارة')
  }

  async function handleResolve(id: number, report: string) {
    if (!tenant) return
    const { error } = await visitsApi.upsert({
      id,
      tenant_id:       tenant.id,
      resolved_report: report,
      resolved_date:   new Date().toLocaleDateString('ar-EG'),
      resolved_by:     currentUser?.name || '',
      status:          'مغلق',
    })
    if (error) { toast.error('خطأ في الحفظ'); return }

    // تحديث الـ state مباشرة بدون إغلاق المودال أولاً
    await loadVisits()
    setCorrectiveVisit(null)
    setDetail(null)
    toast.success('✅ تم إغلاق NCR بنجاح')
  }

  const openNCR = visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
  const totalOk = visits.filter(v => v.specs === 'مطابق').length

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a1a2e' }}>{visits.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>إجمالي الزيارات</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center', background: openNCR > 0 ? '#fef2f2' : 'white', border: openNCR > 0 ? '1px solid #fecaca' : '' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: openNCR > 0 ? '#c81e1e' : '#1a1a2e' }}>{openNCR}</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>NCR معلقة</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center', background: '#ecfdf5', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0ea77b' }}>{totalOk}</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>مطابق</div>
        </div>
      </div>

      {/* بطاقات الأنواع */}
      {!selectedType ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {VISIT_TYPES.map(type => {
            const typeVisits = visits.filter(v => v.type === type.id)
            const typeNCR    = typeVisits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
            const typeOk     = typeVisits.filter(v => v.specs === 'مطابق').length
            const matchRate  = typeVisits.length ? Math.round(typeOk / typeVisits.length * 100) : 0
            return (
              <button key={type.id} onClick={() => setSelectedType(type.id)}
                style={{ padding: '20px', borderRadius: '14px', border: `2px solid ${type.border}`, background: type.bg, cursor: 'pointer', textAlign: 'right', transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{type.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: type.color, marginBottom: '4px' }}>زيارات {type.id}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '10px' }}>{typeVisits.length}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ color: '#9ca3af' }}>نسبة المطابقة</span>
                  <span style={{ fontWeight: 700, color: matchRate >= 80 ? '#0ea77b' : '#e6820a' }}>{matchRate}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.6)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '4px', width: `${matchRate}%`, background: matchRate >= 80 ? '#0ea77b' : '#e6820a', transition: 'width 0.3s' }} />
                </div>
                {typeNCR > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <span className="badge badge-red" style={{ fontSize: '0.72rem' }}>⚠ {typeNCR} NCR معلقة</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        /* زيارات النوع المحدد */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => { setSelectedType(null); setSearch(''); setSpecs('') }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.82rem', color: '#6b7280' }}>
              <ArrowRight style={{ width: '15px', height: '15px' }} /> العودة
            </button>
            <div>
              <h2 style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '1rem' }}>
                {VISIT_TYPES.find(t => t.id === selectedType)?.icon} زيارات {selectedType}
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{visits.filter(v => v.type === selectedType).length} زيارة</p>
            </div>
          </div>

          {/* فلاتر */}
          <div className="card" style={{ padding: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9ca3af' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="input" style={{ paddingRight: '32px', fontSize: '0.82rem' }}
                placeholder="بحث بالمهندس أو الموقع..." />
            </div>
            <select value={specsFilter} onChange={e => setSpecs(e.target.value)} className="select" style={{ width: 'auto', fontSize: '0.82rem' }}>
              <option value="">كل النتائج</option>
              <option value="مطابق">مطابق</option>
              <option value="غير مطابق">غير مطابق (NCR)</option>
            </select>
          </div>

          {(() => {
            const q = search.toLowerCase()
            const filtered = visits.filter(v =>
              v.type === selectedType &&
              (!q || v.engineer.toLowerCase().includes(q) || ((v as any).location || '').toLowerCase().includes(q)) &&
              (!specsFilter || v.specs === specsFilter)
            )
            return filtered.length === 0 ? (
              <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                <ClipboardCheck style={{ width: '48px', height: '48px', color: '#e5e7eb', margin: '0 auto 12px' }} />
                <p style={{ color: '#9ca3af' }}>لا توجد زيارات</p>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['التاريخ', 'المهندس', 'الموقع', 'النتيجة', 'الحالة', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(v => {
                      const isNCR  = v.specs === 'غير مطابق'
                      const isOpen = isNCR && !v.resolved_report
                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{formatDate(v.date)}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: '0.82rem' }}>{v.engineer}</td>
                          <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: '0.78rem' }}>{(v as any).location || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className={`badge ${isNCR ? 'badge-red' : 'badge-green'}`}>
                              {isNCR ? '❌ غير مطابق' : '✅ مطابق'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className={`badge ${isNCR ? (isOpen ? 'badge-amber' : 'badge-green') : 'badge-green'}`}>
                              {isNCR ? (isOpen ? '⚠ مفتوح' : '✓ مغلق') : 'مغلق'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                              {v.attachments && v.attachments.length > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem', color: '#1a56db', marginLeft: '4px' }}>
                                  <Camera style={{ width: '12px', height: '12px' }} />{v.attachments.length}
                                </span>
                              )}

                              {/* زر عرض التفاصيل */}
                              <button onClick={() => setDetail(v)}
                                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Eye style={{ width: '12px', height: '12px' }} /> عرض
                              </button>

                              {/* زر الإجراء التصحيحي — فقط للغير مطابق */}
                              {isNCR && (
                                <button onClick={() => setCorrectiveVisit(v)}
                                  style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${isOpen ? '#fcd34d' : '#86efac'}`, background: isOpen ? '#fffbeb' : '#ecfdf5', cursor: 'pointer', color: isOpen ? '#e6820a' : '#0ea77b', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <ClipboardList style={{ width: '12px', height: '12px' }} />
                                  {isOpen ? 'إجراء تصحيحي' : 'مغلق'}
                                </button>
                              )}

                              {/* زر التعديل */}
                              {canEdit && (
                                <button onClick={() => { setEditVisit(v); loadProjects(); setShowModal(true) }}
                                  style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                                  <Pencil style={{ width: '12px', height: '12px' }} />
                                </button>
                              )}

                              {/* زر الحذف */}
                              {canEdit && (
                                <button onClick={() => handleDelete(v)}
                                  style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e', display: 'flex', alignItems: 'center' }}>
                                  <Trash2 style={{ width: '12px', height: '12px' }} />
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
            )
          })()}
        </>
      )}

      {/* Modals */}
      {showModal && (
        <VisitModal visit={editVisit} projects={projects}
          onClose={() => { setShowModal(false); setEditVisit(null) }}
          onSave={handleSave} />
      )}

      {detailVisit && (
        <VisitDetail
          visit={visits.find(v => v.id === detailVisit.id) || detailVisit}
          onClose={() => setDetail(null)}
          onResolve={handleResolve}
        />
      )}

      {correctiveVisit && (
        <CorrectiveModal
          visit={visits.find(v => v.id === correctiveVisit.id) || correctiveVisit}
          onClose={() => setCorrectiveVisit(null)}
          onSave={(report) => handleResolve(correctiveVisit.id, report)}
        />
      )}
    </div>
  )
}
