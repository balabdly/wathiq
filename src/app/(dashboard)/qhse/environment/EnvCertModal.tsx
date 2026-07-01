'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'

interface Props {
  editCert?: any
  onClose: () => void
  onSave: () => void
}

export default function EnvCertModal({ editCert, onClose, onSave }: Props) {
  const { tenant, activeBranch } = useStore()

  const [form, setForm] = useState({
    category:    editCert?.category    || 'safety',
    type:        editCert?.type        || '',
    name:        editCert?.name        || '',
    cert_no:     editCert?.cert_no     || '',
    issuer:      editCert?.issuer      || '',
    issue_date:  editCert?.issue_date  || '',
    expiry_date: editCert?.expiry_date || '',
    notify_days: editCert?.notify_days || 30,
    notes:       editCert?.notes       || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const [saving, setSaving] = useState(false)

  // احتساب الأيام المتبقية
  const daysLeft = form.expiry_date
    ? Math.ceil((new Date(form.expiry_date).getTime() - Date.now()) / 86400000)
    : null

  async function handleSave() {
    if (!form.name || !form.expiry_date) {
      toast.error('يرجى تعبئة اسم الشهادة وتاريخ الانتهاء'); return
    }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant?.id, branch_id: activeBranch?.id }
    const { error } = editCert
      ? await supabase.from('qhse_certs').update(payload).eq('id', editCert.id)
      : await supabase.from('qhse_certs').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم حفظ الشهادة')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 540 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>{editCert ? 'تعديل الشهادة' : '🏆 إضافة شهادة'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>نوع الشهادة</label>
              <input value={form.type} onChange={e => set('type', e.target.value)} className="input" placeholder="ISO 14001..." />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>اسم الشهادة *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input"
              placeholder="مثال: شهادة ISO 14001 لنظام الإدارة البيئية" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>رقم الشهادة</label>
              <input value={form.cert_no} onChange={e => set('cert_no', e.target.value)} className="input" dir="ltr" placeholder="CERT-0001" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الجهة المصدرة</label>
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

          {/* مؤشر الأيام المتبقية */}
          {daysLeft !== null && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
              background: daysLeft < 0 ? '#fef2f2' : daysLeft <= 60 ? '#fffbeb' : '#ecfdf5',
              color:      daysLeft < 0 ? '#b91c1c' : daysLeft <= 60 ? '#92400e' : '#065f46',
            }}>
              {daysLeft < 0
                ? `❌ منتهية منذ ${Math.abs(daysLeft)} يوم`
                : daysLeft === 0 ? '⚠️ تنتهي اليوم!'
                : daysLeft <= 60 ? `⚠️ تنتهي خلال ${daysLeft} يوم`
                : `✅ سارية — ${daysLeft} يوم متبقي`}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التنبيه قبل الانتهاء (يوم)</label>
            <input type="number" value={form.notify_days} onChange={e => set('notify_days', Number(e.target.value))} className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input"
              style={{ minHeight: 60, resize: 'none' }} />
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
