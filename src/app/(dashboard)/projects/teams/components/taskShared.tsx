'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAssigneeOptions, type AssigneeOption } from '@/lib/project-teams'
import { TASK_STATUS_STEPS } from '@/lib/project-tasks'
import { Plus, X, Save, CheckCircle2, Clock, AlertTriangle, Circle } from 'lucide-react'
import toast from 'react-hot-toast'

export type ProjectTask = {
  id: number
  tenant_id: string
  project_id: number
  title: string
  description?: string
  assignee?: string
  priority: string
  status: string
  category?: string
  start_date?: string
  due_date?: string
  progress: number
  notes?: string
  created_by?: string
  created_at: string
  project?: { name: string; code?: string; team_id?: number | null }
}

export type TaskProject = { id: number; name: string; code?: string; team_id?: number | null }

export const PRIORITY_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  'عالي':    { bg: '#fef2f2', color: '#c81e1e', label: '🔴 عالي' },
  'متوسط':   { bg: '#fffbeb', color: '#e6820a', label: '🟡 متوسط' },
  'منخفض':   { bg: '#ecfdf5', color: '#0ea77b', label: '🟢 منخفض' },
}

export const STATUS_STEPS = [
  { id: 'لم تبدأ',     icon: <Circle style={{ width: '14px', height: '14px' }} />,        color: '#9ca3af', bg: '#f3f4f6' },
  { id: 'قيد التنفيذ', icon: <Clock style={{ width: '14px', height: '14px' }} />,          color: '#1a56db', bg: '#eff6ff' },
  { id: 'معلقة',       icon: <AlertTriangle style={{ width: '14px', height: '14px' }} />,  color: '#e6820a', bg: '#fffbeb' },
  { id: 'مكتملة',     icon: <CheckCircle2 style={{ width: '14px', height: '14px' }} />,   color: '#0ea77b', bg: '#ecfdf5' },
  { id: 'ملغاة',       icon: <X style={{ width: '14px', height: '14px' }} />,              color: '#6b7280', bg: '#f3f4f6' },
].filter(s => (TASK_STATUS_STEPS as readonly string[]).includes(s.id))

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px',
}

export function TaskModal({ task, projects, tenantId, defaultProjectId, onClose, onSave }: {
  task: ProjectTask | null
  projects: TaskProject[]
  tenantId: string
  defaultProjectId?: number
  onClose: () => void
  onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [assignees, setAssignees] = useState<AssigneeOption[]>([])
  const [form, setForm] = useState({
    project_id: task?.project_id ? String(task.project_id) : (defaultProjectId ? String(defaultProjectId) : ''),
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
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!tenantId) return
    const proj = projects.find(p => String(p.id) === form.project_id)
    fetchAssigneeOptions(supabase, tenantId, proj?.team_id).then(setAssignees)
  }, [tenantId, form.project_id, projects])

  async function handleSave() {
    if (!form.title.trim())    { toast.error('عنوان المهمة مطلوب'); return }
    if (!form.project_id)      { toast.error('يجب تحديد المشروع');   return }
    setSaving(true)
    const payload: Record<string, unknown> = {
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
    onSave()
    setSaving(false)
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
              {assignees.length === 0 ? (
                <input value={form.assignee} onChange={e => set('assignee', e.target.value)} className="input" placeholder="اسم المهندس" />
              ) : (
                <select value={form.assignee} onChange={e => set('assignee', e.target.value)} className="select">
                  <option value="">— اختر من الفريق —</option>
                  {assignees.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name}{m.role_in_team ? ` (${m.role_in_team})` : m.job_title ? ` — ${m.job_title}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={lbl}>التصنيف</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {['تصميم', 'تنفيذ', 'إداري', 'سلامة', 'جودة', 'مشتريات', 'أخرى'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
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
            <Save style={{ width: '14px', height: '14px' }} />
            {task ? 'حفظ التعديل' : 'إضافة المهمة'}
          </button>
        </div>
      </div>
    </div>
  )
}
