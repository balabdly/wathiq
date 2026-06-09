'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Printer, Trash2, Pencil, Search, ShoppingCart, Users, RotateCcw, FileText, CheckCircle, Warehouse, MapPin, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePagination } from '@/hooks/usePagination'
import { createJournalEntry, getCashAccountCode } from '@/lib/journal'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Vendor = {
  id: number; tenant_id: string; name: string; name_en?: string
  vat_number?: string; cr_number?: string; vendor_type: string
  city?: string; district?: string; street?: string; postal_code?: string
  country: string; phone?: string; email?: string
  contact_person?: string; iban?: string; is_active: boolean; notes?: string
}
type POItem = {
  id?: number; description: string; quantity: number; unit: string; unit_price: number; total: number
}
type PurchaseOrder = {
  id: number; po_number: string; po_date: string; expected_date?: string
  vendor_id?: number; vendor_name: string; vendor_vat?: string
  project_id?: number; delivery_to: string; warehouse_id?: number
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  status: string; notes?: string; has_invoice?: boolean
  vendor?: Vendor; project?: { name: string }
}
type VendorInvoice = {
  id: number; invoice_number: string; invoice_date: string; due_date?: string
  vendor_id?: number; vendor_name: string; vendor_vat?: string
  po_id?: number; project_id?: number; delivery_to: string; warehouse_id?: number
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  status: string; notes?: string
  vendor?: Vendor; project?: { name: string }
  po?: { po_number: string }
}
type PurchaseReturn = {
  id: number; return_number: string; return_date: string; return_type: string
  original_invoice_id?: number; vendor_id?: number; vendor_name: string
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  reason?: string; status: string; notes?: string
}
type Project   = { id: number; name: string }
type Warehouse = { id: number; name: string; wh_type: string }
type CashAccount = { id: number; name: string; account_type: string; bank_name?: string; account_no?: string; iban?: string; account_id?: number; account_code?: string }

const PO_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'مرسل': 'badge-blue', 'مستلم جزئياً': 'badge-amber',
  'مستلم': 'badge-green', 'ملغي': 'badge-red'
}
const INV_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'معتمدة': 'badge-blue', 'مدفوعة': 'badge-green',
  'متأخرة': 'badge-red', 'ملغاة': 'badge-red'
}

// ════════════════════════════════════════
// مكوّن: بنود الطلب
// ════════════════════════════════════════
function ItemsTable({ items, onChange }: { items: POItem[]; onChange: (items: POItem[]) => void }) {
  function update(idx: number, k: keyof POItem, v: any) {
    const next = [...items]
    next[idx] = { ...next[idx], [k]: v }
    if (k === 'quantity' || k === 'unit_price') next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price)
    onChange(next)
  }
  function add()              { onChange([...items, { description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]) }
  function remove(idx: number){ if (items.length > 1) onChange(items.filter((_, i) => i !== idx)) }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>البنود</label>
        <button type="button" onClick={add}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
          <Plus style={{ width: '13px', height: '13px' }} /> إضافة بند
        </button>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg2)' }}>
              {['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', minWidth: '180px' }}>
                  <input value={item.description} onChange={e => update(idx, 'description', e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="وصف المادة أو الخدمة" />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input type="number" value={item.quantity} onChange={e => update(idx, 'quantity', e.target.value)}
                    style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <select value={item.unit} onChange={e => update(idx, 'unit', e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>
                    {['وحدة', 'م²', 'م طولي', 'طن', 'كجم', 'لتر', 'يوم', 'ساعة', 'مقطوعة'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input type="number" value={item.unit_price} onChange={e => update(idx, 'unit_price', e.target.value)}
                    style={{ width: '100px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                </td>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                  {Number(item.total).toLocaleString()} ر.س
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <button type="button" onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مكوّن: الإجماليات
// ════════════════════════════════════════
function TotalsBox({ subtotal, vatRate, vatAmount, total }: { subtotal: number; vatRate: number; vatAmount: number; total: number }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>المجموع قبل الضريبة</span>
          <span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} ر.س</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>ضريبة القيمة المضافة ({vatRate}%)</span>
          <span style={{ fontWeight: 600, color: '#e6820a' }}>{vatAmount.toLocaleString()} ر.س</span>
        </div>
        <div style={{ borderTop: '2px solid #fde68a', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>الإجمالي</span>
          <span style={{ fontWeight: 700, fontSize: '1.3rem', color: '#e6820a' }}>{total.toLocaleString()} ر.س</span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مكوّن: وجهة التسليم
// ════════════════════════════════════════
function DeliveryField({ value, warehouseId, assetType, projects, warehouses, onChange, onAssetTypeChange }: {
  value: string; warehouseId?: string; assetType?: string; projects: Project[]; warehouses: Warehouse[]
  onChange: (delivery: string, warehouseId?: string) => void
  onAssetTypeChange?: (t: string) => void
}) {
  return (
    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 14px' }}>
      <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0369a1', display: 'block', marginBottom: '10px' }}>
        📦 وجهة التسليم / تصنيف الشراء
      </label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { val: 'مستودع',     icon: '🏪', desc: 'يُضاف للمخزون' },
          { val: 'موقع العمل', icon: '🏗️', desc: 'مباشرة للمشروع' },
          { val: 'أصل ثابت',  icon: '🏭', desc: 'سيارة / معدة / جهاز' },
        ].map(opt => (
          <button key={opt.val} type="button" onClick={() => onChange(opt.val, undefined)}
            style={{ flex: 1, minWidth: '100px', padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
              borderColor: value === opt.val ? '#0369a1' : 'var(--border)',
              background:  value === opt.val ? '#e0f2fe' : 'white',
              color:       value === opt.val ? '#0369a1' : '#6b7280' }}>
            <div>{opt.icon}</div>
            <div style={{ marginTop: '2px' }}>{opt.val}</div>
            <div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '1px' }}>{opt.desc}</div>
          </button>
        ))}
      </div>
      {value === 'مستودع' && (
        <select value={warehouseId || ''} onChange={e => onChange('مستودع', e.target.value)}
          className="select" style={{ marginTop: '4px' }}>
          <option value="">— اختر المستودع —</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
      {value === 'أصل ثابت' && onAssetTypeChange && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          {[
            { val: 'معدات',  icon: '🔧', account: '1220 — الأجهزة والمعدات' },
            { val: 'مركبات', icon: '🚗', account: '1210 — المركبات' },
            { val: 'أثاث',   icon: '🪑', account: '1230 — الأثاث والمفروشات' },
          ].map(t => (
            <button key={t.val} type="button" onClick={() => onAssetTypeChange(t.val)}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center',
                borderColor: assetType === t.val ? '#065f46' : 'var(--border)',
                background:  assetType === t.val ? '#d1fae5' : 'white',
                color:       assetType === t.val ? '#065f46' : 'var(--text3)' }}>
              <div>{t.icon}</div>
              <div style={{ marginTop: '2px' }}>{t.val}</div>
              <div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '1px' }}>{t.account}</div>
            </button>
          ))}
        </div>
      )}
      {value === 'أصل ثابت' && assetType && (
        <div style={{ padding: '6px 10px', background: '#f0fdf4', borderRadius: '6px', fontSize: '0.75rem', color: '#065f46', border: '1px solid #bbf7d0', marginTop: '8px' }}>
          ✅ سيُسجَّل في حساب {assetType === 'مركبات' ? '1210 — المركبات' : assetType === 'أثاث' ? '1230 — الأثاث والمفروشات' : '1220 — الأجهزة والمعدات'}
        </div>
      )}
    </div>
  )
}

// القيود تستخدم @/lib/journal

// ════════════════════════════════════════
// مودال: إضافة / تعديل مورد
// ════════════════════════════════════════
function VendorModal({ vendor, tenantId, onClose, onSave }: {
  vendor: Vendor | null; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: vendor?.name || '', name_en: vendor?.name_en || '',
    vendor_type: vendor?.vendor_type || 'مورد',
    vat_number: vendor?.vat_number || '', cr_number: vendor?.cr_number || '',
    phone: vendor?.phone || '', email: vendor?.email || '',
    contact_person: vendor?.contact_person || '',
    city: vendor?.city || '', district: vendor?.district || '',
    street: vendor?.street || '', postal_code: vendor?.postal_code || '',
    country: vendor?.country || 'المملكة العربية السعودية',
    iban: vendor?.iban || '', notes: vendor?.notes || '',
    is_active: vendor?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const vatValid = !form.vat_number || (form.vat_number.length === 15 && /^\d+$/.test(form.vat_number))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم المورد مطلوب'); return }
    if (!vatValid) { toast.error('الرقم الضريبي يجب أن يكون 15 رقماً'); return }
    setSaving(true)
    const payload = {
      tenant_id: tenantId, name: form.name.trim(), name_en: form.name_en || null,
      vendor_type: form.vendor_type, vat_number: form.vat_number || null,
      cr_number: form.cr_number || null, phone: form.phone || null,
      email: form.email || null, contact_person: form.contact_person || null,
      city: form.city || null, district: form.district || null,
      street: form.street || null, postal_code: form.postal_code || null,
      country: form.country, iban: form.iban || null,
      notes: form.notes || null, is_active: form.is_active,
    }
    if (vendor) await supabase.from('finance_vendors').update(payload).eq('id', vendor.id)
    else await supabase.from('finance_vendors').insert(payload)
    toast.success(vendor ? 'تم التعديل ✅' : '✅ تمت إضافة المورد')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {vendor ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', borderRadius: '6px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['مورد', 'مقاول', 'مقدم خدمة'].map(t => (
              <button key={t} type="button" onClick={() => set('vendor_type', t)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                  borderColor: form.vendor_type === t ? '#e6820a' : 'var(--border)',
                  background:  form.vendor_type === t ? '#fffbeb' : 'white',
                  color:       form.vendor_type === t ? '#e6820a' : 'var(--text3)' }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>اسم المورد *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                الرقم الضريبي
                {form.vat_number && <span style={{ marginRight: '6px', fontSize: '0.72rem', color: vatValid ? '#0ea77b' : '#c81e1e' }}>{vatValid ? '✓' : '✗ 15 رقم'}</span>}
              </label>
              <input value={form.vat_number} onChange={e => set('vat_number', e.target.value.replace(/\D/g, '').slice(0, 15))} className="input" dir="ltr" maxLength={15} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>السجل التجاري</label>
              <input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم الهاتف</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>البريد الإلكتروني</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>شخص التواصل</label>
              <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم IBAN</label>
              <input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} className="input" dir="ltr" placeholder="SA..." />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المدينة</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} className="input" />
            </div>
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
// مودال: أمر شراء
// ════════════════════════════════════════
let _poSaveStatus = 'مفتوحة'
let _invSaveStatus = 'معتمدة'
function POModal({ po, vendors, projects, warehouses, tenantId, onClose, onSave }: {
  po: PurchaseOrder | null; vendors: Vendor[]; projects: Project[]
  warehouses: Warehouse[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<POItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    po_number:     po?.po_number     || '',
    po_date:       po?.po_date       || today,
    expected_date: po?.expected_date || '',
    vendor_id:     po?.vendor_id     ? String(po.vendor_id) : '',
    project_id:    po?.project_id    ? String(po.project_id) : '',
    delivery_to:   po?.delivery_to   || 'مستودع',
    warehouse_id:  po?.warehouse_id  ? String(po.warehouse_id) : '',
    vat_rate:      po?.vat_rate      ?? 15,
    status:        po?.status        || 'مسودة',
    notes:         po?.notes         || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (po) loadItems()
    else generateNumber()
  }, [])

  async function loadItems() {
    const { data } = await supabase.from('finance_purchase_order_items').select('*').eq('po_id', po!.id).order('id')
    if (data && data.length > 0) setItems(data)
  }
  async function generateNumber() {
    const { count } = await supabase.from('finance_purchase_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    set('po_number', `PO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`)
  }

  const selectedVendor = vendors.find(v => v.id === Number(form.vendor_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.po_number.trim()) { toast.error('رقم الطلب مطلوب'); return }
    if (!form.vendor_id) { toast.error('يجب اختيار مورد'); return }
    setSaving(true)
    const payload = {
      tenant_id: tenantId, po_number: form.po_number.trim(),
      po_date: form.po_date, expected_date: form.expected_date || null,
      vendor_id: Number(form.vendor_id), vendor_name: selectedVendor!.name,
      vendor_vat: selectedVendor!.vat_number || null,
      project_id: form.project_id ? Number(form.project_id) : null,
      delivery_to: form.delivery_to,
      warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate), status: form.status, notes: form.notes || null,
    }
    let poId = po?.id
    if (po) {
      await supabase.from('finance_purchase_orders').update(payload).eq('id', po.id)
      await supabase.from('finance_purchase_order_items').delete().eq('po_id', po.id)
    } else {
      const { data, error } = await supabase.from('finance_purchase_orders').insert(payload).select('id').single()
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
      poId = data.id
    }
    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_purchase_order_items').insert(
        validItems.map(i => ({ po_id: poId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) }))
      )
    }
    toast.success(po ? 'تم التعديل ✅' : '✅ تم إنشاء أمر الشراء')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '780px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {po ? 'تعديل أمر الشراء' : 'أمر شراء جديد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', borderRadius: '6px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم أمر الشراء *</label>
              <input value={form.po_number} onChange={e => set('po_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ الطلب *</label>
              <input type="date" value={form.po_date} onChange={e => set('po_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ التسليم المتوقع</label>
              <input type="date" value={form.expected_date} onChange={e => set('expected_date', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '14px', border: '1px solid #fde68a' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المورد *</label>
            <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select">
              <option value="">— اختر المورد —</option>
              {vendors.filter(v => v.is_active).map(v => <option key={v.id} value={v.id}>{v.name} ({v.vendor_type})</option>)}
            </select>
            {selectedVendor && (
              <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#92400e', display: 'flex', gap: '16px' }}>
                {selectedVendor.vat_number && <span>رقم ضريبي: {selectedVendor.vat_number}</span>}
                {selectedVendor.phone && <span>📞 {selectedVendor.phone}</span>}
                {selectedVendor.city && <span>📍 {selectedVendor.city}</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— مشتريات عامة —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          <DeliveryField value={form.delivery_to} warehouseId={form.warehouse_id} projects={projects} warehouses={warehouses}
            onChange={(delivery, wh) => { set('delivery_to', delivery); set('warehouse_id', wh || '') }} />
          <ItemsTable items={items} onChange={setItems} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>نسبة ضريبة القيمة المضافة</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                  <option value={15}>15% — المعيارية</option>
                  <option value={0}>0% — معفي</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ملاحظات</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} />
              </div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          {!po && (
            <button onClick={() => { _poSaveStatus = 'مسودة'; handleSave() }}
              disabled={saving || !form.vendor_id}
              style={{ padding:'8px 18px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontWeight:600, fontSize:'0.875rem', display:'flex', alignItems:'center', gap:'6px', color:'#6b7280' }}>
              <Save style={{ width:'14px', height:'14px' }} />
              حفظ مسودة
            </button>
          )}
          <button onClick={() => { _poSaveStatus = po ? (form.status || 'مفتوحة') : 'مفتوحة'; handleSave() }}
            disabled={saving || !form.vendor_id} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            {po ? 'حفظ التعديل' : 'إصدار أمر الشراء'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: فاتورة مورد — مع تعديل بعد الاعتماد + قيد تصحيحي
// ════════════════════════════════════════
function VendorInvoiceModal({ invoice, convertFromPO, vendors, projects, warehouses, purchaseOrders, tenantId, onClose, onSave }: {
  invoice: VendorInvoice | null; convertFromPO?: PurchaseOrder | null
  vendors: Vendor[]; projects: Project[]
  warehouses: Warehouse[]; purchaseOrders: PurchaseOrder[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<POItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    invoice_number: invoice?.invoice_number || '',
    invoice_date:   invoice?.invoice_date   || today,
    due_date:       invoice?.due_date       || '',
    vendor_id:      invoice?.vendor_id      ? String(invoice.vendor_id) : '',
    po_id:          invoice?.po_id          ? String(invoice.po_id) : '',
    project_id:     invoice?.project_id     ? String(invoice.project_id) : '',
    delivery_to:    invoice?.delivery_to    || 'مستودع',
    warehouse_id:   invoice?.warehouse_id   ? String(invoice.warehouse_id) : '',
    asset_type:     '',
    vat_rate:       invoice?.vat_rate       ?? 15,
    status:         invoice?.status         || 'مسودة',
    notes:          invoice?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (invoice) loadItems()
    else {
      generateNumber()
      if (convertFromPO) {
        setForm(f => ({
          ...f,
          vendor_id:    convertFromPO.vendor_id   ? String(convertFromPO.vendor_id) : '',
          po_id:        String(convertFromPO.id),
          project_id:   convertFromPO.project_id  ? String(convertFromPO.project_id) : '',
          delivery_to:  convertFromPO.delivery_to  || 'مستودع',
          warehouse_id: convertFromPO.warehouse_id ? String(convertFromPO.warehouse_id) : '',
          vat_rate:     convertFromPO.vat_rate      ?? 15,
        }))
        supabase.from('finance_purchase_order_items').select('*').eq('po_id', convertFromPO.id).order('id')
          .then(({ data }) => { if (data && data.length > 0) setItems(data.map(i => ({ description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, total: i.total }))) })
      }
    }
  }, [])

  async function loadItems() {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', invoice!.id).order('id')
    if (data && data.length > 0) setItems(data)
  }
  async function generateNumber() {
    const { count } = await supabase.from('finance_vendor_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    set('invoice_number', `VINV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`)
  }
  async function handlePOSelect(poId: string) {
    set('po_id', poId)
    if (!poId) return
    const po = purchaseOrders.find(p => p.id === Number(poId))
    if (po) {
      set('vendor_id', String(po.vendor_id || ''))
      set('project_id', String(po.project_id || ''))
      set('delivery_to', po.delivery_to)
      set('warehouse_id', String(po.warehouse_id || ''))
      const { data } = await supabase.from('finance_purchase_order_items').select('*').eq('po_id', po.id).order('id')
      if (data && data.length > 0) setItems(data.map(i => ({ ...i, id: undefined })))
    }
  }

  const selectedVendor = vendors.find(v => v.id === Number(form.vendor_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.invoice_number.trim()) { toast.error('رقم الفاتورة مطلوب'); return }
    if (!form.vendor_id) { toast.error('يجب اختيار مورد'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }
    setSaving(true)

    const wasApproved = invoice?.status === 'معتمدة'

    const payload = {
      tenant_id: tenantId, invoice_number: form.invoice_number.trim(),
      invoice_date: form.invoice_date, due_date: form.due_date || null,
      vendor_id: Number(form.vendor_id), vendor_name: selectedVendor!.name,
      vendor_vat: selectedVendor!.vat_number || null,
      po_id: form.po_id ? Number(form.po_id) : null,
      project_id: form.project_id ? Number(form.project_id) : null,
      delivery_to: form.delivery_to,
      warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate), status: _invSaveStatus, notes: form.notes || null,
    }

    let invId = invoice?.id

    if (invoice) {
      // ══ إذا كانت معتمدة — أنشئ قيد تصحيحي عكسي للقيم القديمة ══
      if (wasApproved && payload.status === 'معتمدة') {
        const oldDebitCode =
          invoice.delivery_to === 'مستودع'   ? '1130' :
          invoice.delivery_to === 'أصل ثابت' ? '1220' : '5120'

        await createJournalEntry({
      tenantId,
      date:          payload.invoice_date,
          description:   `قيد تصحيحي — تعديل فاتورة مورد ${invoice.invoice_number}`,
          referenceType: 'تصحيح فاتورة مورد',
          referenceId:   invoice.id,
          source:        'آلي',
          lines: [
            { accountCode: oldDebitCode, debit: 0,                              credit: Number(invoice.subtotal),    description: `عكس: فاتورة ${invoice.invoice_number}` },
            ...(Number(invoice.vat_amount) > 0 ? [{ accountCode: '2140', debit: 0, credit: Number(invoice.vat_amount), description: 'عكس ضريبة المدخلات' }] : []),
            { accountCode: '2110',       debit: Number(invoice.total_amount),    credit: 0,                           description: `عكس مستحق المورد ${invoice.vendor_name}` },
          ]
        })
      }
      await supabase.from('finance_vendor_invoices').update(payload).eq('id', invoice.id)
      await supabase.from('finance_vendor_invoice_items').delete().eq('invoice_id', invoice.id)
    } else {
      const { data, error } = await supabase.from('finance_vendor_invoices').insert(payload).select('id').single()
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
      invId = data.id
    }

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_vendor_invoice_items').insert(
        validItems.map(i => ({ invoice_id: invId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) }))
      )
    }

    // ══ قيد للقيم الجديدة عند الاعتماد ══
    if (payload.status === 'معتمدة' && invId) {
      const debitAccountCode =
        payload.delivery_to === 'مستودع'   ? '1130' :
        payload.delivery_to === 'أصل ثابت' ? (form.asset_type === 'مركبات' ? '1210' : form.asset_type === 'أثاث' ? '1230' : '1220') :
        '5120'
      await createJournalEntry({
      tenantId,
      date:          payload.invoice_date,
        description:   `${wasApproved ? 'تعديل ' : ''}فاتورة مورد ${payload.invoice_number} — ${payload.vendor_name}`,
        referenceType: 'فاتورة مورد',
        referenceId:   invId,
        source:        'آلي',
        lines: [
          { accountCode: debitAccountCode, debit: payload.subtotal,    credit: 0,                   description: `فاتورة ${payload.invoice_number}` },
          ...(payload.vat_amount > 0 ? [{ accountCode: '2140', debit: payload.vat_amount, credit: 0, description: 'ضريبة المدخلات' }] : []),
          { accountCode: '2110',           debit: 0,                   credit: payload.total_amount, description: `مستحق للمورد ${payload.vendor_name}` },
        ]
      })
    }

    toast.success(invoice
      ? (wasApproved ? 'تم التعديل مع قيد تصحيحي ✅' : 'تم التعديل ✅')
      : '✅ تم حفظ فاتورة المورد')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '780px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            {invoice ? 'تعديل فاتورة المورد' : 'فاتورة مورد جديدة'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', borderRadius: '6px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم الفاتورة *</label>
              <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ الفاتورة *</label>
              <input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ الاستحقاق</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ربط بأمر شراء (اختياري)</label>
            <select value={form.po_id} onChange={e => handlePOSelect(e.target.value)} className="select">
              <option value="">— بدون ربط —</option>
              {purchaseOrders.filter(p => p.status !== 'ملغي').map(p => (
                <option key={p.id} value={p.id}>{p.po_number} — {p.vendor_name}</option>
              ))}
            </select>
          </div>
          <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '14px', border: '1px solid #fecaca' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المورد *</label>
            <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select">
              <option value="">— اختر المورد —</option>
              {vendors.filter(v => v.is_active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {selectedVendor?.iban && (
              <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#991b1b' }}>IBAN: <strong>{selectedVendor.iban}</strong></div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المشروع</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
              <option value="">— مشتريات عامة —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <DeliveryField value={form.delivery_to} warehouseId={form.warehouse_id} assetType={form.asset_type}
            projects={projects} warehouses={warehouses}
            onChange={(delivery, wh) => { set('delivery_to', delivery); set('warehouse_id', wh || ''); set('asset_type', '') }}
            onAssetTypeChange={t => set('asset_type', t)} />
          <ItemsTable items={items} onChange={setItems} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ضريبة القيمة المضافة</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                  <option value={15}>15%</option><option value={0}>0% — معفي</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ملاحظات</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
              </div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          {!invoice && (
            <button onClick={() => { _poSaveStatus = 'مسودة'; handleSave() }}
              disabled={saving || !form.vendor_id}
              style={{ padding:'8px 18px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontWeight:600, fontSize:'0.875rem', display:'flex', alignItems:'center', gap:'6px', color:'#6b7280' }}>
              <Save style={{ width:'14px', height:'14px' }} />
              حفظ مسودة
            </button>
          )}
          <button onClick={() => { _invSaveStatus = invoice ? (form.status || 'معتمدة') : 'معتمدة'; handleSave() }}
            disabled={saving || !form.vendor_id} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            {invoice ? 'حفظ التعديل' : 'إصدار الفاتورة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: مرتجع مشتريات
// ════════════════════════════════════════
function PurchaseReturnModal({ invoice, vendors, tenantId, onClose, onSave }: {
  invoice: VendorInvoice | null; vendors: Vendor[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<POItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    return_number:       '',
    return_date:         today,
    return_type:         'مرتجع مشتريات',
    original_invoice_id: invoice?.id ? String(invoice.id) : '',
    vendor_id:           invoice?.vendor_id ? String(invoice.vendor_id) : '',
    vat_rate:            invoice?.vat_rate ?? 15,
    reason:              '',
    status:              'مسودة',
    notes:               '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    generateNumber()
    if (invoice?.id) loadInvoiceItems()
  }, [])

  async function generateNumber() {
    const { count } = await supabase.from('finance_purchase_returns').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    set('return_number', `PR-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`)
  }
  async function loadInvoiceItems() {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', invoice!.id).order('id')
    if (data && data.length > 0) setItems(data.map(i => ({ ...i, id: undefined })))
  }

  const selectedVendor = vendors.find(v => v.id === Number(form.vendor_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.return_number.trim()) { toast.error('رقم المرتجع مطلوب'); return }
    if (!form.vendor_id) { toast.error('اختر المورد'); return }
    if (!form.reason.trim()) { toast.error('سبب الإرجاع مطلوب'); return }
    setSaving(true)
    const payload = {
      tenant_id: tenantId, return_number: form.return_number.trim(),
      return_date: form.return_date, return_type: form.return_type,
      original_invoice_id: form.original_invoice_id ? Number(form.original_invoice_id) : null,
      vendor_id: Number(form.vendor_id), vendor_name: selectedVendor!.name,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate), reason: form.reason,
      status: form.status, notes: form.notes || null,
    }
    const { data, error } = await supabase.from('finance_purchase_returns').insert(payload).select('id').single()
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_purchase_return_items').insert(
        validItems.map(i => ({ return_id: data.id, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) }))
      )
    }
    await createJournalEntry({
      tenantId,
      date: form.return_date,
      description: `${form.return_type} ${form.return_number} — ${selectedVendor!.name}`,
      referenceType: form.return_type, referenceId: data.id, source: 'آلي',
      lines: [
        { accountCode: '2110', debit: total,    credit: 0,        description: `${form.return_type} ${form.return_number}` },
        { accountCode: '1130', debit: 0,        credit: subtotal, description: `إرجاع بضاعة — ${form.reason}` },
        ...(vatAmount > 0 ? [{ accountCode: '2140', debit: 0, credit: vatAmount, description: 'ضريبة مستردة' }] : []),
      ]
    })
    toast.success('✅ تم إنشاء المرتجع والقيد المحاسبي')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw style={{ width: '18px', height: '18px', color: '#6b7280' }} />
            مرتجع مشتريات
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم المرتجع</label>
              <input value={form.return_number} onChange={e => set('return_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>التاريخ</label>
              <input type="date" value={form.return_date} onChange={e => set('return_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>النوع</label>
              <select value={form.return_type} onChange={e => set('return_type', e.target.value)} className="select">
                {['مرتجع مشتريات', 'خصم مورد'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المورد *</label>
            <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select">
              <option value="">— اختر المورد —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>سبب الإرجاع *</label>
            <input value={form.reason} onChange={e => set('reason', e.target.value)} className="input" placeholder="مثال: بضاعة تالفة، مواصفات مختلفة..." />
          </div>
          <ItemsTable items={items} onChange={setItems} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ملاحظات</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
              </div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <RotateCcw style={{ width: '15px', height: '15px' }} />}
            إنشاء المرتجع
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: دفع فاتورة مورد
// ════════════════════════════════════════
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

function VendorPaymentModal({ invoice, tenantId, onClose, onSave }: {
  invoice: VendorInvoice; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving]             = useState(false)
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [form, setForm] = useState({
    amount:          String(invoice.total_amount),
    payment_date:    new Date().toISOString().split('T')[0],
    payment_method:  'تحويل بنكي',
    cash_account_id: '',
    reference:       '',
    notes:           '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('finance_cash_accounts')
      .select('*, fa:finance_accounts(code)')
      .eq('tenant_id', tenantId).eq('is_active', true).order('name')
      .then(({ data }) => setCashAccounts((data || []).map((a: any) => ({ ...a, account_code: a.fa?.code }))))
  }, [])

  const bankAccounts    = cashAccounts.filter(a => a.account_type === 'بنك' || a.account_type === 'حساب بنكي')
  const cashBoxes       = cashAccounts.filter(a => a.account_type === 'صندوق' || a.account_type === 'نقدية')
  const selectedAccount = cashAccounts.find(a => a.id === Number(form.cash_account_id))

  function getCreditAccountCode() {
    // account_code = كود الحساب من finance_accounts
    if (selectedAccount?.account_code) return selectedAccount.account_code
    // fallback بالكود المعروف
    if (form.payment_method === 'نقداً') return '1111'
    return '1120'
  }

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('أدخل المبلغ'); return }
    if ((form.payment_method === 'تحويل بنكي' || form.payment_method === 'شيك') && !form.cash_account_id) { toast.error('يجب تحديد الحساب البنكي'); return }
    if (form.payment_method === 'نقداً' && !form.cash_account_id) { toast.error('يجب تحديد الصندوق'); return }
    setSaving(true)

    await supabase.from('finance_vendor_invoices').update({ status: 'مدفوعة' }).eq('id', invoice.id)

    const accountLabel = selectedAccount ? `${selectedAccount.name}${selectedAccount.bank_name ? ` — ${selectedAccount.bank_name}` : ''}` : form.payment_method
    await createJournalEntry({
      tenantId,
      date: form.payment_date,
      description: `دفع فاتورة ${invoice.invoice_number} — ${invoice.vendor_name}`,
      referenceType: 'دفع مورد', referenceId: invoice.id, source: 'آلي',
      lines: [
        { accountCode: '2110',                    debit: Number(form.amount), credit: 0,                   description: `تسوية مستحق ${invoice.vendor_name}` },
        { accountCode: getCreditAccountCode() || (form.payment_method === 'نقداً' ? '1111' : '1120'), debit: 0, credit: Number(form.amount), description: `دفع عبر ${accountLabel}` },
      ]
    })

    toast.success('✅ تم تسجيل الدفعة')
    onSave(); setSaving(false)
  }

  const showList = form.payment_method === 'نقداً' ? cashBoxes : bankAccounts

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💸 دفع فاتورة — {invoice.invoice_number}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '12px', border: '1px solid #fecaca', textAlign: 'center' }}>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>المبلغ المستحق</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#c81e1e' }}>{Number(invoice.total_amount).toLocaleString()} ر.س</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{invoice.vendor_name}</div>
          </div>
          <div>
            <label style={lbl}>المبلغ</label>
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label style={lbl}>تاريخ الدفع <span style={{ color: '#c81e1e' }}>*</span></label>
            <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className="input" />
          </div>
          <div>
            <label style={lbl}>طريقة الدفع <span style={{ color: '#c81e1e' }}>*</span></label>
            <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">
              {['تحويل بنكي', 'شيك', 'نقداً'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          {showList.length > 0 && (
            <div>
              <label style={lbl}>{form.payment_method === 'نقداً' ? 'الصندوق' : 'الحساب البنكي'}</label>
              <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {showList.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank_name ? ` — ${a.bank_name}` : ''}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={lbl}>{form.payment_method === 'شيك' ? 'رقم الشيك' : 'رقم المرجع / التحويل'}</label>
            <input value={form.reference} onChange={e => set('reference', e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label style={lbl}>ملاحظات</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" placeholder="اختياري..." />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : '💸'}
            تسجيل الدفعة
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: عرض أمر الشراء
// ════════════════════════════════════════
function POViewModal({ po, items, onClose, onPrint }: { po: PurchaseOrder; items: POItem[]; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            معاينة أمر الشراء — {po.po_number}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={onPrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #fde68a', background: '#fffbeb', color: '#e6820a', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <Printer style={{ width: '15px', height: '15px' }} /> طباعة
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '2px solid #e6820a' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#e6820a' }}>{po.vendor_name}</div>
                {po.vendor_vat && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>الرقم الضريبي: {po.vendor_vat}</div>}
              </div>
              <div style={{ background: '#e6820a', color: 'white', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>أمر شراء</div>
                <div style={{ fontWeight: 800 }}>{po.po_number}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{po.po_date}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', marginBottom: '12px' }}>
              <div><span style={{ color: 'var(--text3)' }}>تاريخ الطلب:</span> <strong>{po.po_date}</strong></div>
              {po.expected_date && <div><span style={{ color: 'var(--text3)' }}>التسليم المتوقع:</span> <strong>{po.expected_date}</strong></div>}
              <div><span style={{ color: 'var(--text3)' }}>وجهة التسليم:</span> <strong>{po.delivery_to}</strong></div>
              <div><span style={{ color: 'var(--text3)' }}>الحالة:</span> <span className={'badge ' + (PO_STATUS_COLOR[po.status] || 'badge-gray')}>{po.status}</span></div>
            </div>
            {items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ background: '#e6820a', color: 'white' }}>
                    {['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '8px 10px' }}>{i.description}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{i.quantity}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text3)' }}>{i.unit}</td>
                      <td style={{ padding: '8px 10px', direction: 'ltr', textAlign: 'left' }}>{Number(i.unit_price).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#e6820a', direction: 'ltr', textAlign: 'left' }}>{Number(i.total).toLocaleString()} ر.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <TotalsBox subtotal={Number(po.subtotal)} vatRate={po.vat_rate} vatAmount={Number(po.vat_amount)} total={Number(po.total_amount)} />
          </div>
        </div>
        <div className="modal-footer"><button onClick={onClose} className="btn btn-ghost">إغلاق</button></div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: عرض فاتورة المورد
// ════════════════════════════════════════
function VInvViewModal({ inv, items, onClose, onPrint }: { inv: VendorInvoice; items: POItem[]; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            معاينة فاتورة المورد — {inv.invoice_number}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={onPrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <Printer style={{ width: '15px', height: '15px' }} /> طباعة
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '2px solid #c81e1e' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#c81e1e' }}>{inv.vendor_name}</div>
                {inv.vendor_vat && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>الرقم الضريبي: {inv.vendor_vat}</div>}
              </div>
              <div style={{ background: '#c81e1e', color: 'white', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>فاتورة مورد</div>
                <div style={{ fontWeight: 800 }}>{inv.invoice_number}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{inv.invoice_date}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', marginBottom: '12px' }}>
              <div><span style={{ color: 'var(--text3)' }}>تاريخ الفاتورة:</span> <strong>{inv.invoice_date}</strong></div>
              {inv.due_date && <div><span style={{ color: 'var(--text3)' }}>تاريخ الاستحقاق:</span> <strong>{inv.due_date}</strong></div>}
              <div><span style={{ color: 'var(--text3)' }}>وجهة التسليم:</span> <strong>{inv.delivery_to}</strong></div>
              <div><span style={{ color: 'var(--text3)' }}>الحالة:</span> <span className={'badge ' + (INV_STATUS_COLOR[inv.status] || 'badge-gray')}>{inv.status}</span></div>
            </div>
            {items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ background: '#c81e1e', color: 'white' }}>
                    {['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '8px 10px' }}>{i.description}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{i.quantity}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text3)' }}>{i.unit}</td>
                      <td style={{ padding: '8px 10px', direction: 'ltr', textAlign: 'left' }}>{Number(i.unit_price).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#c81e1e', direction: 'ltr', textAlign: 'left' }}>{Number(i.total).toLocaleString()} ر.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <TotalsBox subtotal={Number(inv.subtotal)} vatRate={inv.vat_rate} vatAmount={Number(inv.vat_amount)} total={Number(inv.total_amount)} />
          </div>
        </div>
        <div className="modal-footer"><button onClick={onClose} className="btn btn-ghost">إغلاق</button></div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function FinancePurchasesPage() {
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'returns' | 'vendors'>('orders')

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([])
  const poPagination  = usePagination(50)
  const invPagination = usePagination(50)
  const [returns,        setReturns]        = useState<PurchaseReturn[]>([])
  const [vendors,        setVendors]        = useState<Vendor[]>([])
  const [projects,       setProjects]       = useState<Project[]>([])
  const [warehouses,     setWarehouses]     = useState<Warehouse[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')

  const [showPOModal,     setShowPOModal]     = useState(false)
  const [showInvModal,    setShowInvModal]    = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showPayModal,    setShowPayModal]    = useState(false)
  const [showViewPO,      setShowViewPO]      = useState(false)
  const [showViewVInv,    setShowViewVInv]    = useState(false)

  const [editPO,        setEditPO]        = useState<PurchaseOrder | null>(null)
  const [editInv,       setEditInv]       = useState<VendorInvoice | null>(null)
  const [editVendor,    setEditVendor]    = useState<Vendor | null>(null)
  const [returnInvoice, setReturnInvoice] = useState<VendorInvoice | null>(null)
  const [payInvoice,    setPayInvoice]    = useState<VendorInvoice | null>(null)
  const [convertPO,     setConvertPO]     = useState<PurchaseOrder | null>(null)
  const [viewPO,        setViewPO]        = useState<PurchaseOrder | null>(null)
  const [viewPOItems,   setViewPOItems]   = useState<POItem[]>([])
  const [viewVInv,      setViewVInv]      = useState<VendorInvoice | null>(null)
  const [viewVInvItems, setViewVInvItems] = useState<POItem[]>([])

  useEffect(() => { loadAll() }, [tenant?.id])

  async function handleViewPO(po: PurchaseOrder) {
    const { data } = await supabase.from('finance_purchase_order_items').select('*').eq('po_id', po.id).order('id')
    setViewPOItems(data || []); setViewPO(po); setShowViewPO(true)
  }
  async function handleViewVInv(inv: VendorInvoice) {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    setViewVInvItems(data || []); setViewVInv(inv); setShowViewVInv(true)
  }
  async function handlePrintPO(po: PurchaseOrder) {
    const { data } = await supabase.from('finance_purchase_order_items').select('*').eq('po_id', po.id).order('id')
    const items = data || []
    const win = window.open('', '_blank', 'width=900,height=700'); if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>أمر شراء ${po.po_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1a2e;direction:rtl}.page{max-width:794px;margin:0 auto;padding:30px 40px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #e6820a}.badge{background:#e6820a;color:white;padding:10px 20px;border-radius:10px;text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#e6820a;color:white}th{padding:10px 12px;text-align:right;font-size:12px}tbody tr{border-bottom:1px solid #f1f5f9}td{padding:9px 12px;font-size:13px}.totals-box{width:260px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-right:auto}@media print{.no-print{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
<div class="page">
<div class="header"><div><div style="font-size:20px;font-weight:800;color:#e6820a">${po.vendor_name}</div>${po.vendor_vat ? `<div style="font-size:12px;color:#64748b">الرقم الضريبي: ${po.vendor_vat}</div>` : ''}</div>
<div class="badge"><div style="font-size:11px;opacity:0.85">أمر شراء</div><div style="font-size:18px;font-weight:800">${po.po_number}</div><div style="font-size:11px;margin-top:4px;opacity:0.85">${po.po_date}</div></div></div>
<table><thead><tr><th>الوصف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
${items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${Number(i.unit_price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('')}
</tbody></table>
<div style="display:flex;justify-content:flex-end"><div class="totals-box">
<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span>قبل الضريبة</span><span>${Number(po.subtotal).toLocaleString()} ر.س</span></div>
<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span>ضريبة (${po.vat_rate}%)</span><span>${Number(po.vat_amount).toLocaleString()} ر.س</span></div>
<div style="border-top:2px solid #e6820a;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;font-size:15px;color:#e6820a"><span>الإجمالي</span><span>${Number(po.total_amount).toLocaleString()} ر.س</span></div>
</div></div>
${po.notes ? `<div style="margin-top:14px;padding:10px 14px;background:#fffbeb;border-radius:8px;font-size:12px"><strong>ملاحظات:</strong> ${po.notes}</div>` : ''}
</div><div class="no-print" style="text-align:center;padding:16px;background:#f9fafb">
<button onclick="window.print()" style="padding:10px 28px;background:#e6820a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-left:10px">🖨️ طباعة</button>
<button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button>
</div></body></html>`)
    win.document.close()
  }
  async function handlePrintVInv(inv: VendorInvoice) {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    const items = data || []
    const win = window.open('', '_blank', 'width=900,height=700'); if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة مورد ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1a2e;direction:rtl}.page{max-width:794px;margin:0 auto;padding:30px 40px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #c81e1e}.badge{background:#c81e1e;color:white;padding:10px 20px;border-radius:10px;text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#c81e1e;color:white}th{padding:10px 12px;text-align:right;font-size:12px}tbody tr{border-bottom:1px solid #f1f5f9}td{padding:9px 12px;font-size:13px}.totals-box{width:260px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-right:auto}@media print{.no-print{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
<div class="page">
<div class="header"><div><div style="font-size:20px;font-weight:800;color:#c81e1e">${inv.vendor_name}</div>${inv.vendor_vat ? `<div style="font-size:12px;color:#64748b">الرقم الضريبي: ${inv.vendor_vat}</div>` : ''}</div>
<div class="badge"><div style="font-size:11px;opacity:0.85">فاتورة مورد</div><div style="font-size:18px;font-weight:800">${inv.invoice_number}</div><div style="font-size:11px;margin-top:4px;opacity:0.85">${inv.invoice_date}</div></div></div>
<table><thead><tr><th>الوصف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
${items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${Number(i.unit_price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('')}
</tbody></table>
<div style="display:flex;justify-content:flex-end"><div class="totals-box">
<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span>قبل الضريبة</span><span>${Number(inv.subtotal).toLocaleString()} ر.س</span></div>
<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span>ضريبة (${inv.vat_rate}%)</span><span>${Number(inv.vat_amount).toLocaleString()} ر.س</span></div>
<div style="border-top:2px solid #c81e1e;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;font-size:15px;color:#c81e1e"><span>الإجمالي</span><span>${Number(inv.total_amount).toLocaleString()} ر.س</span></div>
</div></div>
</div><div class="no-print" style="text-align:center;padding:16px;background:#f9fafb">
<button onclick="window.print()" style="padding:10px 28px;background:#c81e1e;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-left:10px">🖨️ طباعة</button>
<button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button>
</div></body></html>`)
    win.document.close()
  }

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [retRes, venRes, projRes, whRes] = await Promise.all([
      supabase.from('finance_purchase_returns').select('*').eq('tenant_id', tenant.id).order('return_date', { ascending: false }).limit(200),
      supabase.from('finance_vendors').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('warehouses').select('id, name, wh_type').eq('tenant_id', tenant.id),
    ])
    setReturns(retRes.data || [])
    setVendors(venRes.data || [])
    setProjects(projRes.data || [])
    setWarehouses(whRes.data || [])
    await Promise.all([loadPurchaseOrders(1), loadVendorInvoices(1)])
    setLoading(false)
  }

  async function loadPurchaseOrders(page = 1, q = search) {
    if (!tenant) return
    const from = (page - 1) * 50
    const to   = from + 49
    let query = supabase
      .from('finance_purchase_orders')
      .select('*, vendor:finance_vendors(name,phone), project:projects(name)', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('po_date', { ascending: false })
      .range(from, to)
    if (q) query = query.or(`po_number.ilike.%${q}%,vendor_name.ilike.%${q}%`)
    const { data, count } = await query
    const ids = (data || []).map((p: any) => p.id)
    let invPoIds = new Set<number>()
    if (ids.length > 0) {
      const { data: invs } = await supabase.from('finance_vendor_invoices').select('po_id').in('po_id', ids)
      invPoIds = new Set((invs || []).map((i: any) => i.po_id).filter(Boolean))
    }
    setPurchaseOrders((data || []).map((po: any) => ({ ...po, has_invoice: invPoIds.has(po.id) })))
    poPagination.setTotal(count || 0)
  }

  async function loadVendorInvoices(page = 1, q = search) {
    if (!tenant) return
    const from = (page - 1) * 50
    const to   = from + 49
    let query = supabase
      .from('finance_vendor_invoices')
      .select('*, vendor:finance_vendors(name,iban), project:projects(name), po:finance_purchase_orders(po_number)', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('invoice_date', { ascending: false })
      .range(from, to)
    if (q) query = query.or(`invoice_number.ilike.%${q}%,vendor_name.ilike.%${q}%`)
    const { data, count } = await query
    setVendorInvoices(data || [])
    invPagination.setTotal(count || 0)
  }

  async function deletePO(id: number, status: string) {
    if (status !== 'مسودة') { toast.error('لا يمكن حذف طلب مرسل'); return }
    if (!confirm('حذف هذا الطلب؟')) return
    await supabase.from('finance_purchase_orders').delete().eq('id', id)
    setPurchaseOrders(p => p.filter(x => x.id !== id)); toast.success('تم الحذف')
  }
  async function deleteInv(id: number, status: string) {
    if (status !== 'مسودة') { toast.error('لا يمكن حذف فاتورة معتمدة — استخدم المرتجع'); return }
    if (!confirm('حذف هذه الفاتورة؟')) return
    await supabase.from('finance_vendor_invoices').delete().eq('id', id)
    setVendorInvoices(p => p.filter(x => x.id !== id)); toast.success('تم الحذف')
  }

  const today     = new Date().toISOString().split('T')[0]
  const totalPO   = purchaseOrders.reduce((s, p) => s + Number(p.total_amount), 0)
  const totalInv  = vendorInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalPaid = vendorInvoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
  const totalDue  = vendorInvoices.filter(i => i.status !== 'مدفوعة' && i.status !== 'ملغاة').reduce((s, i) => s + Number(i.total_amount), 0)

  // الفلترة server-side — purchaseOrders و vendorInvoices هي الصفحة الحالية فقط
  const filteredPOs  = purchaseOrders
  const filteredInvs = vendorInvoices

  const TABS = [
    { id: 'orders',   label: '📋 أوامر الشراء',   color: '#e6820a' },
    { id: 'invoices', label: '🧾 فواتير الموردين', color: '#c81e1e' },
    { id: 'returns',  label: '↩️ المرتجعات',      color: '#6b7280' },
    { id: 'vendors',  label: '🏭 الموردون',        color: '#1a56db' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart style={{ width: '20px', height: '20px', color: '#e6820a' }} />
            المشتريات
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>أوامر الشراء — فواتير الموردين — المرتجعات</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'orders'   && <button onClick={() => { setEditPO(null); setShowPOModal(true) }} className="btn btn-primary" style={{ background: '#e6820a' }}><Plus style={{ width: '16px', height: '16px' }} /> أمر شراء</button>}
          {activeTab === 'invoices' && <button onClick={() => { setEditInv(null); setConvertPO(null); setShowInvModal(true) }} className="btn btn-primary" style={{ background: '#c81e1e' }}><Plus style={{ width: '16px', height: '16px' }} /> فاتورة مورد</button>}
          {activeTab === 'returns'  && <button onClick={() => { setReturnInvoice(null); setShowReturnModal(true) }} className="btn btn-primary" style={{ background: '#6b7280' }}><Plus style={{ width: '16px', height: '16px' }} /> مرتجع</button>}
          {activeTab === 'vendors'  && <button onClick={() => { setEditVendor(null); setShowVendorModal(true) }} className="btn btn-primary" style={{ background: '#1a56db' }}><Plus style={{ width: '16px', height: '16px' }} /> مورد جديد</button>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي أوامر الشراء', value: totalPO,   color: '#e6820a', bg: '#fffbeb' },
          { label: 'إجمالي الفواتير',     value: totalInv,  color: '#c81e1e', bg: '#fef2f2' },
          { label: 'إجمالي المدفوع',      value: totalPaid, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'المستحق للموردين',    value: totalDue,  color: '#374151', bg: '#f3f4f6' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: kpi.color }}>{Number(kpi.value).toLocaleString()} ر.س</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any); setSearch('') }}
            style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? `0 2px 8px ${t.color}44` : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* بحث */}
      <div style={{ position: 'relative', maxWidth: '360px' }}>
        <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
        <input value={search} onChange={e => {
          setSearch(e.target.value)
          if (activeTab === 'orders')   loadPurchaseOrders(1, e.target.value)
          if (activeTab === 'invoices') loadVendorInvoices(1, e.target.value)
        }} placeholder="بحث..." className="input" style={{ paddingRight: '32px' }} />
      </div>

      {/* ══ أوامر الشراء ══ */}
      {activeTab === 'orders' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#e6820a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : filteredPOs.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>لا توجد أوامر شراء</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم الطلب', 'المورد', 'التاريخ', 'التسليم', 'الإجمالي', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.map(po => (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                      onClick={() => handleViewPO(po)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#e6820a' }}>{po.po_number}</td>
                      <td style={{ padding: '10px 14px' }}>{po.vendor_name}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{po.po_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{po.delivery_to}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#e6820a' }}>{Number(po.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px' }}><span className={'badge ' + (PO_STATUS_COLOR[po.status] || 'badge-gray')}>{po.status}</span></td>
                      <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <button onClick={() => handlePrintPO(po)} title="طباعة"
                            style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', color: '#e6820a', cursor: 'pointer' }}>
                            <Printer style={{ width: '12px', height: '12px' }} />
                          </button>
                          <button onClick={() => { setEditPO(po); setShowPOModal(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '12px', height: '12px' }} />
                          </button>
                          {!po.has_invoice && (
                            <button onClick={() => { setConvertPO(po); setEditInv(null); setShowInvModal(true) }}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              تحويل لفاتورة
                            </button>
                          )}
                          {po.status === 'مسودة' && (
                            <button onClick={() => deletePO(po.id, po.status)}
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}>
                              <Trash2 style={{ width: '12px', height: '12px' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <poPagination.PaginationBar color="#e6820a" />
        </div>
      )}

      {/* ══ فواتير الموردين ══ */}
      {activeTab === 'invoices' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#c81e1e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : filteredInvs.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>لا توجد فواتير</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم الفاتورة', 'المورد', 'التاريخ', 'الاستحقاق', 'التسليم', 'الإجمالي', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvs.map(inv => {
                    const isOverdue = inv.status !== 'مدفوعة' && inv.status !== 'ملغاة' && inv.due_date && inv.due_date < today
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                        onClick={() => handleViewVInv(inv)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{inv.invoice_number}</td>
                        <td style={{ padding: '10px 14px' }}>{inv.vendor_name}</td>
                        <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{inv.invoice_date}</td>
                        <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: isOverdue ? '#c81e1e' : 'var(--text3)' }}>{inv.due_date || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{inv.delivery_to}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#c81e1e' }}>{Number(inv.total_amount).toLocaleString()} ر.س</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className={'badge ' + (INV_STATUS_COLOR[isOverdue ? 'متأخرة' : inv.status] || 'badge-gray')}>{isOverdue ? 'متأخرة' : inv.status}</span>
                        </td>
                        <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            <button onClick={() => handlePrintVInv(inv)} title="طباعة"
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}>
                              <Printer style={{ width: '12px', height: '12px' }} />
                            </button>
                            {/* تعديل — متاح لجميع الحالات */}
                            <button onClick={() => { setEditInv(inv); setConvertPO(null); setShowInvModal(true) }}
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}
                              title="تعديل الفاتورة">
                              <Pencil style={{ width: '12px', height: '12px' }} />
                            </button>
                            {/* اعتماد للمسودة */}
                            {inv.status === 'مسودة' && (
                              <button onClick={async e => {
                                e.stopPropagation()
                                const debitCode = inv.delivery_to === 'مستودع' ? '1130' : inv.delivery_to === 'أصل ثابت' ? '1220' : '5120'
                                await supabase.from('finance_vendor_invoices').update({ status: 'معتمدة' }).eq('id', inv.id)
                                await createJournalEntry({
        tenantId: tenant!.id,
        date: inv.invoice_date,
                                  description: `فاتورة مورد ${inv.invoice_number} — ${inv.vendor_name}`,
                                  referenceType: 'فاتورة مورد', referenceId: inv.id, source: 'آلي',
                                  lines: [
                                    { accountCode: debitCode,  debit: Number(inv.subtotal),    credit: 0,                      description: `فاتورة ${inv.invoice_number}` },
                                    ...(Number(inv.vat_amount) > 0 ? [{ accountCode: '2140', debit: Number(inv.vat_amount), credit: 0, description: 'ضريبة المدخلات' }] : []),
                                    { accountCode: '2110',     debit: 0,                       credit: Number(inv.total_amount), description: `مستحق للمورد ${inv.vendor_name}` },
                                  ]
                                })
                                toast.success('✅ تم الاعتماد والقيد المحاسبي')
                                loadAll()
                              }}
                              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                ✓ اعتماد
                              </button>
                            )}
                            {/* دفع للمعتمدة */}
                            {inv.status === 'معتمدة' && (
                              <button onClick={() => { setPayInvoice(inv); setShowPayModal(true) }}
                                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                دفع
                              </button>
                            )}
                            {/* مرتجع */}
                            {(inv.status === 'معتمدة' || inv.status === 'مدفوعة') && (
                              <button onClick={() => { setReturnInvoice(inv); setShowReturnModal(true) }}
                                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                مرتجع
                              </button>
                            )}
                            {/* حذف للمسودة */}
                            {inv.status === 'مسودة' && (
                              <button onClick={() => deleteInv(inv.id, inv.status)}
                                style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}>
                                <Trash2 style={{ width: '12px', height: '12px' }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <invPagination.PaginationBar color="#c81e1e" />
        </div>
      )}

      {/* ══ المرتجعات ══ */}
      {activeTab === 'returns' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {returns.filter(r => !search || r.return_number.includes(search) || r.vendor_name.includes(search)).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد مرتجعات</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم المرتجع', 'المورد', 'التاريخ', 'النوع', 'الإجمالي', 'السبب', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {returns.filter(r => !search || r.return_number.includes(search) || r.vendor_name.includes(search)).map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#6b7280' }}>{r.return_number}</td>
                      <td style={{ padding: '10px 14px' }}>{r.vendor_name}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{r.return_date}</td>
                      <td style={{ padding: '10px 14px' }}><span className="badge badge-gray">{r.return_type}</span></td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{Number(r.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{r.reason || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><span className="badge badge-gray">{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ الموردون ══ */}
      {activeTab === 'vendors' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {vendors.filter(v => !search || v.name.includes(search)).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا يوجد موردون</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['المورد', 'النوع', 'الرقم الضريبي', 'الهاتف', 'المدينة', 'IBAN', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendors.filter(v => !search || v.name.includes(search)).map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{v.name}</td>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-amber">{v.vendor_type}</span></td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontFamily: 'monospace', color: v.vat_number ? '#0ea77b' : '#e6820a' }}>
                        {v.vat_number || '⚠️ غير مُدخل'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{v.phone || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{v.city || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text3)' }}>
                        {v.iban ? v.iban.substring(0, 10) + '...' : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}><span className={'badge ' + (v.is_active ? 'badge-green' : 'badge-gray')}>{v.is_active ? 'نشط' : 'موقوف'}</span></td>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => { setEditVendor(v); setShowVendorModal(true) }} className="btn btn-ghost btn-xs">
                          <Pencil style={{ width: '13px', height: '13px' }} /> تعديل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* المودالات */}
      {showPOModal && (
        <POModal po={editPO} vendors={vendors} projects={projects} warehouses={warehouses}
          tenantId={tenant!.id} onClose={() => { setShowPOModal(false); setEditPO(null) }}
          onSave={() => { setShowPOModal(false); setEditPO(null); loadAll() }} />
      )}
      {showInvModal && (
        <VendorInvoiceModal invoice={editInv} convertFromPO={convertPO} vendors={vendors} projects={projects}
          warehouses={warehouses} purchaseOrders={purchaseOrders} tenantId={tenant!.id}
          onClose={() => { setShowInvModal(false); setEditInv(null); setConvertPO(null) }}
          onSave={() => { setShowInvModal(false); setEditInv(null); setConvertPO(null); loadAll() }} />
      )}
      {showReturnModal && (
        <PurchaseReturnModal invoice={returnInvoice} vendors={vendors} tenantId={tenant!.id}
          onClose={() => { setShowReturnModal(false); setReturnInvoice(null) }}
          onSave={() => { setShowReturnModal(false); setReturnInvoice(null); loadAll() }} />
      )}
      {showVendorModal && (
        <VendorModal vendor={editVendor} tenantId={tenant!.id}
          onClose={() => { setShowVendorModal(false); setEditVendor(null) }}
          onSave={() => { setShowVendorModal(false); setEditVendor(null); loadAll() }} />
      )}
      {showPayModal && payInvoice && (
        <VendorPaymentModal invoice={payInvoice} tenantId={tenant!.id}
          onClose={() => { setShowPayModal(false); setPayInvoice(null) }}
          onSave={() => { setShowPayModal(false); setPayInvoice(null); loadAll() }} />
      )}
      {showViewPO && viewPO && (
        <POViewModal po={viewPO} items={viewPOItems}
          onClose={() => { setShowViewPO(false); setViewPO(null) }}
          onPrint={() => handlePrintPO(viewPO)} />
      )}
      {showViewVInv && viewVInv && (
        <VInvViewModal inv={viewVInv} items={viewVInvItems}
          onClose={() => { setShowViewVInv(false); setViewVInv(null) }}
          onPrint={() => handlePrintVInv(viewVInv)} />
      )}
    </div>
  )
}
