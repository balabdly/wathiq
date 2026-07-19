'use client'
import { useState, useEffect } from 'react'
import { Save, Upload, Paperclip, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectPlanning } from '../ProjectPlanningContext'
import { updateProjectPlanning, uploadPlanningFile } from '@/lib/project-planning-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

function Divider() {
  return <hr style={{ border: 'none', borderTop: '2px solid #e5e7eb', margin: '20px 0' }} />
}

function FileField({ label, fileName, filePath, onUpload }: {
  label: string; fileName?: string | null; filePath?: string | null
  onUpload: (file: File) => Promise<void>
}) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="btn btn-ghost" style={{ cursor: 'pointer', margin: 0, fontSize: '0.82rem' }}>
          <Upload style={{ width: '14px', height: '14px' }} /> رفع مرفق
          <input type="file" accept=".pdf,image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }} />
        </label>
        {fileName && (
          <span style={{ fontSize: '0.78rem', color: '#1a56db', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Paperclip style={{ width: '13px', height: '13px' }} /> {fileName}
          </span>
        )}
      </div>
    </div>
  )
}

export default function PermitTabPage() {
  const { tenantId, projectId, planning, reload } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    permit_number: planning?.permit_number || '',
    permit_start: planning?.permit_start || '',
    permit_end: planning?.permit_end || '',
    work_completion_number: planning?.work_completion_number || '',
    clearance_number: planning?.clearance_number || '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!planning) return
    setForm({
      permit_number: planning.permit_number || '',
      permit_start: planning.permit_start || '',
      permit_end: planning.permit_end || '',
      work_completion_number: planning.work_completion_number || '',
      clearance_number: planning.clearance_number || '',
    })
  }, [planning?.id, planning?.updated_at])

  async function save(extra?: Record<string, string | null>) {
    setSaving(true)
    try {
      await updateProjectPlanning(tenantId, projectId, {
        permit_number: form.permit_number || null,
        permit_start: form.permit_start || null,
        permit_end: form.permit_end || null,
        work_completion_number: form.work_completion_number || null,
        clearance_number: form.clearance_number || null,
        ...extra,
      })
      await reload()
      toast.success('تم الحفظ ✅')
    } catch (e: any) {
      toast.error(e.message)
    }
    setSaving(false)
  }

  async function upload(prefix: string, fieldPath: string, fieldName: string, file: File) {
    const { path, name } = await uploadPlanningFile(tenantId, projectId, file, prefix)
    await save({ [fieldPath]: path, [fieldName]: name })
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileText style={{ width: '17px', height: '17px', color: '#1a56db' }} /> تصريح البلدية
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div>
          <label style={lbl}>رقم التصريح</label>
          <input value={form.permit_number} onChange={e => set('permit_number', e.target.value)} className="input" dir="ltr" />
        </div>
        <div>
          <label style={lbl}>تاريخ البداية</label>
          <input type="date" value={form.permit_start} onChange={e => set('permit_start', e.target.value)} className="input" />
        </div>
        <div>
          <label style={lbl}>تاريخ النهاية</label>
          <input type="date" value={form.permit_end} onChange={e => set('permit_end', e.target.value)} className="input" />
        </div>
      </div>
      <div style={{ marginTop: '12px' }}>
        <FileField label="مرفق التصريح" fileName={planning?.permit_file_name} filePath={planning?.permit_file_path}
          onUpload={f => upload('permit', 'permit_file_path', 'permit_file_name', f)} />
      </div>

      <Divider />

      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>اتمام الاعمال</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
        <div>
          <label style={lbl}>رقم اتمام الاعمال</label>
          <input value={form.work_completion_number} onChange={e => set('work_completion_number', e.target.value)} className="input" dir="ltr" />
        </div>
        <FileField label="مرفقات اتمام الاعمال" fileName={planning?.work_completion_file_name} filePath={planning?.work_completion_file_path}
          onUpload={f => upload('completion', 'work_completion_file_path', 'work_completion_file_name', f)} />
      </div>

      <Divider />

      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>اخلاء الطرف</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
        <div>
          <label style={lbl}>رقم اخلاء الطرف</label>
          <input value={form.clearance_number} onChange={e => set('clearance_number', e.target.value)} className="input" dir="ltr" />
        </div>
        <FileField label="مرفقات اخلاء الطرف" fileName={planning?.clearance_file_name} filePath={planning?.clearance_file_path}
          onUpload={f => upload('clearance', 'clearance_file_path', 'clearance_file_name', f)} />
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => save()} disabled={saving} className="btn btn-primary">
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  )
}
