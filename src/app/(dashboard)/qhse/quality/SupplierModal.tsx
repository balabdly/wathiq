'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Props = { editItem?: any; onClose: () => void; onSave: () => void }

export default function SupplierModal({ editItem, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:                 editItem?.name                 || '',
    category:             editItem?.category             || 'مواد كهربائية',
    contact_person:       editItem?.contact_person       || '',
    phone:                editItem?.phone                || '',
    email:                editItem?.email                || '',
    cr_number:            editItem?.cr_number            || '',
    vat_number:           editItem?.vat_number           || '',
    iso_certified:        editItem?.iso_certified        || false,
    iso_cert_no:          editItem?.iso_cert_no          || '',
    iso_cert_expiry:      editItem?.iso_cert_expiry      || '',
    qualification_status: editItem?.qualification_status || 'قيد التقييم',
    qualification_date:   editItem?.qualification_date   || '',
    requalification_due:  editItem?.requalification_due  || '',
    overall_rating:       editItem?.overall_rating       || '',
    notes:                editItem?.notes                || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    'مؤهل':         { bg: '#ecfdf5', color: '#0ea77b' },
    'مشروط':        { bg: '#fffbeb', color: '#e6820a' },
    'غير مؤهل':    { bg: '#fef2f2', color: '#c81e1e' },
    'قيد التقييم': { bg: '#eff6ff', color: '#1a56db' },
  }

  async function handleSave() {
    if (!form.name || !form.category) { toast.error('اسم المورد والتصنيف مطلوبان'); return }
    setSaving(true)
    let code = editItem?.supplier_code
    if (!code) {
      const { count } = await supabase.from('quality_suppliers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant?.id)
      code = `QS-${String((count || 0) + 1).padStart(3, '0')}`
    }
    const payload = {
      ...form,
      supplier_code: code,
      tenant_id: tenant?.id,
      overall_rating: form.overall_rating ? Number(form.overall_rating) : null,
    }
    const { error } = editItem
      ? await supabase.from('quality_suppliers').update(payload).eq('id', editItem.id)
      : await supabase.from('quality_suppliers').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تم الحفظ')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 600 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>
            {editItem ? 'تعديل' : 'إضافة'} مورد
            <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 400, marginRight: 8 }}>ISO 9001 §8.4</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* حالة التأهيل — أبرزها في الأعلى لأنها أهم معلومة */}
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <button key={s} type="button" onClick={() => set('qualification_status', s)}
                style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                  borderColor: form.qualification_status === s ? c.color : 'var(--border)',
                  background:  form.qualification_status === s ? c.bg : 'white',
                  color:       form.qualification_status === s ? c.color : 'var(--text3)' }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>اسم المورد *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التصنيف *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                {['مواد كهربائية','مقاول فرعي','استشارات هندسية','تدريب وتأهيل','معدات وآليات','خدمات لوجستية','أخرى'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>جهة الاتصال</label>
              <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الجوال</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>البريد الإلكتروني</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} className="input" dir="ltr" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>رقم السجل التجاري</label>
              <input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>الرقم الضريبي</label>
              <input value={form.vat_number} onChange={e => set('vat_number', e.target.value)} className="input" dir="ltr" />
            </div>
          </div>

          {/* شهادة ISO */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: form.iso_certified ? 10 : 0 }}>
              <input type="checkbox" checked={form.iso_certified} onChange={e => set('iso_certified', e.target.checked)} />
              <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>يحمل شهادة ISO</span>
            </label>
            {form.iso_certified && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 4 }}>رقم الشهادة</label>
                  <input value={form.iso_cert_no} onChange={e => set('iso_cert_no', e.target.value)} className="input" dir="ltr" placeholder="ISO 9001-2024-XXX" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 4 }}>تاريخ انتهاء الشهادة</label>
                  <input type="date" value={form.iso_cert_expiry} onChange={e => set('iso_cert_expiry', e.target.value)} className="input" />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>تاريخ آخر تأهيل</label>
              <input type="date" value={form.qualification_date} onChange={e => set('qualification_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>موعد إعادة التأهيل</label>
              <input type="date" value={form.requalification_due} onChange={e => set('requalification_due', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>التقييم الكلي (من 5)</label>
              <input type="number" min={0} max={5} step={0.1} value={form.overall_rating} onChange={e => set('overall_rating', e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 5 }}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: 50, resize: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#1a56db' }}>
            {saving ? '...' : <><Save size={14} /> حفظ</>}
          </button>
        </div>
      </div>
    </div>
  )
}
