'use client'
import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/hooks/useStore'
import { projectsApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, daysUntil, PROJECT_STAGES } from '@/lib/utils'
import {
  Plus, Search, Eye, Pencil, Trash2, FolderOpen,
  LayoutGrid, List, Columns, TrendingUp, Clock,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  MessageSquarePlus, X, Send, StickyNote
} from 'lucide-react'
import type { Project } from '@/types'
import toast from 'react-hot-toast'

const ProjectModal  = dynamic(() => import('@/components/projects/ProjectModal'),  { ssr: false })
const ProjectDetail = dynamic(() => import('@/components/projects/ProjectDetail'), { ssr: false })

// المستندات الإلزامية للإغلاق
const REQUIRED_DOC_CATEGORIES = ['مخططات', 'رخصة بلدية', 'إخلاء بلدية', 'مستخلصات', 'فواتير']

// الجهات المنفذة
const CLIENTS = [
  'شركة السعودية للكهرباء', 'أرامكو السعودية', 'وزارة الإسكان',
  'أمانة منطقة الرياض', 'وزارة الصحة', 'وزارة التعليم', 'وزارة النقل',
  'الهيئة الملكية للجبيل', 'شركة معادن', 'سابك', 'القطاع الخاص', 'أخرى',
]

// أنواع المشاريع بأسماء واضحة
const PROJECT_TYPES: { code: string; name: string }[] = [
  { code: '801',   name: 'مشاريع الربط الكهربائي 801' },
  { code: '802',   name: 'مشاريع التوزيع 802' },
  { code: '405',   name: 'مشاريع كهرباء 405' },
  { code: '441',   name: 'مشاريع المحولات 441' },
  { code: '442',   name: 'محطات التوزيع 442' },
  { code: '805',   name: 'مشاريع النقل 805' },
  { code: 'O&M',   name: 'صيانة وتشغيل O&M' },
  { code: 'EPC',   name: 'هندسة وتوريد وتنفيذ EPC' },
  { code: 'CIVIL', name: 'أعمال مدنية' },
  { code: 'OTHER', name: 'أخرى' },
]

const TYPE_NAME: Record<string, string> = Object.fromEntries(PROJECT_TYPES.map(t => [t.code, t.name]))

// ألوان الأعمدة
const COLUMNS = [
  { id: 'تحت التخطيط', label: 'تحت التخطيط', icon: '📋', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { id: 'قيد التنفيذ',  label: 'قيد التنفيذ',  icon: '🔄', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'متأخر',        label: 'متأخر',         icon: '⚠️', color: '#c81e1e', bg: '#fef2f2', border: '#fca5a5' },
  { id: 'مكتمل',        label: 'مكتمل',         icon: '✅', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac' },
  { id: 'موقوف',        label: 'موقوف',          icon: '🚫', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d' },
]

function getStatusColor(p: Project) {
  const days = daysUntil(p.end_date)
  if (p.status === 'مكتمل' || p.progress >= 100) return { color: '#0ea77b', bg: '#ecfdf5' }
  if (days !== null && days < 0)                  return { color: '#c81e1e', bg: '#fef2f2' }
  if (days !== null && days <= 7)                 return { color: '#e6820a', bg: '#fffbeb' }
  return { color: '#1a56db', bg: '#eff6ff' }
}

function getCurrentStage(p: Project) {
  const stages = p.stages || []
  for (let i = PROJECT_STAGES.length - 1; i >= 0; i--) {
    const s = stages.find(st => st.id === PROJECT_STAGES[i].id)
    if (s && s.startedAt && !s.done) return PROJECT_STAGES[i]
  }
  for (let i = PROJECT_STAGES.length - 1; i >= 0; i--) {
    if (stages.find(s => s.id === PROJECT_STAGES[i].id && s.done)) {
      return PROJECT_STAGES[Math.min(i + 1, PROJECT_STAGES.length - 1)]
    }
  }
  return PROJECT_STAGES[0]
}

// ══════════════════════════════════════
// بطاقة Kanban
// ══════════════════════════════════════
function KanbanCard({ p, canEdit, onView, onEdit, onDelete, onMove, onNote }: {
  p: Project; canEdit: boolean
  onView: () => void; onEdit: () => void; onDelete: () => void
  onMove: (dir: 'prev' | 'next') => void; onNote: () => void
}) {
  const days  = daysUntil(p.end_date)
  const sc    = getStatusColor(p)
  const stage = getCurrentStage(p)

  return (
    <div className="card" style={{ padding: '12px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onClick={onView}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>

      {/* اسم + نوع */}
      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a2e', marginBottom: '4px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.name}
      </div>
      {p.type && (
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '8px' }}>
          {TYPE_NAME[p.type] || p.type}
        </div>
      )}

      {/* Progress */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '0.72rem' }}>
          <span style={{ color: '#9ca3af' }}>الإنجاز</span>
          <span style={{ fontWeight: 700, color: sc.color }}>{p.progress}%</span>
        </div>
        <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${p.progress}%`, background: sc.color, borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* التاريخ + المرحلة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        {days !== null ? (
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: sc.bg, color: sc.color }}>
            {days < 0 ? `متأخر ${Math.abs(days)}ي` : days === 0 ? 'اليوم' : `${days} يوم`}
          </span>
        ) : <span />}
        {stage && (
          <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{stage.icon} {stage.name}</span>
        )}
      </div>

      {/* الأزرار */}
      <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
        <button onClick={onView}
          style={{ flex: 1, padding: '5px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
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
// مودال الملاحظة السريعة
// ══════════════════════════════════════
function NoteModal({ project, onClose, onSave }: { project: Project; onClose: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StickyNote style={{ width: '16px', height: '16px', color: '#e6820a' }} />
            ملاحظة على: {project.name}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body">
          <textarea value={text} onChange={e => setText(e.target.value)} className="input"
            style={{ minHeight: '100px', resize: 'none', width: '100%' }}
            placeholder="اكتب ملاحظتك هنا..." autoFocus />
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={() => { if (text.trim()) { onSave(text.trim()); onClose() } }}
            disabled={!text.trim()} className="btn btn-primary">
            <Send style={{ width: '14px', height: '14px' }} /> حفظ الملاحظة
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function ProjectsPage() {
  const { tenant, activeBranch, projects, setProjects, currentUser } = useStore()
  const [loading, setLoading]     = useState(projects.length === 0)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [typeFilter, setType]     = useState('')
  const [clientFilter, setClient] = useState('')
  const savedView = (tenant as any)?.display_settings?.projectsView || 'kanban'
  const [viewMode, setViewMode]   = useState<'kanban' | 'grid' | 'list'>(savedView as any)
  const [noteProject, setNoteProject] = useState<Project | null>(null)

  useEffect(() => {
    const v = (tenant as any)?.display_settings?.projectsView
    if (v) setViewMode(v as any)
  }, [(tenant as any)?.display_settings?.projectsView])

  const [showModal,    setShowModal]    = useState(false)
  const [editProject,  setEditProject]  = useState<Project | null>(null)
  const [detailProject, setDetail]      = useState<Project | null>(null)

  const canEdit = currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit')

  useEffect(() => { loadProjects() }, [tenant?.id, activeBranch?.id])

  async function loadProjects() {
    if (!tenant || !activeBranch) return
    if (projects.length === 0) setLoading(true)
    const { data } = await projectsApi.getAll(tenant.id, activeBranch.id)
    setProjects(data || [])
    setLoading(false)
  }

  // ✅ إصلاح handleSave — insert للجديد، update للتعديل
  async function handleSave(data: Partial<Project>) {
    if (!tenant || !activeBranch) return
    let error: any = null

    if ((data as any).id) {
      // تعديل مشروع موجود
      const { id, ...rest } = data as any
      const res = await supabase
        .from('projects')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
      error = res.error
    } else {
      // إضافة مشروع جديد
      const res = await supabase
        .from('projects')
        .insert({ ...data, tenant_id: tenant.id, branch_id: activeBranch.id })
      error = res.error
    }

    if (error) { toast.error('حدث خطأ في الحفظ: ' + error.message); return }
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

  async function handleSaveNote(project: Project, noteText: string) {
    if (!tenant) return
    const now     = new Date()
    const dateStr = now.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false })
    const entry   = `${dateStr}، ${timeStr}: 📝 ${noteText}`
    const history = [...(project.history || []), entry]
    const { error } = await supabase.from('projects').update({ history }).eq('id', project.id)
    if (error) { toast.error('خطأ في حفظ الملاحظة'); return }
    setProjects(projects.map(p => p.id === project.id ? { ...p, history } : p))
    toast.success('✅ تم حفظ الملاحظة')
  }

  async function handleMove(p: Project, direction: 'prev' | 'next') {
    const colIdx = COLUMNS.findIndex(c => c.id === p.status)
    const newIdx = direction === 'next' ? colIdx + 1 : colIdx - 1
    if (newIdx < 0 || newIdx >= COLUMNS.length) return
    const newStatus = COLUMNS[newIdx].id as any

    if (newStatus === 'مكتمل') {
      const { data: attachments } = await supabase
        .from('project_attachments')
        .select('category')
        .eq('project_id', p.id)
        .eq('tenant_id', tenant?.id)
      const uploadedCategories = (attachments || []).map((a: any) => a.category)
      const missing = REQUIRED_DOC_CATEGORIES.filter(c => !uploadedCategories.includes(c))
      if (missing.length > 0) {
        toast.error('⛔ لا يمكن إغلاق المشروع. الناقص: ' + missing.join(' | '), { duration: 6000 })
        return
      }
    }

    const newProgress = newStatus === 'مكتمل' ? 100 : p.progress
    const { error }   = await supabase.from('projects')
      .update({ status: newStatus, progress: newProgress }).eq('id', p.id)
    if (error) { toast.error('خطأ في التحديث: ' + error.message); return }
    setProjects(projects.map(x => x.id === p.id ? { ...x, status: newStatus, progress: newProgress } : x))
    toast.success(`نُقل إلى: ${COLUMNS[newIdx].icon} ${newStatus}`)
  }

  const now = new Date(); now.setHours(0, 0, 0, 0)

  const existingClients = Array.from(
    new Set(projects.map(p => (p as any).client_name || (p as any).client).filter(Boolean))
  ) as string[]

  const existingTypes = Array.from(new Set(projects.map(p => p.type).filter(Boolean))) as string[]

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return (
      (!q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)) &&
      (!statusFilter || p.status === statusFilter) &&
      (!typeFilter   || p.type   === typeFilter)  &&
      (!clientFilter || (p as any).client_name === clientFilter || (p as any).client === clientFilter)
    )
  })

  const activeCount = projects.filter(p => p.status === 'قيد التنفيذ').length
  const doneCount   = projects.filter(p => p.progress >= 100 || p.status === 'مكتمل').length
  const lateCount   = projects.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now && p.status !== 'مكتمل').length
  const totalValue  = projects.reduce((s, p) => s + (p.value || 0), 0)

  // تفاصيل مشروع
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
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen style={{ width: '22px', height: '22px', color: '#1a56db' }} />
            المشاريع
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>{projects.length} مشروع إجمالاً</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditProject(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> مشروع جديد
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'قيد التنفيذ',   value: activeCount, color: '#1a56db', bg: '#eff6ff', icon: '🔄' },
          { label: 'مكتمل',          value: doneCount,   color: '#0ea77b', bg: '#ecfdf5', icon: '✅' },
          { label: 'متأخر',          value: lateCount,   color: '#c81e1e', bg: '#fef2f2', icon: '⚠️' },
          { label: 'إجمالي القيمة', value: formatCurrency(totalValue), color: '#e6820a', bg: '#fffbeb', icon: '💰' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.icon} {kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* الفلاتر + البحث */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم أو رقم المشروع..." className="input"
            style={{ paddingRight: '32px', width: '220px' }} />
        </div>

        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="select" style={{ width: 'auto' }}>
          <option value="">كل الحالات</option>
          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>

        <select value={typeFilter} onChange={e => setType(e.target.value)} className="select" style={{ width: 'auto', minWidth: '180px' }}>
          <option value="">كل الأنواع</option>
          {PROJECT_TYPES.filter(t => existingTypes.includes(t.code) || !existingTypes.length).map(t => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>

        <select value={clientFilter} onChange={e => setClient(e.target.value)} className="select" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">كل الجهات</option>
          {existingClients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {(search || statusFilter || typeFilter || clientFilter) && (
          <button onClick={() => { setSearch(''); setStatus(''); setType(''); setClient('') }}
            className="btn btn-ghost btn-sm" style={{ color: '#9ca3af' }}>مسح الفلاتر</button>
        )}

        {/* أزرار تبديل العرض */}
        <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', padding: '3px', borderRadius: '8px', marginRight: 'auto' }}>
          {[
            { mode: 'kanban', icon: Columns,    title: 'Kanban' },
            { mode: 'grid',   icon: LayoutGrid, title: 'Grid' },
            { mode: 'list',   icon: List,       title: 'List' },
          ].map(({ mode, icon: Icon, title }) => (
            <button key={mode} onClick={() => setViewMode(mode as any)} title={title}
              style={{ padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: viewMode === mode ? 'white' : 'transparent',
                color:      viewMode === mode ? '#1a56db' : '#9ca3af',
                boxShadow:  viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              <Icon style={{ width: '15px', height: '15px' }} />
            </button>
          ))}
        </div>
      </div>

      {/* المحتوى */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
        /* ══ Kanban ══ */
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', alignItems: 'flex-start', minWidth: 0 }}>
          {COLUMNS.map(col => {
            const colProjects = filtered.filter(p => {
              if (col.id === 'متأخر')
                return p.status === 'متأخر' || (p.status === 'قيد التنفيذ' && p.end_date && new Date(p.end_date) < now && p.progress < 100)
              return p.status === col.id && !(col.id === 'قيد التنفيذ' && p.end_date && new Date(p.end_date) < now && p.progress < 100)
            })
            return (
              <div key={col.id} style={{ flexShrink: 0, width: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px 10px 0 0', background: col.bg, border: `1px solid ${col.border}`, borderBottom: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{col.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: col.color }}>{col.label}</span>
                  </div>
                  <span style={{ background: col.color, color: 'white', borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                    {colProjects.length}
                  </span>
                </div>
                <div style={{ minHeight: '200px', padding: '8px', background: col.bg, border: `1px solid ${col.border}`, borderTop: `3px solid ${col.color}`, borderRadius: '0 0 10px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {colProjects.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#d1d5db', fontSize: '0.8rem' }}>لا توجد مشاريع</div>
                  ) : (
                    colProjects.map(p => (
                      <KanbanCard key={p.id} p={p} canEdit={!!canEdit}
                        onView={() => setDetail(p)}
                        onEdit={() => { setEditProject(p); setShowModal(true) }}
                        onDelete={() => handleDelete(p)}
                        onMove={dir => handleMove(p, dir)}
                        onNote={() => setNoteProject(p)} />
                    ))
                  )}
                  {canEdit && col.id !== 'مكتمل' && (
                    <button onClick={() => { setEditProject(null); setShowModal(true) }}
                      style={{ padding: '8px', borderRadius: '8px', border: `1px dashed ${col.border}`, background: 'transparent', cursor: 'pointer', color: col.color, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Plus style={{ width: '13px', height: '13px' }} /> إضافة
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      ) : viewMode === 'grid' ? (
        /* ══ Grid ══ */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map(p => {
            const days   = daysUntil(p.end_date)
            const isLate = days !== null && days < 0 && p.progress < 100
            const sc     = getStatusColor(p)
            return (
              <div key={p.id} className="card" style={{ padding: '18px', cursor: 'pointer', border: isLate ? '1px solid #fca5a5' : '' }}
                onClick={() => setDetail(p)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a2e', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', background: sc.bg, color: sc.color, fontWeight: 600, whiteSpace: 'nowrap', marginRight: '8px' }}>
                    {p.status}
                  </span>
                </div>
                {p.type && <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '10px' }}>{TYPE_NAME[p.type] || p.type}</div>}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                    <span style={{ color: '#9ca3af' }}>الإنجاز</span>
                    <span style={{ fontWeight: 700, color: sc.color }}>{p.progress}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.progress}%`, background: sc.color, borderRadius: '4px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', fontSize: '0.72rem', color: '#9ca3af' }}>
                  {p.engineer && <span>👷 {p.engineer}</span>}
                  {p.end_date && <span>📅 {formatDate(p.end_date)}</span>}
                  {p.value   && <span>💰 {formatCurrency(p.value)}</span>}
                </div>
              </div>
            )
          })}
        </div>

      ) : (
        /* ══ List ══ */
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['رقم المشروع', 'اسم المشروع', 'النوع', 'الحالة', 'الإنجاز', 'قيمة العقد', 'المهندس', 'التسليم', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const sc = getStatusColor(p)
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                    onClick={() => setDetail(p)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#1a56db' }}>{p.code || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{TYPE_NAME[p.type || ''] || p.type || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, background: sc.bg, color: sc.color }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px', minWidth: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.progress}%`, background: sc.color, borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: sc.color, whiteSpace: 'nowrap' }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: '#e6820a' }}>{p.value ? formatCurrency(p.value) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{p.engineer || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{formatDate(p.end_date) || '—'}</td>
                    <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => setDetail(p)}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                          تفاصيل
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => { setEditProject(p); setShowModal(true) }}
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                              <Pencil style={{ width: '12px', height: '12px' }} />
                            </button>
                            <button onClick={() => handleDelete(p)}
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', color: '#ef4444' }}>
                              <Trash2 style={{ width: '12px', height: '12px' }} />
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
        </div>
      )}

      {/* مودال المشروع */}
      {showModal && (
        <ProjectModal
          project={editProject}
          onClose={() => { setShowModal(false); setEditProject(null) }}
          onSave={handleSave}
        />
      )}

      {/* مودال الملاحظة */}
      {noteProject && (
        <NoteModal
          project={noteProject}
          onClose={() => setNoteProject(null)}
          onSave={text => handleSaveNote(noteProject, text)}
        />
      )}
    </div>
  )
}
