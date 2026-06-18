'use client'
import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import ProjectModal  from '@/components/projects/ProjectModal'
import ProjectDetail from '@/components/projects/ProjectDetail'
import { useStore } from '@/hooks/useStore'
import { projectsApi, visitsApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, daysUntil, PROJECT_STAGES } from '@/lib/utils'

const VisitModal = dynamic(() => import('@/app/(dashboard)/visits/VisitModal'), { ssr: false })
import {
  Plus, Search, Eye, Pencil, Trash2, FolderOpen,
  LayoutGrid, List, Columns, ChevronLeft, ChevronRight,
  MessageSquarePlus, X, Send, StickyNote, Building2, Tag, Save,
  ClipboardList, MapPin, ChevronDown
} from 'lucide-react'
import type { Project, ProjectStatus } from '@/types'
type Task = {
  id?: number; tenant_id?: string; project_id?: number
  title: string; description?: string; assignee?: string
  priority?: string; status?: string; category?: string
  start_date?: string; due_date?: string; progress?: number
  completed_at?: string; notes?: string
}
import toast from 'react-hot-toast'


const REQUIRED_DOC_CATEGORIES = ['مخططات', 'رخصة بلدية', 'إخلاء بلدية', 'مستخلصات', 'فواتير']

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

const COLUMNS = [
  { id: 'تحت التخطيط', label: 'تحت التخطيط', icon: '📋', color: '#6b7280', bg: '#f9fafb',  border: '#e5e7eb', autoProgress: 0   },
  { id: 'قيد التنفيذ',  label: 'قيد التنفيذ',  icon: '🔄', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', autoProgress: 10  },
  { id: 'قيد الإغلاق',  label: 'قيد الإغلاق',  icon: '🔒', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', autoProgress: 60  },
  { id: 'مكتمل',        label: 'مكتمل',         icon: '✅', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', autoProgress: 100 },
  { id: 'متأخر',        label: 'متأخر',         icon: '⚠️', color: '#c81e1e', bg: '#fef2f2', border: '#fca5a5', autoProgress: null },
  { id: 'موقوف',        label: 'موقوف',          icon: '🚫', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d', autoProgress: null },
  { id: 'ملغي',         label: 'ملغي',           icon: '❌', color: '#374151', bg: '#f3f4f6', border: '#d1d5db', autoProgress: null },
]

function getStatusColor(p: Project): string {
  const status = p.status as string
  const days   = daysUntil(p.end_date)
  if (p.progress >= 100 || status === 'مكتمل')                                       return 'badge-green'
  if (status === 'متأخر' || (days !== null && days < 0 && status === 'قيد التنفيذ')) return 'badge-red'
  if (status === 'قيد التنفيذ')                                                       return 'badge-blue'
  if (status === 'قيد الإغلاق')                                                       return 'badge-closing'
  if (status === 'موقوف')                                                              return 'badge-amber'
  if (status === 'ملغي')                                                               return 'badge-gray'
  return 'badge-gray'
}

function getCurrentStage(p: Project) {
  const stages = p.stages || []
  for (let i = PROJECT_STAGES.length - 1; i >= 0; i--) {
    const s = stages.find(st => st.id === PROJECT_STAGES[i].id)
    if (s && s.startedAt && !s.done) return PROJECT_STAGES[i]
  }
  for (let i = PROJECT_STAGES.length - 1; i >= 0; i--) {
    if (stages.find(s => s.id === PROJECT_STAGES[i].id && s.done))
      return PROJECT_STAGES[Math.min(i + 1, PROJECT_STAGES.length - 1)]
  }
  return PROJECT_STAGES[0]
}

// ══════════════════════════════════════
// مودال إضافة ملاحظة
// ══════════════════════════════════════
function NoteModal({ project, onClose, onSave }: {
  project: Project; onClose: () => void; onSave: (note: string) => Promise<void>
}) {
  const [text, setText]   = useState('')
  const [saving, setSaving] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    await onSave(text.trim())
    setSaving(false)
    onClose()
  }

  const notes = (project.history || []).filter(h => h.includes('📝')).slice(-5).reverse()

  return (
    <div className="modal-overlay" onMouseDown={(e) => { (e.currentTarget as any)._md = e.target }} onClick={(e) => { if (e.target === e.currentTarget && (e.currentTarget as any)._md === e.currentTarget) onClose() }} style={{ zIndex: 60 }}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StickyNote style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            إضافة ملاحظة — {project.name}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea ref={textRef} value={text} onChange={e => setText(e.target.value)}
              className="input" style={{ minHeight: '100px', resize: 'none' }}
              placeholder="اكتب ملاحظتك هنا..." />
            {notes.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '6px' }}>آخر الملاحظات:</div>
                {notes.map((n, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: '#6b7280', padding: '5px 10px', background: '#f9fafb', borderRadius: '6px', marginBottom: '4px' }}>{n}</div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving || !text.trim()} className="btn btn-primary" style={{ background: '#e6820a' }}>
              {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Send style={{ width: '14px', height: '14px' }} />}
              حفظ الملاحظة
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// زر الإضافة السريعة (+) — ملاحظة / زيارة / مهمة
// ══════════════════════════════════════
function QuickAddButton({ project, onNote, onVisit, onTask }: {
  project: Project
  onNote:  () => void
  onVisit: () => void
  onTask:  () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const noteCount = (project.history || []).filter(h => h.includes('📝')).length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          padding: '5px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
          border: `1px solid ${noteCount > 0 ? '#fcd34d' : '#e5e7eb'}`,
          background: open ? '#f3f4f6' : noteCount > 0 ? '#fffbeb' : 'white',
          cursor: 'pointer', color: noteCount > 0 ? '#e6820a' : '#6b7280',
          display: 'flex', alignItems: 'center', gap: '3px',
        }}>
        <Plus style={{ width: '12px', height: '12px' }} />
        {noteCount > 0 && <span style={{ fontSize: '0.68rem' }}>{noteCount}</span>}
        <ChevronDown style={{ width: '10px', height: '10px' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: '150px',
          overflow: 'hidden',
        }}>
          {[
            { icon: <MessageSquarePlus style={{ width: '14px', height: '14px' }} />, label: 'ملاحظة', color: '#e6820a', action: onNote },
            { icon: <MapPin style={{ width: '14px', height: '14px' }} />,            label: 'زيارة',   color: '#0ea77b', action: onVisit },
            { icon: <ClipboardList style={{ width: '14px', height: '14px' }} />,     label: 'مهمة',    color: '#1a56db', action: onTask },
          ].map(item => (
            <button key={item.label} onClick={() => { setOpen(false); item.action() }}
              style={{
                width: '100%', padding: '9px 14px', border: 'none', background: 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)',
                textAlign: 'right', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              <span style={{ color: item.color }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}



// ══════════════════════════════════════
// مودال إضافة زيارة سريعة

// ══════════════════════════════════════
// TaskModal — مودال إضافة/تعديل المهمة
// ══════════════════════════════════════

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px'
}
const PRIORITY_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  'عالي':    { bg: '#fef2f2', color: '#c81e1e', border: '#fca5a5' },
  'متوسط':   { bg: '#fffbeb', color: '#e6820a', border: '#fcd34d' },
  'منخفض':   { bg: '#f0fdf4', color: '#0ea77b', border: '#86efac' },
}

function TaskModal({ task, projects, tenantId, onClose, onSave, defaultProjectId }: {
  task: Task | null; projects: Project[]; tenantId: string
  onClose: () => void; onSave: () => void
  defaultProjectId?: number
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    project_id: task?.project_id ? String(task.project_id) : defaultProjectId ? String(defaultProjectId) : '',
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

function ManageTypesModal({ tenantId, onClose }: {
  tenantId: string; onClose: () => void
}) {
  const [types,   setTypes]   = useState<{ id: number; code: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [newName, setNewName] = useState('')
  const [editId,  setEditId]  = useState<number | null>(null)
  const [editName,setEditName]= useState('')

  useEffect(() => { loadTypes() }, [])

  async function loadTypes() {
    setLoading(true)
    const { data } = await supabase.from('project_types')
      .select('id, code, name').eq('tenant_id', tenantId)
      .eq('is_active', true).order('name')
    setTypes(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newName.trim()) { toast.error('اسم النوع مطلوب'); return }
    setSaving(true)
    const code = newName.trim().substring(0, 20)
    const { error } = await supabase.from('project_types')
      .insert({ tenant_id: tenantId, code, name: newName.trim() })
    if (error) { toast.error(error.code === '23505' ? 'هذا النوع موجود مسبقاً' : 'خطأ في الحفظ'); setSaving(false); return }
    setNewName('')
    await loadTypes()
    toast.success('✅ تمت الإضافة')
    setSaving(false)
  }

  async function handleEdit(id: number) {
    if (!editName.trim()) return
    await supabase.from('project_types').update({ name: editName.trim(), code: editName.trim().substring(0, 20) }).eq('id', id)
    setEditId(null); setEditName('')
    await loadTypes()
    toast.success('تم التعديل ✅')
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`حذف النوع "${name}"؟`)) return
    await supabase.from('project_types').update({ is_active: false }).eq('id', id)
    await loadTypes()
    toast.success('تم الحذف')
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { (e.currentTarget as any)._md = e.target }} onClick={(e) => { if (e.target === e.currentTarget && (e.currentTarget as any)._md === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            إدارة أنواع المشاريع
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* توضيح */}
          <div style={{ background: '#f5f3ff', borderRadius: '10px', padding: '12px 14px', border: '1px solid #ddd6fe', fontSize: '0.82rem', color: '#5b21b6', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>💡 توضيح</div>
            أنواع المشاريع تُستخدم للتصنيف والتقارير — مثل مراكز التكلفة.
            <br />
            <span style={{ opacity: 0.8 }}>مثال: <strong>مشروع 405</strong> أو <strong>صيانة دورية</strong> أو <strong>توسعة شبكة</strong></span>
          </div>

          {/* إضافة نوع جديد */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="input" placeholder="اكتب اسم النوع الجديد..." style={{ flex: 1 }} />
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="btn btn-primary" style={{ background: '#7c3aed', whiteSpace: 'nowrap' }}>
              {saving
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Plus style={{ width: '15px', height: '15px' }} />}
              إضافة
            </button>
          </div>

          {/* قائمة الأنواع */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>جاري التحميل...</div>
          ) : types.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', background: '#f9fafb', borderRadius: '10px', fontSize: '0.875rem' }}>
              لا توجد أنواع بعد — أضف أول نوع
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
              {types.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#f9fafb', border: '1px solid var(--border)' }}>
                  {editId === t.id ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEdit(t.id)}
                        className="input" style={{ flex: 1, padding: '5px 10px' }} autoFocus />
                      <button onClick={() => handleEdit(t.id)}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                        حفظ
                      </button>
                      <button onClick={() => { setEditId(null); setEditName('') }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', color: '#9ca3af', cursor: 'pointer' }}>
                        <X style={{ width: '13px', height: '13px' }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>{t.name}</span>
                      <button onClick={() => { setEditId(t.id); setEditName(t.name) }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                        <Pencil style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button onClick={() => handleDelete(t.id, t.name)}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary" style={{ background: '#7c3aed' }}>تم</button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════
// بطاقة Kanban
// ══════════════════════════════════════
function KanbanCard({ p, canEdit, blockers, onView, onEdit, onDelete, onMove, onNote, onVisit, onTask }: {
  p: Project; canEdit: boolean; blockers?: { tasks: number; ncr: number }
  onView: () => void; onEdit: () => void; onDelete: () => void
  onMove: (dir: 'prev' | 'next') => void; onNote: () => void
  onVisit: () => void; onTask: () => void
}) {
  const days   = daysUntil(p.end_date)
  const isLate = days !== null && days < 0 && p.progress < 100
  const stage  = getCurrentStage(p)
  const colIdx = COLUMNS.findIndex(c => c.id === p.status)

  return (
    <div style={{ background: 'white', borderRadius: '10px', padding: '10px', border: `1px solid ${isLate ? '#fca5a5' : '#f3f4f6'}`, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onClick={onView}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>

      {/* الأكواد + الحالة */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '5px', flexWrap: 'wrap' }}>
        {p.code && <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{p.code}</span>}
        {p.type && <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{TYPE_NAME[p.type] || p.type}</span>}
      </div>

      {/* إشعار الموانع */}
      {blockers && (blockers.tasks > 0 || blockers.ncr > 0) && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '5px' }}>
          {blockers.tasks > 0 && (
            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: '#fef2f2', color: '#c81e1e', fontWeight: 600, border: '1px solid #fecaca' }}>
              ⚠️ {blockers.tasks} مهمة مفتوحة
            </span>
          )}
          {blockers.ncr > 0 && (
            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: '#fffbeb', color: '#e6820a', fontWeight: 600, border: '1px solid #fcd34d' }}>
              🔴 {blockers.ncr} NCR مفتوحة
            </span>
          )}
        </div>
      )}

      {/* الاسم */}
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e', marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {p.name}
      </div>

      {/* العميل */}
      {((p as any).client_name || (p as any).client) && (
        <div style={{ fontSize: '0.72rem', color: '#1a56db', marginBottom: '6px', fontWeight: 600 }}>
          🏢 {(p as any).client_name || (p as any).client}
        </div>
      )}

      {/* Progress */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{stage?.icon} {stage?.name}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isLate ? '#c81e1e' : '#1a56db' }}>{p.progress}%</span>
        </div>
        <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${p.progress}%`, background: p.progress >= 100 ? '#0ea77b' : isLate ? '#c81e1e' : '#1a56db', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* التاريخ + المتبقي */}
      {days !== null && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: isLate ? '#fef2f2' : days <= 7 ? '#fffbeb' : '#f9fafb', color: isLate ? '#c81e1e' : days <= 7 ? '#e6820a' : '#9ca3af' }}>
            {isLate ? `⚠️ متأخر ${Math.abs(days)} يوم` : days === 0 ? '⏰ تسليم اليوم' : `📅 متبقي ${days} يوم`}
          </span>
        </div>
      )}

      {/* الأزرار */}
      <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
        <button onClick={onView}
          style={{ flex: 1, padding: '5px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
          <Eye style={{ width: '12px', height: '12px' }} /> تفاصيل
        </button>
        <QuickAddButton project={p} onNote={onNote} onVisit={onVisit} onTask={onTask} />
        {canEdit && (
          <>
            <button onClick={onEdit}
              style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
              <Pencil style={{ width: '12px', height: '12px' }} />
            </button>
            <button onClick={onDelete}
              style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <Trash2 style={{ width: '12px', height: '12px' }} />
            </button>
          </>
        )}
        {canEdit && (
          <div style={{ display: 'flex', gap: '2px', marginRight: 'auto' }}>
            {colIdx > 0 && (
              <button onClick={() => onMove('prev')} title="رجوع"
                style={{ padding: '5px 6px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                <ChevronRight style={{ width: '12px', height: '12px' }} />
              </button>
            )}
            {colIdx < COLUMNS.length - 1 && (
              <button onClick={() => onMove('next')} title="تقدم"
                style={{ padding: '5px 6px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                <ChevronLeft style={{ width: '12px', height: '12px' }} />
              </button>
            )}
          </div>
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
  const [loading, setLoading]     = useState(projects.length === 0)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [typeFilter, setType]     = useState('')
  const [clientFilter, setClient] = useState('')
  const savedView = (tenant as any)?.display_settings?.projectsView || 'kanban'
  const [viewMode, setViewMode]   = useState<'kanban' | 'grid' | 'list'>(savedView as any)
  const [noteProject,  setNoteProject]  = useState<Project | null>(null)
  const [visitProject, setVisitProject] = useState<Project | null>(null)
  const [taskProject,  setTaskProject]  = useState<Project | null>(null)

  useEffect(() => {
    const v = (tenant as any)?.display_settings?.projectsView
    if (v) setViewMode(v as any)
  }, [(tenant as any)?.display_settings?.projectsView])

  const [showModal,        setShowModal]        = useState(false)
  const [editProject,      setEditProject]      = useState<Project | null>(null)
  const [detailProject,    setDetail]           = useState<Project | null>(null)
  const [showManageTypes, setShowManageTypes] = useState(false)

  const canEdit = currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit')
  const [projectBlockers, setProjectBlockers] = useState<Record<number, { tasks: number; ncr: number }>>({})

  async function loadProjectBlockers(projectIds: number[]) {
    if (!tenant || projectIds.length === 0) return
    const [tasksRes, ncrRes] = await Promise.all([
      supabase.from('project_tasks').select('project_id')
        .eq('tenant_id', tenant.id)
        .in('project_id', projectIds)
        .neq('status', 'مغلقة').neq('status', 'مكتملة'),
      supabase.from('visits').select('project_id')
        .eq('tenant_id', tenant.id)
        .in('project_id', projectIds)
        .eq('specs', 'غير مطابق')
        .is('resolved_report', null),
    ])
    const map: Record<number, { tasks: number; ncr: number }> = {}
    ;(tasksRes.data || []).forEach((t: any) => { if (!map[t.project_id]) map[t.project_id] = { tasks: 0, ncr: 0 }; map[t.project_id].tasks++ })
    ;(ncrRes.data || []).forEach((v: any) => { if (!map[v.project_id]) map[v.project_id] = { tasks: 0, ncr: 0 }; map[v.project_id].ncr++ })
    setProjectBlockers(map)
  }

  useEffect(() => { loadProjects() }, [tenant?.id, activeBranch?.id])


  async function loadProjects() {
    if (!tenant || !activeBranch) return
    if (projects.length === 0) setLoading(true)
    const { data } = await projectsApi.getAll(tenant.id, activeBranch.id)
    const loaded = data || []
    setProjects(loaded)
    setLoading(false)
    // تحميل موانع الإغلاق للمشاريع النشطة
    const activeIds = loaded.filter((p: any) => p.status !== 'مكتمل' && p.status !== 'ملغي').map((p: any) => p.id)
    if (activeIds.length > 0) loadProjectBlockers(activeIds)
  }

  // ✅ إصلاح handleSave — insert للجديد، update للتعديل
  // النسبة التلقائية حسب الحالة
  function getAutoProgress(status: string | undefined, currentProgress: number): number {
    const col = COLUMNS.find(c => c.id === (status || ''))
    return col?.autoProgress !== null && col?.autoProgress !== undefined
      ? col.autoProgress
      : currentProgress
  }

  async function handleSave(data: Partial<Project>): Promise<void> {
    if (!tenant || !activeBranch) return
    let error: any = null

    // ══ فحص شروط الاكتمال عند تغيير الحالة لـ "مكتمل" ══
    const existingProject = projects.find(p => p.id === (data as any).id)
    if (data.status === 'مكتمل' && existingProject?.status !== 'مكتمل') {
      const blockers: string[] = []

      const { data: openTasks } = await supabase
        .from('project_tasks').select('id')
        .eq('project_id', (data as any).id).eq('tenant_id', tenant.id)
        .neq('status', 'مغلقة').neq('status', 'مكتملة')
      if ((openTasks?.length || 0) > 0)
        blockers.push(`${openTasks!.length} مهمة مفتوحة لم تُغلق`)

      const { data: openNCR } = await supabase
        .from('visits').select('id')
        .eq('project_id', (data as any).id).eq('tenant_id', tenant.id)
        .eq('specs', 'غير مطابق').is('resolved_report', null)
      if ((openNCR?.length || 0) > 0)
        blockers.push(`${openNCR!.length} زيارة غير مطابقة (NCR) مفتوحة`)

      if (blockers.length > 0) {
        const msg = ['⛔ لا يمكن إغلاق المشروع:'].concat(blockers.map(b => '• ' + b)).join(String.fromCharCode(10))
        toast.error(msg, { duration: 8000, style: { whiteSpace: 'pre-line' } })
        return
      }
    }

    // تطبيق النسبة التلقائية حسب الحالة
    const autoProgress = getAutoProgress(data.status || 'تحت التخطيط', data.progress || 0)
    const payload = { ...data, progress: autoProgress }
    // لا نحذف value — قيمة العقد مطلوبة

    if ((payload as any).id) {
      const { id, ...rest } = payload as any
      const res = await supabase
        .from('projects')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
      error = res.error
    } else {
      const res = await supabase
        .from('projects')
        .insert({ ...payload, tenant_id: tenant.id, branch_id: activeBranch.id })
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
    const newStatus = COLUMNS[newIdx].id as ProjectStatus

    if (newStatus === 'مكتمل') {
      const blockers: string[] = []

      // 1. فحص المرفقات المطلوبة
      const { data: attachments } = await supabase
        .from('project_attachments').select('category')
        .eq('project_id', p.id).eq('tenant_id', tenant?.id)
      const uploadedCategories = (attachments || []).map((a: any) => a.category)
      const missing = REQUIRED_DOC_CATEGORIES.filter(c => !uploadedCategories.includes(c))
      if (missing.length > 0) {
        const labels: Record<string, string> = {
          'مخططات': '📐 مخططات', 'رخصة بلدية': '📋 رخصة بلدية',
          'إخلاء بلدية': '📋 إخلاء بلدية', 'مستخلصات': '📄 مستخلص', 'فواتير': '🧾 فاتورة',
        }
        blockers.push(`مرفقات ناقصة: ${missing.map(c => labels[c] || c).join('، ')}`)
      }

      // 2. فحص المهام المفتوحة
      const { data: openTasks } = await supabase
        .from('project_tasks').select('id', { count: 'exact' })
        .eq('project_id', p.id).eq('tenant_id', tenant?.id)
        .neq('status', 'مغلقة').neq('status', 'مكتملة')
      const openTasksCount = openTasks?.length || 0
      if (openTasksCount > 0) {
        blockers.push(`${openTasksCount} مهمة مفتوحة لم تُغلق`)
      }

      // 3. فحص الزيارات غير المطابقة المفتوحة
      const { data: openNCR } = await supabase
        .from('visits').select('id', { count: 'exact' })
        .eq('project_id', p.id).eq('tenant_id', tenant?.id)
        .eq('specs', 'غير مطابق').is('resolved_report', null)
      const openNCRCount = openNCR?.length || 0
      if (openNCRCount > 0) {
        blockers.push(`${openNCRCount} زيارة غير مطابقة (NCR) مفتوحة`)
      }

      if (blockers.length > 0) {
        const msg = ['⛔ لا يمكن إغلاق المشروع:'].concat(blockers.map((b: string) => '• ' + b)).join(String.fromCharCode(10))
        toast.error(msg, { duration: 8000, style: { whiteSpace: 'pre-line' } })
        return
      }
    }

    // النسبة التلقائية حسب المرحلة
    const autoP = COLUMNS[newIdx].autoProgress
    const newProgress = autoP !== null ? autoP : p.progress
    const { error } = await supabase.from('projects')
      .update({ status: newStatus, progress: newProgress }).eq('id', p.id)
    if (error) { toast.error('خطأ في التحديث: ' + error.message); return }
    setProjects(projects.map(x => x.id === p.id ? { ...x, status: newStatus, progress: newProgress } : x))
    toast.success(`${COLUMNS[newIdx].icon} ${newStatus} — ${newProgress}%`)
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
  const totalValue = projects.reduce((s, p) => s + (Number((p as any).estimated_value) || 0), 0)

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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canEdit && (
            <button onClick={() => { setEditProject(null); setShowModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> مشروع جديد
            </button>
          )}
          <button onClick={() => setShowManageTypes(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
            <Tag style={{ width: '15px', height: '15px' }} /> أنواع المشاريع
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'قيد التنفيذ',    value: String(activeCount), color: '#1a56db', bg: '#eff6ff', icon: '🔄' },
          { label: 'مكتمل',           value: String(doneCount),   color: '#0ea77b', bg: '#ecfdf5', icon: '✅' },
          { label: 'متأخر',           value: String(lateCount),   color: '#c81e1e', bg: '#fef2f2', icon: '⚠️' },
          { label: 'إجمالي القيمة',  value: formatCurrency(totalValue), color: '#e6820a', bg: '#fffbeb', icon: '💰' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.icon} {kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* الفلاتر */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم أو رقم المشروع..." className="input"
            style={{ paddingRight: '32px', width: '220px' }} />
        </div>

        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="select" style={{ width: 'auto' }}>
          <option value="">كل الحالات</option>
          {COLUMNS.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}{c.autoProgress !== null ? ` — ${c.autoProgress}%` : ''}</option>
          ))}
        </select>

        <select value={typeFilter} onChange={e => setType(e.target.value)} className="select" style={{ width: 'auto', minWidth: '180px' }}>
          <option value="">كل الأنواع</option>
          {existingTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={clientFilter} onChange={e => setClient(e.target.value)} className="select" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">كل الجهات</option>
          {existingClients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {(search || statusFilter || typeFilter || clientFilter) && (
          <button onClick={() => { setSearch(''); setStatus(''); setType(''); setClient('') }}
            className="btn btn-ghost btn-sm" style={{ color: '#9ca3af' }}>مسح الفلاتر</button>
        )}

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
              <div key={col.id} style={{ flexShrink: 0, width: '230px' }}>
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
                      <KanbanCard key={p.id} p={p} canEdit={!!canEdit} blockers={projectBlockers[p.id]}
                        onView={() => setDetail(p)}
                        onEdit={() => { setEditProject(p); setShowModal(true) }}
                        onDelete={() => handleDelete(p)}
                        onMove={dir => handleMove(p, dir)}
                        onNote={() => setNoteProject(p)}
                        onVisit={() => setVisitProject(p)}
                        onTask={() => setTaskProject(p)} />
                    ))
                  )}
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
        /* ══ Grid ══ */
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
                      {p.type && <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{TYPE_NAME[p.type] || p.type}</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a2e' }}>{p.name}</div>
                    {((p as any).client_name || (p as any).client) && (
                      <div style={{ fontSize: '0.72rem', color: '#1a56db', marginTop: '3px', fontWeight: 600 }}>
                        🏢 {(p as any).client_name || (p as any).client}
                      </div>
                    )}
                  </div>
                  <span className={`badge ${getStatusColor(p)}`} style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                    {p.progress >= 100 ? 'مكتمل' : isLate ? 'متأخر' : p.status}
                  </span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{stage?.icon} {stage?.name}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a56db' }}>{p.progress}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '4px', width: `${p.progress}%`, background: p.progress >= 100 ? '#0ea77b' : isLate ? '#c81e1e' : '#1a56db' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', color: '#9ca3af', flexWrap: 'wrap' }}>
                  {p.engineer && <span>👷 {p.engineer}</span>}
                  {p.end_date && <span>📅 {formatDate(p.end_date)}</span>}
                  {(p as any).estimated_value   && <span>💰 {formatCurrency((p as any).estimated_value)}</span>}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDetail(p)}
                    style={{ flex: 1, padding: '6px', borderRadius: '7px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Eye style={{ width: '13px', height: '13px' }} /> تفاصيل
                  </button>
                  <QuickAddButton project={p} onNote={() => setNoteProject(p)} onVisit={() => setVisitProject(p)} onTask={() => setTaskProject(p)} />
                  {canEdit && (
                    <>
                      <button onClick={() => { setEditProject(p); setShowModal(true) }}
                        style={{ padding: '6px 8px', borderRadius: '7px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                        <Pencil style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button onClick={() => handleDelete(p)}
                        style={{ padding: '6px 8px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                      </button>
                    </>
                  )}
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
                {['رقم', 'اسم المشروع', 'النوع', 'الجهة', 'الحالة', 'الإنجاز', 'القيمة', 'المهندس', 'التسليم', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const days   = daysUntil(p.end_date)
                const isLate = days !== null && days < 0 && p.progress < 100
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                    onClick={() => setDetail(p)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#1a56db' }}>{p.code || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{TYPE_NAME[p.type || ''] || p.type || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#1a56db', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(p as any).client_name || (p as any).client || '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${getStatusColor(p)}`} style={{ fontSize: '0.7rem', ...(getStatusColor(p) === 'badge-closing' ? { background: '#f5f3ff', color: '#6d28d9' } : {}) }}>{isLate ? 'متأخر' : p.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '110px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.progress}%`, background: p.progress >= 100 ? '#0ea77b' : isLate ? '#c81e1e' : '#1a56db', borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#e6820a', whiteSpace: 'nowrap' }}>{(p as any).estimated_value ? formatCurrency((p as any).estimated_value) : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{p.engineer || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: isLate ? '#c81e1e' : 'var(--text3)', whiteSpace: 'nowrap' }}>{formatDate(p.end_date) || '—'}</td>
                    <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <button onClick={() => setDetail(p)}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          تفاصيل
                        </button>
                        <QuickAddButton project={p} onNote={() => setNoteProject(p)} onVisit={() => setVisitProject(p)} onTask={() => setTaskProject(p)} />
                        {canEdit && (
                          <>
                            <button onClick={() => { setEditProject(p); setShowModal(true) }}
                              style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                              <Pencil style={{ width: '12px', height: '12px' }} />
                            </button>
                            <button onClick={() => handleDelete(p)}
                              style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
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

      {showModal && (
        <ProjectModal project={editProject}
          onClose={() => { setShowModal(false); setEditProject(null) }}
          onSave={(data) => handleSave(data)} />
      )}

      {noteProject && (
        <NoteModal project={noteProject}
          onClose={() => setNoteProject(null)}
          onSave={async (text) => { await handleSaveNote(noteProject, text) }} />
      )}

      {visitProject && tenant && activeBranch && (
        <VisitModal
          visit={null}
          projects={projects}
          onClose={() => setVisitProject(null)}
          onSave={async (data) => {
            const payload = {
              ...data,
              tenant_id:  tenant.id,
              branch_id:  activeBranch.id,
              project_id: visitProject.id,
            }
            await visitsApi.upsert(payload as any)
            toast.success('تمت إضافة الزيارة ✅')
            setVisitProject(null)
          }}
        />
      )}

      {taskProject && tenant && (
        <TaskModal
          task={null}
          projects={projects}
          tenantId={tenant.id}
          onClose={() => setTaskProject(null)}
          onSave={() => {
            setTaskProject(null)
          }}
          defaultProjectId={taskProject.id}
        />
      )}

      {showManageTypes && tenant && (
        <ManageTypesModal
          tenantId={tenant.id}
          onClose={() => setShowManageTypes(false)}
        />
      )}
    </div>
  )
}
