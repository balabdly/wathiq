'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Props = { editItem?: any; onClose: () => void; onSave: () => void }

export default function EnvEmissionsModal({ editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const [form, setForm] = useState({
    month:    editItem?.month    || MONTHS[now.getMonth()],
    year:     editItem?.year     || now.getFullYear(),
    source:   editItem?.source   || '',
    scope:    editItem?.scope    || 'S1',
    unit:     editItem?.unit     || 'طن CO₂',
    quantity: editItem?.quantity || '',
    target:   editItem?.target   || '',
    notes:    editItem?.notes    || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.source || !form.quantity) { toast.error('مصدر الانبعاث والكمية مطلوبان'); return }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant?.id, year: Number(form.year), quantity: Number(form.quantity), target: form.target ? Number(form.target) : null }
    const { error } = editItem
      ? await supabase.from('env_emissions').update(payload).eq('id', editItem.id)
      : await supabase.from('env_emissions').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم الحفظ')
    onSave()
  }

  const SOURCES = ['وقود ديزل — مركبات','وقود ديزل — مولدات','غاز طبيعي','كهرباء شبكة','نقل موردين','مشتريات','رحلات عمل','أخرى']

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 500 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>☁️ {editItem ? 'تعديل' : 'تسجيل'} انبعاث</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '8px 12px', background: '#f5f3ff', borderRadius: 8, fontSize: '0.76rem', color: '#7c3aed' }}>
            📐 وفق GHG Protocol — Scope 1 (مباشر) · Scope 2 (كهرباء) · Scope 3 (غير مباشر)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{val:'S1',label:'Scope 1 مباشر'},{val:'S2',label:'Scope 2 كهرباء'},{val:'S3',label:'Scope 3 غير مباشر'}].map(s => (
              <button key={s.val} type="button" onClick={() => set('scope', s.val)}
                style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit',
                  borderColor: form.scope === s.val ? '#7c3aed' : 'var(--border)',
                  background: form.scope === s.val ? '#f5f3ff' : 'white',
                  color: form.scope === s.val ? '#7c3aed' : 'var(--text3)' }}>
                {s.label}
              </button>
            ))}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>مصدر الانبعاث *</label>
            <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الوحدة</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                {['طن CO₂','كغ CO₂','طن CO₂e'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الكمية الفعلية *</label>
              <input type="number" step="0.1" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input" min={0} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الهدف (اختياري)</label>
              <input type="number" step="0.1" value={form.target} onChange={e => set('target', e.target.value)} className="input" min={0} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: 50, resize: 'none' }} />
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
