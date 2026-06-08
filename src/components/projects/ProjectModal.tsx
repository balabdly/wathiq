'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { X, Save } from 'lucide-react'
import type { Project } from '@/types'
import toast from 'react-hot-toast'

export interface Props {
  project: Project | null
  onClose: () => void
  onSave: (data: Partial<Project>) => Promise<void>
}

// أنواع المشاريع بأسماء واضحة
const PROJECT_TYPES = [
  { code: '801',   name: 'مشاريع الربط الكهربائي 801' },
  { code: '802',   name: 'مشاريع التوزيع 802' },
  { code: '405',   name: 'مشاريع كهرباء 405' },
  { code: '441',   name: 'مشاريع المحولات 441' },
  { code: '442',   name: 'محطات التوزيع 442' },
  { code: '805',   name: 'مشاريع النقل 805' },
  { code: 'O&M',   name: 'صيانة وتشغيل O&M' },
  { code: 'EPC',   name: 'هندسة وتوريد وتنفيذ EPC' },
  { code: 'CIVIL', name: 'أعمال مدنية' },
  { code: 'OTHER', name: 'أخرى' },
]

const CLIENTS = [
  'شركة السعودية للكهرباء',
  'أرامكو السعودية',
  'وزارة الإسكان',
  'أمانة منطقة الرياض',
  'وزارة الصحة',
  'وزارة التعليم',
  'وزارة النقل',
  'الهيئة الملكية للجبيل',
  'شركة معادن',
  'سابك',
  'القطاع الخاص',
  'أخرى',
]

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px'
}

export default function ProjectModal({ project, onClose, onSave }: Props) {
  const { employees } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code:        '',
    name:        '',
    type:        '',
    client_name: '',
    status:      'تحت التخطيط',
    engineer:    '',
    value:       '',
    progress:    0,
    start_date:  '',
    end_date:    '',
    location:    '',
    description: '',
    notes:       '',
  })

  useEffect(() => {
    if (project) {
      setForm({
        code:        project.code              || '',
        name:        project.name              || '',
        type:        project.type              || '',
        client_name: (project as any).client_name || (project as any).client || '',
        status:      project.status            || 'تحت التخطيط',
        engineer:    project.engineer          || '',
        value:       project.value?.toString() || '',
        progress:    project.progress          ?? 0,
        start_date:  project.start_date        || '',
        end_date:    project.end_date          || '',
        location:    (project as any).location    || '',
        description: (project as any).description || '',
        notes:       (project as any).notes       || '',
      })
    }
  }, [project])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const engineers = employees.filter(e =>
    ['مدير مشروع', 'مدير عام', 'مهندس مدني', 'مشرف كهربائي', 'مهندس'].includes(e.role || '')
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('اسم المشروع مطلوب'); return }
    if (!form.type)        { toast.error('نوع المشروع مطلوب'); return }
    setSaving(true)
    try {
      await onSave({
        ...(project ? {
          id:          project.id,
          stages:      project.stages,
          attachments: project.attachments,
          history:     project.history,
        } : {}),
        code:        form.code        || undefined,
        name:        form.name.trim(),
        type:        form.type,
        status:      form.status,
        engineer:    form.engineer    || undefined,
        value:       form.value ? parseFloat(form.value) : undefined,
        progress:    form.progress,
        start_date:  form.start_date  || undefined,
        end_date:    form.end_date    || undefined,
        // حقول جديدة
        client_name: form.client_name || undefined,
        location:    form.location    || undefined,
        description: form.description || undefined,
        notes:       form.notes       || undefined,
      } as any)
    } catch (err) {
      toast.error('حدث خطأ في الحفظ')
    }
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

            {/* رقم + نوع المشروع */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div>
                <label style={lbl}>رقم المشروع</label>
                <input value={form.code} onChange={e => set('code', e.target.value)}
                  className="input" placeholder="مثال: 2024-001" />
              </div>
              <div>
                <label style={lbl}>نوع المشروع <span style={{ color: '#c81e1e' }}>*</span></label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                  <option value="">— اختر النوع —</option>
                  {PROJECT_TYPES.map(t => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* اسم المشروع */}
            <div>
              <label style={lbl}>اسم المشروع <span style={{ color: '#c81e1e' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="input" placeholder="اسم المشروع التفصيلي" required />
            </div>

            {/* الجهة المنفذة */}
            <div>
              <label style={lbl}>الجهة المنفذة / العميل</label>
              <select value={form.client_name} onChange={e => set('client_name', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* الحالة + المهندس */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>حالة المشروع</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['تحت التخطيط', 'قيد التنفيذ', 'متأخر', 'مكتمل', 'موقوف'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>مدير / مهندس المشروع</label>
                {engineers.length > 0 ? (
                  <select value={form.engineer} onChange={e => set('engineer', e.target.value)} className="select">
                    <option value="">— اختر —</option>
                    {engineers.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                ) : (
                  <input value={form.engineer} onChange={e => set('engineer', e.target.value)}
                    className="input" placeholder="اسم المهندس المسؤول" />
                )}
              </div>
            </div>

            {/* القيمة + الموقع */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>قيمة العقد (ريال)</label>
                <input type="number" value={form.value} onChange={e => set('value', e.target.value)}
                  className="input" dir="ltr" placeholder="0.00" min="0" />
              </div>
              <div>
                <label style={lbl}>موقع المشروع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
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
              {/* شريط مرئي */}
              <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px',
                  width: `${form.progress}%`, transition: 'width 0.2s',
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
                className="input" style={{ minHeight: '70px', resize: 'none' }}
                placeholder="نبذة مختصرة عن نطاق العمل..." />
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
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
