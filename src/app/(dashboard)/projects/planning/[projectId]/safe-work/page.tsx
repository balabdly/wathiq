'use client'
import { useState } from 'react'
import { Save, Upload, Paperclip, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectPlanning } from '../ProjectPlanningContext'
import { updateProjectPlanning, uploadPlanningFile } from '@/lib/project-planning-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

export default function SafeWorkTabPage() {
  const { tenantId, projectId, planning, reload } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [content, setContent] = useState(planning?.safe_work_content || '')

  async function handleSave(file?: File) {
    setSaving(true)
    try {
      const payload: Record<string, string | null> = { safe_work_content: content || null }
      if (file) {
        const { path, name } = await uploadPlanningFile(tenantId, projectId, file, 'safe_work')
        payload.safe_work_file_path = path
        payload.safe_work_file_name = name
      }
      await updateProjectPlanning(tenantId, projectId, payload)
      await reload()
      toast.success('تم الحفظ ✅')
    } catch (e: any) {
      toast.error(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Shield style={{ width: '17px', height: '17px', color: '#e6820a' }} /> إجراءات العمل الآمنة
      </h3>
      <div style={{ marginBottom: '14px' }}>
        <label style={lbl}>محتوى الإجراءات</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} className="input" rows={8} placeholder="إجراءات السلامة، تعليمات PPE، مخاطر الموقع..." />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={lbl}>مرفق الإجراءات</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label className="btn btn-ghost" style={{ cursor: 'pointer', margin: 0 }}>
            <Upload style={{ width: '14px', height: '14px' }} /> رفع PDF / صورة
            <input type="file" accept=".pdf,image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleSave(f) }} />
          </label>
          {planning?.safe_work_file_name && (
            <span style={{ fontSize: '0.78rem', color: '#1a56db', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Paperclip style={{ width: '13px', height: '13px' }} /> {planning.safe_work_file_name}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => handleSave()} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  )
}
