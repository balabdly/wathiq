'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, CheckCircle2, Clock, AlertTriangle, Circle, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

type Task = {
  id: number; tenant_id: string; project_id: number; title: string
  description?: string; assignee?: string; priority: string; status: string
  category?: string; start_date?: string; due_date?: string; progress: number
  notes?: string; created_by?: string; created_at: string
  project?: { name: string; code?: string }
}
type Project = { id: number; name: string; code?: string }

const PRIORITY_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  'عالي':    { bg: '#fef2f2', color: '#c81e1e', label: '🔴 عالي' },
  'متوسط':   { bg: '#fffbeb', color: '#e6820a', label: '🟡 متوسط' },
  'منخفض':   { bg: '#ecfdf5', color: '#0ea77b', label: '🟢 منخفض' },
}

const STATUS_STEPS = [
  { id: 'لم تبدأ',     icon: <Circle style={{ width: '14px', height: '14px' }} />,        color: '#9ca3af', bg: '#f3f4f6' },
  { id: 'قيد التنفيذ', icon: <Clock style={{ width: '14px', height: '14px' }} />,          color: '#1a56db', bg: '#eff6ff' },
  { id: 'معلقة',       icon: <AlertTriangle style={{ width: '14px', height: '14px' }} />,  color: '#e6820a', bg: '#fffbeb' },
  { id: 'مكتملة',     icon: <CheckCircle2 style={{ width: '14px', height: '14px' }} />,   color: '#0ea77b', bg: '#ecfdf5' },
  { id: 'ملغاة',       icon: <X style={{ width: '14px', height: '14px' }} />,              color: '#6b7280', bg: '#f3f4f6' },
]

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

// ══════════════════════════════════════
// مودال المهمة
// ══════════════════════════════════════
function TaskModal({ task, projects, tenantId, onClose, onSave }: {
  task: Task | null; projects: Project[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    project_id: task?.project_id ? String(task.project_id) : '',
    title:       task?.title       || '',
    description: task?.description || '',
    assignee:    task?.assignee    || '',
    priority:    task?.priority    || 'متوسط',
    status:      task?.status      || 'لم تبدأ',
    category:    task?.category    || '',
    start_date:  task?.start_date  || '',
    due_date:    task?.due_date    || '',
    progress:    task?.progress    ?? 0,
    notes:       task?.notes       || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim())    { toast.error('عنوان المهمة مطلوب'); return }
    if (!form.project_id)      { toast.error('يجب تحديد المشروع');   return }
    setSaving(true)
    const payload: any = {
      tenant_id:   tenantId,
      project_id:  Number(form.project_id),
      title:       form.title.trim(),
      description: form.description || null,
      assignee:    form.assignee    || null,
      priority:    form.priority,
      status:      form.status,
      category:    form.category    || null,
      start_date:  form.start_date  || null,
      due_date:    form.due_date    || null,
      progress:    Number(form.progress),
      notes:       form.notes       || null,
    }
    if (form.status === 'مكتملة' && (!task || task.status !== 'مكتملة')) {
      payload.completed_at = new Date().toISOString()
      payload.progress = 100
    }
    if (task) await supabase.from('project_tasks').update(payload).eq('id', task.id)
    else      await supabase.from('project_tasks').insert(payload)
    toast.success(task ? 'تم التعديل ✅' : '✅ تمت إضافة المهمة')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>
            {task ? '✏️ تعديل المهمة' : '➕ مهمة جديدة'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

          <div>
            <label style={lbl}>المشروع <span style={{ color: '#c81e1e' }}>*</span></label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
              <option value="">— اختر المشروع —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>عنوان المهمة <span style={{ color: '#c81e1e' }}>*</span></label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="وصف مختصر للمهمة..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>المسؤول</label>
              <input value={form.assignee} onChange={e => set('assignee', e.target.value)} className="input" placeholder="اسم المهندس أو الفريق" />
            </div>
            <div>
              <label style={lbl}>التصنيف</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {['تصميم', 'تنفيذ', 'إداري', 'سلامة', 'جودة', 'مشتريات', 'أخرى'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* الأولوية */}
          <div>
            <label style={lbl}>الأولوية</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.entries(PRIORITY_COLOR).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('priority', k)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                    borderColor: form.priority === k ? v.color : 'var(--border)',
                    background:  form.priority === k ? v.bg : 'white',
                    color:       form.priority === k ? v.color : 'var(--text3)' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* الحالة */}
          <div>
            <label style={lbl}>الحالة</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {STATUS_STEPS.map(s => (
                <button key={s.id} type="button" onClick={() => set('status', s.id)}
                  style={{ flex: 1, minWidth: '80px', padding: '7px 6px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center',
                    borderColor: form.status === s.id ? s.color : 'var(--border)',
                    background:  form.status === s.id ? s.bg : 'white',
                    color:       form.status === s.id ? s.color : 'var(--text3)' }}>
                  {s.id}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>تاريخ البدء</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>تاريخ الاستحقاق</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label style={lbl}>نسبة الإنجاز: <strong>{form.progress}%</strong></label>
            <input type="range" min={0} max={100} step={5} value={form.progress}
              onChange={e => set('progress', e.target.value)}
              style={{ width: '100%', accentColor: 'var(--primary)' }} />
          </div>

          <div>
            <label style={lbl}>الوصف والتفاصيل</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input" style={{ minHeight: '70px', resize: 'none' }} placeholder="تفاصيل المهمة..." />
          </div>

        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '14px', height: '14px' }} />}
            {task ? 'حفظ التعديل' : 'إضافة المهمة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function ProjectTasksPage() {
  const { tenant, currentUser } = useStore()
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterPriority,setFilterPriority]= useState('')
  const [showModal, setShowModal]  = useState(false)
  const [editTask,  setEditTask]   = useState<Task | null>(null)
  const [view, setView] = useState<'board' | 'list'>('list')

  const canEdit = currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit')

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [tRes, pRes] = await Promise.all([
      supabase.from('project_tasks')
        .select('*, project:projects(name, code)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name, code').eq('tenant_id', tenant.id).order('name'),
    ])
    setTasks(tRes.data || [])
    setProjects(pRes.data || [])
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه المهمة؟')) return
    await supabase.from('project_tasks').delete().eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  async function handleStatusChange(task: Task, status: string) {
    const update: any = { status }
    if (status === 'مكتملة') { update.progress = 100; update.completed_at = new Date().toISOString() }
    await supabase.from('project_tasks').update(update).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...update } : t))
    toast.success('تم تحديث الحالة')
  }

  // فلترة
  const filtered = tasks.filter(t => {
    if (filterProject && String(t.project_id) !== filterProject) return false
    if (filterStatus  && t.status !== filterStatus)   return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (search && !t.title.includes(search) && !(t.assignee || '').includes(search) && !(t.project?.name || '').includes(search)) return false
    return true
  })

  // إحصائيات
  const stats = {
    total:    tasks.length,
    done:     tasks.filter(t => t.status === 'مكتملة').length,
    inprog:   tasks.filter(t => t.status === 'قيد التنفيذ').length,
    overdue:  tasks.filter(t => t.due_date && t.due_date < new Date().toISOString().split('T')[0] && t.status !== 'مكتملة' && t.status !== 'ملغاة').length,
    high:     tasks.filter(t => t.priority === 'عالي' && t.status !== 'مكتملة').length,
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✅ المهام
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '4px' }}>
            إدارة وتتبع مهام المشاريع
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditTask(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> مهمة جديدة
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        {[
          { label: 'إجمالي المهام',   value: stats.total,   color: '#1a56db', bg: '#eff6ff' },
          { label: 'قيد التنفيذ',     value: stats.inprog,  color: '#e6820a', bg: '#fffbeb' },
          { label: 'مكتملة',          value: stats.done,    color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'متأخرة',          value: stats.overdue, color: '#c81e1e', bg: '#fef2f2' },
          { label: 'أولوية عالية',    value: stats.high,    color: '#7c3aed', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px', background: s.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '200px', fontSize: '0.82rem' }} placeholder="بحث..." />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل الحالات</option>
          {STATUS_STEPS.map(s => <option key={s.id}>{s.id}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل الأولويات</option>
          {['عالي', 'متوسط', 'منخفض'].map(p => <option key={p}>{p}</option>)}
        </select>
        {/* مبدّل العرض */}
        <div style={{ marginRight: 'auto', display: 'flex', gap: '4px', background: '#e5e7eb', padding: '3px', borderRadius: '10px' }}>
          {([
            ['list',  '☰',  'قائمة'],
            ['board', '📋', 'كانبان'],
          ] as const).map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: '6px 14px', borderRadius: '7px', border: 'none',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '5px',
                background: view === v ? 'white' : 'transparent',
                color:      view === v ? 'var(--primary)' : 'var(--text3)',
                boxShadow:  view === v ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s',
              }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
          <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد مهام</p>
          {canEdit && <button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus style={{ width: '16px', height: '16px' }} /> إضافة مهمة</button>}
        </div>
      ) : view === 'board' ? (

        /* ══ Board View ══ */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', overflowX: 'auto' }}>
          {STATUS_STEPS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.id)
            return (
              <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: col.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: col.color, fontWeight: 700, fontSize: '0.82rem' }}>
                    {col.icon} {col.id}
                  </div>
                  <span style={{ background: col.color, color: 'white', borderRadius: '12px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{colTasks.length}</span>
                </div>
                {colTasks.map(task => {
                  const isOverdue = task.due_date && task.due_date < today && task.status !== 'مكتملة'
                  const p = PRIORITY_COLOR[task.priority]
                  return (
                    <div key={task.id} className="card" style={{ padding: '12px', border: isOverdue ? '1px solid #fca5a5' : '', cursor: 'pointer' }}
                      onClick={() => { setEditTask(task); setShowModal(true) }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.4, flex: 1 }}>{task.title}</span>
                        <span style={{ background: p.bg, color: p.color, borderRadius: '6px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {task.priority}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '6px' }}>
                        📁 {task.project?.name}
                      </div>
                      {task.assignee && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '6px' }}>
                          👤 {task.assignee}
                        </div>
                      )}
                      {task.due_date && (
                        <div style={{ fontSize: '0.72rem', color: isOverdue ? '#c81e1e' : 'var(--text3)', marginBottom: '8px', fontWeight: isOverdue ? 700 : 400 }}>
                          📅 {task.due_date} {isOverdue ? '⚠️ متأخرة' : ''}
                        </div>
                      )}
                      {task.status !== 'مكتملة' && task.status !== 'ملغاة' && (
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--primary)', borderRadius: '4px', width: `${task.progress}%` }} />
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '2px', textAlign: 'left' }}>{task.progress}%</div>
                        </div>
                      )}
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '4px', borderTop: '1px solid var(--bg2)', paddingTop: '8px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditTask(task); setShowModal(true) }}
                            style={{ flex: 1, padding: '4px', borderRadius: '5px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.68rem', color: 'var(--text3)' }}>
                            تعديل
                          </button>
                          <button onClick={() => handleDelete(task.id)}
                            style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', color: '#c81e1e' }}>
                            <Trash2 style={{ width: '11px', height: '11px' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
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
                  {['المهمة', 'المشروع', 'المسؤول', 'الأولوية', 'الحالة', 'الاستحقاق', 'الإنجاز', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => {
                  const isOverdue = task.due_date && task.due_date < today && task.status !== 'مكتملة'
                  const p = PRIORITY_COLOR[task.priority]
                  const s = STATUS_STEPS.find(x => x.id === task.status)
                  return (
                    <tr key={task.id} style={{ borderBottom: '1px solid var(--bg2)', background: isOverdue ? '#fff5f5' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = isOverdue ? '#fff5f5' : 'transparent')}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700 }}>{task.title}</div>
                        {task.category && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{task.category}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>
                        {task.project?.name}
                        {task.project?.code && <div style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>{task.project.code}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{task.assignee || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: p.bg, color: p.color, borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {task.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: s?.bg, color: s?.color, borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {s?.icon} {task.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: isOverdue ? '#c81e1e' : 'var(--text3)', fontWeight: isOverdue ? 700 : 400 }}>
                        {task.due_date || '—'}
                        {isOverdue && <div style={{ fontSize: '0.7rem' }}>⚠️ متأخرة</div>}
                      </td>
                      <td style={{ padding: '12px 14px', minWidth: '100px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: task.status === 'مكتملة' ? '#0ea77b' : 'var(--primary)', borderRadius: '4px', width: `${task.progress}%` }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text3)', width: '30px' }}>{task.progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => { setEditTask(task); setShowModal(true) }} className="btn btn-ghost btn-xs">
                              <Pencil style={{ width: '13px', height: '13px' }} />
                            </button>
                            <button onClick={() => handleDelete(task.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                              <Trash2 style={{ width: '13px', height: '13px' }} />
                            </button>
                          </div>
                        )}
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
        <TaskModal
          task={editTask}
          projects={projects}
          tenantId={tenant!.id}
          onClose={() => { setShowModal(false); setEditTask(null) }}
          onSave={() => { setShowModal(false); setEditTask(null); loadAll() }}
        />
      )}
    </div>
  )
}
