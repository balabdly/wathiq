'use client'
import { useEffect, useState } from 'react'
import { Save, Upload, Paperclip, Shield, Plus, Trash2, ListChecks, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useProjectPlanning } from '../ProjectPlanningContext'
import { updateProjectPlanning, uploadPlanningFile } from '@/lib/project-planning-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

type SafeWorkTemplate = {
  id: number
  proc_no?: string
  title: string
  work_type?: string
  steps?: { step: number; text: string }[]
  approved_by?: string
}

type StepRow = { step: number; text: string }

function normalizeSteps(raw: unknown): StepRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((s: any, i) => ({
      step: Number(s?.step) || i + 1,
      text: String(s?.text || s || '').trim(),
    }))
    .filter(s => s.text)
}

export default function SafeWorkTabPage() {
  const { tenantId, projectId, planning, reload } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<SafeWorkTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [steps, setSteps] = useState<StepRow[]>([])

  useEffect(() => {
    supabase.from('qhse_safe_work_procedures')
      .select('id, proc_no, title, work_type, steps, approved_by')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('title')
      .then(({ data }) => setTemplates(data || []))
  }, [tenantId])

  useEffect(() => {
    const loaded = normalizeSteps(planning?.safe_work_steps)
    setSteps(loaded.length ? loaded : [{ step: 1, text: '' }])
    setSelectedTemplateId(planning?.safe_work_template_id ? String(planning.safe_work_template_id) : '')
  }, [planning?.id, planning?.updated_at, planning?.safe_work_steps, planning?.safe_work_template_id])

  function renumber(list: StepRow[]) {
    return list.map((s, i) => ({ ...s, step: i + 1 }))
  }

  function updateStep(idx: number, text: string) {
    setSteps(prev => renumber(prev.map((s, i) => i === idx ? { ...s, text } : s)))
  }

  function addStep() {
    setSteps(prev => renumber([...prev, { step: prev.length + 1, text: '' }]))
  }

  function removeStep(idx: number) {
    if (steps.length <= 1) { setSteps([{ step: 1, text: '' }]); return }
    setSteps(prev => renumber(prev.filter((_, i) => i !== idx)))
  }

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    if (!templateId) return
    const tpl = templates.find(t => t.id === Number(templateId))
    if (!tpl) return
    const tplSteps = normalizeSteps(tpl.steps)
    if (!tplSteps.length) { toast.error('هذا الإجراء لا يحتوي خطوات'); return }

    if (steps.some(s => s.text.trim()) && !confirm(`تحميل خطوات «${tpl.title}»؟ سيتم استبدال الخطوات الحالية.`)) {
      setSelectedTemplateId(planning?.safe_work_template_id ? String(planning.safe_work_template_id) : '')
      return
    }
    setSteps(renumber(tplSteps))
    toast.success(`تم تحميل ${tplSteps.length} خطوة — يمكنك التعديل أو الحذف`)
  }

  async function handleSave(file?: File) {
    const validSteps = steps.filter(s => s.text.trim())
    if (!validSteps.length && !file) {
      toast.error('أضف خطوة واحدة على الأقل أو ارفع مرفقاً')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        safe_work_template_id: selectedTemplateId ? Number(selectedTemplateId) : null,
        safe_work_steps: renumber(validSteps),
      }
      if (file) {
        const { path, name } = await uploadPlanningFile(tenantId, projectId, file, 'safe_work')
        payload.safe_work_file_path = path
        payload.safe_work_file_name = name
      }
      await updateProjectPlanning(tenantId, projectId, payload)
      await reload()
      toast.success('تم حفظ إجراءات العمل ✅')
    } catch (e: any) {
      toast.error(e.message)
    }
    setSaving(false)
  }

  const selectedTpl = templates.find(t => t.id === Number(selectedTemplateId))

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield style={{ width: '17px', height: '17px', color: '#e6820a' }} /> إجراءات العمل الآمنة
        </h3>
        <Link href="/qhse/safety" className="btn btn-ghost" style={{ fontSize: '0.78rem', color: '#6b7280' }}>
          <Settings style={{ width: '14px', height: '14px' }} /> إدارة الإجراءات المعتمدة (QHSE)
        </Link>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#92400e', lineHeight: 1.6 }}>
        اختر إجراءً معتمداً من <strong>الشركة السعودية للكهرباء</strong> (مسجّل في QHSE) — تُحمّل الخطوات تلقائياً ويمكنك إضافتها أو حذفها لهذا المشروع.
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ListChecks style={{ width: '15px', height: '15px' }} /> الإجراء المعتمد
        </label>
        {templates.length === 0 ? (
          <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.82rem', color: '#c81e1e' }}>
            لا توجد إجراءات — أضفها من{' '}
            <Link href="/qhse/safety" style={{ color: '#1a56db', fontWeight: 700 }}>QHSE ← السلامة</Link>
          </div>
        ) : (
          <>
            <select value={selectedTemplateId} onChange={e => applyTemplate(e.target.value)} className="select">
              <option value="">— اختر إجراءً معتمداً —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.proc_no ? `${t.proc_no} — ` : ''}{t.title}{t.work_type ? ` (${t.work_type})` : ''}
                </option>
              ))}
            </select>
            {selectedTpl && (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text3)' }}>
                {selectedTpl.approved_by && <span>اعتمد: {selectedTpl.approved_by} · </span>}
                {normalizeSteps(selectedTpl.steps).length} خطوة في النموذج
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ ...lbl, margin: 0 }}>خطوات الإجراء للمشروع</label>
          <button type="button" onClick={addStep} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
            <Plus style={{ width: '13px', height: '13px' }} /> خطوة
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {steps.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{
                width: '28px', height: '28px', borderRadius: '50%', background: '#e6820a', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, marginTop: '6px',
              }}>{idx + 1}</span>
              <textarea
                value={s.text}
                onChange={e => updateStep(idx, e.target.value)}
                className="input"
                rows={2}
                placeholder={`الخطوة ${idx + 1}...`}
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button type="button" onClick={() => removeStep(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '8px 4px', marginTop: '4px' }} title="حذف">
                <Trash2 style={{ width: '15px', height: '15px' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={lbl}>مرفق الإجراء (اختياري)</label>
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
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ الخطوات'}
        </button>
      </div>
    </div>
  )
}
