'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { X, Save } from 'lucide-react'
import type { Project } from '@/types'
import toast from 'react-hot-toast'
import {
  WORKFLOW_TYPES, BILLING_MODELS, WO_SOURCES, PMO_PHASES_FULL, PMO_PHASES_OM,
  defaultBillingModel, defaultPmoPhase, defaultWoSource, statusForPhase,
} from '@/lib/sec-workflow'
import type { WorkflowType, BillingModel, WoSource, PmoPhase } from '@/lib/sec-workflow'

export interface Props {
  project: Project | null
  onClose: () => void
  onSave: (data: Partial<Project>) => Promise<void>
}

const DEFAULT_TYPES = [
  { code: '801', name: 'مشاريع الربط الكهربائي 801' },
  { code: '802', name: 'مشاريع التوزيع 802' },
  { code: '405', name: 'مشاريع كهرباء 405' },
  { code: '441', name: 'مشاريع المحولات 441' },
  { code: 'O&M', name: 'صيانة وتشغيل O&M' },
]

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px'
}

const ENGINEERING_TITLES = ['مهندس', 'مدير مشروع', 'مهندس مشروع', 'مهندس كهرباء', 'مهندس ميداني', 'مشرف', 'مشرف مشروع']

export default function ProjectModal({ project, onClose, onSave }: Props) {
  const { tenant, activeBranch } = useStore()
  const [saving,    setSaving]   = useState(false)
  const [clients,   setClients]  = useState<{ id: number; name: string; vat_number?: string }[]>([])
  const [types,     setTypes]    = useState<{ code: string; name: string }[]>([])
  const [engineers, setEngineers]= useState<{ id: number; name: string; job_title?: string }[]>([])
  const [teams,     setTeams]    = useState<{ id: number; name: string; lead_id?: number | null }[]>([])

  const [form, setForm] = useState({
    code:            project?.code                                    || '',
    name:            project?.name                                    || '',
    client_id:       (project as any)?.client_id ? String((project as any).client_id) : '',
    type:            project?.type                                    || '',
    status:          project?.status                                  || 'تحت التخطيط',
    workflow_type:   (project as any)?.workflow_type                  || 'FULL_SEC' as WorkflowType,
    billing_model:   (project as any)?.billing_model                  || 'SPLIT_50_50' as BillingModel,
    pmo_phase:       (project as any)?.pmo_phase                      || '1_RECEIPT' as PmoPhase,
    wo_number:       (project as any)?.wo_number                      || '',
    wo_source:       (project as any)?.wo_source                      || 'UDS' as WoSource,
    sec_contract_no: (project as any)?.sec_contract_no                || '4400023458',
    team_id:         (project as any)?.team_id ? String((project as any).team_id) : '',
    engineer:        project?.engineer                                || '',
    estimated_value: (project as any)?.estimated_value?.toString()   || (project as any)?.value?.toString() || '',
    actual_value:    (project as any)?.actual_value?.toString()      || '',
    progress:        project?.progress                                ?? 0,
    start_date:      project?.start_date                              || '',
    end_date:        project?.end_date                                || '',
    location:        (project as any)?.location                      || '',
    description:     (project as any)?.description                   || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handleWorkflowChange(wf: WorkflowType) {
    const phase = defaultPmoPhase(wf)
    setForm(f => ({
      ...f,
      workflow_type: wf,
      billing_model: defaultBillingModel(wf),
      wo_source: defaultWoSource(wf),
      pmo_phase: phase,
      status: statusForPhase(phase),
      sec_contract_no: wf === 'FULL_SEC' ? '4400023458' : f.sec_contract_no,
      type: wf.startsWith('O&M') ? 'O&M' : f.type,
    }))
  }

  const phaseOptions = form.workflow_type === 'FULL_SEC' ? PMO_PHASES_FULL : PMO_PHASES_OM

  const showActualValue = ['قيد الإغلاق', 'مكتمل'].includes(form.status)

  useEffect(() => {
    if (!tenant) return

    supabase.from('hr_employees')
      .select('id, name, job_title')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const all = data || []
        const eng = all.filter(e => ENGINEERING_TITLES.some(t => (e.job_title || '').includes(t)))
        setEngineers(eng.length > 0 ? eng : all)
      })

    if (activeBranch) {
      supabase.from('teams')
        .select('id, name, lead_id')
        .eq('tenant_id', tenant.id)
        .eq('branch_id', activeBranch.id)
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => setTeams(data || []))
    }

    supabase.from('finance_clients')
      .select('id, name, vat_number')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setClients(data || []))

    // جلب أنواع المشاريع
    supabase.from('project_types')
      .select('code, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setTypes(data && data.length > 0 ? data : DEFAULT_TYPES))
  }, [tenant?.id, activeBranch?.id])

  function handleTeamChange(teamId: string) {
    set('team_id', teamId)
    if (!teamId) return
    const team = teams.find(t => t.id === Number(teamId))
    if (team?.lead_id) {
      const lead = engineers.find(e => e.id === team.lead_id)
      if (lead) set('engineer', lead.name)
    }
  }

  const selectedClient = clients.find(c => c.id === Number(form.client_id))
  const selectedTeam = teams.find(t => t.id === Number(form.team_id))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('اسم المشروع مطلوب'); return }
    if (!form.client_id)   { toast.error('العميل إلزامي — اختر عميلاً من القائمة'); return }
    setSaving(true)
    await onSave({
      ...(project ? {
        id: project.id, stages: project.stages,
        attachments: project.attachments, history: project.history,
      } : {}),
      code:            form.code            || undefined,
      name:            form.name.trim(),
      client_id:       Number(form.client_id),
      client_name:     selectedClient?.name,
      type:            form.type            || undefined,
      status:          form.status,
      workflow_type:   form.workflow_type,
      billing_model:   form.billing_model,
      pmo_phase:       form.pmo_phase,
      wo_number:       form.wo_number       || undefined,
      wo_source:       form.wo_source,
      sec_contract_no: form.sec_contract_no || undefined,
      team_id:         form.team_id ? Number(form.team_id) : null,
      lead_id:         selectedTeam?.lead_id || null,
      engineer:        form.engineer        || undefined,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : undefined,
      actual_value:    form.actual_value    ? parseFloat(form.actual_value)    : undefined,
      progress:        form.progress,
      start_date:      form.start_date      || undefined,
      end_date:        form.end_date        || undefined,
      location:        form.location        || undefined,
      description:     form.description     || undefined,
    } as any)
    setSaving(false)
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-box"
        style={{ maxWidth: '640px', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>
            {project ? '✏️ تعديل مشروع' : '➕ مشروع جديد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* رقم + نوع */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div>
                <label style={lbl}>رقم المشروع</label>
                <input value={form.code} onChange={e => set('code', e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  className="input" placeholder="2024-001" />
              </div>
              <div>
                <label style={lbl}>نوع المشروع</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                  <option value="">— اختر النوع —</option>
                  {types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* اسم المشروع */}
            <div>
              <label style={lbl}>اسم المشروع <span style={{ color: '#c81e1e' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                className="input" placeholder="اسم المشروع التفصيلي" required />
            </div>

            {/* مسار SEC */}
            <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '14px', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0369a1', marginBottom: '10px' }}>⚡ مسار العمل — SEC</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>نوع المسار</label>
                  <select value={form.workflow_type} onChange={e => handleWorkflowChange(e.target.value as WorkflowType)} className="select">
                    {WORKFLOW_TYPES.map(w => (
                      <option key={w.id} value={w.id}>{w.icon} {w.label}</option>
                    ))}
                  </select>
                  <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text3)' }}>
                    {WORKFLOW_TYPES.find(w => w.id === form.workflow_type)?.desc}
                  </p>
                </div>
                <div>
                  <label style={lbl}>مرحلة PMO</label>
                  <select
                    value={form.pmo_phase}
                    onChange={e => {
                      const phase = e.target.value as PmoPhase
                      setForm(f => ({ ...f, pmo_phase: phase, status: statusForPhase(phase) }))
                    }}
                    className="select"
                  >
                    {phaseOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>نموذج التحصيل</label>
                  <select value={form.billing_model} onChange={e => set('billing_model', e.target.value)} className="select">
                    {BILLING_MODELS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>رقم أمر العمل (WO)</label>
                  <input value={form.wo_number} onChange={e => set('wo_number', e.target.value)}
                    className="input" dir="ltr" placeholder="SAP / UDS" />
                </div>
                <div>
                  <label style={lbl}>مصدر WO</label>
                  <select value={form.wo_source} onChange={e => set('wo_source', e.target.value)} className="select">
                    {WO_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                {form.workflow_type === 'FULL_SEC' && (
                  <div>
                    <label style={lbl}>رقم العقد الإطاري</label>
                    <input value={form.sec_contract_no} onChange={e => set('sec_contract_no', e.target.value)}
                      className="input" dir="ltr" />
                  </div>
                )}
              </div>
            </div>

            {/* العميل */}
            <div style={{ background: '#fef9f0', borderRadius: '12px', padding: '14px', border: '2px solid #fde68a' }}>
              <label style={{ ...lbl, color: '#92400e' }}>
                العميل <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              {clients.length === 0 ? (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.82rem', color: '#c81e1e', border: '1px solid #fecaca' }}>
                  ⚠️ لا يوجد عملاء — أضف العميل أولاً من <strong>المبيعات ← العملاء</strong>
                </div>
              ) : (
                <>
                  <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="select">
                    <option value="">— اختر العميل —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {selectedClient && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '0.78rem', color: '#92400e' }}>
                      {selectedClient.vat_number && <span>🔢 الرقم الضريبي: <strong>{selectedClient.vat_number}</strong></span>}
                      <span style={{ color: '#0ea77b', fontSize: '0.72rem' }}>✅ الاسم مطابق لبيانات الفواتير</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* الفريق + المهندس */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>فريق العمل</label>
                {teams.length === 0 ? (
                  <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.8rem', color: '#1a56db', border: '1px solid #bfdbfe' }}>
                    أنشئ فرقاً من <strong>إدارة الفرق</strong>
                  </div>
                ) : (
                  <select value={form.team_id} onChange={e => handleTeamChange(e.target.value)} className="select">
                    <option value="">— بدون فريق —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label style={lbl}>قائد / مهندس المشروع</label>
                {engineers.length === 0 ? (
                  <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', border: '1px solid #fde68a' }}>
                    ⚠️ لا يوجد موظفون — أضفهم من HR
                  </div>
                ) : (
                  <select value={form.engineer} onChange={e => set('engineer', e.target.value)} className="select">
                    <option value="">— اختر —</option>
                    {engineers.map(m => (
                      <option key={m.id} value={m.name}>
                        {m.name}{m.job_title ? ` — ${m.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* الحالة */}
            <div>
              <label style={lbl}>حالة المشروع</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['تحت التخطيط', 'قيد التنفيذ', 'قيد الإغلاق', 'مكتمل', 'متأخر', 'موقوف', 'ملغي'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* القيمة التقديرية + الفعلية (أو الموقع) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>
                  القيمة التقديرية (ريال)
                  <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#9ca3af', marginRight: '5px' }}>تُحدد عند الإنشاء</span>
                </label>
                <input
                  type="number"
                  value={form.estimated_value}
                  onChange={e => set('estimated_value', e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" dir="ltr" placeholder="0.00" min="0"
                />
              </div>

              {showActualValue ? (
                <div>
                  <label style={lbl}>
                    القيمة الفعلية (ريال)
                    <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#0ea77b', marginRight: '5px' }}>مرحلة الإغلاق</span>
                  </label>
                  <input
                    type="number"
                    value={form.actual_value}
                    onChange={e => set('actual_value', e.target.value)}
                    onMouseDown={e => e.stopPropagation()}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" dir="ltr" placeholder="0.00" min="0"
                    style={{ borderColor: '#86efac', background: '#f0fdf4' }}
                  />
                </div>
              ) : (
                <div>
                  <label style={lbl}>موقع المشروع</label>
                  <input value={form.location} onChange={e => set('location', e.target.value)}
                    onMouseDown={e => e.stopPropagation()}
                    className="input" placeholder="المدينة / الحي" />
                </div>
              )}
            </div>

            {/* موقع المشروع — صف منفصل عند الإغلاق */}
            {showActualValue && (
              <div>
                <label style={lbl}>موقع المشروع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  className="input" placeholder="المدينة / الحي" />
              </div>
            )}

            {/* تنبيه الفرق */}
            {showActualValue && form.estimated_value && form.actual_value && (() => {
              const diff = parseFloat(form.actual_value) - parseFloat(form.estimated_value)
              if (isNaN(diff)) return null
              const pct = ((diff / parseFloat(form.estimated_value)) * 100).toFixed(1)
              return (
                <div style={{
                  padding: '8px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: diff > 0 ? '#fef2f2' : diff < 0 ? '#f0fdf4' : '#f9fafb',
                  color:      diff > 0 ? '#c81e1e' : diff < 0 ? '#0ea77b' : '#9ca3af',
                  border:     `1px solid ${diff > 0 ? '#fca5a5' : diff < 0 ? '#86efac' : '#e5e7eb'}`
                }}>
                  {diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️'}
                  الفرق: {diff > 0 ? '+' : ''}{diff.toLocaleString('ar-SA', { minimumFractionDigits: 0 })} ريال ({diff > 0 ? '+' : ''}{pct}%)
                </div>
              )
            })()}

            {/* نسبة الإنجاز */}
            <div>
              <label style={lbl}>نسبة الإنجاز الحالية</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="range" value={form.progress}
                  onChange={e => set('progress', parseInt(e.target.value))}
                  style={{ flex: 1 }} min="0" max="100" step="5" />
                <span style={{ fontWeight: 700, color: '#1a56db', fontSize: '1.1rem', minWidth: '48px', textAlign: 'center' }}>
                  {form.progress}%
                </span>
              </div>
              <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px', width: `${form.progress}%`, transition: 'width 0.2s',
                  background: form.progress >= 100 ? '#0ea77b' : form.progress >= 60 ? '#1a56db' : '#e6820a'
                }} />
              </div>
            </div>

            {/* التواريخ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>تاريخ البداية</label>
                <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" />
              </div>
              <div>
                <label style={lbl}>تاريخ التسليم</label>
                <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="input" />
              </div>
            </div>

            {/* الوصف */}
            <div>
              <label style={lbl}>وصف المشروع</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                className="input" style={{ minHeight: '70px', resize: 'none' }}
                placeholder="نبذة مختصرة عن نطاق العمل..." />
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving || !form.client_id} className="btn btn-primary">
              {saving
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Save style={{ width: '15px', height: '15px' }} />}
              {project ? 'حفظ التعديلات' : 'إضافة المشروع'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
