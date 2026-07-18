'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Save, Upload, Paperclip, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ProjectTypeRow } from './ManageProjectTypesModal'
import type { InitiationProject } from '@/app/(dashboard)/projects/initiation/InitiationContext'

const BASIC_ATTACHMENT_CATEGORIES = [
  'أمر العمل / الترسية',
  'عقد أو اتفاق',
  'مخططات أولية',
  'مراسلات العميل',
  'أخرى',
]

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px',
}

type AttachmentRow = {
  id?: number
  file_name: string
  file_path?: string
  category: string
  pendingFile?: File
}

export default function InitiationProjectModal({ project, projectTypes, tenantId, branchId, onClose, onSave }: {
  project: InitiationProject | null
  projectTypes: ProjectTypeRow[]
  tenantId: string
  branchId: number
  onClose: () => void
  onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentRow[]>([])
  const [attachCategory, setAttachCategory] = useState(BASIC_ATTACHMENT_CATEGORIES[0])
  const [form, setForm] = useState({
    code: project?.code || '',
    name: project?.name || '',
    client_name: (project as any)?.client_name || '',
    type: project?.type || '',
    estimated_value: project?.estimated_value?.toString() || '',
    start_date: (project as any)?.start_date || '',
    end_date: (project as any)?.end_date || '',
    description: (project as any)?.description || '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (project?.id) loadAttachments(project.id)
  }, [project?.id])

  async function loadAttachments(projectId: number) {
    const { data } = await supabase.from('project_attachments')
      .select('id, file_name, file_path, category')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .like('category', 'مرحلة البدء%')
      .order('created_at', { ascending: false })
    setAttachments((data || []).map(a => ({
      id: a.id,
      file_name: a.file_name,
      file_path: a.file_path,
      category: a.category.replace(/^مرحلة البدء — /, ''),
    })))
  }

  function onFilesSelected(files: FileList | null) {
    if (!files) return
    const pending = Array.from(files).map(file => ({
      file_name: file.name,
      category: attachCategory,
      pendingFile: file,
    }))
    setAttachments(a => [...pending, ...a])
  }

  function removeAttachment(idx: number) {
    setAttachments(a => a.filter((_, i) => i !== idx))
  }

  async function uploadAttachments(projectId: number, rows: AttachmentRow[]) {
    for (const row of rows) {
      if (!row.pendingFile) continue
      const filePath = `${tenantId}/${projectId}/${Date.now()}_${row.pendingFile.name}`
      const { error: upErr } = await supabase.storage
        .from('project-attachments')
        .upload(filePath, row.pendingFile)
      if (upErr) { toast.error(`فشل رفع ${row.file_name}`); continue }
      await supabase.from('project_attachments').insert({
        tenant_id: tenantId,
        project_id: projectId,
        file_name: row.file_name,
        file_path: filePath,
        file_size: row.pendingFile.size,
        file_type: row.pendingFile.type,
        category: `مرحلة البدء — ${row.category}`,
      })
    }
  }

  async function deleteRemovedAttachments(original: AttachmentRow[]) {
    for (const a of original) {
      if (!a.id) continue
      const still = attachments.find(x => x.id === a.id)
      if (!still && a.file_path) {
        await supabase.storage.from('project-attachments').remove([a.file_path])
        await supabase.from('project_attachments').delete().eq('id', a.id)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('اسم المشروع مطلوب'); return }
    if (!form.type) { toast.error('نوع المشروع مطلوب'); return }
    setSaving(true)

    const payload: Record<string, unknown> = {
      code: form.code.trim() || null,
      name: form.name.trim(),
      client_name: form.client_name.trim() || null,
      type: form.type,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      description: form.description.trim() || null,
      pmo_phase: '1_RECEIPT',
      status: 'تحت التخطيط',
      progress: 0,
      team_id: null,
      lead_id: null,
      engineer: null,
      updated_at: new Date().toISOString(),
    }

    let projectId = project?.id

    if (projectId) {
      const prev = [...attachments]
      const { error } = await supabase.from('projects').update(payload).eq('id', projectId)
      if (error) { toast.error(error.message); setSaving(false); return }
      setUploading(true)
      await deleteRemovedAttachments(prev.filter(a => a.id))
      await uploadAttachments(projectId, attachments.filter(a => a.pendingFile))
      setUploading(false)
    } else {
      const { data, error } = await supabase.from('projects').insert({
        ...payload,
        tenant_id: tenantId,
        branch_id: branchId,
      }).select('id').single()
      if (error || !data) { toast.error(error?.message || 'فشل الحفظ'); setSaving(false); return }
      projectId = data.id
      setUploading(true)
      await uploadAttachments(projectId, attachments.filter(a => a.pendingFile))
      setUploading(false)
    }

    toast.success(project ? 'تم التعديل ✅' : 'تم إضافة المشروع ✅')
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px', maxHeight: '92vh', overflow: 'auto' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, margin: 0 }}>{project ? '✏️ تعديل — مرحلة البدء' : '➕ مشروع جديد — مرحلة البدء'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#1a56db' }}>
              بيانات البدء فقط — الفريق والإنجاز والتفاصيل اللاحقة في المراحل التالية
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div>
                <label style={lbl}>رقم المشروع</label>
                <input value={form.code} onChange={e => set('code', e.target.value)} className="input" placeholder="2026-001" dir="ltr" />
              </div>
              <div>
                <label style={lbl}>اسم المشروع *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="اسم المشروع" required />
              </div>
            </div>

            <div>
              <label style={lbl}>اسم العميل</label>
              <input value={form.client_name} onChange={e => set('client_name', e.target.value)} className="input"
                placeholder="الشركة السعودية للكهرباء — أو اسم عميل خارجي" />
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text3)' }}>
                للمشاريع خارج SEC — اكتب اسم العميل الجديد
              </p>
            </div>

            <div>
              <label style={lbl}>نوع المشروع *</label>
              {projectTypes.length === 0 ? (
                <div style={{ padding: '10px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e' }}>
                  لا توجد أنواع — استخدم «تحديد أنواع المشاريع» أولاً
                </div>
              ) : (
                <select value={form.type} onChange={e => set('type', e.target.value)} className="select" required>
                  <option value="">— اختر النوع —</option>
                  {projectTypes.map(t => (
                    <option key={t.id} value={t.code || t.name}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={lbl}>القيمة التقديرية (ريال)</label>
              <input type="number" min="0" step="0.01" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)} className="input" dir="ltr" placeholder="0.00" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>تاريخ البداية</label>
                <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" />
              </div>
              <div>
                <label style={lbl}>تاريخ النهاية</label>
                <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="input" />
              </div>
            </div>

            <div>
              <label style={lbl}>وصف المشروع</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" rows={3} placeholder="ملخص نطاق العمل..." />
            </div>

            <div>
              <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Paperclip style={{ width: '15px', height: '15px' }} /> المرفقات الأساسية
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <select value={attachCategory} onChange={e => setAttachCategory(e.target.value)} className="select" style={{ flex: 1, minWidth: '160px' }}>
                  {BASIC_ATTACHMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <label className="btn btn-ghost" style={{ cursor: 'pointer', margin: 0 }}>
                  <Upload style={{ width: '14px', height: '14px' }} /> رفع ملف
                  <input type="file" multiple hidden onChange={e => onFilesSelected(e.target.files)} />
                </label>
              </div>
              {attachments.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', background: '#f9fafb', borderRadius: '8px', fontSize: '0.82rem' }}>
                  لا مرفقات — أمر عمل، عقد، مخططات...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {attachments.map((a, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.82rem' }}>
                      <Paperclip style={{ width: '14px', height: '14px', color: '#1a56db', flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{a.category}</span>
                      {a.pendingFile && <span style={{ fontSize: '0.65rem', color: '#e6820a' }}>جديد</span>}
                      <button type="button" onClick={() => removeAttachment(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving || uploading} className="btn btn-primary">
              <Save style={{ width: '14px', height: '14px' }} />
              {saving || uploading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
