'use client'
import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import ProjectModal  from '@/components/projects/ProjectModal'
import ProjectDetail from '@/components/projects/ProjectDetail'
import { useStore } from '@/hooks/useStore'
import { projectsApi, visitsApi } from '@/lib/db'
import type { QhseVisitType } from '@/components/projects/QuickQhseModal'
const QuickQhseModal = dynamic(() => import('@/components/projects/QuickQhseModal'), { ssr: false })
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, daysUntil, PROJECT_STAGES } from '@/lib/utils'
import { phaseLabel, WORKFLOW_TYPES, statusForPhase } from '@/lib/sec-workflow'
import type { PmoPhase } from '@/lib/sec-workflow'
import { isMonitorPhase } from '@/lib/project-phase-display'
import { fetchAssigneeOptions, type AssigneeOption } from '@/lib/project-teams'
import { getMissingClosureDocs, formatMissingClosureDocs, isTaskOpen } from '@/lib/project-tasks'


import {
  Plus, Search, Eye, Pencil, Trash2, FolderOpen,
  LayoutGrid, List, Columns, ChevronLeft, ChevronRight,
  MessageSquarePlus, X, Send, StickyNote, Building2, Tag, Save,
  ClipboardList, MapPin, ChevronDown, Circle, Clock, AlertTriangle, CheckCircle2
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

const PROJECT_TYPES: { code: string; name: string }[] = [
  { code: '801',   name: '┘à╪┤╪د╪▒┘è╪╣ ╪د┘╪▒╪ذ╪╖ ╪د┘┘â┘ç╪▒╪ذ╪د╪خ┘è 801' },
  { code: '802',   name: '┘à╪┤╪د╪▒┘è╪╣ ╪د┘╪ز┘ê╪▓┘è╪╣ 802' },
  { code: '405',   name: '┘à╪┤╪د╪▒┘è╪╣ ┘â┘ç╪▒╪ذ╪د╪ة 405' },
  { code: '441',   name: '┘à╪┤╪د╪▒┘è╪╣ ╪د┘┘à╪ص┘ê┘╪د╪ز 441' },
  { code: '442',   name: '┘à╪ص╪╖╪د╪ز ╪د┘╪ز┘ê╪▓┘è╪╣ 442' },
  { code: '805',   name: '┘à╪┤╪د╪▒┘è╪╣ ╪د┘┘┘é┘ 805' },
  { code: 'O&M',   name: '╪╡┘è╪د┘╪ر ┘ê╪ز╪┤╪║┘è┘ O&M' },
  { code: 'EPC',   name: '┘ç┘╪»╪│╪ر ┘ê╪ز┘ê╪▒┘è╪» ┘ê╪ز┘┘┘è╪░ EPC' },
  { code: 'CIVIL', name: '╪ث╪╣┘à╪د┘ ┘à╪»┘┘è╪ر' },
  { code: 'OTHER', name: '╪ث╪«╪▒┘ë' },
]
const TYPE_NAME: Record<string, string> = Object.fromEntries(PROJECT_TYPES.map(t => [t.code, t.name]))

const COLUMNS = [
  { id: '╪ز╪ص╪ز ╪د┘╪ز╪«╪╖┘è╪╖', label: '╪ز╪ص╪ز ╪د┘╪ز╪«╪╖┘è╪╖', icon: '≡اôï', color: '#6b7280', bg: '#f9fafb',  border: '#e5e7eb', autoProgress: 0   },
  { id: '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░',  label: '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░',  icon: '≡ا¤', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', autoProgress: 10  },
  { id: '┘é┘è╪» ╪د┘╪ح╪║┘╪د┘é',  label: '┘é┘è╪» ╪د┘╪ح╪║┘╪د┘é',  icon: '≡ا¤ْ', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', autoProgress: 60  },
  { id: '┘à┘â╪ز┘à┘',        label: '┘à┘â╪ز┘à┘',         icon: 'ظ£à', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', autoProgress: 100 },
  { id: '┘à╪ز╪ث╪«╪▒',        label: '┘à╪ز╪ث╪«╪▒',         icon: 'ظأبي╕', color: '#c81e1e', bg: '#fef2f2', border: '#fca5a5', autoProgress: null },
  { id: '┘à┘ê┘é┘ê┘',        label: '┘à┘ê┘é┘ê┘',          icon: '≡اأس', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d', autoProgress: null },
  { id: '┘à┘╪║┘è',         label: '┘à┘╪║┘è',           icon: 'ظإî', color: '#374151', bg: '#f3f4f6', border: '#d1d5db', autoProgress: null },
]

function getStatusColor(p: Project): string {
  const status = p.status as string
  const days   = daysUntil(p.end_date)
  if (p.progress >= 100 || status === '┘à┘â╪ز┘à┘')                                       return 'badge-green'
  if (status === '┘à╪ز╪ث╪«╪▒' || (days !== null && days < 0 && status === '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░')) return 'badge-red'
  if (status === '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░')                                                       return 'badge-blue'
  if (status === '┘é┘è╪» ╪د┘╪ح╪║┘╪د┘é')                                                       return 'badge-closing'
  if (status === '┘à┘ê┘é┘ê┘')                                                              return 'badge-amber'
  if (status === '┘à┘╪║┘è')                                                               return 'badge-gray'
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

// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
// ┘à┘ê╪»╪د┘ ╪ح╪╢╪د┘╪ر ┘à┘╪د╪ص╪╕╪ر
// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
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

  const notes = (project.history || []).filter(h => h.includes('≡اôإ')).slice(-5).reverse()

  return (
    <div className="modal-overlay" onMouseDown={(e) => { (e.currentTarget as any)._md = e.target }} onClick={(e) => { if (e.target === e.currentTarget && (e.currentTarget as any)._md === e.currentTarget) onClose() }} style={{ zIndex: 60 }}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StickyNote style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            ╪ح╪╢╪د┘╪ر ┘à┘╪د╪ص╪╕╪ر ظ¤ {project.name}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea ref={textRef} value={text} onChange={e => setText(e.target.value)}
              className="input" style={{ minHeight: '100px', resize: 'none' }}
              placeholder="╪د┘â╪ز╪ذ ┘à┘╪د╪ص╪╕╪ز┘â ┘ç┘╪د..." />
            {notes.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '6px' }}>╪ت╪«╪▒ ╪د┘┘à┘╪د╪ص╪╕╪د╪ز:</div>
                {notes.map((n, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: '#6b7280', padding: '5px 10px', background: '#f9fafb', borderRadius: '6px', marginBottom: '4px' }}>{n}</div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">╪ح┘╪║╪د╪ة</button>
            <button type="submit" disabled={saving || !text.trim()} className="btn btn-primary" style={{ background: '#e6820a' }}>
              {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Send style={{ width: '14px', height: '14px' }} />}
              ╪ص┘╪╕ ╪د┘┘à┘╪د╪ص╪╕╪ر
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
// ╪▓╪▒ ╪د┘╪ح╪╢╪د┘╪ر ╪د┘╪│╪▒┘è╪╣╪ر (+) ظ¤ ┘à┘╪د╪ص╪╕╪ر / ╪▓┘è╪د╪▒╪ر QHSE / ┘à┘ç┘à╪ر
// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
function QuickAddButton({ project, onNote, onTask, onQhse }: {
  project: Project
  onNote:  () => void
  onTask:  () => void
  onQhse:  (type: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [qhseOpen, setQhseOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const noteCount = (project.history || []).filter(h => h.includes('≡اôإ')).length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQhseOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(o => !o); setQhseOpen(false) }}
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
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: '160px',
          overflow: 'hidden',
        }}>
          {/* ┘à┘╪د╪ص╪╕╪ر */}
          <button onClick={() => { setOpen(false); onNote() }}
            style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600,
              color: 'var(--text)', textAlign: 'right' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
            <span style={{ color: '#e6820a' }}><MessageSquarePlus style={{ width: '14px', height: '14px' }} /></span>
            ┘à┘╪د╪ص╪╕╪ر
          </button>

          {/* ╪▓┘è╪د╪▒╪ر QHSE ظ¤ ┘é╪د╪خ┘à╪ر ┘╪▒╪╣┘è╪ر */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setQhseOpen(o => !o)}
              style={{ width: '100%', padding: '9px 14px', border: 'none', background: qhseOpen ? '#f9fafb' : 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = qhseOpen ? '#f9fafb' : 'white')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#1a56db' }}><MapPin style={{ width: '14px', height: '14px' }} /></span>
                ╪▓┘è╪د╪▒╪ر
              </div>
              <ChevronDown style={{ width: '10px', height: '10px', transform: qhseOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </button>

            {qhseOpen && (
              <div style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                {[
                  { label: '≡اؤةي╕ ╪▓┘è╪د╪▒╪ر ╪│┘╪د┘à╪ر', type: 'safety_inspection',   color: '#e6820a' },
                  { label: '≡ا¤ ╪▓┘è╪د╪▒╪ر ╪ش┘ê╪»╪ر',   type: 'quality_inspection',  color: '#1a56db' },
                  { label: '≡اî┐ ╪▓┘è╪د╪▒╪ر ╪ذ┘è╪خ┘è╪ر',  type: 'env_inspection',      color: '#059669' },
                ].map(item => (
                  <button key={item.type}
                    onClick={() => { setOpen(false); setQhseOpen(false); onQhse(item.type) }}
                    style={{ width: '100%', padding: '8px 14px 8px 24px', border: 'none', background: 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: '0.78rem', fontWeight: 600, color: item.color, textAlign: 'right' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ┘à┘ç┘à╪ر */}
          <button onClick={() => { setOpen(false); onTask() }}
            style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600,
              color: 'var(--text)', textAlign: 'right' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
            <span style={{ color: '#7c3aed' }}><ClipboardList style={{ width: '14px', height: '14px' }} /></span>
            ┘à┘ç┘à╪ر
          </button>
        </div>
      )}
    </div>
  )
}



// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
// ┘à┘ê╪»╪د┘ ╪ح╪╢╪د┘╪ر ╪▓┘è╪د╪▒╪ر ╪│╪▒┘è╪╣╪ر

const STATUS_STEPS = [
  { id: '┘┘à ╪ز╪ذ╪»╪ث',     icon: <Circle style={{ width: '14px', height: '14px' }} />,       color: '#9ca3af', bg: '#f3f4f6' },
  { id: '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░', icon: <Clock style={{ width: '14px', height: '14px' }} />,         color: '#1a56db', bg: '#eff6ff' },
  { id: '┘à╪╣┘┘é╪ر',       icon: <AlertTriangle style={{ width: '14px', height: '14px' }} />, color: '#e6820a', bg: '#fffbeb' },
  { id: '┘à┘â╪ز┘à┘╪ر',      icon: <CheckCircle2 style={{ width: '14px', height: '14px' }} />,  color: '#0ea77b', bg: '#ecfdf5' },
  { id: '┘à┘╪║╪د╪ر',       icon: <X style={{ width: '14px', height: '14px' }} />,             color: '#6b7280', bg: '#f3f4f6' },
]

// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
// TaskModal ظ¤ ┘à┘ê╪»╪د┘ ╪ح╪╢╪د┘╪ر/╪ز╪╣╪»┘è┘ ╪د┘┘à┘ç┘à╪ر
// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px'
}
const PRIORITY_COLOR: Record<string, { bg: string; color: string; border: string; label: string }> = {
  '╪╣╪د┘┘è':    { bg: '#fef2f2', color: '#c81e1e', border: '#fca5a5', label: '≡ا¤┤ ╪╣╪د┘┘è' },
  '┘à╪ز┘ê╪│╪╖':   { bg: '#fffbeb', color: '#e6820a', border: '#fcd34d', label: '≡ااة ┘à╪ز┘ê╪│╪╖' },
  '┘à┘╪«┘╪╢':   { bg: '#f0fdf4', color: '#0ea77b', border: '#86efac', label: '≡اات ┘à┘╪«┘╪╢' },
}

function TaskModal({ task, projects, tenantId, onClose, onSave, defaultProjectId }: {
  task: Task | null; projects: Project[]; tenantId: string
  onClose: () => void; onSave: () => void
  defaultProjectId?: number
}) {
  const [saving, setSaving] = useState(false)
  const [assignees, setAssignees] = useState<AssigneeOption[]>([])
  const [form, setForm] = useState({
    project_id: task?.project_id ? String(task.project_id) : defaultProjectId ? String(defaultProjectId) : '',
    title:       task?.title       || '',
    description: task?.description || '',
    assignee:    task?.assignee    || '',
    priority:    task?.priority    || '┘à╪ز┘ê╪│╪╖',
    status:      task?.status      || '┘┘à ╪ز╪ذ╪»╪ث',
    category:    task?.category    || '',
    start_date:  task?.start_date  || '',
    due_date:    task?.due_date    || '',
    progress:    task?.progress    ?? 0,
    notes:       task?.notes       || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!tenantId) return
    const proj = projects.find(p => String(p.id) === form.project_id)
    fetchAssigneeOptions(supabase, tenantId, proj?.team_id).then(setAssignees)
  }, [tenantId, form.project_id, projects])

  async function handleSave() {
    if (!form.title.trim())    { toast.error('╪╣┘┘ê╪د┘ ╪د┘┘à┘ç┘à╪ر ┘à╪╖┘┘ê╪ذ'); return }
    if (!form.project_id)      { toast.error('┘è╪ش╪ذ ╪ز╪ص╪»┘è╪» ╪د┘┘à╪┤╪▒┘ê╪╣');   return }
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
    if (form.status === '┘à┘â╪ز┘à┘╪ر' && (!task || task.status !== '┘à┘â╪ز┘à┘╪ر')) {
      payload.completed_at = new Date().toISOString()
      payload.progress = 100
    }
    if (task) await supabase.from('project_tasks').update(payload).eq('id', task.id)
    else      await supabase.from('project_tasks').insert(payload)
    toast.success(task ? '╪ز┘à ╪د┘╪ز╪╣╪»┘è┘ ظ£à' : 'ظ£à ╪ز┘à╪ز ╪ح╪╢╪د┘╪ر ╪د┘┘à┘ç┘à╪ر')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>
            {task ? 'ظ£ي╕ ╪ز╪╣╪»┘è┘ ╪د┘┘à┘ç┘à╪ر' : 'ظئـ ┘à┘ç┘à╪ر ╪ش╪»┘è╪»╪ر'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

          <div>
            <label style={lbl}>╪د┘┘à╪┤╪▒┘ê╪╣ <span style={{ color: '#c81e1e' }}>*</span></label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
              <option value="">ظ¤ ╪د╪«╪ز╪▒ ╪د┘┘à╪┤╪▒┘ê╪╣ ظ¤</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>╪╣┘┘ê╪د┘ ╪د┘┘à┘ç┘à╪ر <span style={{ color: '#c81e1e' }}>*</span></label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="┘ê╪╡┘ ┘à╪«╪ز╪╡╪▒ ┘┘┘à┘ç┘à╪ر..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>╪د┘┘à╪│╪ج┘ê┘</label>
              {assignees.length === 0 ? (
                <input value={form.assignee} onChange={e => set('assignee', e.target.value)} className="input" placeholder="╪د╪│┘à ╪د┘┘à┘ç┘╪»╪│" />
              ) : (
                <select value={form.assignee} onChange={e => set('assignee', e.target.value)} className="select">
                  <option value="">ظ¤ ╪د╪«╪ز╪▒ ┘à┘ ╪د┘┘╪▒┘è┘é ظ¤</option>
                  {assignees.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name}{m.role_in_team ? ` (${m.role_in_team})` : m.job_title ? ` ظ¤ ${m.job_title}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={lbl}>╪د┘╪ز╪╡┘┘è┘</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                <option value="">ظ¤ ╪د╪«╪ز╪▒ ظ¤</option>
                {['╪ز╪╡┘à┘è┘à', '╪ز┘┘┘è╪░', '╪ح╪»╪د╪▒┘è', '╪│┘╪د┘à╪ر', '╪ش┘ê╪»╪ر', '┘à╪┤╪ز╪▒┘è╪د╪ز', '╪ث╪«╪▒┘ë'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* ╪د┘╪ث┘ê┘┘ê┘è╪ر */}
          <div>
            <label style={lbl}>╪د┘╪ث┘ê┘┘ê┘è╪ر</label>
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

          {/* ╪د┘╪ص╪د┘╪ر */}
          <div>
            <label style={lbl}>╪د┘╪ص╪د┘╪ر</label>
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
              <label style={lbl}>╪ز╪د╪▒┘è╪« ╪د┘╪ذ╪»╪ة</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>╪ز╪د╪▒┘è╪« ╪د┘╪د╪│╪ز╪ص┘é╪د┘é</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label style={lbl}>┘╪│╪ذ╪ر ╪د┘╪ح┘╪ش╪د╪▓: <strong>{form.progress}%</strong></label>
            <input type="range" min={0} max={100} step={5} value={form.progress}
              onChange={e => set('progress', e.target.value)}
              style={{ width: '100%', accentColor: 'var(--primary)' }} />
          </div>

          <div>
            <label style={lbl}>╪د┘┘ê╪╡┘ ┘ê╪د┘╪ز┘╪د╪╡┘è┘</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input" style={{ minHeight: '70px', resize: 'none' }} placeholder="╪ز┘╪د╪╡┘è┘ ╪د┘┘à┘ç┘à╪ر..." />
          </div>

        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">╪ح┘╪║╪د╪ة</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '14px', height: '14px' }} />}
            {task ? '╪ص┘╪╕ ╪د┘╪ز╪╣╪»┘è┘' : '╪ح╪╢╪د┘╪ر ╪د┘┘à┘ç┘à╪ر'}
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
    if (!newName.trim()) { toast.error('╪د╪│┘à ╪د┘┘┘ê╪╣ ┘à╪╖┘┘ê╪ذ'); return }
    setSaving(true)
    const code = newName.trim().substring(0, 20)
    const { error } = await supabase.from('project_types')
      .insert({ tenant_id: tenantId, code, name: newName.trim() })
    if (error) { toast.error(error.code === '23505' ? '┘ç╪░╪د ╪د┘┘┘ê╪╣ ┘à┘ê╪ش┘ê╪» ┘à╪│╪ذ┘é╪د┘ï' : '╪«╪╖╪ث ┘┘è ╪د┘╪ص┘╪╕'); setSaving(false); return }
    setNewName('')
    await loadTypes()
    toast.success('ظ£à ╪ز┘à╪ز ╪د┘╪ح╪╢╪د┘╪ر')
    setSaving(false)
  }

  async function handleEdit(id: number) {
    if (!editName.trim()) return
    await supabase.from('project_types').update({ name: editName.trim(), code: editName.trim().substring(0, 20) }).eq('id', id)
    setEditId(null); setEditName('')
    await loadTypes()
    toast.success('╪ز┘à ╪د┘╪ز╪╣╪»┘è┘ ظ£à')
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`╪ص╪░┘ ╪د┘┘┘ê╪╣ "${name}"╪ا`)) return
    await supabase.from('project_types').update({ is_active: false }).eq('id', id)
    await loadTypes()
    toast.success('╪ز┘à ╪د┘╪ص╪░┘')
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { (e.currentTarget as any)._md = e.target }} onClick={(e) => { if (e.target === e.currentTarget && (e.currentTarget as any)._md === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            ╪ح╪»╪د╪▒╪ر ╪ث┘┘ê╪د╪╣ ╪د┘┘à╪┤╪د╪▒┘è╪╣
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ╪ز┘ê╪╢┘è╪ص */}
          <div style={{ background: '#f5f3ff', borderRadius: '10px', padding: '12px 14px', border: '1px solid #ddd6fe', fontSize: '0.82rem', color: '#5b21b6', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>≡اْة ╪ز┘ê╪╢┘è╪ص</div>
            ╪ث┘┘ê╪د╪╣ ╪د┘┘à╪┤╪د╪▒┘è╪╣ ╪ز┘╪│╪ز╪«╪»┘à ┘┘╪ز╪╡┘┘è┘ ┘ê╪د┘╪ز┘é╪د╪▒┘è╪▒ ظ¤ ┘à╪س┘ ┘à╪▒╪د┘â╪▓ ╪د┘╪ز┘â┘┘╪ر.
            <br />
            <span style={{ opacity: 0.8 }}>┘à╪س╪د┘: <strong>┘à╪┤╪▒┘ê╪╣ 405</strong> ╪ث┘ê <strong>╪╡┘è╪د┘╪ر ╪»┘ê╪▒┘è╪ر</strong> ╪ث┘ê <strong>╪ز┘ê╪│╪╣╪ر ╪┤╪ذ┘â╪ر</strong></span>
          </div>

          {/* ╪ح╪╢╪د┘╪ر ┘┘ê╪╣ ╪ش╪»┘è╪» */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="input" placeholder="╪د┘â╪ز╪ذ ╪د╪│┘à ╪د┘┘┘ê╪╣ ╪د┘╪ش╪»┘è╪»..." style={{ flex: 1 }} />
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="btn btn-primary" style={{ background: '#7c3aed', whiteSpace: 'nowrap' }}>
              {saving
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Plus style={{ width: '15px', height: '15px' }} />}
              ╪ح╪╢╪د┘╪ر
            </button>
          </div>

          {/* ┘é╪د╪خ┘à╪ر ╪د┘╪ث┘┘ê╪د╪╣ */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>╪ش╪د╪▒┘è ╪د┘╪ز╪ص┘à┘è┘...</div>
          ) : types.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', background: '#f9fafb', borderRadius: '10px', fontSize: '0.875rem' }}>
              ┘╪د ╪ز┘ê╪ش╪» ╪ث┘┘ê╪د╪╣ ╪ذ╪╣╪» ظ¤ ╪ث╪╢┘ ╪ث┘ê┘ ┘┘ê╪╣
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
                        ╪ص┘╪╕
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
          <button onClick={onClose} className="btn btn-primary" style={{ background: '#7c3aed' }}>╪ز┘à</button>
        </div>
      </div>
    </div>
  )
}


// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
// ╪ذ╪╖╪د┘é╪ر Kanban
// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
function KanbanCard({ p, teamName, canEdit, lockPhase, blockers, onView, onEdit, onDelete, onMove, onNote, onQhse, onTask }: {
  p: Project; teamName?: string; canEdit: boolean; lockPhase?: boolean; blockers?: { tasks: number; ncr: number }
  onView: () => void; onEdit: () => void; onDelete: () => void
  onMove: (dir: 'prev' | 'next') => void; onNote: () => void
  onQhse: (type: string) => void; onTask: () => void
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

      {/* ╪د┘╪ث┘â┘ê╪د╪» + ╪د┘╪ص╪د┘╪ر */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '5px', flexWrap: 'wrap' }}>
        {p.code && <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{p.code}</span>}
        {p.type && <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{TYPE_NAME[p.type] || p.type}</span>}
      </div>

      {/* ╪ح╪┤╪╣╪د╪▒ ╪د┘┘à┘ê╪د┘╪╣ */}
      {blockers && (blockers.tasks > 0 || blockers.ncr > 0) && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '5px' }}>
          {blockers.tasks > 0 && (
            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: '#fef2f2', color: '#c81e1e', fontWeight: 600, border: '1px solid #fecaca' }}>
              ظأبي╕ {blockers.tasks} ┘à┘ç┘à╪ر ┘à┘╪ز┘ê╪ص╪ر
            </span>
          )}
          {blockers.ncr > 0 && (
            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: '#fffbeb', color: '#e6820a', fontWeight: 600, border: '1px solid #fcd34d' }}>
              ≡ا¤┤ {blockers.ncr} NCR ┘à┘╪ز┘ê╪ص╪ر
            </span>
          )}
        </div>
      )}

      {/* ╪د┘╪د╪│┘à */}
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e', marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {p.name}
      </div>

      {/* ╪د┘╪╣┘à┘è┘ */}
      {((p as any).client_name || (p as any).client) && (
        <div style={{ fontSize: '0.72rem', color: '#1a56db', marginBottom: '6px', fontWeight: 600 }}>
          ≡ات {(p as any).client_name || (p as any).client}
        </div>
      )}

      {teamName && (
        <div style={{ fontSize: '0.68rem', color: '#1a56db', marginBottom: '4px', fontWeight: 600 }}>≡اّح {teamName}</div>
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

      {/* ╪د┘╪ز╪د╪▒┘è╪« + ╪د┘┘à╪ز╪ذ┘é┘è */}
      {days !== null && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: isLate ? '#fef2f2' : days <= 7 ? '#fffbeb' : '#f9fafb', color: isLate ? '#c81e1e' : days <= 7 ? '#e6820a' : '#9ca3af' }}>
            {isLate ? `ظأبي╕ ┘à╪ز╪ث╪«╪▒ ${Math.abs(days)} ┘è┘ê┘à` : days === 0 ? 'ظ░ ╪ز╪│┘┘è┘à ╪د┘┘è┘ê┘à' : `≡اôà ┘à╪ز╪ذ┘é┘è ${days} ┘è┘ê┘à`}
          </span>
        </div>
      )}

      {/* ╪د┘╪ث╪▓╪▒╪د╪▒ */}
      <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
        <button onClick={onView}
          style={{ flex: 1, padding: '5px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
          <Eye style={{ width: '12px', height: '12px' }} /> ╪ز┘╪د╪╡┘è┘
        </button>
        <QuickAddButton project={p} onNote={onNote} onQhse={onQhse} onTask={onTask} />
        {canEdit && !lockPhase && (
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
        {canEdit && !lockPhase && (
          <div style={{ display: 'flex', gap: '2px', marginRight: 'auto' }}>
            {colIdx > 0 && (
              <button onClick={() => onMove('prev')} title="╪▒╪ش┘ê╪╣"
                style={{ padding: '5px 6px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                <ChevronRight style={{ width: '12px', height: '12px' }} />
              </button>
            )}
            {colIdx < COLUMNS.length - 1 && (
              <button onClick={() => onMove('next')} title="╪ز┘é╪»┘à"
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

// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
// ╪د┘╪╡┘╪ص╪ر ╪د┘╪▒╪خ┘è╪│┘è╪ر
// ظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـظـ
export default function ProjectsPage() {
  const { tenant, activeBranch, projects, setProjects, currentUser } = useStore()
  const [loading, setLoading]     = useState(projects.length === 0)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  // ┘à┘ê╪»╪د┘ QHSE ╪د┘╪│╪▒┘è╪╣
  const [qhseModal, setQhseModal] = useState<{ type: QhseVisitType; projectId?: number } | null>(null)
  const [typeFilter, setType]     = useState('')
  const [clientFilter, setClient] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [myTeamOnly, setMyTeamOnly] = useState(false)
  const [myTeamIds,  setMyTeamIds]  = useState<number[]>([])
  const { displayPrefs, updateDisplayPref } = useStore()
  const [viewMode, setViewMode] = useState<'kanban' | 'grid' | 'list'>(
    (displayPrefs.projects as any) || 'kanban'
  )
  function changeView(mode: 'kanban' | 'grid' | 'list') {
    setViewMode(mode)
    updateDisplayPref('projects', mode as any)
    // ╪ص┘╪╕ ┘┘è ┘é╪د╪╣╪»╪ر ╪د┘╪ذ┘è╪د┘╪د╪ز
    if (tenant) {
      import('@/lib/supabase').then(({ supabase }) => {
        supabase.from('employees')
          .update({ display_preferences: { ...displayPrefs, projects: mode } })
          .eq('id', (window as any).__userId || 0)
      })
    }
  }
  const [noteProject,  setNoteProject]  = useState<Project | null>(null)
  const [taskProject,  setTaskProject]  = useState<Project | null>(null)

  useEffect(() => {
    const v = (tenant as any)?.display_settings?.projectsView
    if (v) setViewMode(v as any)
  }, [(tenant as any)?.display_settings?.projectsView])

  const [showModal,        setShowModal]        = useState(false)
  const [editProject,      setEditProject]      = useState<Project | null>(null)
  const [detailProject,    setDetail]           = useState<Project | null>(null)

  const canEdit = currentUser?.role === '┘à╪»┘è╪▒ ╪╣╪د┘à' || currentUser?.permissions?.includes('projects_edit')
  const [projectBlockers, setProjectBlockers] = useState<Record<number, { tasks: number; ncr: number }>>({})
  const [teamNames, setTeamNames] = useState<Record<number, string>>({})

  async function loadProjectBlockers(projectIds: number[]) {
    if (!tenant || projectIds.length === 0) return
    const [tasksRes, ncrRes] = await Promise.all([
      supabase.from('project_tasks').select('project_id, status')
        .eq('tenant_id', tenant.id)
        .in('project_id', projectIds),
      supabase.from('visits').select('project_id')
        .eq('tenant_id', tenant.id)
        .in('project_id', projectIds)
        .eq('specs', '╪║┘è╪▒ ┘à╪╖╪د╪ذ┘é')
        .is('resolved_report', null),
    ])
    const map: Record<number, { tasks: number; ncr: number }> = {}
    ;(tasksRes.data || []).forEach((t: { project_id: number; status: string }) => {
      if (!isTaskOpen(t.status)) return
      if (!map[t.project_id]) map[t.project_id] = { tasks: 0, ncr: 0 }
      map[t.project_id].tasks++
    })
    ;(ncrRes.data || []).forEach((v: { project_id: number }) => { if (!map[v.project_id]) map[v.project_id] = { tasks: 0, ncr: 0 }; map[v.project_id].ncr++ })
    setProjectBlockers(map)
  }

  useEffect(() => { loadProjects() }, [tenant?.id, activeBranch?.id])

  useEffect(() => {
    if (!tenant || !currentUser?.hr_employee_id) { setMyTeamIds([]); return }
    supabase.from('team_members')
      .select('team_id')
      .eq('tenant_id', tenant.id)
      .eq('employee_id', currentUser.hr_employee_id)
      .eq('is_active', true)
      .then(({ data }) => setMyTeamIds((data || []).map((m: { team_id: number }) => m.team_id)))
  }, [tenant?.id, currentUser?.hr_employee_id])


  async function loadProjects() {
    if (!tenant || !activeBranch) return
    if (projects.length === 0) setLoading(true)
    const [{ data }, { data: teamsData }] = await Promise.all([
      projectsApi.getAll(tenant.id, activeBranch.id),
      supabase.from('teams').select('id, name').eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id),
    ])
    const loaded = (data || []).filter((p: Project & { pmo_phase?: string }) => isMonitorPhase(p.pmo_phase))
    const tMap: Record<number, string> = {}
    ;(teamsData || []).forEach((t: { id: number; name: string }) => { tMap[t.id] = t.name })
    setTeamNames(tMap)
    setProjects(loaded)
    setLoading(false)
    // ╪ز╪ص┘à┘è┘ ┘à┘ê╪د┘╪╣ ╪د┘╪ح╪║┘╪د┘é ┘┘┘à╪┤╪د╪▒┘è╪╣ ╪د┘┘╪┤╪╖╪ر
    const activeIds = loaded.filter((p: any) => p.status !== '┘à┘â╪ز┘à┘' && p.status !== '┘à┘╪║┘è').map((p: any) => p.id)
    if (activeIds.length > 0) loadProjectBlockers(activeIds)
  }

  // ظ£à ╪ح╪╡┘╪د╪ص handleSave ظ¤ insert ┘┘╪ش╪»┘è╪»╪î update ┘┘╪ز╪╣╪»┘è┘
  // ╪د┘┘╪│╪ذ╪ر ╪د┘╪ز┘┘é╪د╪خ┘è╪ر ╪ص╪│╪ذ ╪د┘╪ص╪د┘╪ر
  function getAutoProgress(status: string | undefined, currentProgress: number): number {
    const col = COLUMNS.find(c => c.id === (status || ''))
    return col?.autoProgress !== null && col?.autoProgress !== undefined
      ? col.autoProgress
      : currentProgress
  }

  async function handleSave(data: Partial<Project>): Promise<void> {
    if (!tenant || !activeBranch) return

    if (!(data as any).id) {
      toast.error('╪ث┘╪┤╪خ ╪د┘┘à╪┤╪▒┘ê╪╣ ╪د┘╪ش╪»┘è╪» ┘à┘ ╪ز╪ذ┘ê┘è╪ذ ┬س┘à╪▒╪ص┘╪ر ╪د┘╪ذ╪»╪ة┬╗')
      return
    }

    let error: any = null

    // ظـظـ ┘╪ص╪╡ ╪┤╪▒┘ê╪╖ ╪د┘╪د┘â╪ز┘à╪د┘ ╪╣┘╪» ╪ز╪║┘è┘è╪▒ ╪د┘╪ص╪د┘╪ر ┘┘ "┘à┘â╪ز┘à┘" ظـظـ
    const existingProject = projects.find(p => p.id === (data as any).id)
    if (data.status === '┘à┘â╪ز┘à┘' && existingProject?.status !== '┘à┘â╪ز┘à┘') {
      const blockers: string[] = []

      const { data: attachments } = await supabase
        .from('project_attachments').select('category')
        .eq('project_id', (data as any).id).eq('tenant_id', tenant.id)
      const uploadedCategories = (attachments || []).map((a: { category: string }) => a.category)
      const missingDocs = getMissingClosureDocs(uploadedCategories)
      if (missingDocs.length > 0)
        blockers.push(`┘à╪▒┘┘é╪د╪ز ┘╪د┘é╪╡╪ر: ${formatMissingClosureDocs(missingDocs)}`)

      const { data: allTasks } = await supabase
        .from('project_tasks').select('status')
        .eq('project_id', (data as any).id).eq('tenant_id', tenant.id)
      const openCount = (allTasks || []).filter(t => isTaskOpen(t.status)).length
      if (openCount > 0)
        blockers.push(`${openCount} ┘à┘ç┘à╪ر ┘à┘╪ز┘ê╪ص╪ر ┘┘à ╪ز┘╪║┘┘é`)

      const { data: openNCR } = await supabase
        .from('visits').select('id')
        .eq('project_id', (data as any).id).eq('tenant_id', tenant.id)
        .eq('specs', '╪║┘è╪▒ ┘à╪╖╪د╪ذ┘é').is('resolved_report', null)
      if ((openNCR?.length || 0) > 0)
        blockers.push(`${openNCR!.length} ╪▓┘è╪د╪▒╪ر ╪║┘è╪▒ ┘à╪╖╪د╪ذ┘é╪ر (NCR) ┘à┘╪ز┘ê╪ص╪ر`)

      if (blockers.length > 0) {
        const msg = ['ظؤ¤ ┘╪د ┘è┘à┘â┘ ╪ح╪║┘╪د┘é ╪د┘┘à╪┤╪▒┘ê╪╣:'].concat(blockers.map(b => 'ظت ' + b)).join(String.fromCharCode(10))
        toast.error(msg, { duration: 8000, style: { whiteSpace: 'pre-line' } })
        return
      }
    }

    // ╪ز╪╖╪ذ┘è┘é ╪د┘┘╪│╪ذ╪ر ╪د┘╪ز┘┘é╪د╪خ┘è╪ر ╪ص╪│╪ذ ╪د┘╪ص╪د┘╪ر
    const autoProgress = getAutoProgress(data.status || '╪ز╪ص╪ز ╪د┘╪ز╪«╪╖┘è╪╖', data.progress || 0)
    const payload = { ...data, progress: autoProgress } as Partial<Project> & { pmo_phase?: PmoPhase }
    if (payload.pmo_phase) {
      payload.status = statusForPhase(payload.pmo_phase)
    }
    // ┘╪د ┘╪ص╪░┘ value ظ¤ ┘é┘è┘à╪ر ╪د┘╪╣┘é╪» ┘à╪╖┘┘ê╪ذ╪ر

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

    if (error) { toast.error('╪ص╪»╪س ╪«╪╖╪ث ┘┘è ╪د┘╪ص┘╪╕: ' + error.message); return }
    await loadProjects()
    setShowModal(false); setEditProject(null)
    toast.success(editProject ? '╪ز┘à ╪د┘╪ز╪╣╪»┘è┘ ظ£à' : '╪ز┘à ╪ح╪╢╪د┘╪ر ╪د┘┘à╪┤╪▒┘ê╪╣ ظ£à')
  }

  async function handleDelete(p: Project) {
    if (!confirm(`╪ص╪░┘ ╪د┘┘à╪┤╪▒┘ê╪╣ "${p.name}"╪ا`)) return
    await projectsApi.delete(p.id)
    setProjects(projects.filter(x => x.id !== p.id))
    toast.success('╪ز┘à ╪ص╪░┘ ╪د┘┘à╪┤╪▒┘ê╪╣')
  }

  async function handleSaveNote(project: Project, noteText: string) {
    if (!tenant) return
    const now     = new Date()
    const dateStr = now.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false })
    const entry   = `${dateStr}╪î ${timeStr}: ≡اôإ ${noteText}`
    const history = [...(project.history || []), entry]
    const { error } = await supabase.from('projects').update({ history }).eq('id', project.id)
    if (error) { toast.error('╪«╪╖╪ث ┘┘è ╪ص┘╪╕ ╪د┘┘à┘╪د╪ص╪╕╪ر'); return }
    setProjects(projects.map(p => p.id === project.id ? { ...p, history } : p))
    toast.success('ظ£à ╪ز┘à ╪ص┘╪╕ ╪د┘┘à┘╪د╪ص╪╕╪ر')
  }

  async function handleMove(_p: Project, _direction: 'prev' | 'next') {
    toast.error('╪ز╪║┘è┘è╪▒ ╪د┘┘à╪▒╪ص┘╪ر ┘è╪ز┘à ╪╣╪ذ╪▒ ╪│┘╪د┘ ╪د┘╪ذ╪»╪ة ظ ╪د┘╪ز╪«╪╖┘è╪╖ ظ ╪د┘╪ز┘┘┘è╪░')
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
      (!clientFilter || (p as any).client_name === clientFilter || (p as any).client === clientFilter) &&
      (!teamFilter || String((p as any).team_id) === teamFilter) &&
      (!myTeamOnly || (myTeamIds.length > 0 && myTeamIds.includes((p as any).team_id)))
    )
  })

  const activeCount = projects.filter(p => p.status === '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░').length
  const doneCount   = projects.filter(p => p.progress >= 100 || p.status === '┘à┘â╪ز┘à┘').length
  const lateCount   = projects.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now && p.status !== '┘à┘â╪ز┘à┘').length
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      {/* ╪ث╪»┘ê╪د╪ز ╪د┘┘┘ê╪ص╪ر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>
          {projects.length} ┘à╪┤╪▒┘ê╪╣ ┘┘è ╪د┘╪ز┘┘┘è╪░ ┘ê╪د┘╪ح╪║┘╪د┘é ظ¤ ┘┘┘à╪ز╪د╪ذ╪╣╪ر ┘┘é╪╖ (┘╪د ╪ز╪║┘è┘è╪▒ ┘┘┘à╪▒╪د╪ص┘ ┘à┘ ┘ç┘╪د)
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canEdit && (
            <Link href="/projects/initiation/projects" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> ┘à╪┤╪▒┘ê╪╣ ╪ش╪»┘è╪»
            </Link>
          )}
          <button onClick={() => setShowManageTypes(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
            <Tag style={{ width: '15px', height: '15px' }} /> ╪ث┘┘ê╪د╪╣ ╪د┘┘à╪┤╪د╪▒┘è╪╣
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░',    value: String(activeCount), color: '#1a56db', bg: '#eff6ff', icon: '≡ا¤' },
          { label: '┘à┘â╪ز┘à┘',           value: String(doneCount),   color: '#0ea77b', bg: '#ecfdf5', icon: 'ظ£à' },
          { label: '┘à╪ز╪ث╪«╪▒',           value: String(lateCount),   color: '#c81e1e', bg: '#fef2f2', icon: 'ظأبي╕' },
          { label: '╪ح╪ش┘à╪د┘┘è ╪د┘┘é┘è┘à╪ر',  value: formatCurrency(totalValue), color: '#e6820a', bg: '#fffbeb', icon: '≡اْ░' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.icon} {kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ╪د┘┘┘╪د╪ز╪▒ */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="╪ذ╪ص╪س ╪ذ╪د╪│┘à ╪ث┘ê ╪▒┘é┘à ╪د┘┘à╪┤╪▒┘ê╪╣..." className="input"
            style={{ paddingRight: '32px', width: '220px' }} />
        </div>

        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="select" style={{ width: 'auto' }}>
          <option value="">┘â┘ ╪د┘╪ص╪د┘╪د╪ز</option>
          {COLUMNS.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}{c.autoProgress !== null ? ` ظ¤ ${c.autoProgress}%` : ''}</option>
          ))}
        </select>

        <select value={typeFilter} onChange={e => setType(e.target.value)} className="select" style={{ width: 'auto', minWidth: '180px' }}>
          <option value="">┘â┘ ╪د┘╪ث┘┘ê╪د╪╣</option>
          {existingTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={clientFilter} onChange={e => setClient(e.target.value)} className="select" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">┘â┘ ╪د┘╪ش┘ç╪د╪ز</option>
          {existingClients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="select" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">┘â┘ ╪د┘┘╪▒┘é</option>
          {Object.entries(teamNames).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        {myTeamIds.length > 0 && (
          <button type="button" onClick={() => setMyTeamOnly(v => !v)}
            style={{
              padding: '7px 14px', borderRadius: '8px', border: '2px solid', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600,
              borderColor: myTeamOnly ? '#7c3aed' : 'var(--border)',
              background: myTeamOnly ? '#f5f3ff' : 'white',
              color: myTeamOnly ? '#7c3aed' : 'var(--text3)',
            }}>
            ≡اّح ┘à╪┤╪د╪▒┘è╪╣ ┘╪▒┘è┘é┘è
          </button>
        )}

        {(search || statusFilter || typeFilter || clientFilter || teamFilter || myTeamOnly) && (
          <button onClick={() => { setSearch(''); setStatus(''); setType(''); setClient(''); setTeamFilter(''); setMyTeamOnly(false) }}
            className="btn btn-ghost btn-sm" style={{ color: '#9ca3af' }}>┘à╪│╪ص ╪د┘┘┘╪د╪ز╪▒</button>
        )}

        <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', padding: '3px', borderRadius: '8px', marginRight: 'auto' }}>
          {[
            { mode: 'kanban', icon: Columns,    title: 'Kanban' },
            { mode: 'grid',   icon: LayoutGrid, title: 'Grid' },
            { mode: 'list',   icon: List,       title: 'List' },
          ].map(({ mode, icon: Icon, title }) => (
            <button key={mode} onClick={() => changeView(mode as any)} title={title}
              style={{ padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: viewMode === mode ? 'white' : 'transparent',
                color:      viewMode === mode ? '#1a56db' : '#9ca3af',
                boxShadow:  viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              <Icon style={{ width: '15px', height: '15px' }} />
            </button>
          ))}
        </div>
      </div>

      {/* ╪د┘┘à╪ص╪ز┘ê┘ë */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <FolderOpen style={{ width: '48px', height: '48px', color: '#e5e7eb', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', marginBottom: '16px' }}>┘╪د ┘à╪┤╪د╪▒┘è╪╣ ┘┘è ┘à╪▒╪ص┘╪ر ╪د┘╪ز┘┘┘è╪░ ظ¤ ╪د╪╣╪ز┘à╪» ╪ز╪«╪╖┘è╪╖ ┘à╪┤╪▒┘ê╪╣ ╪ث┘ê┘╪د┘ï</p>
          {canEdit && (
            <Link href="/projects/initiation/projects" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> ╪ذ╪»╪ة ┘à╪┤╪▒┘ê╪╣ ╪ش╪»┘è╪»
            </Link>
          )}
        </div>

      ) : viewMode === 'kanban' ? (
        /* ظـظـ Kanban ظـظـ */
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', alignItems: 'flex-start', minWidth: 0 }}>
          {COLUMNS.map(col => {
            const colProjects = filtered.filter(p => {
              if (col.id === '┘à╪ز╪ث╪«╪▒')
                return p.status === '┘à╪ز╪ث╪«╪▒' || (p.status === '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░' && p.end_date && new Date(p.end_date) < now && p.progress < 100)
              return p.status === col.id && !(col.id === '┘é┘è╪» ╪د┘╪ز┘┘┘è╪░' && p.end_date && new Date(p.end_date) < now && p.progress < 100)
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
                    <div style={{ padding: '24px', textAlign: 'center', color: '#d1d5db', fontSize: '0.8rem' }}>┘╪د ╪ز┘ê╪ش╪» ┘à╪┤╪د╪▒┘è╪╣</div>
                  ) : (
                    colProjects.map(p => (
                      <KanbanCard key={p.id} p={p} teamName={(p as any).team_id ? teamNames[(p as any).team_id] : undefined} canEdit={!!canEdit} lockPhase blockers={projectBlockers[p.id]}
                        onView={() => setDetail(p)}
                        onEdit={() => { setEditProject(p); setShowModal(true) }}
                        onDelete={() => handleDelete(p)}
                        onMove={dir => handleMove(p, dir)}
                        onNote={() => setNoteProject(p)}
                        onQhse={(type) => setQhseModal({ type: type as QhseVisitType, projectId: p.id })}
                        onTask={() => setTaskProject(p)} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

      ) : viewMode === 'grid' ? (
        /* ظـظـ Grid ظـظـ */
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
                      {(p as any).workflow_type && (
                        <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                          {WORKFLOW_TYPES.find(w => w.id === (p as any).workflow_type)?.icon}
                          {' '}{WORKFLOW_TYPES.find(w => w.id === (p as any).workflow_type)?.label.split(' ')[0]}
                        </span>
                      )}
                      {(p as any).pmo_phase && (
                        <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '6px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>
                          {phaseLabel((p as any).pmo_phase, (p as any).workflow_type)?.split('ظ¤')[0]?.trim()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a2e' }}>{p.name}</div>
                    {((p as any).client_name || (p as any).client) && (
                      <div style={{ fontSize: '0.72rem', color: '#1a56db', marginTop: '3px', fontWeight: 600 }}>
                        ≡ات {(p as any).client_name || (p as any).client}
                      </div>
                    )}
                  </div>
                  <span className={`badge ${getStatusColor(p)}`} style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                    {p.progress >= 100 ? '┘à┘â╪ز┘à┘' : isLate ? '┘à╪ز╪ث╪«╪▒' : p.status}
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
                  {(p as any).team_id && teamNames[(p as any).team_id] && (
                    <span style={{ color: '#1a56db', fontWeight: 600 }}>≡اّح {teamNames[(p as any).team_id]}</span>
                  )}
                  {p.engineer && <span>≡اّ╖ {p.engineer}</span>}
                  {p.end_date && <span>≡اôà {formatDate(p.end_date)}</span>}
                  {(p as any).estimated_value   && <span>≡اْ░ {formatCurrency((p as any).estimated_value)}</span>}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDetail(p)}
                    style={{ flex: 1, padding: '6px', borderRadius: '7px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Eye style={{ width: '13px', height: '13px' }} /> ╪ز┘╪د╪╡┘è┘
                  </button>
                  <QuickAddButton project={p} onNote={() => setNoteProject(p)} onQhse={(type) => setQhseModal({ type: type as QhseVisitType, projectId: p.id })} onTask={() => setTaskProject(p)} />
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
        /* ظـظـ List ظـظـ */
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['╪▒┘é┘à', '╪د╪│┘à ╪د┘┘à╪┤╪▒┘ê╪╣', '╪د┘┘┘ê╪╣', '╪د┘╪ش┘ç╪ر', '╪د┘╪ص╪د┘╪ر', '╪د┘╪ح┘╪ش╪د╪▓', '╪د┘┘é┘è┘à╪ر', '╪د┘┘à┘ç┘╪»╪│', '╪د┘╪ز╪│┘┘è┘à', ''].map(h => (
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
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#1a56db' }}>{p.code || 'ظ¤'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{TYPE_NAME[p.type || ''] || p.type || 'ظ¤'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#1a56db', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(p as any).client_name || (p as any).client || 'ظ¤'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${getStatusColor(p)}`} style={{ fontSize: '0.7rem', ...(getStatusColor(p) === 'badge-closing' ? { background: '#f5f3ff', color: '#6d28d9' } : {}) }}>{isLate ? '┘à╪ز╪ث╪«╪▒' : p.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '110px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.progress}%`, background: p.progress >= 100 ? '#0ea77b' : isLate ? '#c81e1e' : '#1a56db', borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#e6820a', whiteSpace: 'nowrap' }}>{(p as any).estimated_value ? formatCurrency((p as any).estimated_value) : 'ظ¤'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{p.engineer || 'ظ¤'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: isLate ? '#c81e1e' : 'var(--text3)', whiteSpace: 'nowrap' }}>{formatDate(p.end_date) || 'ظ¤'}</td>
                    <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <button onClick={() => setDetail(p)}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          ╪ز┘╪د╪╡┘è┘
                        </button>
                        <QuickAddButton project={p} onNote={() => setNoteProject(p)} onQhse={(type) => setQhseModal({ type: type as QhseVisitType, projectId: p.id })} onTask={() => setTaskProject(p)} />
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

      {/* ظـظـ ┘à┘ê╪»╪د┘ QHSE ╪د┘╪│╪▒┘è╪╣ ظـظـ */}
      {qhseModal && (
        <QuickQhseModal
          type={qhseModal.type}
          projectId={qhseModal.projectId}
          onClose={() => setQhseModal(null)}
          onSave={() => setQhseModal(null)}
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

    </div>
  )
}
