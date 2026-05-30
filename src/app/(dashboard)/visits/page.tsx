'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { visitsApi, projectsApi } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import {
  Plus, Search, Filter, Eye, Pencil, Trash2,
  ClipboardCheck, CheckCircle2, AlertTriangle, X, Upload, ArrowRight
} from 'lucide-react'
import type { Visit, Project } from '@/types'
import toast from 'react-hot-toast'

// ── Modal إضافة / تعديل زيارة ──────────────────────────────────────
function VisitModal({ visit, projects, onClose, onSave }: {
  visit: Visit | null
  projects: Project[]
  onClose: () => void
  onSave: (data: Partial<Visit>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type:       (visit?.type        || 'جودة') as Visit['type'],
    date:       visit?.date         || new Date().toISOString().split('T')[0],
    engineer:   visit?.engineer     || '',
    project_id: visit?.project_id   || ('' as any),
    location:   visit?.location     || '',
    specs:      (visit?.specs       || 'مطابق') as Visit['specs'],
    corrective: visit?.corrective   || '',
    notes:      visit?.notes        || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.engineer.trim()) return
    setSaving(true)
    await onSave({
      ...(visit ? { id: visit.id } : {}),
      type:       form.type,
      date:       form.date,
      engineer:   form.engineer,
      project_id: form.project_id || undefined,
      location:   form.location   || undefined,
      specs:      form.specs,
      status:     form.specs === 'مطابق' ? 'مغلق' : 'مفتوح',
      corrective: form.specs === 'غير مطابق' ? form.corrective : undefined,
      notes:      form.notes      || undefined,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{visit ? 'تعديل زيارة' : 'زيارة جديدة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الزيارة</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                  {(['جودة','سلامة','كهربائية','ميدانية'] as const).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المهندس المسؤول <span className="text-red-500">*</span></label>
              <input value={form.engineer} onChange={e => set('engineer', e.target.value)} className="input" placeholder="اسم المهندس" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع (اختياري)</label>
                <select value={form.project_id} onChange={e => set('project_id', e.target.value ? Number(e.target.value) : '')} className="select">
                  <option value="">— غير مرتبط —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="اسم الموقع" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نتيجة الفحص</label>
              <div className="flex gap-3">
                {(['مطابق','غير مطابق'] as const).map(s => (
                  <button key={s} type="button"
                    onClick={() => set('specs', s)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.specs === s
                        ? s === 'مطابق' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {s === 'مطابق' ? '✅' : '❌'} {s}
                  </button>
                ))}
              </div>
            </div>
            {form.specs === 'غير مطابق' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الإجراء التصحيحي</label>
                <textarea value={form.corrective} onChange={e => set('corrective', e.target.value)}
                  className="input min-h-[80px] resize-none" placeholder="وصف الإجراء التصحيحي المطلوب..." />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="input min-h-[70px] resize-none" placeholder="ملاحظات إضافية..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {visit ? 'حفظ التعديلات' : 'إضافة الزيارة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal تفاصيل / إغلاق NCR ───────────────────────────────────────
function VisitDetail({ visit, onClose, onResolve }: {
  visit: Visit
  onClose: () => void
  onResolve: (id: number, report: string) => Promise<void>
}) {
  const [resolving, setResolving] = useState(false)
  const [report, setReport] = useState('')
  const isNCR = visit.specs === 'غير مطابق'
  const isOpen = !visit.resolved_report

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault()
    if (!report.trim()) return
    setResolving(true)
    await onResolve(visit.id, report)
    setResolving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-2xl">
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800">تفاصيل الزيارة</h3>
            <p className="text-xs text-gray-400 mt-0.5">{visit.type} · {formatDate(visit.date)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body">
          {/* Status banner */}
          <div className={`rounded-xl p-3 flex items-center gap-3 ${isNCR && isOpen ? 'bg-red-50 border border-red-200' : isNCR ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-50 border border-emerald-200'}`}>
            {isNCR && isOpen ? <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
            <div>
              <div className="font-semibold text-sm">{isNCR && isOpen ? 'NCR معلقة — تحتاج إجراء تصحيحي' : visit.specs === 'مطابق' ? 'مطابق للمواصفات' : 'تم إغلاق NCR'}</div>
              {visit.resolved_date && <div className="text-xs text-gray-500 mt-0.5">أُغلق في {formatDate(visit.resolved_date)} بواسطة {visit.resolved_by}</div>}
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'نوع الزيارة',        value: visit.type },
              { label: 'المهندس المسؤول',    value: visit.engineer },
              { label: 'التاريخ',            value: formatDate(visit.date) },
              { label: 'الموقع',             value: visit.location || '—' },
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                <div className="font-semibold text-gray-800 text-sm">{item.value}</div>
              </div>
            ))}
          </div>

          {visit.corrective && (
            <div>
              <div className="text-xs text-gray-400 mb-1">الإجراء التصحيحي المطلوب</div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">{visit.corrective}</div>
            </div>
          )}
          {visit.notes && (
            <div>
              <div className="text-xs text-gray-400 mb-1">الملاحظات</div>
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">{visit.notes}</div>
            </div>
          )}

          {/* Resolve form */}
          {isNCR && isOpen && (
            <form onSubmit={handleResolve} className="border-t border-gray-100 pt-4 space-y-3">
              <div className="font-semibold text-sm text-gray-700">إغلاق NCR</div>
              <textarea value={report} onChange={e => setReport(e.target.value)}
                className="input min-h-[80px] resize-none" placeholder="تقرير الإجراء التصحيحي المنفذ..." required />
              <button type="submit" disabled={resolving} className="btn btn-success w-full justify-center">
                {resolving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                تأكيد إغلاق NCR
              </button>
            </form>
          )}
          {isNCR && !isOpen && visit.resolved_report && (
            <div>
              <div className="text-xs text-gray-400 mb-1">تقرير الإغلاق</div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">{visit.resolved_report}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── الصفحة الرئيسية ─────────────────────────────────────────────────
export default function VisitsPage() {
  const { tenant, activeBranch, visits, setVisits, projects, setProjects, currentUser } = useStore()
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [specsFilter, setSpecs]     = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editVisit, setEditVisit]   = useState<Visit | null>(null)
  const [detailVisit, setDetail]    = useState<Visit | null>(null)

  const canEdit = currentUser?.permissions?.some(p => p.startsWith('visits'))

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const [v, p] = await Promise.all([
      visitsApi.getAll(tenant.id, activeBranch.id),
      projectsApi.getAll(tenant.id, activeBranch.id),
    ])
    setVisits(v.data || [])
    setProjects(p.data || [])
    setLoading(false)
  }

  async function handleDelete(v: Visit) {
    if (!confirm(`حذف هذه الزيارة؟`)) return
    await visitsApi.delete(v.id)
    setVisits(visits.filter(x => x.id !== v.id))
    toast.success('تم الحذف')
  }

  async function handleSave(data: Partial<Visit>) {
    if (!tenant || !activeBranch) return
    const { data: saved, error } = await visitsApi.upsert({ ...data, tenant_id: tenant.id, branch_id: activeBranch.id })
    if (error) { toast.error('حدث خطأ'); return }
    await loadData()
    setShowModal(false)
    setEditVisit(null)
    toast.success(editVisit ? 'تم التعديل' : 'تم إضافة الزيارة')
  }

  async function handleResolve(id: number, report: string) {
    if (!tenant) return
    const now = new Date().toLocaleDateString('ar-EG')
    await visitsApi.upsert({
      id, tenant_id: tenant.id,
      resolved_report: report,
      resolved_date: now,
      resolved_by: currentUser?.name || '',
      status: 'مغلق',
    })
    await loadData()
    setDetail(null)
    toast.success('تم إغلاق NCR بنجاح ✅')
  }

  const filtered = visits.filter(v => {
    const q = search.toLowerCase()
    const matchS = !q || v.engineer.toLowerCase().includes(q) || v.type.includes(q) || (v.location||'').toLowerCase().includes(q)
    const matchT = !typeFilter  || v.type  === typeFilter
    const matchSp = !specsFilter || v.specs === specsFilter
    return matchS && matchT && matchSp
  })

  const openNCR  = visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
  const totalOk  = visits.filter(v => v.specs === 'مطابق').length
  const closedNCR = visits.filter(v => v.specs === 'غير مطابق' && v.resolved_report).length

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-500" />
            الزيارات الفنية
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{filtered.length} زيارة</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditVisit(null); setShowModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> زيارة جديدة
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{visits.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">إجمالي الزيارات</div>
        </div>
        <div className={`card p-4 text-center ${openNCR > 0 ? 'border-red-200 bg-red-50/50' : ''}`}>
          <div className={`text-2xl font-bold ${openNCR > 0 ? 'text-red-600' : 'text-gray-800'}`}>{openNCR}</div>
          <div className="text-xs text-gray-400 mt-0.5">NCR معلقة</div>
        </div>
        <div className="card p-4 text-center border-emerald-100 bg-emerald-50/30">
          <div className="text-2xl font-bold text-emerald-600">{totalOk}</div>
          <div className="text-xs text-gray-400 mt-0.5">مطابق</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pr-9 text-sm" placeholder="بحث بالمهندس أو الموقع..." />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="select w-auto text-sm">
          <option value="">كل الأنواع</option>
          {['جودة','سلامة','كهربائية','ميدانية'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={specsFilter} onChange={e => setSpecs(e.target.value)} className="select w-auto text-sm">
          <option value="">كل النتائج</option>
          <option value="مطابق">مطابق</option>
          <option value="غير مطابق">غير مطابق (NCR)</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">لا توجد زيارات</p>
          {canEdit && (
            <button onClick={() => { setEditVisit(null); setShowModal(true) }} className="btn btn-primary mt-4 mx-auto">
              <Plus className="w-4 h-4" /> إضافة زيارة
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>التاريخ</th>
                <th>المهندس</th>
                <th>الموقع</th>
                <th>النتيجة</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const isNCR  = v.specs === 'غير مطابق'
                const isOpen = isNCR && !v.resolved_report
                return (
                  <tr key={v.id}>
                    <td>
                      <span className="badge badge-blue">{v.type}</span>
                    </td>
                    <td className="text-gray-600 text-sm">{formatDate(v.date)}</td>
                    <td className="font-medium text-gray-800 text-sm">{v.engineer}</td>
                    <td className="text-gray-500 text-sm">{v.location || '—'}</td>
                    <td>
                      <span className={`badge ${isNCR ? 'badge-red' : 'badge-green'}`}>
                        {isNCR ? '❌ غير مطابق' : '✅ مطابق'}
                      </span>
                    </td>
                    <td>
                      {isNCR ? (
                        <span className={`badge ${isOpen ? 'badge-amber' : 'badge-green'}`}>
                          {isOpen ? '⚠ مفتوح' : '✓ مغلق'}
                        </span>
                      ) : (
                        <span className="badge badge-green">مغلق</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setDetail(v)} className="btn btn-ghost btn-xs"><Eye className="w-3.5 h-3.5" /></button>
                        {canEdit && <>
                          <button onClick={() => { setEditVisit(v); setShowModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(v)} className="btn btn-ghost btn-xs text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <VisitModal
          visit={editVisit}
          projects={projects}
          onClose={() => { setShowModal(false); setEditVisit(null) }}
          onSave={handleSave}
        />
      )}
      {detailVisit && (
        <VisitDetail
          visit={visits.find(v => v.id === detailVisit.id) || detailVisit}
          onClose={() => setDetail(null)}
          onResolve={handleResolve}
        />
      )}
    </div>
  )
}
