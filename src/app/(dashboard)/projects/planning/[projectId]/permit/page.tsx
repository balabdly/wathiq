'use client'
import { useState, useEffect } from 'react'
import { Save, Upload, Paperclip, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { isDateRangeInvalid, formatDate } from '@/lib/utils'
import { useProjectPlanning } from '../ProjectPlanningContext'
import { updateProjectPlanning, uploadPlanningFile } from '@/lib/project-planning-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

function FileField({ label, fileName, onUpload }: {
  label: string; fileName?: string | null
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
  const { tenantId, projectId, planning, project, reload } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    permit_number: planning?.permit_number || '',
    permit_start: planning?.permit_start || '',
    permit_end: planning?.permit_end || '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const projectStart = project.start_date || ''
  const permitBeforeProject = !!(projectStart && form.permit_start && form.permit_start < projectStart)
  const permitEndBeforeProject = !!(projectStart && form.permit_end && form.permit_end < projectStart)
  const permitRangeInvalid = isDateRangeInvalid(form.permit_start, form.permit_end)
  const datesInvalid = permitBeforeProject || permitEndBeforeProject || permitRangeInvalid

  function setPermitStart(v: string) {
    if (projectStart && v && v < projectStart) {
      toast.error('تاريخ بداية التصريح لا يمكن أن يسبق تاريخ بدء المشروع')
      return
    }
    setForm(f => {
      const next = { ...f, permit_start: v }
      if (v && f.permit_end && v > f.permit_end) next.permit_end = ''
      return next
    })
  }

  function setPermitEnd(v: string) {
    const min = form.permit_start || projectStart
    if (min && v && v < min) {
      toast.error(form.permit_start
        ? 'تاريخ نهاية التصريح يجب أن يكون بعد تاريخ بدايته'
        : 'تاريخ نهاية التصريح لا يمكن أن يسبق تاريخ بدء المشروع')
      return
    }
    set('permit_end', v)
  }

  function validateDates(): boolean {
    if (permitBeforeProject) {
      toast.error('تاريخ بداية التصريح لا يمكن أن يسبق تاريخ بدء المشروع')
      return false
    }
    if (permitEndBeforeProject) {
      toast.error('تاريخ نهاية التصريح لا يمكن أن يسبق تاريخ بدء المشروع')
      return false
    }
    if (permitRangeInvalid) {
      toast.error('تاريخ بداية التصريح يجب أن يكون قبل تاريخ نهايته')
      return false
    }
    return true
  }

  useEffect(() => {
    if (!planning) return
    setForm({
      permit_number: planning.permit_number || '',
      permit_start: planning.permit_start || '',
      permit_end: planning.permit_end || '',
    })
  }, [planning?.id, planning?.updated_at])

  async function save(extra?: Record<string, string | null>) {
    if (!validateDates()) return
    setSaving(true)
    try {
      await updateProjectPlanning(tenantId, projectId, {
        permit_number: form.permit_number || null,
        permit_start: form.permit_start || null,
        permit_end: form.permit_end || null,
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
      <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '14px' }}>
        إتمام الأعمال وإخلاء الطرف يُسجّلان في مرحلة الإغلاق بعد انتهاء التنفيذ.
        {projectStart && (
          <span style={{ display: 'block', marginTop: '4px' }}>
            تاريخ بدء المشروع: <strong>{formatDate(projectStart)}</strong> — لا يُقبل تصريح يسبق هذا التاريخ.
          </span>
        )}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div>
          <label style={lbl}>رقم التصريح</label>
          <input value={form.permit_number} onChange={e => set('permit_number', e.target.value)} className="input" dir="ltr" />
        </div>
        <div>
          <label style={lbl}>تاريخ البداية</label>
          <input
            type="date"
            value={form.permit_start}
            min={projectStart || undefined}
            max={form.permit_end || undefined}
            onChange={e => setPermitStart(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label style={lbl}>تاريخ النهاية</label>
          <input
            type="date"
            value={form.permit_end}
            min={form.permit_start || projectStart || undefined}
            onChange={e => setPermitEnd(e.target.value)}
            className="input"
          />
        </div>
      </div>
      {datesInvalid && (
        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#c81e1e', fontWeight: 600 }}>
          {permitBeforeProject || permitEndBeforeProject
            ? 'تواريخ التصريح لا يمكن أن تسبق تاريخ بدء المشروع'
            : 'تاريخ بداية التصريح يجب أن يكون قبل تاريخ نهايته'}
        </p>
      )}
      <div style={{ marginTop: '12px' }}>
        <FileField label="مرفق التصريح" fileName={planning?.permit_file_name}
          onUpload={f => upload('permit', 'permit_file_path', 'permit_file_name', f)} />
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => save()} disabled={saving || datesInvalid} className="btn btn-primary">
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  )
}
