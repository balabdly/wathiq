'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Employee = { id: number; name: string; job_title?: string }
type Props = { employees: Employee[]; editItem?: any; onClose: () => void; onSave: () => void }

export default function EnvTrainingModal({ employees, editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id:   editItem?.employee_id   || '',
    employee_name: editItem?.employee_name || '',
    course_name:   editItem?.course_name   || '',
    iso_ref:       editItem?.iso_ref       || '',
    training_date: editItem?.training_date || new Date().toISOString().split('T')[0],
    expiry_date:   editItem?.expiry_date   || '',
    result:        editItem?.result        || 'ناجح',
    provider:      editItem?.provider      || '',
    cert_number:   editItem?.cert_number   || '',
    notes:         editItem?.notes         || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const COURSES = [
    { name: 'التوعية البيئية ISO 14001', ref: 'ISO 14001:2015 — الفقرة 7.2' },
    { name: 'إدارة النفايات الخطرة',     ref: 'ISO 14001:2015 — الفقرة A.6.1.2' },
    { name: 'التعامل مع المواد الكيميائية', ref: 'GHS — نظام التصنيف الأممي' },
    { name: 'الاستجابة لحوادث التسرب',  ref: 'ISO 14001:2015 — الفقرة 8.2' },
    { name: 'محاسبة الغازات الدفيئة',   ref: 'ISO 14064-1' },
    { name: 'تقارير GRI البيئية',        ref: 'GRI Standards 2021' },
  ]

  async function handleSave() {
    if (!form.employee_name || !form.course_name || !form.training_date) {
      toast.error('الموظف والدورة والتاريخ مطلوبة'); return
    }
    setSaving(true)
    const payload = {
      ...form,
      tenant_id: tenant?.id,
      employee_id: form.employee_id ? Number(form.employee_id) : null,
    }
    const { error } = editItem
      ? await supabase.from('env_training').update(payload).eq('id', editItem.id)
      : await supabase.from('env_training').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم الحفظ')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>📚 {editItem ? 'تعديل' : 'تسجيل'} تدريب بيئي</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الموظف *</label>
            <select value={form.employee_id} onChange={e => {
              const emp = employees.find(x => x.id === Number(e.target.value))
              set('employee_id', e.target.value)
              if (emp) set('employee_name', emp.name)
            }} className="select">
              <option value="">— اختر الموظف —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الدورة التدريبية *</label>
            <select value={form.course_name} onChange={e => {
              const c = COURSES.find(x => x.name === e.target.value)
              set('course_name', e.target.value)
              if (c) set('iso_ref', c.ref)
            }} className="select">
              <option value="">— اختر —</option>
              {COURSES.map(c => <option key={c.name}>{c.name}</option>)}
            </select>
          </div>
          {form.iso_ref && (
            <div style={{ padding: '6px 12px', background: '#eff6ff', borderRadius: 6, fontSize: '0.72rem', color: '#1a56db' }}>
              📐 {form.iso_ref}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ التدريب *</label>
              <input type="date" value={form.training_date} onChange={e => set('training_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ انتهاء الصلاحية</label>
              <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>النتيجة</label>
              <select value={form.result} onChange={e => set('result', e.target.value)} className="select">
                <option>ناجح</option><option>راسب</option><option>غائب</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الجهة المقدِّمة</label>
              <input value={form.provider} onChange={e => set('provider', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>رقم الشهادة</label>
            <input value={form.cert_number} onChange={e => set('cert_number', e.target.value)} className="input" dir="ltr" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0891b2' }}>
            {saving ? '...' : <><Save size={14} /> حفظ</>}
          </button>
        </div>
      </div>
    </div>
  )
}
