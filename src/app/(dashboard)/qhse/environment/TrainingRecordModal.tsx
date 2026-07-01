'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'

interface Props {
  trainings: any[]
  employees: any[]
  onClose: () => void
  onSave: () => void
}

export default function TrainingRecordModal({ trainings, employees, onClose, onSave }: Props) {
  const { tenant, activeBranch } = useStore()

  const [form, setForm] = useState({
    training_id:   '',
    employee_id:   '',
    training_date: '',
    expiry_date:   '',
    result:        'ناجح',
    cert_number:   '',
    provider:      '',
    score:         '',
    notes:         '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.training_id || !form.employee_id || !form.training_date) {
      toast.error('يرجى تعبئة الدورة والموظف والتاريخ'); return
    }
    setSaving(true)

    // احتساب تاريخ الانتهاء تلقائياً إن لم يُدخَل
    const training = trainings.find((t: any) => t.id === Number(form.training_id))
    let expiry = form.expiry_date
    if (!expiry && training) {
      const d = new Date(form.training_date)
      d.setMonth(d.getMonth() + training.validity_months)
      expiry = d.toISOString().split('T')[0]
    }

    const { error } = await supabase.from('qhse_training_records').insert({
      ...form,
      expiry_date:  expiry,
      training_id:  Number(form.training_id),
      employee_id:  Number(form.employee_id),
      score:        form.score ? Number(form.score) : null,
      tenant_id:    tenant?.id,
      branch_id:    activeBranch?.id,
    })
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم تسجيل الحضور')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>📚 تسجيل حضور دورة تدريبية</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الدورة *</label>
            <select value={form.training_id} onChange={e => set('training_id', e.target.value)} className="select">
              <option value="">— اختر الدورة —</option>
              {trainings.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الموظف *</label>
            <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="select">
              <option value="">— اختر الموظف —</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}{e.department ? ` — ${e.department}` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ التدريب *</label>
              <input type="date" value={form.training_date} onChange={e => set('training_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>
                تاريخ الانتهاء
                <span style={{ fontSize: 10, color: '#9ca3af', marginRight: 4 }}>(يُحتسب تلقائياً)</span>
              </label>
              <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>النتيجة</label>
              <select value={form.result} onChange={e => set('result', e.target.value)} className="select">
                <option value="ناجح">ناجح</option>
                <option value="راسب">راسب</option>
                <option value="غائب">غائب</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الدرجة</label>
              <input type="number" value={form.score} onChange={e => set('score', e.target.value)}
                className="input" placeholder="من 100" min={0} max={100} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>رقم الشهادة</label>
              <input value={form.cert_number} onChange={e => set('cert_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الجهة المقدمة</label>
              <input value={form.provider} onChange={e => set('provider', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input"
              style={{ minHeight: 60, resize: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? '...' : <><Save size={14} /> حفظ</>}
          </button>
        </div>
      </div>
    </div>
  )
}
