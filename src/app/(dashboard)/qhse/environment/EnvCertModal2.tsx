'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Props = { editItem?: any; onClose: () => void; onSave: () => void }

export default function EnvCertModal2({ editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title:        editItem?.title        || '',
    cert_type:    editItem?.cert_type    || 'شهادة',
    cert_no:      editItem?.cert_no      || '',
    issuer:       editItem?.issuer       || '',
    issue_date:   editItem?.issue_date   || '',
    expiry_date:  editItem?.expiry_date  || '',
    notify_days:  editItem?.notify_days  || 60,
    standard_ref: editItem?.standard_ref || '',
    notes:        editItem?.notes        || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const daysLeft = form.expiry_date ? Math.ceil((new Date(form.expiry_date).getTime() - Date.now()) / 86400000) : null

  async function handleSave() {
    if (!form.title || !form.expiry_date) { toast.error('العنوان وتاريخ الانتهاء مطلوبان'); return }
    setSaving(true)
    const dl = daysLeft
    const status = dl !== null && dl < 0 ? 'منتهية' : dl !== null && dl <= 60 ? 'تقترب' : 'سارية'
    const payload = { ...form, tenant_id: tenant?.id, notify_days: Number(form.notify_days), status }
    const { error } = editItem
      ? await supabase.from('env_certificates').update(payload).eq('id', editItem.id)
      : await supabase.from('env_certificates').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم الحفظ')
    onSave()
  }

  const TYPES = [
    { val: 'شهادة', std: 'ISO 14001:2015 — نظام الإدارة البيئية' },
    { val: 'شهادة', std: 'ISO 14064-1 — محاسبة الغازات الدفيئة' },
    { val: 'رخصة',  std: 'ترخيص صرف مياه — بلدية' },
    { val: 'رخصة',  std: 'رخصة نقل نفايات خطرة — وزارة البيئة' },
    { val: 'اعتماد', std: 'GRI — التقارير البيئية' },
  ]

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>🏅 {editItem ? 'تعديل' : 'إضافة'} شهادة / ترخيص بيئي</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: 'شهادة',  color: '#0ea77b', bg: '#ecfdf5' },
              { val: 'رخصة',   color: '#1a56db', bg: '#eff6ff' },
              { val: 'اعتماد', color: '#7c3aed', bg: '#f5f3ff' },
            ].map(opt => (
              <button key={opt.val} type="button" onClick={() => set('cert_type', opt.val)}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
                  borderColor: form.cert_type === opt.val ? opt.color : 'var(--border)',
                  background: form.cert_type === opt.val ? opt.bg : 'white',
                  color: form.cert_type === opt.val ? opt.color : 'var(--text3)' }}>
                {opt.val}
              </button>
            ))}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>العنوان *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="مثال: شهادة ISO 14001:2015" autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>المعيار المرجعي</label>
            <select value={form.standard_ref} onChange={e => set('standard_ref', e.target.value)} className="select">
              <option value="">— اختر أو اكتب —</option>
              {TYPES.map(t => <option key={t.std} value={t.std}>{t.std}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>رقم الشهادة / الترخيص</label>
              <input value={form.cert_no} onChange={e => set('cert_no', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الجهة المصدِرة</label>
              <input value={form.issuer} onChange={e => set('issuer', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ الإصدار</label>
              <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ الانتهاء *</label>
              <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" />
            </div>
          </div>
          {daysLeft !== null && (
            <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
              background: daysLeft < 0 ? '#fef2f2' : daysLeft <= 60 ? '#fffbeb' : '#ecfdf5',
              color: daysLeft < 0 ? '#b91c1c' : daysLeft <= 60 ? '#92400e' : '#065f46' }}>
              {daysLeft < 0 ? `❌ منتهية منذ ${Math.abs(daysLeft)} يوم` : daysLeft <= 60 ? `⚠️ تنتهي خلال ${daysLeft} يوم` : `✅ سارية — ${daysLeft} يوم متبقي`}
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التنبيه قبل الانتهاء بـ (يوم)</label>
            <input type="number" value={form.notify_days} onChange={e => set('notify_days', e.target.value)} className="input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#f59e0b' }}>
            {saving ? '...' : <><Save size={14} /> حفظ</>}
          </button>
        </div>
      </div>
    </div>
  )
}
