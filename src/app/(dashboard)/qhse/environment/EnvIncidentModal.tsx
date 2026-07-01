'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Props = { editItem?: any; onClose: () => void; onSave: () => void }

export default function EnvIncidentModal({ editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type:                 editItem?.type                 || '',
    date:                 editItem?.date                 || new Date().toISOString().split('T')[0],
    time:                 editItem?.time                 || '',
    location:             editItem?.location             || '',
    severity:             editItem?.severity             || 'متوسطة',
    description:          editItem?.description          || '',
    environmental_impact: editItem?.environmental_impact || '',
    immediate_action:     editItem?.immediate_action     || '',
    root_cause:           editItem?.root_cause           || '',
    reported_by:          editItem?.reported_by          || '',
    penalty_amount:       editItem?.penalty_amount       || 0,
    status:               editItem?.status               || 'مفتوح',
    notes:                editItem?.notes                || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.type || !form.date || !form.location) { toast.error('النوع والتاريخ والموقع مطلوبة'); return }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant?.id, penalty_amount: Number(form.penalty_amount) }
    const { error } = editItem
      ? await supabase.from('env_incidents').update(payload).eq('id', editItem.id)
      : await supabase.from('env_incidents').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success(editItem ? '✅ تم التحديث' : '✅ تم التسجيل')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 600 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>⚠️ {editItem ? 'تعديل' : 'تسجيل'} حادثة بيئية</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>نوع الحادثة *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {['تسرب زيت','تسرب مواد كيميائية','انبعاث غازات','تلوث مياه','تلوث تربة','حريق','نفايات غير مرخصة','أخرى'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>درجة الخطورة</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)} className="select">
                <option>منخفضة</option><option>متوسطة</option><option>عالية</option><option>حرجة</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التاريخ *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الوقت</label>
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الموقع *</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="موقع الحادثة" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>وصف الحادثة</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" style={{ minHeight: 60, resize: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التأثير البيئي</label>
            <input value={form.environmental_impact} onChange={e => set('environmental_impact', e.target.value)} className="input" placeholder="تلوث تربة، تلوث مياه جوفية..." />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الإجراء الفوري</label>
            <textarea value={form.immediate_action} onChange={e => set('immediate_action', e.target.value)} className="input" style={{ minHeight: 60, resize: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تحليل السبب الجذري</label>
            <textarea value={form.root_cause} onChange={e => set('root_cause', e.target.value)} className="input" style={{ minHeight: 60, resize: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المُبلِّغ</label>
              <input value={form.reported_by} onChange={e => set('reported_by', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الغرامة (ريال)</label>
              <input type="number" value={form.penalty_amount} onChange={e => set('penalty_amount', e.target.value)} className="input" min={0} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                <option>مفتوح</option><option>قيد المعالجة</option><option>مغلق</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#dc2626' }}>
            {saving ? '...' : <><Save size={14} /> حفظ</>}
          </button>
        </div>
      </div>
    </div>
  )
}
