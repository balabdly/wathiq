'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'

interface Props {
  editIncident?: any
  onClose: () => void
  onSave: () => void
}

export default function IncidentModal({ editIncident, onClose, onSave }: Props) {
  const { tenant, activeBranch } = useStore()

  const [form, setForm] = useState({
    type:        editIncident?.type        || '',
    date:        editIncident?.date        || '',
    time:        editIncident?.time        || '',
    location:    editIncident?.location    || '',
    project_id:  editIncident?.project_id  || '',
    severity:    editIncident?.severity    || 'متوسطة',
    description: editIncident?.description || '',
    injured:     editIncident?.injured     || '',
    action:      editIncident?.action      || '',
    lesson:      editIncident?.lesson      || '',
    reported_by: editIncident?.reported_by || '',
    status:      editIncident?.status      || 'مفتوح',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.type || !form.date || !form.location) {
      toast.error('يرجى تعبئة النوع والتاريخ والموقع'); return
    }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant?.id, branch_id: activeBranch?.id }
    const { error } = editIncident
      ? await supabase.from('qhse_incidents').update(payload).eq('id', editIncident.id)
      : await supabase.from('qhse_incidents').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success(editIncident ? '✅ تم تحديث الحادثة' : '✅ تم تسجيل الحادثة')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 580 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>{editIncident ? 'تعديل الحادثة' : '⚠️ تسجيل حادثة جديدة'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>نوع الحادثة *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {['إصابة','حريق','سقوط','صعق كهربائي','حادث مركبة','إغماء','أخرى'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>درجة الخطورة</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)} className="select">
                <option value="منخفضة">منخفضة</option>
                <option value="متوسطة">متوسطة</option>
                <option value="عالية">عالية</option>
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
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input"
              style={{ minHeight: 70, resize: 'none' }} placeholder="تفاصيل ما حدث..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المصاب (إن وجد)</label>
              <input value={form.injured} onChange={e => set('injured', e.target.value)} className="input" placeholder="اسم المصاب" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>أبلغ عنها</label>
              <input value={form.reported_by} onChange={e => set('reported_by', e.target.value)} className="input" placeholder="اسم المبلّغ" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الإجراء المتخذ</label>
            <textarea value={form.action} onChange={e => set('action', e.target.value)} className="input"
              style={{ minHeight: 60, resize: 'none' }} placeholder="الإجراءات الفورية..." />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الدروس المستفادة</label>
            <textarea value={form.lesson} onChange={e => set('lesson', e.target.value)} className="input"
              style={{ minHeight: 60, resize: 'none' }} placeholder="ماذا تعلمنا..." />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الحالة</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
              <option value="مفتوح">مفتوح</option>
              <option value="قيد المعالجة">قيد المعالجة</option>
              <option value="مغلق">مغلق</option>
            </select>
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
