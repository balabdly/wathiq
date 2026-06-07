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

// ── المستندات الإلزامية للإغلاق ──
const REQUIRED_DOC_CATEGORIES = ['مخططات', 'رخصة بلدية', 'إخلاء بلدية', 'مستخلصات', 'فواتير']

// ── الجهات المنفذة ──
const CLIENTS = [
  'شركة السعودية للكهرباء',
  'أرامكو السعودية',
  'وزارة الإسكان',
  'أمانة منطقة الرياض',
  'وزارة الصحة',
  'وزارة التعليم',
  'وزارة النقل',
  'الهيئة الملكية للجبيل',
  'شركة معادن',
  'سابك',
  'القطاع الخاص',
  'أخرى',
]

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
// مودال إدارة الجهات
// ══════════════════════════════════════
function ClientManagerModal({ tenantId, customClients, onClose, onSave }: {
  tenantId: string
  customClients: string[]
  onClose: () => void
  onSave: (clients: string[]) => void
}) {
  const [clients, setClients] = useState<string[]>(customClients)
  const [newName, setNewName] = useState('')
  const [saving,  setSaving]  = useState(false)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) { toast.error('أدخل اسم الجهة'); return }
    if (clients.includes(name)) { toast.error('الجهة موجودة مسبقاً'); return }
    const { error } = await supabase.from('project_custom_clients').insert({ tenant_id: tenantId, name })
    if (error) { toast.error('خطأ: ' + error.message); return }
    const updated = [...clients, name]
    setClients(updated)
    setNewName('')
    toast.success('✅ تمت الإضافة')
  }

  async function handleDelete(name: string) {
    if (!confirm(`حذف جهة "${name}"؟`)) return
    await supabase.from('project_custom_clients').delete().eq('tenant_id', tenantId).eq('name', name)
    setClients(c => c.filter(x => x !== name))
    toast.success('تم الحذف')
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>🏢 إدارة الجهات</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* الجهات الافتراضية */}
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '8px', fontWeight: 600 }}>الجهات الافتراضية (غير قابلة للحذف)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CLIENTS.map(c => (
                <span key={c} style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: '20px', padding: '3px 12px', fontSize: '0.78rem' }}>{c}</span>
              ))}
            </div>
          </div>

          {/* الجهات المخصصة */}
          {clients.length > 0 && (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '8px', fontWeight: 600 }}>الجهات المضافة</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {clients.map(c => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1a56db' }}>{c}</span>
                    <button onClick={() => handleDelete(c)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '2px' }}>
                      <X style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* إضافة جديدة */}
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '6px', fontWeight: 600 }}>إضافة جهة جديدة</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="input"
                placeholder="اسم الجهة..."
                style={{ flex: 1 }}
              />
              <button onClick={handleAdd} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                <Plus style={{ width: '15px', height: '15px' }} /> إضافة
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={() => onSave(clients)} className="btn btn-primary">حفظ وإغلاق</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// مودال إدارة الحالات
// ══════════════════════════════════════
const DEFAULT_STATUS_OPTIONS = [
  { icon: '📋', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { icon: '🔄', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe' },
  { icon: '⚠️', color: '#c81e1e', bg: '#fef2f2', border: '#fca5a5' },
  { icon: '✅', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac' },
  { icon: '🚫', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d' },
  { icon: '⏸️', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { icon: '🎯', color: '#0891b2', bg: '#f0f9ff', border: '#bae6fd' },
]

function StatusManagerModal({ tenantId, columns, onClose, onSave }: {
  tenantId: string
  columns: typeof COLUMNS
  onClose: () => void
  onSave: (cols: typeof COLUMNS) => void
}) {
  const [cols,    setCols]    = useState([...columns])
  const [newLabel,setNewLabel]= useState('')
  const [newIcon, setNewIcon] = useState('📋')
  const [newColor,setNewColor]= useState('#6b7280')
  const [saving,  setSaving]  = useState(false)

  async function handleSaveAll() {
    setSaving(true)
    // حذف القديم وإدخال الجديد
    await supabase.from('project_custom_statuses').delete().eq('tenant_id', tenantId)
    if (cols.length > 0) {
      await supabase.from('project_custom_statuses').insert(
        cols.map((c, i) => ({
          tenant_id:  tenantId,
          id_key:     c.id,
          label:      c.label,
          icon:       c.icon,
          color:      c.color,
          bg:         c.bg,
          border:     c.border,
          sort_order: i,
        }))
      )
    }
    toast.success('✅ تم حفظ الحالات')
    setSaving(false)
    onSave(cols)
  }

  function handleRename(idx: number, newLabel: string) {
    setCols(prev => prev.map((c, i) => i === idx ? { ...c, label: newLabel, id: newLabel } : c))
  }

  function handleDelete(idx: number) {
    if (cols.length <= 2) { toast.error('يجب أن تبقى حالتان على الأقل'); return }
    setCols(prev => prev.filter((_, i) => i !== idx))
  }

  function handleAdd() {
    const label = newLabel.trim()
    if (!label) { toast.error('أدخل اسم الحالة'); return }
    if (cols.find(c => c.label === label)) { toast.error('الحالة موجودة'); return }
    // اختيار bg وborder تلقائياً من اللون
    setCols(prev => [...prev, {
      id:     label,
      label:  label,
      icon:   newIcon,
      color:  newColor,
      bg:     newColor + '18',
      border: newColor + '60',
    }])
    setNewLabel('')
    toast.success('تمت الإضافة')
  }

  const COLOR_OPTIONS = ['#6b7280','#1a56db','#c81e1e','#0ea77b','#e6820a','#7c3aed','#0891b2','#be185d']

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>🎛️ إدارة حالات المشاريع</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* الحالات الحالية */}
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '8px', fontWeight: 600 }}>الحالات الحالية — اضغط على الاسم لتعديله</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {cols.map((col, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: col.bg, borderRadius: '8px', border: `1px solid ${col.border}` }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{col.icon}</span>
                  <input
                    value={col.label}
                    onChange={e => handleRename(idx, e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontWeight: 700, fontSize: '0.875rem', color: col.color, cursor: 'text' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>اسحب لإعادة الترتيب</span>
                  <button onClick={() => handleDelete(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '2px', flexShrink: 0 }}>
                    <X style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* إضافة حالة جديدة */}
          <div style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '10px', fontWeight: 600 }}>إضافة حالة جديدة</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {DEFAULT_STATUS_OPTIONS.map(o => (
                <button key={o.icon} type="button" onClick={() => setNewIcon(o.icon)}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: `2px solid ${newIcon === o.icon ? o.color : 'var(--border)'}`, background: newIcon === o.icon ? o.bg : 'white', cursor: 'pointer', fontSize: '1rem' }}>
                  {o.icon}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map(c => (
                <button key={c} type="button" onClick={() => setNewColor(c)}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: newColor === c ? '3px solid #1a1a2e' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="input" placeholder="اسم الحالة..."
                style={{ flex: 1 }}
              />
              <button onClick={handleAdd} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                <Plus style={{ width: '15px', height: '15px' }} /> إضافة
              </button>
            </div>
          </div>

        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSaveAll} disabled={saving} className="btn btn-primary">
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : null}
            حفظ الحالات
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// مودال إضافة ملاحظة
// ══════════════════════════════════════
function NoteModal({ project, onClose, onSave }: {
  project: Project
  onClose: () => void
  onSave: (note: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    await onSave(text.trim())
    setSaving(false)
    onClose()
  }

  // آخر 5 ملاحظات من السجل
  const notes = (project.history || [])
    .filter(h => h.includes('📝'))
    .slice(-5)
    .reverse()

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 60 }}
    >
      <div
        className="modal-box"
        style={{ maxWidth: '480px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StickyNote style={{ width: '18px', height: '18px', color: '#e6820a' }} />
              إضافة ملاحظة
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
              {project.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ paddingBottom: '12px' }}>
            {/* حقل الملاحظة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                الملاحظة
              </label>
              <textarea
                ref={textRef}
                value={text}
                onChange={e => setText(e.target.value)}
                className="input"
                style={{ minHeight: '100px', resize: 'vertical', lineHeight: 1.6 }}
                placeholder="اكتب ملاحظتك هنا..."
                maxLength={500}
                required
              />
              <div style={{ textAlign: 'left', fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>
                {text.length}/500
              </div>
            </div>

            {/* آخر الملاحظات */}
            {notes.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <StickyNote style={{ width: '12px', height: '12px' }} />
                  آخر الملاحظات
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {notes.map((note, i) => {
                    // استخراج التاريخ والنص من السجل
                    // الصيغة: "DD/MM/YYYY، HH:MM: 📝 النص"
                    const match = note.match(/^(.+?):\s*📝\s*(.+)$/)
                    const dateStr = match ? match[1] : ''
                    const noteText = match ? match[2] : note.replace('📝', '').trim()
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '8px 12px',
                          background: '#fffbeb',
                          borderRadius: '8px',
                          border: '1px solid #fcd34d',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ color: '#1a1a2e', lineHeight: 1.5 }}>{noteText}</div>
                        {dateStr && (
                          <div style={{ color: '#9ca3af', fontSize: '0.7rem', marginTop: '4px', direction: 'ltr', textAlign: 'right' }}>
                            {dateStr}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button
              type="submit"
              disabled={saving || !text.trim()}
              className="btn"
              style={{ background: '#e6820a', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send style={{ width: '14px', height: '14px' }} />
              }
              حفظ الملاحظة
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// زر أيقونة الملاحظة
// ══════════════════════════════════════
function NoteButton({ project, onNote }: { project: Project; onNote: () => void }) {
  const noteCount = (project.history || []).filter(h => h.includes('📝')).length
  return (
    <button
      onClick={e => { e.stopPropagation(); onNote() }}
      title="إضافة ملاحظة"
      style={{
        padding: '5px 7px',
        borderRadius: '6px',
        border: noteCount > 0 ? '1px solid #fcd34d' : '1px solid #e5e7eb',
        background: noteCount > 0 ? '#fffbeb' : 'white',
        cursor: 'pointer',
        color: noteCount > 0 ? '#e6820a' : '#9ca3af',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        transition: 'all 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = '#fffbeb'
        el.style.borderColor = '#fcd34d'
        el.style.color = '#e6820a'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = noteCount > 0 ? '#fffbeb' : 'white'
        el.style.borderColor = noteCount > 0 ? '#fcd34d' : '#e5e7eb'
        el.style.color = noteCount > 0 ? '#e6820a' : '#9ca3af'
      }}
    >
      <MessageSquarePlus style={{ width: '13px', height: '13px' }} />
      {noteCount > 0 && (
        <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>{noteCount}</span>
      )}
    </button>
  )
}

// ══════════════════════════════════════
// بطاقة الـ Kanban
// ══════════════════════════════════════
function KanbanCard({ p, canEdit, onView, onEdit, onDelete, onMove, onNote }: {
  p: Project; canEdit: boolean
  onView: () => void; onEdit: () => void; onDelete: () => void
  onMove: (direction: 'prev' | 'next') => void
  onNote: () => void
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
          {/* الجهة المنفذة */}
          {(p as any).client && (
            <div style={{ fontSize: '0.7rem', color: '#1a56db', marginTop: '3px', fontWeight: 600 }}>
              🏢 {(p as any).client}
            </div>
          )}
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

        {/* ملاحظة */}
        <NoteButton project={p} onNote={onNote} />

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
  const [clientFilter, setClient]     = useState('')
  const savedView = (tenant as any)?.display_settings?.projectsView || 'kanban'
  const [viewMode, setViewMode] = useState<'kanban' | 'grid' | 'list'>(savedView as any)
  const [noteProject, setNoteProject] = useState<Project | null>(null)

  useEffect(() => {
    const v = (tenant as any)?.display_settings?.projectsView
    if (v) setViewMode(v as any)
  }, [(tenant as any)?.display_settings?.projectsView])

  const [showModal,       setShowModal]       = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [editProject,     setEditProject]     = useState<Project | null>(null)
  const [detailProject,   setDetail]          = useState<Project | null>(null)
  const [customClients,   setCustomClients]   = useState<string[]>([])
  const [customColumns,   setCustomColumns]   = useState<typeof COLUMNS>([...COLUMNS])

  const canEdit = currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit')

  useEffect(() => { loadProjects() }, [tenant?.id, activeBranch?.id])

  async function loadProjects() {
    if (!tenant || !activeBranch) return
    if (projects.length === 0) setLoading(true)

    // جلب الجهات المخصصة
    const { data: clientsData } = await supabase
      .from('project_custom_clients')
      .select('name')
      .eq('tenant_id', tenant.id)
      .order('name')
    if (clientsData) setCustomClients(clientsData.map((c: any) => c.name))

    // جلب الحالات المخصصة
    const { data: statusData } = await supabase
      .from('project_custom_statuses')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('sort_order')
    if (statusData && statusData.length > 0) {
      setCustomColumns(statusData.map((s: any) => ({
        id: s.id_key, label: s.label, icon: s.icon,
        color: s.color, bg: s.bg, border: s.border
      })))
    }

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

  // ── حفظ الملاحظة في السجل ──
  async function handleSaveNote(project: Project, noteText: string) {
    if (!tenant) return
    const now = new Date()
    const dateStr = now.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false })
    const entry = `${dateStr}، ${timeStr}: 📝 ${noteText}`
    const history = [...(project.history || []), entry]
    const { error } = await supabase
      .from('projects')
      .update({ history })
      .eq('id', project.id)
    if (error) { toast.error('خطأ في حفظ الملاحظة'); return }
    // تحديث محلي فوري
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

  // قائمة الجهات الموجودة فعلاً في المشاريع
  const allClients = Array.from(new Set([...CLIENTS, ...customClients])) as string[]
  const existingClients = Array.from(
    new Set(projects.map(p => (p as any).client).filter(Boolean))
  ) as string[]

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return (
      (!q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)) &&
      (!statusFilter || p.status === statusFilter) &&
      (!typeFilter   || p.type   === typeFilter)  &&
      (!clientFilter || (p as any).client === clientFilter)
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowClientModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: '2px solid var(--primary)', background: 'white', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <Plus style={{ width: '15px', height: '15px' }} /> إضافة جهة
            </button>
            <button onClick={() => setShowStatusModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: '2px solid #7c3aed', background: 'white', color: '#7c3aed', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <Plus style={{ width: '15px', height: '15px' }} /> إضافة حالة
            </button>
            <button onClick={() => { setEditProject(null); setShowModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> مشروع جديد
            </button>
          </div>
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
        {/* البحث */}
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input" style={{ paddingRight: '32px', fontSize: '0.875rem' }}
            placeholder="بحث بالاسم أو الرقم..." />
        </div>

        {/* فلتر الحالة */}
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="select" style={{ width: 'auto' }}>
          <option value="">كل الحالات</option>
          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>

        {/* فلتر النوع */}
        <select value={typeFilter} onChange={e => setType(e.target.value)} className="select" style={{ width: 'auto' }}>
          <option value="">كل الأنواع</option>
          {['801','802','441','442','805','405','O&M'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* ── فلتر الجهة المنفذة ── */}
        <select
          value={clientFilter}
          onChange={e => setClient(e.target.value)}
          className="select"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="">كل الجهات</option>
          {/* الجهات الموجودة في المشاريع أولاً */}
          {existingClients.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
          {/* الجهات الإضافية غير المستخدمة */}
          {CLIENTS.filter(c => !existingClients.includes(c)).map(c => (
            <option key={c} value={c} style={{ color: '#9ca3af' }}>{c}</option>
          ))}
        </select>

        {/* مسح الفلاتر */}
        {(search || statusFilter || typeFilter || clientFilter) && (
          <button onClick={() => { setSearch(''); setStatus(''); setType(''); setClient('') }}
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
                        onNote={() => setNoteProject(p)}
                      />
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
                    {(p as any).client && (
                      <div style={{ fontSize: '0.72rem', color: '#1a56db', marginTop: '3px', fontWeight: 600 }}>
                        🏢 {(p as any).client}
                      </div>
                    )}
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
                  {/* ملاحظة */}
                  <NoteButton project={p} onNote={() => setNoteProject(p)} />
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
                  {['المشروع','الجهة','النوع','المهندس','الحالة','الإنجاز','التسليم','القيمة',''].map(h => (
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
                      {/* ── عمود الجهة في list ── */}
                      <td style={{ padding: '12px 14px', color: '#1a56db', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {(p as any).client ? `🏢 ${(p as any).client}` : <span style={{ color: '#d1d5db' }}>—</span>}
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
                          {/* ملاحظة */}
                          <NoteButton project={p} onNote={() => setNoteProject(p)} />
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

      {/* مودال المشروع */}
      {/* مودال إضافة جهة */}
      {showClientModal && (
        <ClientManagerModal
          tenantId={tenant!.id}
          customClients={customClients}
          onClose={() => setShowClientModal(false)}
          onSave={(clients) => { setCustomClients(clients); setShowClientModal(false) }}
        />
      )}

      {/* مودال إدارة الحالات */}
      {showStatusModal && (
        <StatusManagerModal
          tenantId={tenant!.id}
          columns={customColumns}
          onClose={() => setShowStatusModal(false)}
          onSave={(cols) => { setCustomColumns(cols); setShowStatusModal(false) }}
        />
      )}

      {showModal && (
        <ProjectModal project={editProject}
          onClose={() => { setShowModal(false); setEditProject(null) }}
          onSave={handleSave} />
      )}

      {/* ── مودال الملاحظة ── */}
      {noteProject && (
        <NoteModal
          project={projects.find(p => p.id === noteProject.id) || noteProject}
          onClose={() => setNoteProject(null)}
          onSave={(text) => handleSaveNote(noteProject, text)}
        />
      )}
    </div>
  )
}
