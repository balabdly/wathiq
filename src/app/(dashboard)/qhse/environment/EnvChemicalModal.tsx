'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Props = { editItem?: any; onClose: () => void; onSave: () => void }

export default function EnvChemicalModal({ editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:              editItem?.name              || '',
    chemical_formula:  editItem?.chemical_formula  || '',
    ghs_class:         editItem?.ghs_class         || '',
    ghs_hazard:        editItem?.ghs_hazard        || '',
    quantity:          editItem?.quantity          || '',
    unit:              editItem?.unit              || 'لتر',
    storage_location:  editItem?.storage_location  || '',
    supplier:          editItem?.supplier          || '',
    expiry_date:       editItem?.expiry_date       || '',
    msds_date:         editItem?.msds_date         || '',
    msds_status:       editItem?.msds_status       || 'محدّثة',
    storage_temp:      editItem?.storage_temp      || '',
    emergency_contact: editItem?.emergency_contact || '',
    status:            editItem?.status            || 'آمن',
    notes:             editItem?.notes             || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name || !form.quantity) { toast.error('اسم المادة والكمية مطلوبان'); return }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant?.id, quantity: Number(form.quantity) }
    const { error } = editItem
      ? await supabase.from('env_chemicals').update(payload).eq('id', editItem.id)
      : await supabase.from('env_chemicals').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم الحفظ')
    onSave()
  }

  const GHS_CLASSES = ['قابل للاشتعال','مسبب للتآكل','سام','مؤكسد','ضاغط','ضار بالبيئة','مسبب للانفجار','مشع','أخرى']

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 580 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>⚗️ {editItem ? 'تعديل' : 'إضافة'} مادة كيميائية</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: '0.76rem', color: '#1a56db' }}>
            📋 سجل MSDS — وفق نظام GHS الأممي لتصنيف المواد الكيميائية وتوسيمها
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>اسم المادة *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: حامض الكبريتيك" autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الصيغة الكيميائية</label>
              <input value={form.chemical_formula} onChange={e => set('chemical_formula', e.target.value)} className="input" dir="ltr" placeholder="H₂SO₄" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تصنيف GHS</label>
              <select value={form.ghs_class} onChange={e => set('ghs_class', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {GHS_CLASSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>بيان الخطورة (H-code)</label>
              <input value={form.ghs_hazard} onChange={e => set('ghs_hazard', e.target.value)} className="input" dir="ltr" placeholder="H314, H335" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الكمية المخزنة *</label>
              <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input" min={0} step="0.1" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الوحدة</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                {['لتر','كغ','طن','م³','وحدة'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>موقع التخزين</label>
              <input value={form.storage_location} onChange={e => set('storage_location', e.target.value)} className="input" placeholder="مخزن A-3" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ انتهاء المادة</label>
              <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ آخر تحديث MSDS</label>
              <input type="date" value={form.msds_date} onChange={e => set('msds_date', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>حالة MSDS</label>
              <select value={form.msds_status} onChange={e => set('msds_status', e.target.value)} className="select">
                <option>محدّثة</option><option>تحتاج تحديث</option><option>منتهية</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>درجة حرارة التخزين</label>
              <input value={form.storage_temp} onChange={e => set('storage_temp', e.target.value)} className="input" placeholder="15-25°C" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الحالة الأمنية</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                <option>آمن</option><option>يتطلب مراجعة</option><option>خطر</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>جهة الطوارئ / المورد</label>
            <input value={form.emergency_contact} onChange={e => set('emergency_contact', e.target.value)} className="input" />
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
