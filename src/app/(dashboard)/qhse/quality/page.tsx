'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  Plus, X, Save, Search, CheckCircle2, AlertTriangle,
  ClipboardCheck, RefreshCw, Award, FileSearch
} from 'lucide-react'
import QualityInspectionModal from './QualityInspectionModal'
import QualityObservationModal from './QualityObservationModal'
import toast from 'react-hot-toast'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Audit = {
  id: number; audit_no: string; audit_type: string; standard?: string
  audit_date: string; auditor_name: string; scope?: string
  department?: string; overall_result: string; findings: any[]
  attachments?: any[]; notes?: string
}
type CAPA = {
  id: number; capa_no: string; title: string; source?: string
  problem_description?: string; root_cause_analysis?: string
  corrective_action?: string; preventive_action?: string
  responsible_name?: string; target_date?: string
  effectiveness_check?: string; status: string; notes?: string
}
type Training = {
  id: number; training_no: string; title: string; training_date: string
  trainer?: string; duration_hours?: number; status: string
  attendees: any[]; location?: string; content?: string
}
type Project  = { id: number; name: string }
type Employee = { id: number; name: string; job_title?: string }

const fmt = (d: string) => new Date(d).toLocaleDateString('ar-SA')
const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  'عالي':   { bg: '#fef2f2', color: '#c81e1e' },
  'متوسط':  { bg: '#fffbeb', color: '#e6820a' },
  'منخفض': { bg: '#ecfdf5', color: '#0ea77b' },
}
const LIFECYCLE_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  'رصد':     { bg: '#fffbeb', color: '#e6820a', icon: '👁️' },
  'إسناد':   { bg: '#f5f3ff', color: '#7c3aed', icon: '📌' },
  'تصحيح':  { bg: '#eff6ff', color: '#1a56db', icon: '🔧' },
  'اعتماد': { bg: '#ecfdf5', color: '#0ea77b', icon: '🛡️' },
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem',
  fontWeight: 600, color: 'var(--text)', marginBottom: '6px'
}

// ════════════════════════════════════════
// مودال: تدقيق جديد
// ════════════════════════════════════════
function AuditModal({ projects, tenantId, onClose, onSave }: {
  projects: Project[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [findings, setFindings] = useState<{ item: string; result: 'مطابق' | 'غير مطابق' }[]>([{ item: '', result: 'مطابق' }])
  const [form, setForm] = useState({
    audit_type: 'داخلي', standard: '', audit_date: today,
    auditor_name: '', scope: '', department: '', project_id: '', notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function addFinding() { setFindings([...findings, { item: '', result: 'مطابق' }]) }
  function updateFinding(i: number, key: 'item' | 'result', val: string) {
    setFindings(prev => { const n = [...prev]; (n[i] as any)[key] = val; return n })
  }
  function removeFinding(i: number) { setFindings(findings.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    if (!form.auditor_name.trim()) { toast.error('اسم المدقق مطلوب'); return }
    setSaving(true)
    const { count } = await supabase.from('qhse_audits').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const validFindings = findings.filter(f => f.item.trim())
    const hasNC = validFindings.some(f => f.result === 'غير مطابق')
    const payload: Record<string, any> = {
      tenant_id: tenantId,
      audit_no: `AUD-${new Date().getFullYear()}-${String((count||0)+1).padStart(4,'0')}`,
      audit_type: form.audit_type, standard: form.standard || null,
      audit_date: form.audit_date, auditor_name: form.auditor_name.trim(),
      scope: form.scope || null, department: form.department || null,
      findings: validFindings, overall_result: hasNC ? 'غير مطابق' : 'مطابق',
      notes: form.notes || null,
    }
    if (form.project_id) payload.project_id = Number(form.project_id)
    const { error } = await supabase.from('qhse_audits').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم تسجيل التدقيق')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardCheck style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            تدقيق جودة جديد
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['داخلي', 'خارجي'].map(t => (
              <button key={t} type="button" onClick={() => set('audit_type', t)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
                  borderColor: form.audit_type === t ? '#1a56db' : 'var(--border)',
                  background: form.audit_type === t ? '#eff6ff' : 'white',
                  color: form.audit_type === t ? '#1a56db' : 'var(--text3)' }}>
                {t === 'داخلي' ? '🏢 تدقيق داخلي' : '🌐 تدقيق خارجي'}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>تاريخ التدقيق *</label><input type="date" value={form.audit_date} onChange={e => set('audit_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>المعيار المرجعي</label><input value={form.standard} onChange={e => set('standard', e.target.value)} className="input" placeholder="مثال: ISO 9001" /></div>
          </div>
          <div><label style={lbl}>اسم المدقق *</label><input value={form.auditor_name} onChange={e => set('auditor_name', e.target.value)} className="input" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>القسم / الإدارة</label><input value={form.department} onChange={e => set('department', e.target.value)} className="input" /></div>
            <div><label style={lbl}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div><label style={lbl}>نطاق التدقيق</label>
            <textarea value={form.scope} onChange={e => set('scope', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>

          <div>
            <label style={lbl}>نتائج التدقيق</label>
            {findings.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'flex-start' }}>
                <input value={f.item} onChange={e => updateFinding(i, 'item', e.target.value)} className="input" placeholder={`بند التدقيق ${i+1}`} style={{ flex: 1 }} />
                <select value={f.result} onChange={e => updateFinding(i, 'result', e.target.value)} className="select" style={{ width: '120px' }}>
                  <option value="مطابق">✅ مطابق</option>
                  <option value="غير مطابق">❌ غير مطابق</option>
                </select>
                {findings.length > 1 && (
                  <button type="button" onClick={() => removeFinding(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '8px 4px' }}><X style={{ width: '14px', height: '14px' }} /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={addFinding} style={{ fontSize: '0.78rem', color: '#1a56db', background: 'none', border: '1px dashed #1a56db', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', marginTop: '4px' }}>+ إضافة بند</button>
          </div>

          <div><label style={lbl}>ملاحظات عامة</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#1a56db' }}>
            {saving ? '...' : <><Save style={{ width: '15px', height: '15px' }} /> حفظ التدقيق</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إجراء تحسين مستمر (CAPA)
// ════════════════════════════════════════
function CapaModal({ employees, tenantId, onClose, onSave }: {
  employees: Employee[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', source: 'مبادرة داخلية',
    problem_description: '', root_cause_analysis: '',
    corrective_action: '', preventive_action: '',
    responsible_id: '', responsible_name: '',
    target_date: '', notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) { toast.error('عنوان الإجراء مطلوب'); return }
    setSaving(true)
    const { count } = await supabase.from('qhse_capa').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const payload: Record<string, any> = {
      tenant_id: tenantId,
      capa_no: `CAPA-${new Date().getFullYear()}-${String((count||0)+1).padStart(4,'0')}`,
      title: form.title.trim(), source: form.source,
      problem_description: form.problem_description || null,
      root_cause_analysis: form.root_cause_analysis || null,
      corrective_action: form.corrective_action || null,
      preventive_action: form.preventive_action || null,
      responsible_name: form.responsible_name || null,
      target_date: form.target_date || null,
      status: 'مفتوح', notes: form.notes || null,
    }
    if (form.responsible_id) payload.responsible_id = Number(form.responsible_id)
    const { error } = await supabase.from('qhse_capa').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم تسجيل إجراء التحسين')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            إجراء تحسين مستمر (CAPA)
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={lbl}>عنوان الإجراء *</label><input value={form.title} onChange={e => set('title', e.target.value)} className="input" /></div>
          <div><label style={lbl}>مصدر الإجراء</label>
            <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
              {['مبادرة داخلية', 'زيارة جودة', 'تدقيق', 'شكوى عميل', 'أخرى'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label style={lbl}>وصف المشكلة</label>
            <textarea value={form.problem_description} onChange={e => set('problem_description', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
          <div><label style={lbl}>تحليل السبب الجذري</label>
            <textarea value={form.root_cause_analysis} onChange={e => set('root_cause_analysis', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>الإجراء التصحيحي</label>
              <textarea value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
            <div><label style={lbl}>الإجراء الوقائي</label>
              <textarea value={form.preventive_action} onChange={e => set('preventive_action', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>المسؤول</label>
              <select value={form.responsible_id} onChange={e => { set('responsible_id', e.target.value); const emp = employees.find(x => x.id === Number(e.target.value)); if (emp) set('responsible_name', emp.name) }} className="select">
                <option value="">— اختر —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>التاريخ المستهدف</label><input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} className="input" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? '...' : <><Save style={{ width: '15px', height: '15px' }} /> حفظ الإجراء</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: تسجيل تدريب جودة
// ════════════════════════════════════════
function TrainingModal({ employees, tenantId, onClose, onSave }: {
  employees: Employee[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [form, setForm] = useState({
    title: '', trainer: '', training_date: new Date().toISOString().split('T')[0],
    duration_hours: '', location: '', content: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) { toast.error('عنوان التدريب مطلوب'); return }
    setSaving(true)
    const { count } = await supabase.from('qhse_trainings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const { error } = await supabase.from('qhse_trainings').insert({
      tenant_id: tenantId,
      training_no: `TRN-${new Date().getFullYear()}-${String((count||0)+1).padStart(4,'0')}`,
      title: form.title.trim(), training_type: 'جودة',
      trainer: form.trainer || null,
      training_date: form.training_date,
      duration_hours: Number(form.duration_hours) || null,
      location: form.location || null, content: form.content || null,
      attendees: selected.map(id => ({ id, name: employees.find(e => e.id === id)?.name || '', attended: true })),
      status: 'مجدول',
    })
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم تسجيل التدريب')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '540px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            تسجيل تدريب جودة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={lbl}>عنوان التدريب *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="مثال: تدريب ISO 9001" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>التاريخ *</label><input type="date" value={form.training_date} onChange={e => set('training_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>المدة (ساعات)</label><input type="number" value={form.duration_hours} onChange={e => set('duration_hours', e.target.value)} className="input" dir="ltr" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>المدرب</label><input value={form.trainer} onChange={e => set('trainer', e.target.value)} className="input" /></div>
            <div><label style={lbl}>الموقع</label><input value={form.location} onChange={e => set('location', e.target.value)} className="input" /></div>
          </div>
          <div>
            <label style={lbl}>المشاركون ({selected.length} محدد)</label>
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {employees.map(e => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: selected.includes(e.id) ? '#eff6ff' : 'transparent' }}>
                  <input type="checkbox" checked={selected.includes(e.id)} onChange={() => setSelected(s => s.includes(e.id) ? s.filter(x => x !== e.id) : [...s, e.id])} />
                  <span style={{ fontSize: '0.85rem' }}>{e.name}</span>
                  {e.job_title && <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{e.job_title}</span>}
                </label>
              ))}
            </div>
          </div>
          <div><label style={lbl}>محتوى التدريب</label>
            <textarea value={form.content} onChange={e => set('content', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? '...' : <><Save style={{ width: '15px', height: '15px' }} /> حفظ التدريب</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إضافة شهادة جودة
// ════════════════════════════════════════
function CertModal({ employees, tenantId, onClose, onSave }: {
  employees: Employee[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', cert_type: 'شهادة تأهيل', cert_number: '',
    holder_id: '', holder_name: '',
    issuer: '', issue_date: '', expiry_date: '', notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const today = new Date()
  const daysLeft = form.expiry_date ? Math.round((new Date(form.expiry_date).getTime() - today.getTime()) / 86400000) : null

  async function handleSave() {
    if (!form.title.trim())    { toast.error('عنوان الشهادة مطلوب'); return }
    if (!form.holder_name.trim()) { toast.error('اسم الحامل مطلوب'); return }
    if (!form.expiry_date)     { toast.error('تاريخ الانتهاء مطلوب'); return }
    setSaving(true)
    const payload: Record<string, any> = {
      tenant_id: tenantId, title: form.title.trim(),
      cert_type: form.cert_type, cert_type_module: 'جودة', cert_number: form.cert_number || null,
      holder_name: form.holder_name.trim(), issuer: form.issuer || null,
      issue_date: form.issue_date || null, expiry_date: form.expiry_date,
      notes: form.notes || null,
      status: daysLeft !== null && daysLeft < 0 ? 'منتهية' : 'سارية',
    }
    if (form.holder_id) payload.holder_id = Number(form.holder_id)
    const { error } = await supabase.from('qhse_certificates').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم إضافة الشهادة')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '500px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            إضافة شهادة / اعتماد جودة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['شهادة تأهيل','رخصة','اعتماد'].map(t => (
              <button key={t} type="button" onClick={() => set('cert_type', t)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                  borderColor: form.cert_type === t ? '#7c3aed' : 'var(--border)',
                  background: form.cert_type === t ? '#f5f3ff' : 'white',
                  color: form.cert_type === t ? '#7c3aed' : 'var(--text3)' }}>{t}</button>
            ))}
          </div>
          <div><label style={lbl}>عنوان الشهادة *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="مثال: شهادة مدقق جودة داخلي" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>الحامل *</label>
              <select value={form.holder_id} onChange={e => { set('holder_id', e.target.value); const emp = employees.find(x => x.id === Number(e.target.value)); if (emp) set('holder_name', emp.name) }} className="select">
                <option value="">— اختر الموظف —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <input value={form.holder_name} onChange={e => set('holder_name', e.target.value)} className="input" style={{ marginTop: '6px' }} placeholder="أو اكتب الاسم..." />
            </div>
            <div><label style={lbl}>رقم الشهادة</label>
              <input value={form.cert_number} onChange={e => set('cert_number', e.target.value)} className="input" dir="ltr" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>الجهة المصدِرة</label>
              <input value={form.issuer} onChange={e => set('issuer', e.target.value)} className="input" /></div>
            <div><label style={lbl}>تاريخ الإصدار</label>
              <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>تاريخ الانتهاء *</label>
              <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" /></div>
          </div>
          {daysLeft !== null && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
              background: daysLeft < 0 ? '#fef2f2' : daysLeft <= 30 ? '#fffbeb' : '#ecfdf5',
              color:      daysLeft < 0 ? '#c81e1e' : daysLeft <= 30 ? '#e6820a' : '#0ea77b' }}>
              {daysLeft < 0 ? `❌ منتهية منذ ${Math.abs(daysLeft)} يوم` : daysLeft === 0 ? '⚠️ تنتهي اليوم!' : daysLeft <= 30 ? `⚠️ تنتهي خلال ${daysLeft} يوم` : `✅ سارية — ${daysLeft} يوم متبقي`}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? '...' : <><Save style={{ width: '15px', height: '15px' }} /> حفظ الشهادة</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مكوّن: إدارة مهندسي الاعتماد (جودة)
// ════════════════════════════════════════
function ApproversPanel({ tenant, employees, approvers, onChanged }: {
  tenant: any; employees: Employee[]
  approvers: { employee_id: number; employee_name: string }[]
  onChanged: () => void
}) {
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  async function addApprover() {
    if (!selected || !tenant) return
    const emp = employees.find(e => e.id === Number(selected))
    if (!emp) return
    setSaving(true)
    const { error } = await supabase.from('qhse_approvers').insert({
      tenant_id: tenant.id, employee_id: emp.id, employee_name: emp.name,
      module: 'جودة', is_active: true,
    })
    if (error) toast.error('خطأ: ' + error.message)
    else toast.success(`✅ تم تعيين ${emp.name} كمعتمد`)
    setSelected('')
    setSaving(false)
    onChanged()
  }

  async function removeApprover(employeeId: number) {
    if (!tenant) return
    await supabase.from('qhse_approvers').delete().eq('tenant_id', tenant.id).eq('employee_id', employeeId).eq('module', 'جودة')
    toast.success('تم إلغاء صلاحية الاعتماد')
    onChanged()
  }

  const availableEmployees = employees.filter(e => !approvers.some(a => a.employee_id === e.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
      <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1a56db' }}>
        🛡️ المعتمدون هنا (مهندس الجودة ونائبه) هم وحدهم المخوّلون باعتماد أو رفض محاولات تصحيح ملاحظات وحالات عدم المطابقة في الجودة. هذه صلاحية مستقلة تُمنح يدوياً ولا ترتبط بالمسمى الوظيفي.
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <select value={selected} onChange={e => setSelected(e.target.value)} className="select" style={{ flex: 1 }}>
          <option value="">— اختر موظفاً لتعيينه معتمداً —</option>
          {availableEmployees.map(e => <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>)}
        </select>
        <button onClick={addApprover} disabled={!selected || saving} className="btn btn-primary" style={{ background: '#1a56db' }}>
          <Plus style={{ width: '15px', height: '15px' }} /> تعيين
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {approvers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            <CheckCircle2 style={{ width: '36px', height: '36px', color: 'var(--border)', margin: '0 auto 10px' }} />
            <p style={{ fontSize: '0.85rem' }}>لا يوجد معتمدون بعد — لن تستطيع أي ملاحظة الانتقال لمرحلة الاعتماد</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {approvers.map(a => (
              <div key={a.employee_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--bg2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🛡️</div>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{a.employee_name}</span>
                </div>
                <button onClick={() => removeApprover(a.employee_id)}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#c81e1e', fontFamily: 'inherit' }}>
                  إلغاء الصلاحية
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إسناد المسؤول عن التصحيح (RBAC: مهندس الجودة/نائبه فقط)
// ════════════════════════════════════════
function AssignmentModal({ visit, employees, onClose, onSubmit }: {
  visit: any; employees: Employee[]
  onClose: () => void
  onSubmit: (responsibleId: number, responsibleName: string) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)

  function submit() {
    if (!selectedId) { toast.error('اختر الموظف المسؤول عن التصحيح'); return }
    const emp = employees.find(e => e.id === Number(selectedId))
    if (!emp) return
    setSaving(true)
    onSubmit(emp.id, emp.name)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>📌 إسناد المسؤول عن التصحيح</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', fontSize: '0.82rem', color: '#c81e1e', whiteSpace: 'pre-line' }}>
            ⚠️ {visit.corrective}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>اختر الموظف المسؤول عن تنفيذ التصحيح *</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="select" autoFocus>
              <option value="">— اختر الموظف —</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}{emp.job_title ? ` — ${emp.job_title}` : ''}</option>)}
            </select>
          </div>
          <div style={{ padding: '8px 12px', background: '#f5f3ff', borderRadius: '8px', fontSize: '0.76rem', color: '#7c3aed' }}>
            بعد الإسناد، يصبح هذا الموظف وحده المخوّل بتسجيل التصحيح لهذه المخالفة
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? '...' : '📌 تأكيد الإسناد'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: تسجيل محاولة تصحيح
// ════════════════════════════════════════
function CorrectionModal({ visit, attemptNo, onClose, onSubmit }: {
  visit: any; attemptNo: number
  onClose: () => void
  onSubmit: (notes: string, files: { name: string; data: string }[]) => void
}) {
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<{ name: string; data: string }[]>([])
  const [saving, setSaving] = useState(false)

  function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files || []).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = ev => setPhotos(p => [...p, { name: file.name, data: ev.target?.result as string }])
      reader.readAsDataURL(file)
    })
  }

  function submit() {
    if (!notes.trim()) { toast.error('تفاصيل التصحيح مطلوبة'); return }
    setSaving(true)
    onSubmit(notes.trim(), photos)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>🔧 تسجيل تصحيح — محاولة {attemptNo}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', fontSize: '0.82rem', color: '#c81e1e', whiteSpace: 'pre-line' }}>
            ⚠️ {visit.corrective}
          </div>
          {attemptNo > 1 && (
            <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.78rem', color: '#92400e' }}>
              هذه محاولتك رقم {attemptNo} — تم رفض المحاولة السابقة، يُرجى معالجة سبب الرفض الموضح في سجل المحاولات
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>تفاصيل التصحيح المُنفَّذ *</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" style={{ minHeight: '90px', resize: 'none' }}
              placeholder="صف الإجراء التصحيحي الذي تم تنفيذه..." autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>📷 صور إثبات التصحيح</label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: '2px dashed var(--border)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text3)' }}>
              📎 اضغط لإضافة صور
              <input type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: 'none' }} />
            </label>
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1' }}>
                    <img src={p.data} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" onClick={() => setPhotos(ph => ph.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: '3px', left: '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#c81e1e', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.76rem', color: '#1a56db' }}>
            سيُرسَل هذا التصحيح لمهندس الجودة لاعتماده أو رفضه
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            {saving ? '...' : '✅ إرسال للمراجعة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: مراجعة التصحيح — اعتماد أو رفض
// ════════════════════════════════════════
function ReviewModal({ visit, lastAttempt, onClose, onDecide }: {
  visit: any; lastAttempt: any
  onClose: () => void
  onDecide: (decision: 'معتمد' | 'مرفوض', text: string) => void
}) {
  const [mode, setMode] = useState<'review' | 'reject'>('review')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  function approve() { setSaving(true); onDecide('معتمد', text) }
  function reject() {
    if (!text.trim()) { toast.error('سبب الرفض مطلوب'); return }
    setSaving(true)
    onDecide('مرفوض', text.trim())
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '540px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>🛡️ مراجعة التصحيح</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', fontSize: '0.82rem', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>الملاحظة الأصلية:</div>
            <div style={{ color: 'var(--text3)', whiteSpace: 'pre-line' }}>{visit.corrective}</div>
          </div>

          {lastAttempt && (
            <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.72rem', color: '#0ea77b', fontWeight: 700, marginBottom: '6px' }}>
                ✅ التصحيح المُقدَّم (محاولة {lastAttempt.attempt_no}) — {lastAttempt.corrected_by_name}
              </div>
              <div style={{ fontSize: '0.85rem' }}>{lastAttempt.correction_notes}</div>
              {lastAttempt.correction_files?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {lastAttempt.correction_files.map((f: any, i: number) => (
                    <a key={i} href={f.data} target="_blank" style={{ width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', display: 'block' }}>
                      <img src={f.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => setMode('review')}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
                borderColor: mode === 'review' ? '#0ea77b' : 'var(--border)', background: mode === 'review' ? '#ecfdf5' : 'white', color: mode === 'review' ? '#0ea77b' : 'var(--text3)' }}>
              ✅ اعتماد
            </button>
            <button type="button" onClick={() => setMode('reject')}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
                borderColor: mode === 'reject' ? '#c81e1e' : 'var(--border)', background: mode === 'reject' ? '#fef2f2' : 'white', color: mode === 'reject' ? '#c81e1e' : 'var(--text3)' }}>
              ❌ رفض وإعادة
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
              {mode === 'review' ? 'ملاحظات الاعتماد (اختياري)' : 'سبب الرفض *'}
            </label>
            <textarea value={text} onChange={e => setText(e.target.value)} className="input" style={{ minHeight: '80px', resize: 'none' }}
              placeholder={mode === 'review' ? 'أي ملاحظات إضافية عند الاعتماد...' : 'وضّح للمسؤول ما الذي يحتاج إعادة معالجته...'} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          {mode === 'review' ? (
            <button onClick={approve} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b' }}>
              {saving ? '...' : '✅ اعتماد نهائي'}
            </button>
          ) : (
            <button onClick={reject} disabled={saving} className="btn btn-primary" style={{ background: '#c81e1e' }}>
              {saving ? '...' : '🔁 رفض وإرجاع للمسؤول'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function QualityPage() {
  const { tenant, currentUser, visits, setVisits } = useStore()
  const perms: string[] = currentUser?.permissions || []
  const canManageApprovers = perms.includes('quality_manage_approvers')

  const [tab,       setTab]       = useState('visits')
  const [audits,    setAudits]    = useState<Audit[]>([])
  const [capas,     setCapas]     = useState<CAPA[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [projects,  setProjects]  = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [certs,     setCerts]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [showModal, setShowModal] = useState<string | null>(null)
  const [visitSubTab, setVisitSubTab] = useState<'inspection' | 'observation' | 'ncr'>('inspection')

  const [detailVisit,    setDetailVisit]    = useState<any | null>(null)
  const [detailAudit,    setDetailAudit]    = useState<Audit | null>(null)
  const [detailCapa,     setDetailCapa]     = useState<CAPA | null>(null)
  const [detailTraining, setDetailTraining] = useState<Training | null>(null)

  const [approvers,        setApprovers]        = useState<{ employee_id: number; employee_name: string }[]>([])
  const [corrections,      setCorrections]      = useState<Record<number, any[]>>({})
  const [showCorrectModal, setShowCorrectModal] = useState<any | null>(null)
  const [showReviewModal,  setShowReviewModal]  = useState<any | null>(null)
  const [showAssignModal,  setShowAssignModal]  = useState<any | null>(null)

  const isApprover = approvers.some(a => a.employee_id === (currentUser as any)?.hr_employee_id || a.employee_name === currentUser?.name)
  function isResponsibleFor(v: any) {
    return v.responsible_name === currentUser?.name || v.responsible_id === (currentUser as any)?.hr_employee_id
  }

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const tid = tenant.id
    const [audRes, capaRes, trnRes, projRes, empRes, visRes, apprRes] = await Promise.all([
      supabase.from('qhse_audits').select('*').eq('tenant_id', tid).order('audit_date', { ascending: false }),
      supabase.from('qhse_capa').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('qhse_trainings').select('*').eq('tenant_id', tid).eq('training_type', 'جودة').order('training_date', { ascending: false }),
      supabase.from('projects').select('id,name').eq('tenant_id', tid).order('name'),
      supabase.from('hr_employees').select('id,name,job_title').eq('tenant_id', tid).eq('is_active', true).order('name'),
      supabase.from('visits').select('*').eq('tenant_id', tid).eq('type', 'جودة').order('date', { ascending: false }),
      supabase.from('qhse_approvers').select('employee_id,employee_name').eq('tenant_id', tid).eq('module', 'جودة').eq('is_active', true),
    ])
    setAudits(audRes.data || [])
    setCapas(capaRes.data || [])
    setTrainings(trnRes.data || [])
    setProjects(projRes.data || [])
    setEmployees(empRes.data || [])
    if (visRes.data) setVisits([...visits.filter(v => v.type !== 'جودة'), ...visRes.data])
    setApprovers(apprRes.data || [])
    const certRes = await supabase.from('qhse_certificates').select('*').eq('tenant_id', tid).eq('cert_type_module', 'جودة').order('expiry_date')
    setCerts(certRes.data || [])

    const visitIds = (visRes.data || []).filter((v: any) => v.specs === 'غير مطابق').map((v: any) => v.id)
    if (visitIds.length > 0) {
      const { data: corrData } = await supabase.from('visit_corrections').select('*').eq('tenant_id', tid).in('visit_id', visitIds).order('attempt_no', { ascending: true })
      const grouped: Record<number, any[]> = {}
      ;(corrData || []).forEach((c: any) => {
        if (!grouped[c.visit_id]) grouped[c.visit_id] = []
        grouped[c.visit_id].push(c)
      })
      setCorrections(grouped)
    }
    setLoading(false)
  }

  // ══ إسناد المسؤول عن التصحيح — يقوم بها فقط مهندس الجودة/نائبه ══
  async function submitAssignment(visit: any, responsibleId: number, responsibleName: string) {
    if (!tenant) return
    await supabase.from('visits').update({
      responsible_id:   responsibleId,
      responsible_name: responsibleName,
      assigned_by_id:   (currentUser as any)?.hr_employee_id || null,
      assigned_by_name: currentUser?.name || null,
      assigned_at:      new Date().toISOString(),
      lifecycle:        'إسناد',
    }).eq('id', visit.id)
    toast.success(`✅ تم إسناد المهمة إلى ${responsibleName}`)
    setShowAssignModal(null)
    setDetailVisit(null)
    loadAll()
  }

  async function submitCorrection(visit: any, notes: string, files: { name: string; data: string }[]) {
    if (!tenant) return
    const prevAttempts = corrections[visit.id] || []
    const attemptNo = prevAttempts.length + 1
    await supabase.from('visit_corrections').insert({
      tenant_id: tenant.id, visit_id: visit.id, attempt_no: attemptNo,
      correction_notes: notes,
      correction_files: files.length > 0 ? files : [],
      corrected_by_name: currentUser?.name || null,
      corrected_by_id: (currentUser as any)?.hr_employee_id || null,
      review_status: 'بانتظار المراجعة',
    })
    await supabase.from('visits').update({ lifecycle: 'تصحيح', current_attempt: attemptNo }).eq('id', visit.id)
    toast.success(`✅ تم تسجيل محاولة التصحيح رقم ${attemptNo} — بانتظار اعتماد مهندس الجودة`)
    setShowCorrectModal(null)
    setDetailVisit(null)
    loadAll()
  }

  async function reviewCorrection(visit: any, decision: 'معتمد' | 'مرفوض', reasonOrNotes: string) {
    if (!tenant) return
    const attempts = corrections[visit.id] || []
    const last = attempts[attempts.length - 1]
    if (!last) return
    await supabase.from('visit_corrections').update({
      review_status: decision,
      reviewed_by_name: currentUser?.name || null,
      reviewed_by_id: (currentUser as any)?.hr_employee_id || null,
      reviewed_at: new Date().toISOString(),
      ...(decision === 'مرفوض' ? { rejection_reason: reasonOrNotes } : { approval_notes: reasonOrNotes }),
    }).eq('id', last.id)

    if (decision === 'معتمد') {
      await supabase.from('visits').update({
        lifecycle: 'اعتماد', status: 'مغلق',
        resolved_report: reasonOrNotes || 'تم الاعتماد',
        resolved_by: currentUser?.name || null,
        resolved_date: new Date().toISOString().split('T')[0],
        approved_by: currentUser?.name || null,
        approved_date: new Date().toISOString().split('T')[0],
      }).eq('id', visit.id)
      toast.success('✅ تم اعتماد التصحيح نهائياً')
    } else {
      await supabase.from('visits').update({
        lifecycle: 'إسناد',
        rejection_count: ((visit as any).rejection_count || 0) + 1,
      }).eq('id', visit.id)
      toast('🔁 تم رفض التصحيح وإرجاعه للمسؤول', { icon: '⚠️' })
    }
    setShowReviewModal(null)
    setDetailVisit(null)
    loadAll()
  }

  const qualityVisits = visits.filter(v => v.type === 'جودة')
  const openIssues   = qualityVisits.filter(v => v.specs === 'غير مطابق' && (v as any).lifecycle !== 'اعتماد').length
  const ncrCount      = qualityVisits.filter(v => !!(v as any).ncr_no).length
  const openAudits    = audits.filter(a => a.overall_result === 'غير مطابق').length
  const openCapas     = capas.filter(c => c.status !== 'مغلق').length

  const TABS = [
    { id: 'visits',    label: 'زيارات الجودة',                icon: '📋' },
    { id: 'audits',    label: 'التدقيق',                       icon: '🔍' },
    { id: 'certs',     label: 'شهادات الجودة',                 icon: '🏅' },
    { id: 'capa',      label: 'إجراءات التحسين المستمر',       icon: '🔄' },
    { id: 'trainings', label: 'التدريب',                       icon: '🎓' },
    ...(canManageApprovers ? [{ id: 'approvers', label: 'مهندسو الاعتماد', icon: '🛡️' }] : []),
  ]

  const visitSubTabFiltered = qualityVisits.filter(v => {
    const et = (v as any).entry_type || 'زيارة'
    if (visitSubTab === 'inspection')  return et === 'زيارة'
    if (visitSubTab === 'observation') return et === 'ملاحظة'
    return et === 'مطابقة'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            ضبط الجودة
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>إدارة زيارات الجودة والتدقيق وعدم المطابقات وإجراءات التحسين</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tab === 'visits' && (
            <>
              <button onClick={() => setShowModal('inspection')} className="btn btn-primary" style={{ background: '#1a56db' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> زيارة تفتيشية
              </button>
              <button onClick={() => setShowModal('observation')} className="btn btn-primary" style={{ background: '#e6820a' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> ملاحظة / NCR
              </button>
            </>
          )}
          {tab === 'audits'    && <button onClick={() => setShowModal('audit')}    className="btn btn-primary" style={{ background: '#1a56db' }}><Plus style={{ width: '16px', height: '16px' }} /> تدقيق جديد</button>}
          {tab === 'certs'     && <button onClick={() => setShowModal('cert')}     className="btn btn-primary" style={{ background: '#7c3aed' }}><Plus style={{ width: '16px', height: '16px' }} /> إضافة شهادة</button>}
          {tab === 'capa'      && <button onClick={() => setShowModal('capa')}     className="btn btn-primary" style={{ background: '#7c3aed' }}><Plus style={{ width: '16px', height: '16px' }} /> إجراء تحسين</button>}
          {tab === 'trainings' && <button onClick={() => setShowModal('training')} className="btn btn-primary" style={{ background: '#7c3aed' }}><Plus style={{ width: '16px', height: '16px' }} /> تسجيل تدريب</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        {[
          { label: 'زيارات الجودة',     value: qualityVisits.length, color: '#1a56db', bg: '#eff6ff' },
          { label: 'قيود مفتوحة',       value: openIssues,           color: '#c81e1e', bg: '#fef2f2' },
          { label: 'عدم مطابقات NCR',   value: ncrCount,              color: '#e6820a', bg: '#fffbeb' },
          { label: 'تدقيقات غير مطابقة', value: openAudits,           color: '#c81e1e', bg: '#fef2f2' },
          { label: 'إجراءات تحسين مفتوحة', value: openCapas,          color: '#7c3aed', bg: '#f5f3ff' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px', background: kpi.bg, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch('') }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? '#1a56db' : 'var(--text3)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', maxWidth: '340px' }}>
        <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث..." />
      </div>

      {tab === 'visits' && (
        <>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
            {[
              { id: 'inspection',  label: '📋 الزيارات التفتيشية', count: qualityVisits.filter(v => ((v as any).entry_type || 'زيارة') === 'زيارة').length },
              { id: 'observation', label: '⚠️ الملاحظات الفورية',  count: qualityVisits.filter(v => (v as any).entry_type === 'ملاحظة').length },
              { id: 'ncr',         label: '🚫 عدم المطابقة (NCR)', count: qualityVisits.filter(v => (v as any).entry_type === 'مطابقة').length },
            ].map(st => (
              <button key={st.id} onClick={() => setVisitSubTab(st.id as any)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
                  background: visitSubTab === st.id ? 'white' : 'transparent',
                  color: visitSubTab === st.id ? '#1a56db' : 'var(--text3)',
                  boxShadow: visitSubTab === st.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                {st.label}
                <span style={{ background: visitSubTab === st.id ? '#eff6ff' : '#e5e7eb', color: visitSubTab === st.id ? '#1a56db' : '#6b7280', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{st.count}</span>
              </button>
            ))}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            {visitSubTabFiltered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
                <CheckCircle2 style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
                <p>{visitSubTab === 'inspection' ? 'لا توجد زيارات تفتيشية' : visitSubTab === 'observation' ? 'لا توجد ملاحظات فورية' : 'لا توجد حالات عدم مطابقة'}</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {[visitSubTab === 'ncr' ? 'رقم NCR' : null, 'التاريخ','المهندس','الموقع','النتيجة','الخطورة','الحالة','المسؤول',''].filter(Boolean).map(h => (
                        <th key={h as string} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visitSubTabFiltered.filter(v => !search || v.engineer.includes(search) || (v.notes || '').includes(search) || (v.location || '').includes(search)).map(v => {
                      const lc = (v as any).lifecycle || 'رصد'
                      const lcS = LIFECYCLE_STYLE[lc] || LIFECYCLE_STYLE['رصد']
                      const sev = (v as any).severity
                      const sevS = sev ? SEVERITY_STYLE[sev] : null
                      const attempts = corrections[v.id] || []
                      const lastAttempt = attempts[attempts.length - 1]
                      const awaitingReview = lc === 'تصحيح' && lastAttempt?.review_status === 'بانتظار المراجعة'
                      const canAssign  = v.specs === 'غير مطابق' && lc === 'رصد' && isApprover
                      const canCorrect = v.specs === 'غير مطابق' && lc === 'إسناد' && isResponsibleFor(v)
                      const canReview  = v.specs === 'غير مطابق' && awaitingReview && isApprover
                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {visitSubTab === 'ncr' && (
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#c81e1e', fontWeight: 700 }}>{(v as any).ncr_no || '—'}</td>
                          )}
                          <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(v.date)}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{v.engineer}</td>
                          <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: 'var(--text3)' }}>{v.location || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                              background: v.specs === 'مطابق' ? '#ecfdf5' : '#fef2f2',
                              color: v.specs === 'مطابق' ? '#0ea77b' : '#c81e1e' }}>
                              {v.specs === 'مطابق' ? '✅ مطابق' : '❌ غير مطابق'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {sevS ? <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: sevS.bg, color: sevS.color }}>{sev}</span> : '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: lcS.bg, color: lcS.color, width: 'fit-content' }}>
                                {lcS.icon} {lc}
                              </span>
                              {awaitingReview && <span style={{ fontSize: '0.65rem', color: '#1a56db', fontWeight: 600 }}>بانتظار المراجعة (محاولة {lastAttempt.attempt_no})</span>}
                              {v.specs === 'غير مطابق' && lc === 'رصد' && !canAssign && (
                                <span style={{ fontSize: '0.65rem', color: '#7c3aed', fontWeight: 600 }}>بانتظار إسناد مهندس الجودة</span>
                              )}
                              {((v as any).rejection_count || 0) > 0 && lc === 'إسناد' && (
                                <span style={{ fontSize: '0.65rem', color: '#c81e1e', fontWeight: 700 }}>🔁 مرفوضة سابقاً ({(v as any).rejection_count})</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{(v as any).responsible_name || '—'}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {canAssign && (
                                <button onClick={() => setShowAssignModal(v)}
                                  style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#f5f3ff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', fontFamily: 'inherit' }}>
                                  📌 إسناد
                                </button>
                              )}
                              {canCorrect && (
                                <button onClick={() => setShowCorrectModal(v)}
                                  style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#fef2f2', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, color: '#c81e1e', fontFamily: 'inherit' }}>
                                  🔧 تصحيح
                                </button>
                              )}
                              {canReview && (
                                <button onClick={() => setShowReviewModal(v)}
                                  style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#eff6ff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, color: '#1a56db', fontFamily: 'inherit' }}>
                                  🛡️ مراجعة
                                </button>
                              )}
                              <button onClick={() => setDetailVisit(v)}
                                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)', fontFamily: 'inherit' }}>
                                👁️ تفاصيل
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'audits' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {audits.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
              <FileSearch style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p>لا توجد تدقيقات مسجلة</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم التدقيق','التاريخ','النوع','المعيار','المدقق','النتيجة',''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audits.filter(a => !search || a.auditor_name.includes(search) || (a.scope || '').includes(search)).map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#1a56db', fontWeight: 700 }}>{a.audit_no}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(a.audit_date)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600, background: '#eff6ff', color: '#1a56db' }}>{a.audit_type}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{a.standard || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{a.auditor_name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                          background: a.overall_result === 'مطابق' ? '#ecfdf5' : '#fef2f2',
                          color: a.overall_result === 'مطابق' ? '#0ea77b' : '#c81e1e' }}>
                          {a.overall_result === 'مطابق' ? '✅ مطابق' : '❌ غير مطابق'}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={() => setDetailAudit(a)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)', fontFamily: 'inherit' }}>
                          👁️ تفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'certs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {certs.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', gridColumn: '1/-1' }}>
              <Award style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p>لا توجد شهادات مسجلة</p>
            </div>
          ) : certs.map((c: any) => {
            const today   = new Date()
            const expiry  = new Date(c.expiry_date)
            const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86400000)
            const isExp   = daysLeft < 0
            const isSoon  = daysLeft >= 0 && daysLeft <= 30
            return (
              <div key={c.id} className="card" style={{ padding: '16px', borderTop: `3px solid ${isExp ? '#c81e1e' : isSoon ? '#e6820a' : '#0ea77b'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.title}</div>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700,
                    background: isExp ? '#fef2f2' : isSoon ? '#fffbeb' : '#ecfdf5',
                    color:      isExp ? '#c81e1e' : isSoon ? '#e6820a' : '#0ea77b' }}>
                    {isExp ? '❌ منتهية' : isSoon ? `⚠️ ${daysLeft} يوم` : '✅ سارية'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>👤 {c.holder_name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '3px' }}>📅 تنتهي: {c.expiry_date}</div>
                {c.cert_number && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'monospace', marginTop: '3px' }}>{c.cert_number}</div>}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'capa' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {capas.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
              <RefreshCw style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p>لا توجد إجراءات تحسين مسجلة</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم الإجراء','العنوان','المصدر','المسؤول','التاريخ المستهدف','الحالة',''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {capas.filter(c => !search || c.title.includes(search)).map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>{c.capa_no}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '200px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{c.source || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{c.responsible_name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{c.target_date ? fmt(c.target_date) : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                          background: c.status === 'مغلق' ? '#ecfdf5' : c.status === 'قيد التنفيذ' ? '#eff6ff' : '#fffbeb',
                          color: c.status === 'مغلق' ? '#0ea77b' : c.status === 'قيد التنفيذ' ? '#1a56db' : '#e6820a' }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={() => setDetailCapa(c)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)', fontFamily: 'inherit' }}>
                          👁️ تفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'trainings' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {trainings.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
              <Award style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p>لا توجد تدريبات مسجلة</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم التدريب','العنوان','التاريخ','المدرب','المشاركون','المدة','الحالة',''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trainings.filter(t => !search || t.title.includes(search)).map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>{t.training_no}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.title}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(t.training_date)}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{t.trainer || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{t.attendees.length}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{t.duration_hours ? `${t.duration_hours} ساعة` : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                          background: t.status === 'منعقد' ? '#ecfdf5' : t.status === 'ملغي' ? '#fef2f2' : '#eff6ff',
                          color: t.status === 'منعقد' ? '#0ea77b' : t.status === 'ملغي' ? '#c81e1e' : '#1a56db' }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={() => setDetailTraining(t)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)', fontFamily: 'inherit' }}>
                          👁️ تفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'approvers' && canManageApprovers && (
        <ApproversPanel tenant={tenant} employees={employees} approvers={approvers} onChanged={loadAll} />
      )}

      {detailVisit && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setDetailVisit(null)}>
          <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(detailVisit as any).entry_type === 'مطابقة' ? `🚫 ${(detailVisit as any).ncr_no || 'عدم مطابقة'}` : (detailVisit as any).entry_type === 'ملاحظة' ? '⚠️ ملاحظة جودة' : '📋 زيارة تفتيشية'}
                <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text3)' }}>{fmt(detailVisit.date)}</span>
              </h3>
              <button onClick={() => setDetailVisit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { label: 'المهندس',  value: detailVisit.engineer },
                  { label: 'الموقع',   value: detailVisit.location || '—' },
                  { label: 'التاريخ',  value: fmt(detailVisit.date) },
                  ...(detailVisit.supervisor_name ? [{ label: 'مشرف الموقع', value: detailVisit.supervisor_name }] : []),
                  ...(detailVisit.work_order_source ? [{ label: 'مصدر أمر العمل', value: detailVisit.work_order_source }] : []),
                  ...(detailVisit.work_order_receiver ? [{ label: 'مستلم أمر العمل', value: detailVisit.work_order_receiver }] : []),
                ].map((item, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '3px' }}>{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {(detailVisit as any).latitude && (
                <div style={{ padding: '8px 12px', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.78rem', color: '#0ea77b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📍 الموقع الجغرافي: {Number((detailVisit as any).latitude).toFixed(5)}, {Number((detailVisit as any).longitude).toFixed(5)}
                  <a href={`https://maps.google.com/?q=${(detailVisit as any).latitude},${(detailVisit as any).longitude}`} target="_blank"
                    style={{ color: '#1a56db', fontSize: '0.72rem', marginRight: 'auto' }}>فتح في الخريطة ↗</a>
                </div>
              )}

              {detailVisit.specs === 'غير مطابق' && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {(detailVisit as any).severity && (() => {
                    const s = SEVERITY_STYLE[(detailVisit as any).severity] || SEVERITY_STYLE['متوسط']
                    return <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.78rem', background: s.bg, color: s.color }}>خطورة: {(detailVisit as any).severity}</span>
                  })()}
                  {(() => {
                    const lc = (detailVisit as any).lifecycle || 'رصد'
                    const ls = LIFECYCLE_STYLE[lc] || LIFECYCLE_STYLE['رصد']
                    return <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.78rem', background: ls.bg, color: ls.color }}>{ls.icon} {lc}</span>
                  })()}
                  {(detailVisit as any).responsible_name && (
                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.78rem', background: '#f5f3ff', color: '#7c3aed' }}>👤 {(detailVisit as any).responsible_name}</span>
                  )}
                </div>
              )}

              {detailVisit.corrective && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#c81e1e', fontWeight: 700, marginBottom: '5px' }}>⚠️ {(detailVisit as any).entry_type === 'ملاحظة' || (detailVisit as any).entry_type === 'مطابقة' ? 'وصف المخالفة' : 'البنود غير المطابقة'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#c81e1e', whiteSpace: 'pre-line' }}>{detailVisit.corrective}</div>
                </div>
              )}

              {(detailVisit as any).entry_type === 'زيارة' && (detailVisit as any).checklist?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '10px' }}>
                    قائمة الفحص ({(detailVisit as any).checklist.filter((c: any) => c.result === 'نعم').length} مطابق /
                    {' '}{(detailVisit as any).checklist.filter((c: any) => c.result === 'لا').length} غير مطابق)
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    {(detailVisit as any).checklist.map((c: any, i: number) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: '8px',
                        padding: '8px 12px', alignItems: 'center',
                        borderBottom: i < (detailVisit as any).checklist.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: c.result === 'نعم' ? '#f0fdf4' : c.result === 'لا' ? '#fef2f2' : 'white',
                      }}>
                        <div style={{ fontSize: '0.72rem', color: '#6b7280', textAlign: 'center', fontWeight: 700 }}>{c.no}</div>
                        <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>{c.item}</div>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
                          background: c.result === 'نعم' ? '#ecfdf5' : c.result === 'لا' ? '#fef2f2' : '#f3f4f6',
                          color:      c.result === 'نعم' ? '#0ea77b' : c.result === 'لا' ? '#c81e1e' : '#6b7280' }}>
                          {c.result}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailVisit.attachments?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px' }}>📷 الصور والمرفقات ({detailVisit.attachments.length})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {detailVisit.attachments.map((a: any, i: number) => (
                      <a key={i} href={a.data} target="_blank" style={{ borderRadius: '8px', overflow: 'hidden', aspectRatio: '1', display: 'block' }}>
                        <img src={a.data} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(detailVisit as any).general_notes && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px' }}>ملاحظات عامة</div>
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '0.85rem' }}>{(detailVisit as any).general_notes}</div>
                </div>
              )}

              {detailVisit.specs === 'غير مطابق' && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '10px' }}>
                    📜 سجل محاولات التصحيح {(corrections[detailVisit.id]?.length || 0) > 0 ? `(${corrections[detailVisit.id].length})` : ''}
                  </div>
                  {(!corrections[detailVisit.id] || corrections[detailVisit.id].length === 0) ? (
                    <div style={{ padding: '14px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text3)' }}>
                      لم يُسجَّل أي تصحيح بعد
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {corrections[detailVisit.id].map((c: any) => (
                        <div key={c.id} style={{
                          border: `1px solid ${c.review_status === 'معتمد' ? '#bbf7d0' : c.review_status === 'مرفوض' ? '#fecaca' : '#fde68a'}`,
                          borderRadius: '8px', overflow: 'hidden',
                        }}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px',
                            background: c.review_status === 'معتمد' ? '#ecfdf5' : c.review_status === 'مرفوض' ? '#fef2f2' : '#fffbeb',
                          }}>
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: c.review_status === 'معتمد' ? '#0ea77b' : c.review_status === 'مرفوض' ? '#c81e1e' : '#92400e' }}>
                              محاولة {c.attempt_no} — {c.corrected_by_name}
                            </span>
                            <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700,
                              background: c.review_status === 'معتمد' ? '#0ea77b' : c.review_status === 'مرفوض' ? '#c81e1e' : '#e6820a', color: 'white' }}>
                              {c.review_status === 'معتمد' ? '✅ معتمد' : c.review_status === 'مرفوض' ? '❌ مرفوض' : '⏳ بانتظار المراجعة'}
                            </span>
                          </div>
                          <div style={{ padding: '10px 12px', fontSize: '0.82rem' }}>
                            <div>{c.correction_notes}</div>
                            {c.correction_files?.length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                {c.correction_files.map((f: any, i: number) => (
                                  <a key={i} href={f.data} target="_blank" style={{ width: '50px', height: '50px', borderRadius: '6px', overflow: 'hidden', display: 'block' }}>
                                    <img src={f.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </a>
                                ))}
                              </div>
                            )}
                            {c.review_status === 'مرفوض' && c.rejection_reason && (
                              <div style={{ marginTop: '8px', padding: '8px 10px', background: '#fef2f2', borderRadius: '6px', fontSize: '0.78rem', color: '#c81e1e' }}>
                                <strong>سبب الرفض ({c.reviewed_by_name}):</strong> {c.rejection_reason}
                              </div>
                            )}
                            {c.review_status === 'معتمد' && c.approval_notes && (
                              <div style={{ marginTop: '8px', padding: '8px 10px', background: '#ecfdf5', borderRadius: '6px', fontSize: '0.78rem', color: '#0ea77b' }}>
                                <strong>ملاحظات الاعتماد ({c.reviewed_by_name}):</strong> {c.approval_notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const lc = (detailVisit as any).lifecycle || 'رصد'
                    const attempts = corrections[detailVisit.id] || []
                    const lastAttempt = attempts[attempts.length - 1]
                    const awaitingReview = lc === 'تصحيح' && lastAttempt?.review_status === 'بانتظار المراجعة'
                    const canAssign  = lc === 'رصد' && isApprover
                    const canCorrect = lc === 'إسناد' && isResponsibleFor(detailVisit)
                    const canReview  = awaitingReview && isApprover
                    if (!canAssign && !canCorrect && !canReview) return null
                    return (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        {canAssign && (
                          <button onClick={() => setShowAssignModal(detailVisit)}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit' }}>
                            📌 إسناد المسؤول
                          </button>
                        )}
                        {canCorrect && (
                          <button onClick={() => setShowCorrectModal(detailVisit)}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#c81e1e', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit' }}>
                            🔧 تسجيل تصحيح
                          </button>
                        )}
                        {canReview && (
                          <button onClick={() => setShowReviewModal(detailVisit)}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#1a56db', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit' }}>
                            🛡️ مراجعة التصحيح
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setDetailVisit(null)} className="btn btn-ghost">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {detailAudit && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setDetailAudit(null)}>
          <div className="modal-box" style={{ maxWidth: '560px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><FileSearch style={{ width: '18px', height: '18px', color: '#1a56db' }} />{detailAudit.audit_no}</h3>
              <button onClick={() => setDetailAudit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'النوع',    value: detailAudit.audit_type },
                  { label: 'التاريخ',  value: fmt(detailAudit.audit_date) },
                  { label: 'المدقق',   value: detailAudit.auditor_name },
                ].map((item, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '3px' }}>{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {detailAudit.standard && <div style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>📐 المعيار: {detailAudit.standard}</div>}
              {detailAudit.scope && <div><div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px' }}>النطاق</div><div style={{ fontSize: '0.85rem', color: 'var(--text3)' }}>{detailAudit.scope}</div></div>}
              {detailAudit.findings?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>نتائج التدقيق</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {detailAudit.findings.map((f: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: f.result === 'مطابق' ? '#f0fdf4' : '#fef2f2', borderRadius: '6px', fontSize: '0.82rem' }}>
                        <span>{f.item}</span>
                        <span style={{ fontWeight: 700, color: f.result === 'مطابق' ? '#0ea77b' : '#c81e1e' }}>{f.result === 'مطابق' ? '✅' : '❌'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detailAudit.notes && <div style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{detailAudit.notes}</div>}
            </div>
            <div className="modal-footer"><button onClick={() => setDetailAudit(null)} className="btn btn-ghost">إغلاق</button></div>
          </div>
        </div>
      )}

      {detailCapa && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setDetailCapa(null)}>
          <div className="modal-box" style={{ maxWidth: '560px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw style={{ width: '18px', height: '18px', color: '#7c3aed' }} />{detailCapa.title}</h3>
              <button onClick={() => setDetailCapa(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{detailCapa.capa_no} {detailCapa.source ? `· المصدر: ${detailCapa.source}` : ''}</div>
              {detailCapa.problem_description && <div><div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px' }}>وصف المشكلة</div><div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '0.85rem' }}>{detailCapa.problem_description}</div></div>}
              {detailCapa.root_cause_analysis && <div><div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px' }}>تحليل السبب الجذري</div><div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '0.85rem' }}>{detailCapa.root_cause_analysis}</div></div>}
              {detailCapa.corrective_action && <div><div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px' }}>الإجراء التصحيحي</div><div style={{ background: '#ecfdf5', borderRadius: '8px', padding: '10px 12px', fontSize: '0.85rem' }}>{detailCapa.corrective_action}</div></div>}
              {detailCapa.preventive_action && <div><div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px' }}>الإجراء الوقائي</div><div style={{ background: '#eff6ff', borderRadius: '8px', padding: '10px 12px', fontSize: '0.85rem' }}>{detailCapa.preventive_action}</div></div>}
              {detailCapa.responsible_name && <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>المسؤول: {detailCapa.responsible_name}</div>}
              {detailCapa.target_date && <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>التاريخ المستهدف: {fmt(detailCapa.target_date)}</div>}
            </div>
            <div className="modal-footer"><button onClick={() => setDetailCapa(null)} className="btn btn-ghost">إغلاق</button></div>
          </div>
        </div>
      )}

      {detailTraining && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setDetailTraining(null)}>
          <div className="modal-box" style={{ maxWidth: '560px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Award style={{ width: '18px', height: '18px', color: '#7c3aed' }} />{detailTraining.title}</h3>
              <button onClick={() => setDetailTraining(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'التاريخ', value: fmt(detailTraining.training_date) },
                  { label: 'المدرب',  value: detailTraining.trainer || '—' },
                  { label: 'المدة',   value: detailTraining.duration_hours ? `${detailTraining.duration_hours} ساعة` : '—' },
                ].map((item, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '3px' }}>{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {detailTraining.location && <div style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>📍 {detailTraining.location}</div>}
              {detailTraining.content && <div><div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>محتوى التدريب</div><div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '0.85rem' }}>{detailTraining.content}</div></div>}
              {detailTraining.attendees?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>👥 المشاركون ({detailTraining.attendees.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {detailTraining.attendees.map((a: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.82rem' }}>
                        <span>{a.name}</span>
                        <span style={{ color: a.attended ? '#0ea77b' : '#c81e1e', fontWeight: 700 }}>{a.attended ? '✓ حضر' : '✗ غاب'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer"><button onClick={() => setDetailTraining(null)} className="btn btn-ghost">إغلاق</button></div>
          </div>
        </div>
      )}

      {showModal === 'inspection' && (
        <QualityInspectionModal projects={projects} employees={employees}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'observation' && (
        <QualityObservationModal projects={projects} employees={employees}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'audit' && (
        <AuditModal projects={projects} tenantId={tenant!.id}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'cert' && (
        <CertModal employees={employees} tenantId={tenant!.id}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'capa' && (
        <CapaModal employees={employees} tenantId={tenant!.id}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'training' && (
        <TrainingModal employees={employees} tenantId={tenant!.id}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}

      {showAssignModal && (
        <AssignmentModal visit={showAssignModal} employees={employees}
          onClose={() => setShowAssignModal(null)}
          onSubmit={(responsibleId, responsibleName) => submitAssignment(showAssignModal, responsibleId, responsibleName)} />
      )}

      {showCorrectModal && (
        <CorrectionModal visit={showCorrectModal}
          attemptNo={(corrections[showCorrectModal.id]?.length || 0) + 1}
          onClose={() => setShowCorrectModal(null)}
          onSubmit={(notes, files) => submitCorrection(showCorrectModal, notes, files)} />
      )}

      {showReviewModal && (
        <ReviewModal visit={showReviewModal}
          lastAttempt={(corrections[showReviewModal.id] || [])[(corrections[showReviewModal.id] || []).length - 1]}
          onClose={() => setShowReviewModal(null)}
          onDecide={(decision, text) => reviewCorrection(showReviewModal, decision, text)} />
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
