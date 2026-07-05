// src/app/(dashboard)/finance/purchases/vendors/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Search, Users, Eye, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePurchases } from '../PurchasesContext'
import type { Vendor } from '@/lib/purchases-types'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

// ════════════════════════════════════════
// مودال: إضافة/تعديل مورد
// ════════════════════════════════════════
function VendorModal({ vendor, tenantId, onClose, onSave }: { vendor: Vendor | null; tenantId: string; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: vendor?.name || '', vendor_type: vendor?.vendor_type || 'مورد',
    vat_number: vendor?.vat_number || '', cr_number: vendor?.cr_number || '',
    phone: vendor?.phone || '', email: vendor?.email || '', contact_person: vendor?.contact_person || '',
    city: vendor?.city || '', country: vendor?.country || 'المملكة العربية السعودية',
    iban: vendor?.iban || '', notes: vendor?.notes || '', is_active: vendor?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const vatValid = !form.vat_number || (form.vat_number.length === 15 && /^\d+$/.test(form.vat_number))
  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم المورد مطلوب'); return }
    if (!vatValid) { toast.error('الرقم الضريبي يجب أن يكون 15 رقماً'); return }
    setSaving(true)
    const payload = { tenant_id: tenantId, name: form.name.trim(), vendor_type: form.vendor_type, vat_number: form.vat_number || null, cr_number: form.cr_number || null, phone: form.phone || null, email: form.email || null, contact_person: form.contact_person || null, city: form.city || null, country: form.country, iban: form.iban || null, notes: form.notes || null, is_active: form.is_active }
    if (vendor) await supabase.from('finance_vendors').update(payload).eq('id', vendor.id)
    else await supabase.from('finance_vendors').insert(payload)
    toast.success(vendor ? 'تم التعديل' : 'تمت إضافة المورد')
    onSave(); setSaving(false)
  }
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Users style={{ width: '18px', height: '18px', color: '#e6820a' }} />{vendor ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['مورد', 'مقاول', 'مقدم خدمة'].map(t => (
              <button key={t} type="button" onClick={() => set('vendor_type', t)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, borderColor: form.vendor_type === t ? '#e6820a' : 'var(--border)', background: form.vendor_type === t ? '#fffbeb' : 'white', color: form.vendor_type === t ? '#e6820a' : 'var(--text3)' }}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>اسم المورد *</label><input value={form.name} onChange={e => set('name', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" /></div>
            <div><label style={lbl}>الرقم الضريبي {form.vat_number && <span style={{ fontSize: '0.72rem', color: vatValid ? '#0ea77b' : '#c81e1e' }}>{vatValid ? '✓' : '✗'}</span>}</label><input value={form.vat_number} onChange={e => set('vat_number', e.target.value.replace(/\D/g, '').slice(0, 15))} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
            <div><label style={lbl}>السجل التجاري</label><input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
            <div><label style={lbl}>رقم الهاتف</label><input value={form.phone} onChange={e => set('phone', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
            <div><label style={lbl}>البريد الإلكتروني</label><input value={form.email} onChange={e => set('email', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
            <div><label style={lbl}>شخص التواصل</label><input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" /></div>
            <div><label style={lbl}>رقم IBAN</label><input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" placeholder="SA..." /></div>
            <div><label style={lbl}>المدينة</label><input value={form.city} onChange={e => set('city', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            {vendor ? 'حفظ التعديل' : 'إضافة المورد'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة
// ════════════════════════════════════════
export default function VendorsPage() {
  const router = useRouter()
  const { tenantId, vendors, reloadShared } = usePurchases()
  const [search, setSearch] = useState('')
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)

  const filtered = vendors.filter(v => !search || v.name.includes(search))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', maxWidth: '360px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم المورد..." className="input" style={{ paddingRight: '32px' }} />
        </div>
        <button onClick={() => { setEditVendor(null); setShowVendorModal(true) }} className="btn btn-primary" style={{ background: '#1a56db' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> مورد جديد
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا يوجد موردون</div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['المورد', 'النوع', 'الرقم الضريبي', 'الهاتف', 'المدينة', 'IBAN', 'الحالة', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{v.name}</td>
                    <td style={{ padding: '12px 14px' }}><span className="badge badge-amber">{v.vendor_type}</span></td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontFamily: 'monospace', color: v.vat_number ? '#0ea77b' : '#e6820a' }}>{v.vat_number || 'غير مُدخل'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{v.phone || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{v.city || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text3)' }}>{v.iban ? v.iban.substring(0, 10) + '...' : '—'}</td>
                    <td style={{ padding: '12px 14px' }}><span className={'badge ' + (v.is_active ? 'badge-green' : 'badge-gray')}>{v.is_active ? 'نشط' : 'موقوف'}</span></td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => router.push(`/finance/purchases/vendors/${v.id}`)} title="استعراض وكشف حساب"
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                          <Eye style={{ width: '13px', height: '13px' }} />
                        </button>
                        <button onClick={() => { setEditVendor(v); setShowVendorModal(true) }} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Pencil style={{ width: '12px', height: '12px' }} /> تعديل</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>

      {showVendorModal && (
        <VendorModal vendor={editVendor} tenantId={tenantId!}
          onClose={() => { setShowVendorModal(false); setEditVendor(null) }}
          onSave={() => { setShowVendorModal(false); setEditVendor(null); reloadShared() }} />
      )}
    </div>
  )
}
