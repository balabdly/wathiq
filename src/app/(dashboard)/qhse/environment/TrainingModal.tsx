'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'

interface Props {
  onClose: () => void
  onSave: () => void
}

export default function TrainingModal({ onClose, onSave }: Props) {
  const { tenant, activeBranch } = useStore()

  const [form, setForm] = useState({
    name:            '',
    code:            '',
    category:        'safety',
    duration_days:   1,
    validity_months: 24,
    is_mandatory:    true,
    provider:        '',
    notes:           '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم الدورة'); return }
    setSaving(true)
    const { error } = await supabase.from('qhse_trainings').insert({
      ...form, tenant_id: tenant?.id, branch_id: activeBranch?.id,
    })
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم إضافة الدورة')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>📚 إضافة دورة تدريبية</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>اسم الدورة *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input"
                placeholder="مكافحة الحرائق" autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>كود الدورة</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} className="input" dir="ltr" placeholder="HSE-001" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التصنيف</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                <option value="safety">سلامة عامة</option>
                <option value="fire">مكافحة الحرائق</option>
                <option value="first_aid">إسعافات أولية</option>
                <option value="environment">بيئة</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>مدة الدورة (يوم)</label>
              <input type="number" value={form.duration_days} onChange={e => set('duration_days', Number(e.target.value))} className="input" min={1} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>صلاحية الشهادة (شهر)</label>
              <input type="number" value={form.validity_months} onChange={e => set('validity_months', Number(e.target.value))} className="input" min={1} />
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>السلامة ومكافحة الحرائق = 24 شهر</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الجهة المقدمة</label>
              <input value={form.provider} onChange={e => set('provider', e.target.value)} className="input" />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_mandatory} onChange={e => set('is_mandatory', e.target.checked)} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>دورة إلزامية لجميع الموظفين</span>
          </label>
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
