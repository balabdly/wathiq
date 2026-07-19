'use client'
import { useState, useEffect } from 'react'
import { Save, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectPlanning } from '../ProjectPlanningContext'
import { updateProjectPlanning } from '@/lib/project-planning-service'
import { formatDate } from '@/lib/utils'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

export default function TimelineTabPage() {
  const { tenantId, projectId, project, planning, reload } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    timeline_start: planning?.timeline_start || project.start_date || '',
    timeline_end: planning?.timeline_end || project.end_date || '',
    timeline_revised_end: planning?.timeline_revised_end || '',
    timeline_revision_reason: planning?.timeline_revision_reason || '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    setForm({
      timeline_start: planning?.timeline_start || project.start_date || '',
      timeline_end: planning?.timeline_end || project.end_date || '',
      timeline_revised_end: planning?.timeline_revised_end || '',
      timeline_revision_reason: planning?.timeline_revision_reason || '',
    })
  }, [planning?.id, planning?.updated_at, project.start_date, project.end_date])

  const effectiveEnd = form.timeline_revised_end || form.timeline_end

  async function handleSave() {
    setSaving(true)
    try {
      await updateProjectPlanning(tenantId, projectId, {
        timeline_start: form.timeline_start || null,
        timeline_end: form.timeline_end || null,
        timeline_revised_end: form.timeline_revised_end || null,
        timeline_revision_reason: form.timeline_revision_reason || null,
      })
      await reload()
      toast.success('تم تحديث الخطة الزمنية ✅')
    } catch (e: any) {
      toast.error(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar style={{ width: '17px', height: '17px', color: '#7c3aed' }} /> الخطة الزمنية
      </h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '16px' }}>
        التواريخ مأخوذة من مرحلة بدء المشروع — يمكن تعديلها عند تأخر إصدار التصريح
      </p>

      <div style={{ background: '#f5f3ff', borderRadius: '10px', padding: '14px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.82rem' }}>
        <div><span style={{ color: 'var(--text3)' }}>بداية المشروع:</span> <strong>{project.start_date ? formatDate(project.start_date) : '—'}</strong></div>
        <div><span style={{ color: 'var(--text3)' }}>نهاية متوقعة:</span> <strong>{project.end_date ? formatDate(project.end_date) : '—'}</strong></div>
        <div><span style={{ color: 'var(--text3)' }}>النهاية الفعلية:</span> <strong style={{ color: '#7c3aed' }}>{effectiveEnd ? formatDate(effectiveEnd) : '—'}</strong></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div>
          <label style={lbl}>تاريخ البداية (الخطة)</label>
          <input type="date" value={form.timeline_start} onChange={e => set('timeline_start', e.target.value)} className="input" />
        </div>
        <div>
          <label style={lbl}>تاريخ النهاية المتوقع</label>
          <input type="date" value={form.timeline_end} onChange={e => set('timeline_end', e.target.value)} className="input" />
        </div>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400e', marginBottom: '10px' }}>تعديل بسبب تأخير (مثل التصريح)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
          <div>
            <label style={lbl}>تاريخ النهاية المعدّل</label>
            <input type="date" value={form.timeline_revised_end} onChange={e => set('timeline_revised_end', e.target.value)} className="input" />
          </div>
          <div>
            <label style={lbl}>سبب التعديل</label>
            <input value={form.timeline_revision_reason} onChange={e => set('timeline_revision_reason', e.target.value)} className="input" placeholder="مثال: تأخر إصدار تصريح البلدية" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ الخطة'}
        </button>
      </div>
    </div>
  )
}
