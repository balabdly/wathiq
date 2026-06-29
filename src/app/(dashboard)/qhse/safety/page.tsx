'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  Plus, X, Save, Search, Shield, AlertTriangle, CheckCircle2,
  ClipboardList, Zap, BookOpen, Award, Eye, Pencil, Clock, FileText
} from 'lucide-react'
import InspectionVisitModal from './InspectionVisitModal'
import SafetyObservationModal from './SafetyObservationModal'
import toast from 'react-hot-toast'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Visit = {
  id: number; type: string; date: string; engineer: string
  specs: string; corrective?: string; notes?: string
  location?: string; project_id?: number
  severity?: string; lifecycle?: string
  responsible_name?: string; correction_notes?: string
}
type Incident = {
  id: number; incident_no: string; incident_date: string; title: string
  incident_type: string; severity: string; status: string
  injured_name?: string; location?: string; project_id?: number
  description?: string; immediate_action?: string; corrective_action?: string
  reported_by?: string; lost_time_days?: number
}
type Risk = {
  id: number; risk_no: string; title: string; risk_category?: string
  likelihood: number; severity: number; risk_score: number
  risk_level?: string; control_measures?: string
  responsible_name?: string; status: string; review_date?: string
}
type SWP = {
  id: number; proc_no: string; title: string; work_type: string
  description?: string; steps: any[]; ppe_required: any[]
  hazards?: string; precautions?: string; version: string
  approved_by?: string; is_active: boolean
}
type ProjectRisk = {
  id: number; risk_code: string; title: string; category?: string
  probability: string; impact: string; risk_score: number
  status: string; owner?: string; response_plan?: string
  project?: { name: string }
}
type Training = {
  id: number; training_no: string; title: string; training_date: string
  trainer?: string; duration_hours?: number; status: string
  attendees: any[]; location?: string
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
  'تصحيح':  { bg: '#eff6ff', color: '#1a56db', icon: '🔧' },
  'اعتماد': { bg: '#ecfdf5', color: '#0ea77b', icon: '🛡️' },
}
const RISK_LEVEL = (score: number) =>
  score >= 15 ? { label: 'عالي جداً', color: '#c81e1e', bg: '#fef2f2' } :
  score >= 10 ? { label: 'عالي',      color: '#e6820a', bg: '#fffbeb' } :
  score >= 6  ? { label: 'متوسط',     color: '#e6820a', bg: '#fffbeb' } :
                { label: 'منخفض',    color: '#0ea77b', bg: '#ecfdf5' }

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem',
  fontWeight: 600, color: 'var(--text)', marginBottom: '6px'
}

// ════════════════════════════════════════
// مودال: تسجيل حادث
// ════════════════════════════════════════
function IncidentModal({ projects, employees, tenantId, onClose, onSave }: {
  projects: Project[]; employees: Employee[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    incident_date: today, incident_time: '',
    title: '', description: '', location: '',
    project_id: '', incident_type: 'حادث',
    severity: 'متوسط', injured_name: '', injured_id: '',
    injury_type: '', injury_part: '', lost_time_days: '0',
    immediate_action: '', root_cause: '', reported_by: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) { toast.error('عنوان الحادث مطلوب'); return }
    setSaving(true)
    const { count } = await supabase.from('qhse_incidents').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const payload: Record<string, any> = {
      tenant_id: tenantId,
      incident_no: `INC-${new Date().getFullYear()}-${String((count||0)+1).padStart(4,'0')}`,
      incident_date: form.incident_date,
      incident_time: form.incident_time || null,
      title: form.title.trim(), description: form.description || null,
      location: form.location || null, incident_type: form.incident_type,
      severity: form.severity, status: 'مفتوح',
      injured_name: form.injured_name || null,
      injury_type: form.injury_type || null,
      injury_part: form.injury_part || null,
      lost_time_days: Number(form.lost_time_days) || 0,
      immediate_action: form.immediate_action || null,
      root_cause: form.root_cause || null,
      reported_by: form.reported_by || null,
    }
    if (form.project_id)  payload.project_id  = Number(form.project_id)
    if (form.injured_id)  payload.injured_id  = Number(form.injured_id)
    const { error } = await supabase.from('qhse_incidents').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم تسجيل الحادث')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            تسجيل حادث / إصابة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* نوع الحادث والخطورة */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
            {['حادث','إصابة','كاد يقع','مرض مهني'].map(t => (
              <button key={t} type="button" onClick={() => set('incident_type', t)}
                style={{ padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                  borderColor: form.incident_type === t ? '#c81e1e' : 'var(--border)',
                  background: form.incident_type === t ? '#fef2f2' : 'white',
                  color: form.incident_type === t ? '#c81e1e' : 'var(--text3)' }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['عالي','متوسط','منخفض'].map(s => {
              const st = SEVERITY_STYLE[s]
              return (
                <button key={s} type="button" onClick={() => set('severity', s)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
                    borderColor: form.severity === s ? st.color : 'var(--border)',
                    background: form.severity === s ? st.bg : 'white',
                    color: form.severity === s ? st.color : 'var(--text3)' }}>
                  {s === 'عالي' ? '🔴' : s === 'متوسط' ? '🟡' : '🟢'} {s}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>التاريخ *</label><input type="date" value={form.incident_date} onChange={e => set('incident_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>الوقت</label><input type="time" value={form.incident_time} onChange={e => set('incident_time', e.target.value)} className="input" /></div>
          </div>

          <div><label style={lbl}>عنوان الحادث *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="وصف مختصر للحادث" /></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>الموقع</label><input value={form.location} onChange={e => set('location', e.target.value)} className="input" /></div>
            <div><label style={lbl}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون مشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div><label style={lbl}>وصف الحادث</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} /></div>

          {/* بيانات المصاب */}
          <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#c81e1e', marginBottom: '10px' }}>🚑 بيانات المصاب (إن وجد)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><label style={lbl}>اسم المصاب</label>
                <select value={form.injured_id} onChange={e => { set('injured_id', e.target.value); const emp = employees.find(x => x.id === Number(e.target.value)); if (emp) set('injured_name', emp.name) }} className="select">
                  <option value="">— اختر الموظف —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <input value={form.injured_name} onChange={e => set('injured_name', e.target.value)} className="input" style={{ marginTop: '6px' }} placeholder="أو اكتب الاسم..." />
              </div>
              <div>
                <div><label style={lbl}>نوع الإصابة</label>
                  <select value={form.injury_type} onChange={e => set('injury_type', e.target.value)} className="select">
                    <option value="">— اختر —</option>
                    {['كسر','جرح','حرق','صدمة كهربائية','سقوط','إجهاد','أخرى'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>الجزء المصاب</label>
                <input value={form.injury_part} onChange={e => set('injury_part', e.target.value)} className="input" placeholder="اليد، القدم، الرأس..." />
              </div>
              <div><label style={lbl}>أيام الغياب</label>
                <input type="number" value={form.lost_time_days} onChange={e => set('lost_time_days', e.target.value)} className="input" min="0" dir="ltr" />
              </div>
            </div>
          </div>

          <div><label style={lbl}>الإجراء الفوري</label>
            <textarea value={form.immediate_action} onChange={e => set('immediate_action', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} placeholder="ما تم فعله فور وقوع الحادث..." /></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>السبب الجذري</label>
              <input value={form.root_cause} onChange={e => set('root_cause', e.target.value)} className="input" /></div>
            <div><label style={lbl}>بلّغ عنه</label>
              <input value={form.reported_by} onChange={e => set('reported_by', e.target.value)} className="input" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            تسجيل الحادث
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: تقييم مخاطر
// ════════════════════════════════════════
function RiskModal({ projects, employees, tenantId, onClose, onSave }: {
  projects: Project[]; employees: Employee[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', location: '', project_id: '',
    risk_category: 'كهربائي', likelihood: 3, severity: 3,
    control_measures: '', responsible_id: '', responsible_name: '',
    review_date: '', notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const score = form.likelihood * form.severity
  const rl = RISK_LEVEL(score)

  async function handleSave() {
    if (!form.title.trim()) { toast.error('عنوان المخاطرة مطلوب'); return }
    setSaving(true)
    const { count } = await supabase.from('qhse_risks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const payload: Record<string, any> = {
      tenant_id: tenantId,
      risk_no: `RISK-${new Date().getFullYear()}-${String((count||0)+1).padStart(4,'0')}`,
      title: form.title.trim(), description: form.description || null,
      location: form.location || null, risk_category: form.risk_category,
      likelihood: form.likelihood, severity: form.severity,
      risk_level: rl.label, control_measures: form.control_measures || null,
      responsible_name: form.responsible_name || null,
      review_date: form.review_date || null, status: 'نشط', notes: form.notes || null,
    }
    if (form.project_id)     payload.project_id     = Number(form.project_id)
    if (form.responsible_id) payload.responsible_id = Number(form.responsible_id)
    const { error } = await supabase.from('qhse_risks').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم تسجيل المخاطرة')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            تقييم مخاطرة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={lbl}>عنوان المخاطرة *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>الفئة</label>
              <select value={form.risk_category} onChange={e => set('risk_category', e.target.value)} className="select">
                {['كهربائي','ميكانيكي','كيميائي','بيئي','بشري','أخرى'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={lbl}>الموقع</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" /></div>
          </div>
          {/* مصفوفة المخاطر */}
          <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '12px' }}>⚡ مصفوفة تقييم المخاطر</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={lbl}>الاحتمالية (1-5)</label>
                <input type="range" min="1" max="5" value={form.likelihood} onChange={e => set('likelihood', Number(e.target.value))} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text3)' }}>
                  <span>نادر</span><span style={{ fontWeight: 700, color: '#e6820a' }}>{form.likelihood}</span><span>محقق</span>
                </div>
              </div>
              <div>
                <label style={lbl}>الخطورة (1-5)</label>
                <input type="range" min="1" max="5" value={form.severity} onChange={e => set('severity', Number(e.target.value))} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text3)' }}>
                  <span>بسيط</span><span style={{ fontWeight: 700, color: '#e6820a' }}>{form.severity}</span><span>كارثي</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '12px', textAlign: 'center', padding: '10px', borderRadius: '8px', background: rl.bg }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: rl.color }}>{score}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: rl.color }}>مستوى الخطر: {rl.label}</div>
            </div>
          </div>
          <div><label style={lbl}>إجراءات السيطرة</label>
            <textarea value={form.control_measures} onChange={e => set('control_measures', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>المسؤول</label>
              <select value={form.responsible_id} onChange={e => { set('responsible_id', e.target.value); const emp = employees.find(x => x.id === Number(e.target.value)); if (emp) set('responsible_name', emp.name) }} className="select">
                <option value="">— اختر —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>تاريخ المراجعة</label>
              <input type="date" value={form.review_date} onChange={e => set('review_date', e.target.value)} className="input" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            حفظ التقييم
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إجراء عمل آمن (SWP)
// ════════════════════════════════════════
function SWPModal({ tenantId, onClose, onSave }: { tenantId: string; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false)
  const [steps, setSteps] = useState<string[]>([''])
  const [ppe, setPpe] = useState<string[]>([])
  const [form, setForm] = useState({
    title: '', work_type: '', description: '',
    hazards: '', precautions: '', approved_by: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const PPE_OPTIONS = ['خوذة','قفازات','نظارات واقية','حذاء أمان','صدرية عاكسة','حزام أمان','كمامة','سدادات أذن','واقي وجه']

  async function handleSave() {
    if (!form.title.trim() || !form.work_type.trim()) { toast.error('العنوان ونوع العمل مطلوبان'); return }
    setSaving(true)
    const { count } = await supabase.from('qhse_safe_work_procedures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const { error } = await supabase.from('qhse_safe_work_procedures').insert({
      tenant_id: tenantId,
      proc_no: `SWP-${new Date().getFullYear()}-${String((count||0)+1).padStart(4,'0')}`,
      title: form.title.trim(), work_type: form.work_type.trim(),
      description: form.description || null,
      steps: steps.filter(s => s.trim()).map((s, i) => ({ step: i+1, text: s })),
      ppe_required: ppe,
      hazards: form.hazards || null, precautions: form.precautions || null,
      approved_by: form.approved_by || null, is_active: true,
    })
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم حفظ الإجراء')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            إجراء عمل آمن
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>عنوان الإجراء *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="مثال: إجراء اللحام الآمن" /></div>
            <div><label style={lbl}>نوع العمل *</label>
              <input value={form.work_type} onChange={e => set('work_type', e.target.value)} className="input" placeholder="لحام، حفر، رفع أثقال..." /></div>
          </div>
          <div><label style={lbl}>الوصف العام</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
          {/* خطوات الإجراء */}
          <div>
            <label style={lbl}>خطوات الإجراء</label>
            {steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1a56db', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, marginTop: '8px' }}>{i+1}</span>
                <input value={step} onChange={e => { const s = [...steps]; s[i] = e.target.value; setSteps(s) }} className="input" placeholder={`الخطوة ${i+1}`} />
                {steps.length > 1 && (
                  <button type="button" onClick={() => setSteps(steps.filter((_,idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '4px' }}><X style={{ width: '14px', height: '14px' }} /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setSteps([...steps, ''])} style={{ fontSize: '0.78rem', color: '#1a56db', background: 'none', border: '1px dashed #1a56db', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', marginTop: '4px' }}>+ إضافة خطوة</button>
          </div>
          {/* معدات الوقاية */}
          <div>
            <label style={lbl}>معدات الوقاية الشخصية المطلوبة (PPE)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PPE_OPTIONS.map(p => (
                <button key={p} type="button" onClick={() => setPpe(ppe.includes(p) ? ppe.filter(x => x !== p) : [...ppe, p])}
                  style={{ padding: '4px 10px', borderRadius: '16px', border: '1px solid', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                    borderColor: ppe.includes(p) ? '#1a56db' : 'var(--border)',
                    background: ppe.includes(p) ? '#eff6ff' : 'white',
                    color: ppe.includes(p) ? '#1a56db' : 'var(--text3)' }}>
                  {ppe.includes(p) ? '✓ ' : ''}{p}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>المخاطر المحتملة</label>
              <textarea value={form.hazards} onChange={e => set('hazards', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
            <div><label style={lbl}>الاحتياطات</label>
              <textarea value={form.precautions} onChange={e => set('precautions', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
          </div>
          <div><label style={lbl}>اعتمد بواسطة</label>
            <input value={form.approved_by} onChange={e => set('approved_by', e.target.value)} className="input" /></div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            حفظ الإجراء
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: تسجيل تدريب
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
      title: form.title.trim(), training_type: 'سلامة',
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
            تسجيل تدريب
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={lbl}>عنوان التدريب *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="مثال: تدريب السلامة الكهربائية" /></div>
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
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            حفظ التدريب
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function SafetyPage() {
  const { tenant, visits, setVisits } = useStore()
  const [tab,       setTab]       = useState('visits')
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [risks,     setRisks]     = useState<Risk[]>([])
  const [swps,      setSwps]      = useState<SWP[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [projects,  setProjects]  = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [showModal,      setShowModal]      = useState<string | null>(null)
  const [visitSubTab,    setVisitSubTab]    = useState<'inspection' | 'observation'>('inspection')
  const [riskSubTab,     setRiskSubTab]     = useState<'general' | 'projects'>('general')
  const [projectRisks,   setProjectRisks]   = useState<ProjectRisk[]>([])
  const [selectedRisks,  setSelectedRisks]  = useState<number[]>([])
  const [importing,      setImporting]      = useState(false)

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const tid = tenant.id
    const [incRes, riskRes, swpRes, trnRes, projRes, empRes, visRes] = await Promise.all([
      supabase.from('qhse_incidents').select('*').eq('tenant_id', tid).order('incident_date', { ascending: false }),
      supabase.from('qhse_risks').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('qhse_safe_work_procedures').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('qhse_trainings').select('*').eq('tenant_id', tid).order('training_date', { ascending: false }),
      supabase.from('projects').select('id,name').eq('tenant_id', tid).order('name'),
      supabase.from('hr_employees').select('id,name,job_title').eq('tenant_id', tid).eq('is_active', true).order('name'),
      supabase.from('visits').select('*').eq('tenant_id', tid).in('type', ['سلامة']).order('date', { ascending: false }),
    ])
    setIncidents(incRes.data || [])
    setRisks(riskRes.data || [])
    setSwps(swpRes.data || [])
    setTrainings(trnRes.data || [])
    setProjects(projRes.data || [])
    setEmployees(empRes.data || [])
    if (visRes.data) setVisits([...visits.filter(v => v.type !== 'سلامة'), ...visRes.data])
    // جلب مخاطر المشاريع
    const pRiskRes = await supabase.from('project_risks').select('*, project:projects(name)').eq('tenant_id', tid).order('risk_score', { ascending: false })
    setProjectRisks(pRiskRes.data || [])
    setLoading(false)
  }

  const safetyVisits = visits.filter(v => v.type === 'سلامة')
  const openNCR      = safetyVisits.filter(v => v.specs === 'غير مطابق' && (v as any).lifecycle !== 'اعتماد').length
  const openIncidents = incidents.filter(i => i.status !== 'مغلق').length
  const highRisks    = risks.filter(r => r.risk_score >= 10 && r.status === 'نشط').length

  async function importRisksToGeneral() {
    if (!tenant || selectedRisks.length === 0) return
    setImporting(true)
    for (const riskId of selectedRisks) {
      const r = projectRisks.find(x => x.id === riskId)
      if (!r) continue
      const { count } = await supabase.from('qhse_risks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
      await supabase.from('qhse_risks').insert({
        tenant_id: tenant.id,
        risk_no: `RISK-${new Date().getFullYear()}-${String((count||0)+1).padStart(4,'0')}`,
        title: r.title,
        risk_category: r.category || null,
        likelihood: r.probability === 'عالية' ? 4 : r.probability === 'متوسطة' ? 3 : 2,
        severity:   r.impact     === 'عالي'  ? 4 : r.impact     === 'متوسط'   ? 3 : 2,
        risk_level: r.risk_score >= 10 ? 'عالي' : r.risk_score >= 6 ? 'متوسط' : 'منخفض',
        control_measures: r.response_plan || null,
        responsible_name: r.owner || null,
        status: 'نشط',
      })
    }
    toast.success(`✅ تم نقل ${selectedRisks.length} مخاطرة للسجل العام`)
    setSelectedRisks([])
    setImporting(false)
    loadAll()
  }

  const TABS = [
    { id: 'visits',    label: 'الزيارات وملاحظات السلامة', icon: '📋' },
    { id: 'incidents', label: 'الحوادث والإصابات',          icon: '🚨' },
    { id: 'risks',     label: 'تقييم المخاطر',              icon: '⚡' },
    { id: 'swp',       label: 'إجراءات العمل الآمنة',       icon: '🔐' },
    { id: 'trainings', label: 'التدريبات',                  icon: '🎓' },
  ]
  const safetyVisitsFiltered = safetyVisits.filter(v => {
    const et = (v as any).entry_type || 'زيارة'
    return visitSubTab === 'inspection' ? et === 'زيارة' : et === 'ملاحظة'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield style={{ width: '20px', height: '20px', color: '#c81e1e' }} />
            السلامة والصحة المهنية
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>إدارة الزيارات الميدانية والحوادث والمخاطر والتدريبات</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tab === 'visits' && (
            <>
              <button onClick={() => setShowModal('inspection')} className="btn btn-primary" style={{ background: '#1B3A6B' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> زيارة تفتيشية
              </button>
              <button onClick={() => setShowModal('observation')} className="btn btn-primary" style={{ background: '#e6820a' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> ملاحظة فورية
              </button>
            </>
          )}
          {tab === 'incidents' && <button onClick={() => setShowModal('incident')} className="btn btn-primary" style={{ background: '#c81e1e' }}><Plus style={{ width: '16px', height: '16px' }} /> تسجيل حادث</button>}
          {tab === 'risks'     && <button onClick={() => setShowModal('risk')}     className="btn btn-primary" style={{ background: '#e6820a' }}><Plus style={{ width: '16px', height: '16px' }} /> تقييم مخاطرة</button>}
          {tab === 'swp'       && <button onClick={() => setShowModal('swp')}      className="btn btn-primary"                                  ><Plus style={{ width: '16px', height: '16px' }} /> إجراء عمل آمن</button>}
          {tab === 'trainings' && <button onClick={() => setShowModal('training')} className="btn btn-primary" style={{ background: '#7c3aed' }}><Plus style={{ width: '16px', height: '16px' }} /> تسجيل تدريب</button>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        {[
          { label: 'زيارات السلامة', value: safetyVisits.length, color: '#1a56db', bg: '#eff6ff' },
          { label: 'ملاحظات مفتوحة', value: openNCR,            color: '#c81e1e', bg: '#fef2f2' },
          { label: 'حوادث مفتوحة',   value: openIncidents,      color: '#e6820a', bg: '#fffbeb' },
          { label: 'مخاطر عالية',    value: highRisks,           color: '#c81e1e', bg: '#fef2f2' },
          { label: 'تدريبات',        value: trainings.length,    color: '#7c3aed', bg: '#f5f3ff' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px', background: kpi.bg, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch('') }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? '#c81e1e' : 'var(--text3)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* بحث */}
      <div style={{ position: 'relative', maxWidth: '340px' }}>
        <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث..." />
      </div>

      {/* ══ تاب: الزيارات وملاحظات السلامة ══ */}
      {tab === 'visits' && (
        <>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
            {[
              { id: 'inspection',  label: '📋 الزيارات التفتيشية', count: safetyVisits.filter(v => ((v as any).entry_type || 'زيارة') === 'زيارة').length },
              { id: 'observation', label: '⚠️ الملاحظات الفورية',  count: safetyVisits.filter(v => (v as any).entry_type === 'ملاحظة').length },
            ].map(st => (
              <button key={st.id} onClick={() => setVisitSubTab(st.id as any)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
                  background: visitSubTab === st.id ? 'white' : 'transparent',
                  color: visitSubTab === st.id ? '#c81e1e' : 'var(--text3)',
                  boxShadow: visitSubTab === st.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                {st.label}
                <span style={{ background: visitSubTab === st.id ? '#fef2f2' : '#e5e7eb', color: visitSubTab === st.id ? '#c81e1e' : '#6b7280', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{st.count}</span>
              </button>
            ))}
          </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {safetyVisitsFiltered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
              <Shield style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p>{visitSubTab === 'inspection' ? 'لا توجد زيارات تفتيشية' : 'لا توجد ملاحظات فورية'}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['التاريخ','المهندس','الموقع','النتيجة','الخطورة','الحالة','المسؤول'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {safetyVisitsFiltered.filter(v => !search || v.engineer.includes(search) || (v.notes || '').includes(search) || (v.location || '').includes(search)).map(v => {
                    const lc = (v as any).lifecycle || 'رصد'
                    const lcS = LIFECYCLE_STYLE[lc] || LIFECYCLE_STYLE['رصد']
                    const sev = (v as any).severity
                    const sevS = sev ? SEVERITY_STYLE[sev] : null
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
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
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: lcS.bg, color: lcS.color }}>
                            {lcS.icon} {lc}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{(v as any).responsible_name || '—'}</td>
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

      {/* ══ تاب: الحوادث ══ */}
      {tab === 'incidents' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {incidents.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
              <AlertTriangle style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p>لا توجد حوادث مسجلة — هذا جيد! 👍</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم الحادث','التاريخ','العنوان','النوع','الخطورة','المصاب','أيام غياب','الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.filter(i => !search || i.title.includes(search) || (i.location || '').includes(search)).map(inc => {
                    const sevS = SEVERITY_STYLE[inc.severity] || SEVERITY_STYLE['متوسط']
                    return (
                      <tr key={inc.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#c81e1e', fontWeight: 700 }}>{inc.incident_no}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(inc.incident_date)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '180px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600, background: '#fef2f2', color: '#c81e1e' }}>{inc.incident_type}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: sevS.bg, color: sevS.color }}>{inc.severity}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{inc.injured_name || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', textAlign: 'center' }}>{inc.lost_time_days || 0}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                            background: inc.status === 'مغلق' ? '#ecfdf5' : inc.status === 'تحت التحقيق' ? '#eff6ff' : '#fffbeb',
                            color: inc.status === 'مغلق' ? '#0ea77b' : inc.status === 'تحت التحقيق' ? '#1a56db' : '#e6820a' }}>
                            {inc.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب: تقييم المخاطر ══ */}
      {tab === 'risks' && (
        <>
          {/* Sub-tabs المخاطر */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
              {[
                { id: 'general',  label: '📋 السجل العام',      count: risks.length },
                { id: 'projects', label: '🏗️ مخاطر المشاريع', count: projectRisks.length },
              ].map(st => (
                <button key={st.id} onClick={() => { setRiskSubTab(st.id as any); setSelectedRisks([]) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
                    background: riskSubTab === st.id ? 'white' : 'transparent',
                    color: riskSubTab === st.id ? '#e6820a' : 'var(--text3)',
                    boxShadow: riskSubTab === st.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                  {st.label}
                  <span style={{ background: riskSubTab === st.id ? '#fffbeb' : '#e5e7eb', color: riskSubTab === st.id ? '#e6820a' : '#6b7280', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{st.count}</span>
                </button>
              ))}
            </div>
            {riskSubTab === 'projects' && selectedRisks.length > 0 && (
              <button onClick={importRisksToGeneral} disabled={importing}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#e6820a', color: 'white', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'inherit' }}>
                {importing ? '...' : `📤 نقل ${selectedRisks.length} للسجل العام`}
              </button>
            )}
          </div>

          {/* السجل العام */}
          {riskSubTab === 'general' && <div className="card" style={{ overflow: 'hidden' }}>
          {risks.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
              <Zap style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p>لا توجد مخاطر مسجلة</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم المخاطرة','العنوان','الفئة','الاحتمالية','الخطورة','الدرجة','المستوى','المسؤول','الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {risks.filter(r => !search || r.title.includes(search)).map(r => {
                    const rl = RISK_LEVEL(r.risk_score)
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#e6820a', fontWeight: 700 }}>{r.risk_no}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '160px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{r.risk_category || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{r.likelihood}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{r.severity}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', width: '32px', height: '32px', borderRadius: '50%', background: rl.bg, color: rl.color, fontWeight: 800, fontSize: '0.85rem', lineHeight: '32px', textAlign: 'center' }}>{r.risk_score}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: rl.bg, color: rl.color }}>{rl.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: 'var(--text3)' }}>{r.responsible_name || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                            background: r.status === 'مغلق' ? '#ecfdf5' : r.status === 'تحت المعالجة' ? '#eff6ff' : '#fffbeb',
                            color: r.status === 'مغلق' ? '#0ea77b' : r.status === 'تحت المعالجة' ? '#1a56db' : '#e6820a' }}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>}

          {/* مخاطر المشاريع */}
          {riskSubTab === 'projects' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              {projectRisks.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
                  <Zap style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
                  <p>لا توجد مخاطر مسجلة في المشاريع</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '10px 12px', width: '32px' }}>
                          <input type="checkbox" onChange={e => setSelectedRisks(e.target.checked ? projectRisks.map(r => r.id) : [])} checked={selectedRisks.length === projectRisks.length && projectRisks.length > 0} />
                        </th>
                        {['الكود','المشروع','العنوان','الفئة','الاحتمالية','التأثير','الدرجة','الحالة'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {projectRisks.filter(r => !search || r.title.includes(search)).map(r => {
                        const rl = RISK_LEVEL(r.risk_score)
                        const isSelected = selectedRisks.includes(r.id)
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)', background: isSelected ? '#fffbeb' : 'transparent' }}
                            onMouseEnter={e => { if (!isSelected) (e.currentTarget.style.background = 'var(--bg2)') }}
                            onMouseLeave={e => { if (!isSelected) (e.currentTarget.style.background = 'transparent') }}>
                            <td style={{ padding: '10px 12px' }}>
                              <input type="checkbox" checked={isSelected} onChange={e => setSelectedRisks(s => e.target.checked ? [...s, r.id] : s.filter(x => x !== r.id))} />
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#e6820a', fontWeight: 700 }}>{r.risk_code}</td>
                            <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#1a56db' }}>{(r as any).project?.name || '—'}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '180px' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{r.category || '—'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{r.probability}</td>
                            <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{r.impact}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span style={{ display: 'inline-block', width: '28px', height: '28px', borderRadius: '50%', background: rl.bg, color: rl.color, fontWeight: 800, fontSize: '0.8rem', lineHeight: '28px', textAlign: 'center' }}>{r.risk_score}</span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                                background: r.status === 'مغلق' ? '#ecfdf5' : '#fffbeb',
                                color:      r.status === 'مغلق' ? '#0ea77b' : '#e6820a' }}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ تاب: إجراءات العمل الآمنة ══ */}
      {tab === 'swp' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {swps.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', gridColumn: '1/-1' }}>
              <BookOpen style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p>لا توجد إجراءات مسجلة</p>
            </div>
          ) : swps.filter(s => !search || s.title.includes(search) || s.work_type.includes(search)).map(s => (
            <div key={s.id} className="card" style={{ padding: '18px', borderTop: `3px solid ${s.is_active ? '#1a56db' : '#9ca3af'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.title}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{s.proc_no} · الإصدار {s.version}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700,
                  background: s.is_active ? '#eff6ff' : '#f3f4f6', color: s.is_active ? '#1a56db' : '#6b7280' }}>
                  {s.is_active ? 'فعّال' : 'موقوف'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ padding: '2px 10px', borderRadius: '10px', background: '#f5f3ff', color: '#7c3aed', fontSize: '0.75rem', fontWeight: 600 }}>🔧 {s.work_type}</span>
              </div>
              {s.ppe_required.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {s.ppe_required.map((p: string) => (
                    <span key={p} style={{ padding: '2px 6px', borderRadius: '6px', background: '#ecfdf5', color: '#0ea77b', fontSize: '0.68rem' }}>🦺 {p}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{s.steps.length} خطوة{s.approved_by ? ` · اعتمد: ${s.approved_by}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* ══ تاب: التدريبات ══ */}
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
                    {['رقم التدريب','العنوان','التاريخ','المدرب','المشاركون','المدة','الحالة'].map(h => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* المودالات */}
      {showModal === 'inspection' && (
        <InspectionVisitModal projects={projects} employees={employees}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'observation' && (
        <SafetyObservationModal projects={projects} employees={employees}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'incident' && (
        <IncidentModal projects={projects} employees={employees} tenantId={tenant!.id}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'risk' && (
        <RiskModal projects={projects} employees={employees} tenantId={tenant!.id}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'swp' && (
        <SWPModal tenantId={tenant!.id}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}
      {showModal === 'training' && (
        <TrainingModal employees={employees} tenantId={tenant!.id}
          onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadAll() }} />
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
