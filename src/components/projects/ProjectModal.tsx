'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { X, Save, Plus, Trash2 } from 'lucide-react'
import type { Project } from '@/types'
import toast from 'react-hot-toast'

export interface Props {
  project: Project | null
  onClose: () => void
  onSave: (data: Partial<Project>) => Promise<void>
}

// أنواع افتراضية إن لم يكن هناك أنواع في قاعدة البيانات
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

export default function ProjectModal({ project, onClose, onSave }: Props) {
  const { employees, tenant } = useStore()
  const [saving,   setSaving]  = useState(false)
  const [clients,  setClients] = useState<{ id: number; name: string; vat_number?: string }[]>([])
  const [types,    setTypes]   = useState<{ code: string; name: string }[]>([])
  const [managers, setManagers]= useState<{ id: number; name: string }[]>([])

  const [form, setForm] = useState({
    code:        project?.code              || '',
    name:        project?.name              || '',
    client_id:   (project as any)?.client_id ? String((project as any).client_id) : '',
    type:        project?.type              || '',
    status:      project?.status            || 'تحت التخطيط',
    engineer:    project?.engineer          || '',
    value:       project?.value?.toString() || '',
    progress:    project?.progress          ?? 0,
    start_date:  project?.start_date        || '',
    end_date:    project?.end_date          || '',
    location:    (project as any)?.location    || '',
    description: (project as any)?.description || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!tenant) return
    // جلب مدراء المشاريع من hr_employees
    supabase.from('hr_employees')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .eq('job_title', 'مدير مشروع')
      .order('name')
      .then(({ data }) => setManagers(data || []))

    // جلب العملاء من finance_clients
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
  }, [tenant?.id])

  const selectedClient = clients.find(c => c.id === Number(form.client_id))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim())  { toast.error('اسم المشروع مطلوب'); return }
    if (!form.client_id)    { toast.error('العميل إلزامي — اختر عميلاً من قائمة المبيعات'); return }
    setSaving(true)
    await onSave({
      ...(project ? {
        id: project.id, stages: project.stages,
        attachments: project.attachments, history: project.history,
      } : {}),
      code:        form.code        || undefined,
      name:        form.name.trim(),
      client_id:   Number(form.client_id),
      client_name: selectedClient?.name,
      type:        form.type        || undefined,
      status:      form.status,
      engineer:    form.engineer    || undefined,
      value:       form.value ? parseFloat(form.value) : undefined,
      progress:    form.progress,
      start_date:  form.start_date  || undefined,
      end_date:    form.end_date    || undefined,
      location:    (form as any).location    || undefined,
      description: (form as any).description || undefined,
    } as any)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '90vh' }}>
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
                  className="input" placeholder="2024-001" />
              </div>
              <div>
                <label style={lbl}>نوع المشروع</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                  <option value="">— اختر النوع —</option>
                  {types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
                {types.length === 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#e6820a', marginTop: '4px' }}>
                    ⚠️ لا توجد أنواع — أضف من زر "إضافة نوع"
                  </div>
                )}
              </div>
            </div>

            {/* اسم المشروع */}
            <div>
              <label style={lbl}>اسم المشروع <span style={{ color: '#c81e1e' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="input" placeholder="اسم المشروع التفصيلي" required />
            </div>

            {/* العميل — إلزامي */}
            <div style={{ background: '#fef9f0', borderRadius: '12px', padding: '14px', border: '2px solid #fde68a' }}>
              <label style={{ ...lbl, color: '#92400e' }}>
                العميل <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              {clients.length === 0 ? (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.82rem', color: '#c81e1e', border: '1px solid #fecaca' }}>
                  ⚠️ لا يوجد عملاء — أضف العميل أولاً من <strong>المبيعات ← العملاء</strong> ثم عد لإضافة المشروع
                </div>
              ) : (
                <>
                  <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="select">
                    <option value="">— اختر العميل —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
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

            {/* الحالة + المهندس */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>حالة المشروع</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['تحت التخطيط', 'قيد التنفيذ', 'قيد الإغلاق', 'مكتمل', 'متأخر', 'موقوف', 'ملغي'].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>مدير المشروع</label>
                {managers.length === 0 ? (
                  <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', border: '1px solid #fde68a' }}>
                    ⚠️ لا يوجد مدراء مشاريع — أضفهم من <strong>الموارد البشرية</strong> بمسمى "مدير مشروع"
                  </div>
                ) : (
                  <select value={form.engineer} onChange={e => set('engineer', e.target.value)} className="select">
                    <option value="">— اختر مدير المشروع —</option>
                    {managers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* القيمة + الموقع */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>قيمة العقد (ريال)</label>
                <input type="number" value={form.value} onChange={e => set('value', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" dir="ltr" placeholder="0.00" min="0" />
              </div>
              <div>
                <label style={lbl}>موقع المشروع</label>
                <input value={(form as any).location || ''} onChange={e => set('location', e.target.value)}
                  className="input" placeholder="المدينة / الحي" />
              </div>
            </div>

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
              <textarea value={(form as any).description || ''} onChange={e => set('description', e.target.value)}
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
