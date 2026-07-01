'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Props = { editItem?: any; onClose: () => void; onSave: () => void }

export default function EnvWaterModal({ editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const [form, setForm] = useState({
    month:          editItem?.month          || MONTHS[now.getMonth()],
    year:           editItem?.year           || now.getFullYear(),
    source:         editItem?.source         || '',
    consumption_m3: editItem?.consumption_m3 || '',
    recycled_m3:    editItem?.recycled_m3    || 0,
    treated_m3:     editItem?.treated_m3     || 0,
    target_m3:      editItem?.target_m3      || '',
    cost:           editItem?.cost           || 0,
    notes:          editItem?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.source || !form.consumption_m3) { toast.error('المصدر والكمية مطلوبان'); return }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant?.id,
      year: Number(form.year),
      consumption_m3: Number(form.consumption_m3),
      recycled_m3: Number(form.recycled_m3),
      treated_m3: Number(form.treated_m3),
      target_m3: form.target_m3 ? Number(form.target_m3) : null,
      cost: Number(form.cost) }
    const { error } = editItem
      ? await supabase.from('env_water').update(payload).eq('id', editItem.id)
      : await supabase.from('env_water').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم الحفظ')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 500 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>💧 {editItem ? 'تعديل' : 'تسجيل'} استهلاك مياه — GRI 303</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>مصدر الاستهلاك *</label>
            <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {['العمليات الإنتاجية','الغسيل والتنظيف','المرافق والإدارية','التبريد والتكييف','الري','أخرى'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الشهر</label>
              <select value={form.month} onChange={e => set('month', e.target.value)} className="select">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>السنة</label>
              <input type="number" value={form.year} onChange={e => set('year', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الاستهلاك الكلي (م³) *</label>
              <input type="number" step="0.1" value={form.consumption_m3} onChange={e => set('consumption_m3', e.target.value)} className="input" min={0} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الهدف (م³)</label>
              <input type="number" step="0.1" value={form.target_m3} onChange={e => set('target_m3', e.target.value)} className="input" min={0} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المُعاد تدويرها (م³)</label>
              <input type="number" step="0.1" value={form.recycled_m3} onChange={e => set('recycled_m3', e.target.value)} className="input" min={0} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المعالجة قبل الصرف (م³)</label>
              <input type="number" step="0.1" value={form.treated_m3} onChange={e => set('treated_m3', e.target.value)} className="input" min={0} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التكلفة (ريال)</label>
            <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} className="input" min={0} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: 50, resize: 'none' }} />
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
