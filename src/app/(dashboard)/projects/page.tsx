'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/hooks/useStore'
import { projectsApi } from '@/lib/db'
import { formatDate, formatCurrency, daysUntil, PROJECT_STAGES } from '@/lib/utils'
import {
  Plus, Search, Eye, Pencil, Trash2, FolderOpen,
  LayoutGrid, List, TrendingUp, Clock, AlertTriangle, CheckCircle2
} from 'lucide-react'
import type { Project } from '@/types'
import toast from 'react-hot-toast'

// تحميل المكونات الثقيلة عند الحاجة فقط
const ProjectModal  = dynamic(() => import('@/components/projects/ProjectModal'),  { ssr: false })
const ProjectDetail = dynamic(() => import('@/components/projects/ProjectDetail'), { ssr: false })

export default function ProjectsPage() {
  const { tenant, activeBranch, projects, setProjects, currentUser } = useStore()
  const [loading, setLoading]         = useState(projects.length === 0)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [typeFilter, setType]         = useState('')
  // قراءة إعداد العرض من display_settings
  const defaultView = (tenant as any)?.display_settings?.projectsView || 'grid'
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>(defaultView as 'grid' | 'list')

  // تحديث viewMode عند تغيير الإعدادات
  useEffect(() => {
    const v = (tenant as any)?.display_settings?.projectsView
    if (v) setViewMode(v)
  }, [(tenant as any)?.display_settings?.projectsView])

  const [showModal, setShowModal]     = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [detailProject, setDetail]    = useState<Project | null>(null)

  const canEdit = currentUser?.permissions?.includes('projects_edit')

  useEffect(() => { loadProjects() }, [tenant?.id, activeBranch?.id])

  async function loadProjects() {
    if (!tenant || !activeBranch) return
    // إذا في بيانات مسبقة نحدّث في الخلفية بدون spinner
    if (projects.length === 0) setLoading(true)
    const { data } = await projectsApi.getAll(tenant.id, activeBranch.id)
    setProjects(data || [])
    setLoading(false)
  }

  async function handleSave(data: Partial<Project>) {
    if (!tenant || !activeBranch) return
    const { error } = await projectsApi.upsert({ ...data, tenant_id: tenant.id, branch_id: activeBranch.id })
    if (error) { toast.error('حدث خطأ في الحفظ'); return }
    await loadProjects()
    setShowModal(false); setEditProject(null)
    toast.success(editProject ? 'تم التعديل ✅' : 'تم إضافة المشروع ✅')
  }

  async function handleDelete(p: Project) {
    if (!confirm(`حذف المشروع "${p.name}"؟`)) return
    await projectsApi.delete(p.id)
    setProjects(projects.filter(x => x.id !== p.id))
    toast.success('تم حذف المشروع')
  }

  const now = new Date(); now.setHours(0, 0, 0, 0)

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return (
      (!q || p.name.toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q)) &&
      (!statusFilter || p.status === statusFilter) &&
      (!typeFilter   || p.type   === typeFilter)
    )
  })

  const activeCount = projects.filter(p => p.status !== 'مكتمل' && p.progress < 100).length
  const doneCount   = projects.filter(p => p.progress >= 100).length
  const lateCount   = projects.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now).length
  const soonCount   = projects.filter(p => { if (!p.end_date || p.progress >= 100) return false; const d = daysUntil(p.end_date); return d !== null && d >= 0 && d <= 14 }).length

  function getStatusColor(p: Project) {
    if (p.progress >= 100) return 'badge-green'
    const days = daysUntil(p.end_date)
    if (days !== null && days < 0) return 'badge-red'
    if (p.status === 'قيد التنفيذ') return 'badge-blue'
    return 'badge-gray'
  }

  function getCurrentStage(p: Project) {
    const stages = p.stages || []
    for (let i = PROJECT_STAGES.length - 1; i >= 0; i--) {
      if (stages.find(s => s.id === PROJECT_STAGES[i].id && s.done))
        return PROJECT_STAGES[Math.min(i + 1, PROJECT_STAGES.length - 1)]
    }
    return PROJECT_STAGES[0]
  }

  // ── عرض تفاصيل مشروع ──
  if (detailProject) {
    return (
      <ProjectDetail
        project={projects.find(p => p.id === detailProject.id) || detailProject}
        onBack={() => setDetail(null)}
        onEdit={(p) => { setEditProject(p); setShowModal(true) }}
        onRefresh={loadProjects}
      />
    )
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary-500" />
            المشاريع
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-2">
            {filtered.length} مشروع
            {loading && <span className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block" />}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditProject(null); setShowModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> مشروع جديد
          </button>
        )}
      </div>

      {/* Stats — تظهر فوراً من الـ store */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'نشطة',       value: activeCount, icon: <TrendingUp className="w-4 h-4" />,    cls: 'text-blue-600',    bg: 'bg-blue-50',    border: '',                                    onClick: () => { setStatus('قيد التنفيذ'); setType('') } },
          { label: 'مكتملة',     value: doneCount,   icon: <CheckCircle2 className="w-4 h-4" />,  cls: 'text-emerald-600', bg: 'bg-emerald-50', border: '',                                    onClick: () => {} },
          { label: 'متأخرة',     value: lateCount,   icon: <AlertTriangle className="w-4 h-4" />, cls: 'text-red-600',     bg: 'bg-red-50',     border: lateCount  > 0 ? 'border-red-200'   : '', onClick: () => {} },
          { label: 'تسليم قريب', value: soonCount,   icon: <Clock className="w-4 h-4" />,         cls: 'text-amber-600',   bg: 'bg-amber-50',   border: soonCount  > 0 ? 'border-amber-200' : '', onClick: () => {} },
        ].map(s => (
          <button key={s.label} onClick={s.onClick}
            className={`card p-4 flex items-center gap-3 hover:shadow-md transition-all text-right ${s.border}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg} ${s.cls}`}>
              {s.icon}
            </div>
            <div>
              <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pr-9 text-sm" placeholder="بحث بالاسم أو الرقم..." />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="select w-auto text-sm">
          <option value="">كل الحالات</option>
          {['تحت التخطيط','قيد التنفيذ','متأخر','مكتمل','موقوف'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={e => setType(e.target.value)} className="select w-auto text-sm">
          <option value="">كل الأنواع</option>
          {['801','802','441','442','805','405','O&M'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(search || statusFilter || typeFilter) && (
          <button onClick={() => { setSearch(''); setStatus(''); setType('') }}
            className="btn btn-ghost btn-sm text-gray-400">مسح</button>
        )}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mr-auto">
          <button onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* المحتوى — يظهر فوراً حتى أثناء التحديث */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">لا توجد مشاريع</p>
          {canEdit && (
            <button onClick={() => { setEditProject(null); setShowModal(true) }} className="btn btn-primary mt-4 mx-auto">
              <Plus className="w-4 h-4" /> إضافة مشروع
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const days   = daysUntil(p.end_date)
            const isLate = days !== null && days < 0 && p.progress < 100
            const stage  = getCurrentStage(p)
            return (
              <div key={p.id} className={`card p-5 hover:shadow-md transition-all ${isLate ? 'border-red-200' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {p.code && <span className="badge badge-gray text-xs">{p.code}</span>}
                      {p.type && <span className="badge badge-blue text-xs">{p.type}</span>}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">{p.name}</h3>
                  </div>
                  <span className={`badge ${getStatusColor(p)} text-xs flex-shrink-0`}>
                    {p.progress >= 100 ? 'مكتمل' : isLate ? 'متأخر' : p.status}
                  </span>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{stage.icon} {stage.name}</span>
                    <span className="text-xs font-bold text-primary-600">{p.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${p.progress >= 100 ? 'bg-emerald-500' : isLate ? 'bg-red-400' : 'bg-primary-500'}`}
                      style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
                  <div>
                    <span className="text-gray-400">المهندس</span>
                    <div className="font-medium text-gray-700 truncate">{p.engineer || '—'}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">القيمة</span>
                    <div className="font-medium text-gray-700">{p.value ? formatCurrency(p.value) : '—'}</div>
                  </div>
                  {p.end_date && (
                    <div className="col-span-2">
                      <span className="text-gray-400">التسليم</span>
                      <span className={`font-medium mr-1 ${isLate ? 'text-red-500' : days && days <= 7 ? 'text-amber-500' : 'text-gray-700'}`}>
                        {formatDate(p.end_date)}
                        {days !== null && p.progress < 100 && (
                          <span className="mr-1">({isLate ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? 'اليوم' : `${days} يوم`})</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-50">
                  <button onClick={() => setDetail(p)} className="btn btn-ghost btn-sm flex-1 justify-center">
                    <Eye className="w-3.5 h-3.5" /> تفاصيل
                  </button>
                  {canEdit && <>
                    <button onClick={() => { setEditProject(p); setShowModal(true) }} className="btn btn-ghost btn-sm px-2.5">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p)} className="btn btn-ghost btn-sm px-2.5 text-red-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>المشروع</th><th>النوع</th><th>المهندس</th>
                <th>الحالة</th><th>الإنجاز</th><th>التسليم</th><th>القيمة</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const days   = daysUntil(p.end_date)
                const isLate = days !== null && days < 0 && p.progress < 100
                return (
                  <tr key={p.id} className={isLate ? 'bg-red-50/30' : ''}>
                    <td>
                      <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
                      {p.code && <div className="text-xs text-gray-400 font-mono">{p.code}</div>}
                    </td>
                    <td>{p.type ? <span className="badge badge-blue text-xs">{p.type}</span> : '—'}</td>
                    <td className="text-gray-600 text-sm">{p.engineer || '—'}</td>
                    <td><span className={`badge ${getStatusColor(p)} text-xs`}>{p.progress >= 100 ? 'مكتمل' : isLate ? 'متأخر' : p.status}</span></td>
                    <td>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.progress >= 100 ? 'bg-emerald-500' : isLate ? 'bg-red-400' : 'bg-primary-500'}`}
                            style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-600 w-8 text-left">{p.progress}%</span>
                      </div>
                    </td>
                    <td className={`text-sm ${isLate ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {formatDate(p.end_date)}
                      {isLate && days !== null && <div className="text-xs text-red-400">متأخر {Math.abs(days)} يوم</div>}
                    </td>
                    <td className="text-sm text-gray-600">{p.value ? formatCurrency(p.value) : '—'}</td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setDetail(p)} className="btn btn-ghost btn-xs"><Eye className="w-3.5 h-3.5" /></button>
                        {canEdit && <>
                          <button onClick={() => { setEditProject(p); setShowModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(p)} className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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

      {/* Modals — تُحمَّل عند الحاجة فقط */}
      {showModal && (
        <ProjectModal project={editProject}
          onClose={() => { setShowModal(false); setEditProject(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
