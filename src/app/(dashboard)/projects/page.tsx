'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/hooks/useStore'
import { projectsApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, daysUntil, PROJECT_STAGES } from '@/lib/utils'
import {
  Plus, Search, Eye, Pencil, Trash2, FolderOpen,
  LayoutGrid, List, Columns, TrendingUp, Clock,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight
} from 'lucide-react'
import type { Project } from '@/types'
import toast from 'react-hot-toast'

const ProjectModal  = dynamic(() => import('@/components/projects/ProjectModal'),  { ssr: false })
const ProjectDetail = dynamic(() => import('@/components/projects/ProjectDetail'), { ssr: false })

// ── المستندات الإلزامية للإغلاق ──
const REQUIRED_DOC_CATEGORIES = ['مخططات', 'رخصة بلدية', 'إخلاء بلدية', 'مستخلصات', 'فواتير']

// ── ألوان وإعدادات الأعمدة ──
const COLUMNS = [
  { id: 'تحت التخطيط', label: 'تحت التخطيط', icon: '📋', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { id: 'قيد التنفيذ',  label: 'قيد التنفيذ',  icon: '🔄', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'متأخر',        label: 'متأخر',         icon: '⚠️', color: '#c81e1e', bg: '#fef2f2', border: '#fca5a5' },
  { id: 'مكتمل',        label: 'مكتمل',         icon: '✅', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac' },
  { id: 'موقوف',        label: 'موقوف',          icon: '🚫', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d' },
]

function getStatusColor(p: Project) {
  const days = daysUntil(p.end_date)
  if (p.progress >= 100 || p.status === 'مكتمل') return 'badge-green'
  if (days !== null && days < 0) return 'badge-red'
  if (p.status === 'قيد التنفيذ') return 'badge-blue'
  if (p.status === 'موقوف') return 'badge-amber'
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

// ══════════════════════════════════════
// بطاقة الـ Kanban
// ══════════════════════════════════════
function KanbanCard({ p, canEdit, onView, onEdit, onDelete, onMove }: {
  p: Project; canEdit: boolean
  onView: () => void; onEdit: () => void; onDelete: () => void
  onMove: (direction: 'prev' | 'next') => void
}) {
  const days   = daysUntil(p.end_date)
  const isLate = days !== null && days < 0 && p.progress < 100
  const stage  = getCurrentStage(p)
  const colIdx = COLUMNS.findIndex(c => c.id === p.status)

  return (
    <div style={{
      background: 'white', borderRadius: '10px', padding: '10px',
      border: `1px solid ${isLate ? '#fca5a5' : '#e5e7eb'}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.15s, transform 0.15s',
      cursor: 'pointer',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
      onClick={onView}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {(p.code || p.type) && (
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
              {p.code && <span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>{p.code}</span>}
              {p.type && <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{p.type}</span>}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {p.name}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{stage.icon} {stage.name}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1a56db' }}>{p.progress}%</span>
        </div>
        <div style={{ height: '5px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '4px', transition: 'width 0.3s',
            width: `${p.progress}%`,
            background: p.progress >= 100 ? '#0ea77b' : isLate ? '#ef4444' : '#1a56db',
          }} />
        </div>
      </div>

      {/* Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>المهندس</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.engineer || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>القيمة</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{p.value ? formatCurrency(p.value) : '—'}</div>
        </div>
        {p.end_date && (
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>التسليم</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: isLate ? '#ef4444' : days !== null && days <= 7 ? '#f59e0b' : '#374151' }}>
              {formatDate(p.end_date)}
              {days !== null && p.progress < 100 && (
                <span style={{ marginRight: '4px', fontSize: '0.7rem' }}>
                  ({isLate ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? 'اليوم' : `${days} يوم`})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '4px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}
        onClick={e => e.stopPropagation()}>
        {/* نقل للعمود السابق */}
        {canEdit && colIdx > 0 && (
          <button onClick={() => onMove('prev')}
            style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}
            title={`نقل إلى: ${COLUMNS[colIdx - 1].label}`}>
            <ChevronRight style={{ width: '13px', height: '13px' }} />
          </button>
        )}
        {/* نقل للعمود التالي */}
        {canEdit && colIdx < COLUMNS.length - 1 && (
          <button onClick={() => onMove('next')}
            style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}
            title={`نقل إلى: ${COLUMNS[colIdx + 1].label}`}>
            <ChevronLeft style={{ width: '13px', height: '13px' }} />
          </button>
        )}
        <button onClick={onView}
          style={{ flex: 1, padding: '5px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#1a56db', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <Eye style={{ width: '13px', height: '13px' }} /> تفاصيل
        </button>
        {canEdit && (
          <>
            <button onClick={onEdit}
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
              <Pencil style={{ width: '13px', height: '13px' }} />
            </button>
            <button onClick={onDelete}
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <Trash2 style={{ width: '13px', height: '13px' }} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function ProjectsPage() {
  const { tenant, activeBranch, projects, setProjects, currentUser } = useStore()
  const [loading, setLoading]         = useState(projects.length === 0)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [typeFilter, setType]         = useState('')
  const savedView = (tenant as any)?.display_settings?.projectsView || 'kanban'
  const [viewMode, setViewMode] = useState<'kanban' | 'grid' | 'list'>(savedView as any)

  // تحديث عند تغيير الإعدادات
  useEffect(() => {
    const v = (tenant as any)?.display_settings?.projectsView
    if (v) setViewMode(v as any)
  }, [(tenant as any)?.display_settings?.projectsView])
  const [showModal, setShowModal]     = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [detailProject, setDetail]    = useState<Project | null>(null)

  const canEdit = currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit')

  useEffect(() => { loadProjects() }, [tenant?.id, activeBranch?.id])

  async function loadProjects() {
    if (!tenant || !activeBranch) return
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

  async function handleMove(p: Project, direction: 'prev' | 'next') {
    const colIdx = COLUMNS.findIndex(c => c.id === p.status)
    const newIdx = direction === 'next' ? colIdx + 1 : colIdx - 1
    if (newIdx < 0 || newIdx >= COLUMNS.length) return
    const newStatus = COLUMNS[newIdx].id as any

    // ── تحقق من المرفقات عند الإغلاق ──
    if (newStatus === 'مكتمل') {
      const { data: attachments } = await supabase
        .from('project_attachments')
        .select('category')
        .eq('project_id', p.id)
        .eq('tenant_id', tenant?.id)

      const uploadedCategories = (attachments || []).map((a: any) => a.category)
      const missing = REQUIRED_DOC_CATEGORIES.filter(c => !uploadedCategories.includes(c))

      if (missing.length > 0) {
        const missingLabels = missing.map(c => {
          const labels: Record<string,string> = {
            'مخططات': '📐 مخططات المشروع',
            'رخصة بلدية': '📋 رخصة البلدية',
            'إخلاء بلدية': '📋 إخلاء البلدية',
            'مستخلصات': '📄 المستخلص',
            'فواتير': '🧾 الفاتورة',
          }
          return labels[c] || c
        })
        toast.error('⛔ لا يمكن إغلاق المشروع. الناقص: ' + missingLabels.join(' | '), { duration: 6000 })
        return
      }
    }

    const newProgress = newStatus === 'مكتمل' ? 100 : p.progress
    const { error } = await supabase
      .from('projects')
      .update({ status: newStatus, progress: newProgress })
      .eq('id', p.id)
    if (error) { toast.error('خطأ في التحديث: ' + error.message); return }
    setProjects(projects.map(x => x.id === p.id ? { ...x, status: newStatus, progress: newProgress } : x))
    toast.success(`نُقل إلى: ${COLUMNS[newIdx].icon} ${newStatus}`)
  }

  const now = new Date(); now.setHours(0, 0, 0, 0)

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return (
      (!q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)) &&
      (!statusFilter || p.status === statusFilter) &&
      (!typeFilter   || p.type   === typeFilter)
    )
  })

  const activeCount = projects.filter(p => p.status === 'قيد التنفيذ').length
  const doneCount   = projects.filter(p => p.progress >= 100 || p.status === 'مكتمل').length
  const lateCount   = projects.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now && p.status !== 'مكتمل').length
  const soonCount   = projects.filter(p => { if (!p.end_date || p.progress >= 100) return false; const d = daysUntil(p.end_date); return d !== null && d >= 0 && d <= 14 }).length

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen style={{ width: '22px', height: '22px', color: '#1a56db' }} />
            المشاريع
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '2px' }}>{filtered.length} مشروع</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditProject(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> مشروع جديد
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'قيد التنفيذ', value: activeCount, color: '#1a56db', bg: '#eff6ff', icon: TrendingUp, onClick: () => setStatus('قيد التنفيذ') },
          { label: 'مكتملة',      value: doneCount,   color: '#0ea77b', bg: '#ecfdf5', icon: CheckCircle2, onClick: () => setStatus('مكتمل') },
          { label: 'متأخرة',      value: lateCount,   color: '#c81e1e', bg: '#fef2f2', icon: AlertTriangle, onClick: () => setStatus('متأخر') },
          { label: 'تسليم قريب',  value: soonCount,   color: '#e6820a', bg: '#fffbeb', icon: Clock, onClick: () => {} },
        ].map(s => (
          <button key={s.label} onClick={s.onClick}
            className="card"
            style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'right', border: 'none', background: 'white' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon style={{ width: '18px', height: '18px', color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input" style={{ paddingRight: '32px', fontSize: '0.875rem' }}
            placeholder="بحث بالاسم أو الرقم..." />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="select" style={{ width: 'auto' }}>
          <option value="">كل الحالات</option>
          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setType(e.target.value)} className="select" style={{ width: 'auto' }}>
          <option value="">كل الأنواع</option>
          {['801','802','441','442','805','405','O&M'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || statusFilter || typeFilter) && (
          <button onClick={() => { setSearch(''); setStatus(''); setType('') }}
            className="btn btn-ghost btn-sm" style={{ color: '#9ca3af' }}>مسح</button>
        )}

        {/* أزرار تبديل العرض */}
        <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', padding: '3px', borderRadius: '8px', marginRight: 'auto' }}>
          {[
            { mode: 'kanban', icon: Columns,     title: 'Kanban' },
            { mode: 'grid',   icon: LayoutGrid,  title: 'Grid' },
            { mode: 'list',   icon: List,        title: 'List' },
          ].map(({ mode, icon: Icon, title }) => (
            <button key={mode} onClick={() => setViewMode(mode as any)} title={title}
              style={{ padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: viewMode === mode ? 'white' : 'transparent',
                color: viewMode === mode ? '#1a56db' : '#9ca3af',
                boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              <Icon style={{ width: '15px', height: '15px' }} />
            </button>
          ))}
        </div>
      </div>

      {/* المحتوى */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <FolderOpen style={{ width: '48px', height: '48px', color: '#e5e7eb', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', marginBottom: '16px' }}>لا توجد مشاريع</p>
          {canEdit && (
            <button onClick={() => { setEditProject(null); setShowModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> إضافة مشروع
            </button>
          )}
        </div>

      ) : viewMode === 'kanban' ? (
        /* ══ Kanban View ══ */
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', alignItems: 'flex-start', minWidth: 0 }}>
          {COLUMNS.map(col => {
            const colProjects = filtered.filter(p => {
              if (col.id === 'متأخر') return p.status === 'متأخر' || (p.status === 'قيد التنفيذ' && p.end_date && new Date(p.end_date) < now && p.progress < 100)
              return p.status === col.id && !(col.id === 'قيد التنفيذ' && p.end_date && new Date(p.end_date) < now && p.progress < 100)
            })

            return (
              <div key={col.id} style={{ flexShrink: 0, width: '220px' }}>
                {/* رأس العمود */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: '10px 10px 0 0',
                  background: col.bg, border: `1px solid ${col.border}`, borderBottom: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>{col.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: col.color }}>{col.label}</span>
                  </div>
                  <span style={{ background: col.color, color: 'white', borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                    {colProjects.length}
                  </span>
                </div>

                {/* البطاقات */}
                <div style={{
                  minHeight: '200px', padding: '8px',
                  background: col.bg, border: `1px solid ${col.border}`,
                  borderTop: `3px solid ${col.color}`,
                  borderRadius: '0 0 10px 10px',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  {colProjects.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#d1d5db', fontSize: '0.8rem' }}>
                      لا توجد مشاريع
                    </div>
                  ) : (
                    colProjects.map(p => (
                      <KanbanCard key={p.id} p={p} canEdit={!!canEdit}
                        onView={() => setDetail(p)}
                        onEdit={() => { setEditProject(p); setShowModal(true) }}
                        onDelete={() => handleDelete(p)}
                        onMove={(dir) => handleMove(p, dir)}
                      />
                    ))
                  )}

                  {/* زر إضافة سريع */}
                  {canEdit && col.id !== 'مكتمل' && (
                    <button onClick={() => { setEditProject(null); setShowModal(true) }}
                      style={{ padding: '8px', borderRadius: '8px', border: `1px dashed ${col.border}`, background: 'transparent', cursor: 'pointer', color: col.color, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.6)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <Plus style={{ width: '13px', height: '13px' }} /> إضافة مشروع
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      ) : viewMode === 'grid' ? (
        /* ══ Grid View ══ */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map(p => {
            const days   = daysUntil(p.end_date)
            const isLate = days !== null && days < 0 && p.progress < 100
            const stage  = getCurrentStage(p)
            return (
              <div key={p.id} className="card" style={{ padding: '18px', cursor: 'pointer', border: isLate ? '1px solid #fca5a5' : '' }}
                onClick={() => setDetail(p)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {p.code && <span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>{p.code}</span>}
                      {p.type && <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{p.type}</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a2e' }}>{p.name}</div>
                  </div>
                  <span className={`badge ${getStatusColor(p)}`} style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                    {p.progress >= 100 ? 'مكتمل' : isLate ? 'متأخر' : p.status}
                  </span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{stage.icon} {stage.name}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a56db' }}>{p.progress}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '4px', width: `${p.progress}%`, background: p.progress >= 100 ? '#0ea77b' : isLate ? '#ef4444' : '#1a56db' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: '#6b7280', marginBottom: '12px' }}>
                  <div><span style={{ color: '#9ca3af' }}>المهندس</span><div style={{ fontWeight: 600, color: '#374151' }}>{p.engineer || '—'}</div></div>
                  <div><span style={{ color: '#9ca3af' }}>القيمة</span><div style={{ fontWeight: 600, color: '#374151' }}>{p.value ? formatCurrency(p.value) : '—'}</div></div>
                  {p.end_date && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#9ca3af' }}>التسليم</span><div style={{ fontWeight: 600, color: isLate ? '#ef4444' : '#374151' }}>{formatDate(p.end_date)}</div></div>}
                </div>
                <div style={{ display: 'flex', gap: '6px', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDetail(p)} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}><Eye style={{ width: '13px', height: '13px' }} /> تفاصيل</button>
                  {canEdit && <>
                    <button onClick={() => { setEditProject(p); setShowModal(true) }} className="btn btn-ghost btn-sm"><Pencil style={{ width: '13px', height: '13px' }} /></button>
                    <button onClick={() => handleDelete(p)} className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>

      ) : (
        /* ══ List View ══ */
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['المشروع','النوع','المهندس','الحالة','الإنجاز','التسليم','القيمة',''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const days   = daysUntil(p.end_date)
                  const isLate = days !== null && days < 0 && p.progress < 100
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--bg2)', background: isLate ? '#fff5f5' : 'transparent', cursor: 'pointer' }}
                      onClick={() => setDetail(p)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = isLate ? '#fff5f5' : 'transparent')}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#1a1a2e' }}>{p.name}</div>
                        {p.code && <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontFamily: 'monospace' }}>{p.code}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{p.type ? <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{p.type}</span> : '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#6b7280' }}>{p.engineer || '—'}</td>
                      <td style={{ padding: '12px 14px' }}><span className={`badge ${getStatusColor(p)}`} style={{ fontSize: '0.72rem' }}>{p.progress >= 100 ? 'مكتمل' : isLate ? 'متأخر' : p.status}</span></td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' }}>
                          <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '4px', width: `${p.progress}%`, background: p.progress >= 100 ? '#0ea77b' : isLate ? '#ef4444' : '#1a56db' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', width: '32px' }}>{p.progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: isLate ? '#ef4444' : '#6b7280', fontSize: '0.875rem' }}>
                        {formatDate(p.end_date)}
                        {isLate && days !== null && <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>متأخر {Math.abs(days)} يوم</div>}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#6b7280' }}>{p.value ? formatCurrency(p.value) : '—'}</td>
                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setDetail(p)} className="btn btn-ghost btn-xs"><Eye style={{ width: '13px', height: '13px' }} /></button>
                          {canEdit && <>
                            <button onClick={() => { setEditProject(p); setShowModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /></button>
                            <button onClick={() => handleDelete(p)} className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <ProjectModal project={editProject}
          onClose={() => { setShowModal(false); setEditProject(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
