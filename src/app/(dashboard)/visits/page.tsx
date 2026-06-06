'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/hooks/useStore'
import { visitsApi, projectsApi } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import {
  Plus, Search, Eye, Pencil, Trash2,
  ClipboardCheck, ArrowRight, Camera, ClipboardList
} from 'lucide-react'
import type { Visit } from '@/types'
import toast from 'react-hot-toast'

// تحميل المكونات الثقيلة عند الحاجة فقط
const VisitModal  = dynamic(() => import('./VisitModal'),  { ssr: false })
const VisitDetail = dynamic(() => import('./VisitDetail'), { ssr: false })
const NcrModal    = dynamic(() => import('./NcrModal'),    { ssr: false })

const VISIT_TYPES = [
  { id: 'جودة',     icon: '🔍', color: 'border-blue-200 bg-blue-50/60',     text: 'text-blue-700'    },
  { id: 'سلامة',    icon: '🛡️', color: 'border-amber-200 bg-amber-50/60',   text: 'text-amber-700'   },
  { id: 'كهربائية', icon: '⚡', color: 'border-yellow-200 bg-yellow-50/60', text: 'text-yellow-700'  },
  { id: 'ميدانية',  icon: '🏗️', color: 'border-emerald-200 bg-emerald-50/60', text: 'text-emerald-700' },
]

export default function VisitsPage() {
  const { tenant, activeBranch, visits, setVisits, projects, setProjects, currentUser } = useStore()
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [specsFilter, setSpecs]         = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [editVisit, setEditVisit]       = useState<Visit | null>(null)
  const [detailVisit, setDetail]        = useState<Visit | null>(null)
  const [ncrVisit, setNcrVisit]         = useState<Visit | null>(null)
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
    await visitsApi.upsert({
      id, tenant_id: tenant.id,
      resolved_report: report,
      resolved_date: new Date().toLocaleDateString('ar-EG'),
      resolved_by: currentUser?.name || '',
      status: 'مغلق',
    })
    await loadVisits()
    setDetail(null); setNcrVisit(null)
    toast.success('تم إغلاق NCR بنجاح ✅')
  }

  const openNCR = visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
  const totalOk = visits.filter(v => v.specs === 'مطابق').length

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-500" />
            الزيارات الفنية
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-2">
            {visits.length} زيارة إجمالية
            {loading && <span className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block" />}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditVisit(null); loadProjects(); setShowModal(true) }} className="btn btn-primary">
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

      {/* الصفحة الرئيسية — بطاقات الأنواع */}
      {!selectedType ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {VISIT_TYPES.map(type => {
              const typeVisits = visits.filter(v => v.type === type.id)
              const typeNCR    = typeVisits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
              const typeOk     = typeVisits.filter(v => v.specs === 'مطابق').length
              const matchRate  = typeVisits.length ? Math.round(typeOk / typeVisits.length * 100) : 0
              return (
                <button key={type.id} onClick={() => setSelectedType(type.id)}
                  className={`card p-5 text-right transition-all hover:shadow-lg border-2 ${type.color} w-full`}>
                  <div className="text-3xl mb-3">{type.icon}</div>
                  <div className={`font-bold text-lg mb-1 ${type.text}`}>زيارات {type.id}</div>
                  <div className="text-2xl font-bold text-gray-700 mb-3">{typeVisits.length}</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">نسبة المطابقة</span>
                      <span className={`font-bold ${matchRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>{matchRate}%</span>
                    </div>
                    <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${matchRate >= 80 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${matchRate}%` }} />
                    </div>
                    {typeNCR > 0 && (
                      <div className="mt-2">
                        <span className="badge badge-red text-xs">⚠ {typeNCR} NCR معلقة</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
      ) : (
        /* زيارات النوع المحدد */
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => { setSelectedType(null); setSearch(''); setSpecs('') }} className="btn btn-ghost btn-sm">
              <ArrowRight className="w-4 h-4" /> العودة
            </button>
            <div className="flex-1">
              <h2 className="font-bold text-gray-800">
                {VISIT_TYPES.find(t => t.id === selectedType)?.icon} زيارات {selectedType}
              </h2>
              <p className="text-xs text-gray-400">{visits.filter(v => v.type === selectedType).length} زيارة</p>
            </div>
          </div>

          <div className="card p-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="input pr-9 text-sm" placeholder="بحث بالمهندس أو الموقع..." />
            </div>
            <select value={specsFilter} onChange={e => setSpecs(e.target.value)} className="select w-auto text-sm">
              <option value="">كل النتائج</option>
              <option value="مطابق">مطابق</option>
              <option value="غير مطابق">غير مطابق (NCR)</option>
            </select>
          </div>

          {(() => {
            const q = search.toLowerCase()
            const filtered = visits.filter(v =>
              v.type === selectedType &&
              (!q || v.engineer.toLowerCase().includes(q) || (v.location||'').toLowerCase().includes(q)) &&
              (!specsFilter || v.specs === specsFilter)
            )
            return filtered.length === 0 ? (
              <div className="card p-16 text-center">
                <ClipboardCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد زيارات</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th><th>المهندس</th><th>الموقع</th>
                      <th>النتيجة</th><th>الحالة</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(v => {
                      const isNCR  = v.specs === 'غير مطابق'
                      const isOpen = isNCR && !v.resolved_report
                      return (
                        <tr key={v.id}>
                          <td className="text-gray-600 text-sm">{formatDate(v.date)}</td>
                          <td className="font-medium text-gray-800 text-sm">{v.engineer}</td>
                          <td className="text-gray-500 text-sm">{v.location || '—'}</td>
                          <td>
                            <span className={`badge ${isNCR ? 'badge-red' : 'badge-green'}`}>
                              {isNCR ? '❌ غير مطابق' : '✅ مطابق'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${isNCR ? (isOpen ? 'badge-amber' : 'badge-green') : 'badge-green'}`}>
                              {isNCR ? (isOpen ? '⚠ مفتوح' : '✓ مغلق') : 'مغلق'}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1 justify-end">
                              {v.attachments && v.attachments.length > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-blue-500 mr-1">
                                  <Camera className="w-3 h-3" />{v.attachments.length}
                                </span>
                              )}
                              <button onClick={() => setDetail(v)} className="btn btn-ghost btn-xs" title="عرض"><Eye className="w-3.5 h-3.5" /></button>
                              {isNCR && (
                                <button onClick={() => setNcrVisit(v)}
                                  className={`btn btn-ghost btn-xs ${isOpen ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                                  title="الإجراء التصحيحي">
                                  <ClipboardList className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canEdit && <>
                                <button onClick={() => { setEditVisit(v); loadProjects(); setShowModal(true) }}
                                  className="btn btn-ghost btn-xs" title="تعديل"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDelete(v)}
                                  className="btn btn-ghost btn-xs text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>}
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

      {/* Modals — تُحمَّل فقط عند الحاجة */}
      {showModal && (
        <VisitModal visit={editVisit} projects={projects}
          onClose={() => { setShowModal(false); setEditVisit(null) }}
          onSave={handleSave} />
      )}
      {detailVisit && (
        <VisitDetail visit={detailVisit}
          onClose={() => setDetail(null)}
          onResolve={handleResolve} />
      )}
      {ncrVisit && (
        <NcrModal visit={ncrVisit}
          onClose={() => setNcrVisit(null)}
          onResolve={handleResolve} />
      )}
    </div>
  )
}
