'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Props = { editItem?: any; onClose: () => void; onSave: () => void }

export default function EnvWasteModal({ editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date:             editItem?.date             || new Date().toISOString().split('T')[0],
    waste_type:       editItem?.waste_type       || '',
    classification:   editItem?.classification   || 'غير خطرة',
    quantity_ton:     editItem?.quantity_ton     || '',
    disposal_method:  editItem?.disposal_method  || '',
    receiver:         editItem?.receiver         || '',
    license_no:       editItem?.license_no       || '',
    license_expiry:   editItem?.license_expiry   || '',
    cost:             editItem?.cost             || 0,
    notes:            editItem?.notes            || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.waste_type || !form.quantity_ton || !form.disposal_method) {
      toast.error('نوع النفاية والكمية وطريقة التخلص مطلوبة'); return
    }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant?.id, quantity_ton: Number(form.quantity_ton), cost: Number(form.cost) }
    const { error } = editItem
      ? await supabase.from('env_waste').update(payload).eq('id', editItem.id)
      : await supabase.from('env_waste').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم الحفظ')
    onSave()
  }

  const TYPES = ['نفايات معدنية','نفايات كيميائية سائلة','زيوت مستعملة','بلاستيك ومواد تعبئة','نفايات إلكترونية','خشب وورق','نفايات خرسانية','نفايات بيولوجية','أخرى']
  const METHODS = ['إعادة تدوير','دفن صحي','حرق محكوم','معالجة كيميائية','تكرير','تفكيك آمن','أخرى']

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>♻️ {editItem ? 'تعديل' : 'تسجيل'} سجل نفايات</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>نوع النفاية *</label>
            <select value={form.waste_type} onChange={e => set('waste_type', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: 'غير خطرة', color: '#0ea77b', bg: '#ecfdf5' },
              { val: 'محدودة الخطورة', color: '#e6820a', bg: '#fffbeb' },
              { val: 'خطرة', color: '#c81e1e', bg: '#fef2f2' },
            ].map(opt => (
              <button key={opt.val} type="button" onClick={() => set('classification', opt.val)}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                  borderColor: form.classification === opt.val ? opt.color : 'var(--border)',
                  background: form.classification === opt.val ? opt.bg : 'white',
                  color: form.classification === opt.val ? opt.color : 'var(--text3)' }}>
                {opt.val}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الكمية (طن) *</label>
              <input type="number" step="0.01" value={form.quantity_ton} onChange={e => set('quantity_ton', e.target.value)} className="input" min={0} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التاريخ</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>طريقة التخلص *</label>
            <select value={form.disposal_method} onChange={e => set('disposal_method', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>جهة الاستلام</label>
              <input value={form.receiver} onChange={e => set('receiver', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>رقم الترخيص</label>
              <input value={form.license_no} onChange={e => set('license_no', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>انتهاء الترخيص</label>
              <input type="date" value={form.license_expiry} onChange={e => set('license_expiry', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التكلفة (ريال)</label>
              <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} className="input" min={0} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: 50, resize: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#059669' }}>
            {saving ? '...' : <><Save size={14} /> حفظ</>}
          </button>
        </div>
      </div>
    </div>
  )
}
