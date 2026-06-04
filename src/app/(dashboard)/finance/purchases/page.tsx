'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Printer, Trash2, Pencil, Search, ShoppingCart, Users, RotateCcw, FileText, CheckCircle, Warehouse, MapPin, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

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
  status: string; notes?: string
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

type Project = { id: number; name: string }
type Warehouse = { id: number; name: string; wh_type: string }

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
    if (k === 'quantity' || k === 'unit_price') {
      next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price)
    }
    onChange(next)
  }
  function add() { onChange([...items, { description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]) }
  function remove(idx: number) { if (items.length > 1) onChange(items.filter((_, i) => i !== idx)) }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>البنود</label>
        <button type="button" onClick={add} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
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
                <td style={{ padding: '6px 8px' }}>
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
                    {['وحدة', 'م²', 'م طولي', 'طن', 'كجم', 'لتر', 'يوم', 'ساعة', 'مقطوعة', 'كرتون', 'رول'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input type="number" value={item.unit_price} onChange={e => update(idx, 'unit_price', e.target.value)}
                    style={{ width: '100px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                </td>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: '#e6820a', whiteSpace: 'nowrap' }}>
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
// مكوّن: ملخص الإجماليات
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
// مكوّن: حقل اختيار وجهة التسليم
// ════════════════════════════════════════
function DeliveryField({ value, warehouseId, projects, warehouses, onChange }: {
  value: string; warehouseId?: string; projects: Project[]; warehouses: Warehouse[]
  onChange: (delivery: string, warehouseId?: string) => void
}) {
  return (
    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 14px' }}>
      <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0369a1', display: 'block', marginBottom: '10px' }}>
        📦 وجهة التسليم / تصنيف الشراء
      </label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { val: 'مستودع',      icon: '🏪', label: 'مستودع',            desc: 'يُضاف للمخزون' },
          { val: 'موقع العمل',  icon: '🏗️', label: 'موقع العمل',        desc: 'مباشرة للمشروع' },
          { val: 'أصل ثابت',   icon: '🏭', label: 'أصل ثابت',          desc: 'سيارة / معدة / جهاز' },
        ].map(opt => (
          <button key={opt.val} type="button" onClick={() => onChange(opt.val, undefined)}
            style={{ flex: 1, minWidth: '100px', padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
              borderColor: value === opt.val ? '#0369a1' : 'var(--border)',
              background: value === opt.val ? '#e0f2fe' : 'white',
              color: value === opt.val ? '#0369a1' : 'var(--text3)' }}>
            <div>{opt.icon} {opt.label}</div>
            <div style={{ fontSize: '0.68rem', marginTop: '2px', opacity: 0.7 }}>{opt.desc}</div>
          </button>
        ))}
      </div>
      {value === 'مستودع' && (
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>اختر المستودع</label>
          <select value={warehouseId || ''} onChange={e => onChange(value, e.target.value)} className="select">
            <option value="">— اختر المستودع —</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      )}
      {value === 'موقع العمل' && (
        <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.78rem', color: '#92400e' }}>
          ⚠️ البضاعة ستُرسل مباشرة لموقع العمل ولن تُضاف للمخزون
        </div>
      )}
      {value === 'أصل ثابت' && (
        <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', fontSize: '0.78rem', color: '#065f46', border: '1px solid #bbf7d0' }}>
          ✅ سيُسجَّل كأصل ثابت — يمكن إدارة الأصول الثابتة لاحقاً من قسم مخصص
        </div>
      )}
    </div>
  )
}

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
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['مورد', 'مقاول', 'مقدم خدمة'].map(t => (
              <button key={t} type="button" onClick={() => set('vendor_type', t)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                  borderColor: form.vendor_type === t ? '#e6820a' : 'var(--border)',
                  background: form.vendor_type === t ? '#fffbeb' : 'white',
                  color: form.vendor_type === t ? '#e6820a' : 'var(--text3)' }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المورد *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                الرقم الضريبي
                {form.vat_number && <span style={{ marginRight: '6px', fontSize: '0.72rem', color: vatValid ? '#0ea77b' : '#c81e1e' }}>{vatValid ? '✓' : '✗ 15 رقم'}</span>}
              </label>
              <input value={form.vat_number} onChange={e => set('vat_number', e.target.value.replace(/\D/g, '').slice(0, 15))} className="input" dir="ltr" maxLength={15} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">السجل التجاري</label>
              <input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الهاتف</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">شخص التواصل</label>
              <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم IBAN</label>
              <input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} className="input" dir="ltr" placeholder="SA..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المدينة</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} className="input" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
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
    const num = String((count || 0) + 1).padStart(4, '0')
    set('po_number', `PO-${new Date().getFullYear()}-${num}`)
  }

  const selectedVendor = vendors.find(v => v.id === Number(form.vendor_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.po_number.trim()) { toast.error('رقم الطلب مطلوب'); return }
    if (!form.vendor_id) { toast.error('يجب اختيار مورد'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }
    if (po && po.status !== 'مسودة') { toast.error('لا يمكن تعديل الطلب بعد الإرسال'); return }
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
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الطلب *</label>
              <input value={form.po_number} onChange={e => set('po_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الطلب *</label>
              <input type="date" value={form.po_date} onChange={e => set('po_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ التسليم المتوقع</label>
              <input type="date" value={form.expected_date} onChange={e => set('expected_date', e.target.value)} className="input" />
            </div>
          </div>

          {/* المورد */}
          <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '14px', border: '1px solid #fde68a' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المورد * — يجب اختيار مورد مضاف مسبقاً</label>
            <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select">
              <option value="">— اختر المورد —</option>
              {vendors.filter(v => v.is_active).map(v => (
                <option key={v.id} value={v.id}>{v.name} {v.vendor_type !== 'مورد' ? '(' + v.vendor_type + ')' : ''}</option>
              ))}
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— مشتريات عامة —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {['مسودة', 'مرسل', 'مستلم جزئياً', 'مستلم', 'ملغي'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* وجهة التسليم */}
          <DeliveryField
            value={form.delivery_to}
            warehouseId={form.warehouse_id}
            projects={projects}
            warehouses={warehouses}
            onChange={(delivery, wh) => { set('delivery_to', delivery); set('warehouse_id', wh || '') }}
          />

          <ItemsTable items={items} onChange={setItems} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نسبة ضريبة القيمة المضافة</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                  <option value={15}>15% — المعيارية</option>
                  <option value={0}>0% — معفي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} />
              </div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.vendor_id} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
            {po ? 'حفظ التعديل' : 'إنشاء أمر الشراء'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: فاتورة مورد
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
    vat_rate:       invoice?.vat_rate       ?? 15,
    status:         invoice?.status         || 'مسودة',
    notes:          invoice?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (invoice) {
      loadItems()
    } else {
      generateNumber()
      // إذا تحويل من PO — نملأ البيانات تلقائياً
      if (convertFromPO) {
        setForm(f => ({
          ...f,
          vendor_id:    convertFromPO.vendor_id    ? String(convertFromPO.vendor_id) : '',
          po_id:        String(convertFromPO.id),
          project_id:   convertFromPO.project_id   ? String(convertFromPO.project_id) : '',
          delivery_to:  convertFromPO.delivery_to  || 'مستودع',
          warehouse_id: convertFromPO.warehouse_id ? String(convertFromPO.warehouse_id) : '',
          vat_rate:     convertFromPO.vat_rate      ?? 15,
        }))
        // نجلب بنود الـ PO
        supabase.from('finance_purchase_order_items')
          .select('*').eq('po_id', convertFromPO.id).order('id')
          .then(({ data }) => {
            if (data && data.length > 0) {
              setItems(data.map(i => ({ description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, total: i.total })))
            }
          })
      }
    }
  }, [])

  async function loadItems() {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', invoice!.id).order('id')
    if (data && data.length > 0) setItems(data)
  }

  async function generateNumber() {
    const { count } = await supabase.from('finance_vendor_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const num = String((count || 0) + 1).padStart(4, '0')
    set('invoice_number', `VINV-${new Date().getFullYear()}-${num}`)
  }

  // عند اختيار PO — نملأ البيانات تلقائياً
  async function handlePOSelect(poId: string) {
    set('po_id', poId)
    if (!poId) return
    const po = purchaseOrders.find(p => p.id === Number(poId))
    if (po) {
      set('vendor_id', String(po.vendor_id || ''))
      set('project_id', String(po.project_id || ''))
      set('delivery_to', po.delivery_to)
      set('warehouse_id', String(po.warehouse_id || ''))
      // نجلب بنود الـ PO
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
      vat_rate: Number(form.vat_rate), status: form.status, notes: form.notes || null,
    }

    let invId = invoice?.id
    if (invoice) {
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
    toast.success(invoice ? 'تم التعديل ✅' : '✅ تم حفظ فاتورة المورد')
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
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الفاتورة *</label>
              <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الفاتورة *</label>
              <input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الاستحقاق</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>

          {/* ربط بأمر شراء */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ربط بأمر شراء (اختياري — يملأ البيانات تلقائياً)</label>
            <select value={form.po_id} onChange={e => handlePOSelect(e.target.value)} className="select">
              <option value="">— بدون ربط —</option>
              {purchaseOrders.filter(p => p.status !== 'ملغي').map(p => (
                <option key={p.id} value={p.id}>{p.po_number} — {p.vendor_name}</option>
              ))}
            </select>
          </div>

          {/* المورد */}
          <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '14px', border: '1px solid #fecaca' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المورد *</label>
            <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select">
              <option value="">— اختر المورد —</option>
              {vendors.filter(v => v.is_active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {selectedVendor?.iban && (
              <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#991b1b' }}>
                IBAN: <strong>{selectedVendor.iban}</strong>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
              <option value="">— مشتريات عامة —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* وجهة التسليم */}
          <DeliveryField
            value={form.delivery_to}
            warehouseId={form.warehouse_id}
            projects={projects}
            warehouses={warehouses}
            onChange={(delivery, wh) => { set('delivery_to', delivery); set('warehouse_id', wh || '') }}
          />

          <ItemsTable items={items} onChange={setItems} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ضريبة القيمة المضافة</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                  <option value={15}>15%</option><option value={0}>0% — معفي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['مسودة', 'معتمدة', 'مدفوعة', 'ملغاة'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
              </div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.vendor_id} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
            {invoice ? 'حفظ التعديل' : 'حفظ الفاتورة'}
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
    const num = String((count || 0) + 1).padStart(4, '0')
    set('return_number', `PR-${new Date().getFullYear()}-${num}`)
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
    toast.success('✅ تم إنشاء مرتجع المشتريات')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            مرتجع مشتريات / إشعار مدين
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['مرتجع مشتريات', 'إشعار مدين'].map(t => (
              <button key={t} type="button" onClick={() => set('return_type', t)}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
                  borderColor: form.return_type === t ? '#e6820a' : 'var(--border)',
                  background: form.return_type === t ? '#fffbeb' : 'white',
                  color: form.return_type === t ? '#e6820a' : 'var(--text3)' }}>
                {t === 'مرتجع مشتريات' ? '↩️ مرتجع مشتريات' : '📄 إشعار مدين'}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الرقم المرجعي *</label>
              <input value={form.return_number} onChange={e => set('return_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ *</label>
              <input type="date" value={form.return_date} onChange={e => set('return_date', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المورد *</label>
            <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select">
              <option value="">— اختر المورد —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">سبب الإرجاع *</label>
            <input value={form.reason} onChange={e => set('reason', e.target.value)} className="input" placeholder="مثال: بضاعة تالفة، مواصفات مختلفة..." />
          </div>
          <ItemsTable items={items} onChange={setItems} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['مسودة', 'معتمد', 'مُطبَّق'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
              </div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw style={{ width: '15px', height: '15px' }} />}
            إنشاء المرتجع
          </button>
        </div>
      </div>
    </div>
  )
}


// ════════════════════════════════════════
// مودال: عرض أمر الشراء
// ════════════════════════════════════════
function POViewModal({ po, items, onClose, onPrint }: {
  po: PurchaseOrder; items: POItem[]; onClose: () => void; onPrint: () => void
}) {
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            معاينة أمر الشراء — {po.po_number}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={onPrint}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #fde68a', background: '#fffbeb', color: '#e6820a', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <Printer style={{ width: '15px', height: '15px' }} /> طباعة
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: '0' }}>
          <div style={{ padding: '24px', direction: 'rtl' }}>

            {/* هيدر */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '16px', borderBottom: '3px solid #e6820a' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#e6820a', marginBottom: '4px' }}>{po.vendor_name}</div>
                {po.vendor_vat && <div style={{ fontSize: '12px', color: '#64748b' }}>الرقم الضريبي: {po.vendor_vat}</div>}
              </div>
              <div style={{ background: '#e6820a', color: 'white', padding: '10px 20px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>أمر شراء</div>
                <div style={{ fontSize: '16px', fontWeight: 800 }}>{po.po_number}</div>
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.85 }}>{po.po_date}</div>
              </div>
            </div>

            {/* التفاصيل */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'تاريخ الطلب', value: po.po_date },
                { label: 'تاريخ التسليم المتوقع', value: po.expected_date || '—' },
                { label: 'وجهة التسليم', value: po.delivery_to },
                { label: 'الحالة', value: po.status },
                { label: 'المشروع', value: po.project?.name || 'مشتريات عامة' },
              ].map(f => (
                <div key={f.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '3px' }}>{f.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* البنود */}
            {items.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#e6820a', color: 'white' }}>
                      <th style={{ padding: '9px 12px', textAlign: 'right', width: '40%' }}>الوصف</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center' }}>الكمية</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center' }}>الوحدة</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left' }}>سعر الوحدة</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left' }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '9px 12px' }}>{item.description}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>{item.unit}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'left', direction: 'ltr' }}>{Number(item.unit_price).toLocaleString('ar-SA')}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'left', direction: 'ltr', fontWeight: 600 }}>{Number(item.total).toLocaleString('ar-SA')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* الإجماليات */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '260px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>قبل الضريبة</span>
                  <span style={{ fontWeight: 600 }}>{Number(po.subtotal).toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>ضريبة ({po.vat_rate}%)</span>
                  <span style={{ fontWeight: 600, color: '#e6820a' }}>{Number(po.vat_amount).toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div style={{ borderTop: '2px solid #e6820a', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px', color: '#e6820a' }}>
                  <span>الإجمالي</span>
                  <span>{Number(po.total_amount).toLocaleString('ar-SA')} ر.س</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: عرض فاتورة المورد
// ════════════════════════════════════════
function VInvViewModal({ inv, items, onClose, onPrint }: {
  inv: VendorInvoice; items: POItem[]; onClose: () => void; onPrint: () => void
}) {
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            معاينة فاتورة المورد — {inv.invoice_number}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={onPrint}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <Printer style={{ width: '15px', height: '15px' }} /> طباعة
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: '0' }}>
          <div style={{ padding: '24px', direction: 'rtl' }}>

            {/* هيدر */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '16px', borderBottom: '3px solid #c81e1e' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#c81e1e', marginBottom: '4px' }}>{inv.vendor_name}</div>
                {inv.vendor_vat && <div style={{ fontSize: '12px', color: '#64748b' }}>الرقم الضريبي: {inv.vendor_vat}</div>}
                {inv.vendor?.iban && <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>IBAN: {inv.vendor.iban}</div>}
              </div>
              <div style={{ background: '#c81e1e', color: 'white', padding: '10px 20px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>فاتورة مورد</div>
                <div style={{ fontSize: '16px', fontWeight: 800 }}>{inv.invoice_number}</div>
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.85 }}>{inv.invoice_date}</div>
              </div>
            </div>

            {/* التفاصيل */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'تاريخ الفاتورة', value: inv.invoice_date },
                { label: 'تاريخ الاستحقاق', value: inv.due_date || '—' },
                { label: 'أمر الشراء المرتبط', value: inv.po?.po_number || '—' },
                { label: 'وجهة التسليم', value: inv.delivery_to },
                { label: 'المشروع', value: inv.project?.name || 'مشتريات عامة' },
                { label: 'الحالة', value: inv.status },
              ].map(f => (
                <div key={f.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '3px' }}>{f.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* البنود */}
            {items.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#c81e1e', color: 'white' }}>
                      <th style={{ padding: '9px 12px', textAlign: 'right', width: '40%' }}>الوصف</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center' }}>الكمية</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center' }}>الوحدة</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left' }}>سعر الوحدة</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left' }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '9px 12px' }}>{item.description}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>{item.unit}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'left', direction: 'ltr' }}>{Number(item.unit_price).toLocaleString('ar-SA')}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'left', direction: 'ltr', fontWeight: 600 }}>{Number(item.total).toLocaleString('ar-SA')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* الإجماليات */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '260px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>قبل الضريبة</span>
                  <span style={{ fontWeight: 600 }}>{Number(inv.subtotal).toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>ضريبة ({inv.vat_rate}%)</span>
                  <span style={{ fontWeight: 600, color: '#e6820a' }}>{Number(inv.vat_amount).toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div style={{ borderTop: '2px solid #c81e1e', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px', color: '#c81e1e' }}>
                  <span>الإجمالي</span>
                  <span>{Number(inv.total_amount).toLocaleString('ar-SA')} ر.س</span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
  const [returns,        setReturns]        = useState<PurchaseReturn[]>([])
  const [vendors,        setVendors]        = useState<Vendor[]>([])
  const [projects,       setProjects]       = useState<Project[]>([])
  const [warehouses,     setWarehouses]     = useState<Warehouse[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')

  const [showPOModal,      setShowPOModal]      = useState(false)
  const [showInvModal,     setShowInvModal]     = useState(false)
  const [showReturnModal,  setShowReturnModal]  = useState(false)
  const [showVendorModal,  setShowVendorModal]  = useState(false)
  const [editPO,     setEditPO]     = useState<PurchaseOrder | null>(null)
  const [editInv,    setEditInv]    = useState<VendorInvoice | null>(null)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)
  const [returnInvoice,  setReturnInvoice]  = useState<VendorInvoice | null>(null)
  const [viewPO,         setViewPO]         = useState<PurchaseOrder | null>(null)
  const [viewPOItems,    setViewPOItems]     = useState<POItem[]>([])
  const [showViewPO,     setShowViewPO]      = useState(false)
  const [viewVInv,       setViewVInv]        = useState<VendorInvoice | null>(null)
  const [viewVInvItems,  setViewVInvItems]   = useState<POItem[]>([])
  const [showViewVInv,   setShowViewVInv]    = useState(false)
  const [convertPO,     setConvertPO]     = useState<PurchaseOrder | null>(null)

  useEffect(() => { loadAll() }, [tenant?.id])

  async function handleViewPO(po: PurchaseOrder) {
    const { data } = await supabase.from('finance_purchase_order_items').select('*').eq('po_id', po.id).order('id')
    setViewPOItems(data || [])
    setViewPO(po)
    setShowViewPO(true)
  }

  async function handleViewVInv(inv: VendorInvoice) {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    setViewVInvItems(data || [])
    setViewVInv(inv)
    setShowViewVInv(true)
  }

  function printPO(po: PurchaseOrder, items: POItem[]) {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>أمر شراء ${po.po_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1a2e;direction:rtl;font-size:14px}.page{max-width:794px;margin:0 auto;padding:30px 40px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #e6820a}.badge{background:#e6820a;color:white;padding:10px 20px;border-radius:10px;text-align:center}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.info-item{background:#f8fafc;border-radius:8px;padding:10px 14px}.info-label{font-size:10px;color:#94a3b8;margin-bottom:3px}.info-value{font-size:13px;font-weight:600}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#e6820a;color:white}th{padding:10px 12px;text-align:right;font-size:12px}tbody tr{border-bottom:1px solid #f1f5f9}td{padding:9px 12px;font-size:13px}.totals-box{width:260px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-right:auto}.total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}.total-final{border-top:2px solid #e6820a;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;font-size:15px;color:#e6820a}@media print{.no-print{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
<div class="page">
<div class="header">
  <div>
    <div style="font-size:20px;font-weight:800;color:#e6820a;margin-bottom:4px">${po.vendor_name}</div>
    ${po.vendor_vat ? '<div style="font-size:12px;color:#64748b">الرقم الضريبي: ' + po.vendor_vat + '</div>' : ''}
  </div>
  <div class="badge">
    <div style="font-size:11px;opacity:0.85">أمر شراء</div>
    <div style="font-size:18px;font-weight:800">${po.po_number}</div>
    <div style="font-size:11px;margin-top:4px;opacity:0.85">${po.po_date}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-item"><div class="info-label">تاريخ الطلب</div><div class="info-value">${po.po_date}</div></div>
  ${po.expected_date ? '<div class="info-item"><div class="info-label">تاريخ التسليم المتوقع</div><div class="info-value">' + po.expected_date + '</div></div>' : ''}
  <div class="info-item"><div class="info-label">وجهة التسليم</div><div class="info-value">${po.delivery_to}</div></div>
  <div class="info-item"><div class="info-label">الحالة</div><div class="info-value">${po.status}</div></div>
</div>
<table>
  <thead><tr><th style="width:40%">الوصف</th><th style="text-align:center">الكمية</th><th style="text-align:center">الوحدة</th><th style="text-align:left">سعر الوحدة</th><th style="text-align:left">الإجمالي</th></tr></thead>
  <tbody>${items.map(i => '<tr><td>' + i.description + '</td><td style="text-align:center">' + i.quantity + '</td><td style="text-align:center">' + i.unit + '</td><td style="text-align:left;direction:ltr">' + Number(i.unit_price).toLocaleString('ar-SA') + '</td><td style="text-align:left;direction:ltr;font-weight:600">' + Number(i.total).toLocaleString('ar-SA') + '</td></tr>').join('')}</tbody>
</table>
<div style="display:flex;justify-content:flex-end">
  <div class="totals-box">
    <div class="total-row"><span>المجموع قبل الضريبة</span><span>${Number(po.subtotal).toLocaleString('ar-SA')} ر.س</span></div>
    <div class="total-row"><span>ضريبة القيمة المضافة (${po.vat_rate}%)</span><span style="color:#e6820a">${Number(po.vat_amount).toLocaleString('ar-SA')} ر.س</span></div>
    <div class="total-final"><span>الإجمالي</span><span>${Number(po.total_amount).toLocaleString('ar-SA')} ر.س</span></div>
  </div>
</div>
${po.notes ? '<div style="margin-top:14px;padding:10px 14px;background:#fffbeb;border-radius:8px;font-size:12px"><strong>ملاحظات:</strong> ' + po.notes + '</div>' : ''}
<div style="margin-top:40px;display:flex;justify-content:flex-end;padding-top:20px;border-top:1px solid #e2e8f0">
  <div style="text-align:center"><div style="border-bottom:2px solid #e6820a;width:160px;margin:30px auto 6px"></div><div style="font-size:11px;color:#94a3b8">التوقيع والختم</div></div>
</div>
</div>
<div class="no-print" style="text-align:center;padding:16px;background:#f9fafb">
  <button onclick="window.print()" style="padding:10px 28px;background:#e6820a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-left:10px">🖨️ طباعة / PDF</button>
  <button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button>
</div>
</body></html>`)
    win.document.close()
  }

  function printVendorInvoice(inv: VendorInvoice, items: POItem[]) {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة مورد ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1a2e;direction:rtl;font-size:14px}.page{max-width:794px;margin:0 auto;padding:30px 40px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #c81e1e}.badge{background:#c81e1e;color:white;padding:10px 20px;border-radius:10px;text-align:center}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.info-item{background:#f8fafc;border-radius:8px;padding:10px 14px}.info-label{font-size:10px;color:#94a3b8;margin-bottom:3px}.info-value{font-size:13px;font-weight:600}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#c81e1e;color:white}th{padding:10px 12px;text-align:right;font-size:12px}tbody tr{border-bottom:1px solid #f1f5f9}td{padding:9px 12px;font-size:13px}.totals-box{width:260px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-right:auto}.total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}.total-final{border-top:2px solid #c81e1e;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;font-size:15px;color:#c81e1e}@media print{.no-print{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
<div class="page">
<div class="header">
  <div>
    <div style="font-size:20px;font-weight:800;color:#c81e1e;margin-bottom:4px">${inv.vendor_name}</div>
    ${inv.vendor_vat ? '<div style="font-size:12px;color:#64748b">الرقم الضريبي: ' + inv.vendor_vat + '</div>' : ''}
  </div>
  <div class="badge">
    <div style="font-size:11px;opacity:0.85">فاتورة مورد</div>
    <div style="font-size:18px;font-weight:800">${inv.invoice_number}</div>
    <div style="font-size:11px;margin-top:4px;opacity:0.85">${inv.invoice_date}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-item"><div class="info-label">تاريخ الفاتورة</div><div class="info-value">${inv.invoice_date}</div></div>
  ${inv.due_date ? '<div class="info-item"><div class="info-label">تاريخ الاستحقاق</div><div class="info-value">' + inv.due_date + '</div></div>' : ''}
  ${inv.po ? '<div class="info-item"><div class="info-label">أمر الشراء</div><div class="info-value">' + inv.po.po_number + '</div></div>' : ''}
  <div class="info-item"><div class="info-label">وجهة التسليم</div><div class="info-value">${inv.delivery_to}</div></div>
  <div class="info-item"><div class="info-label">الحالة</div><div class="info-value">${inv.status}</div></div>
</div>
<table>
  <thead><tr><th style="width:40%">الوصف</th><th style="text-align:center">الكمية</th><th style="text-align:center">الوحدة</th><th style="text-align:left">سعر الوحدة</th><th style="text-align:left">الإجمالي</th></tr></thead>
  <tbody>${items.map(i => '<tr><td>' + i.description + '</td><td style="text-align:center">' + i.quantity + '</td><td style="text-align:center">' + i.unit + '</td><td style="text-align:left;direction:ltr">' + Number(i.unit_price).toLocaleString('ar-SA') + '</td><td style="text-align:left;direction:ltr;font-weight:600">' + Number(i.total).toLocaleString('ar-SA') + '</td></tr>').join('')}</tbody>
</table>
<div style="display:flex;justify-content:flex-end">
  <div class="totals-box">
    <div class="total-row"><span>المجموع قبل الضريبة</span><span>${Number(inv.subtotal).toLocaleString('ar-SA')} ر.س</span></div>
    <div class="total-row"><span>ضريبة القيمة المضافة (${inv.vat_rate}%)</span><span style="color:#e6820a">${Number(inv.vat_amount).toLocaleString('ar-SA')} ر.س</span></div>
    <div class="total-final"><span>الإجمالي</span><span>${Number(inv.total_amount).toLocaleString('ar-SA')} ر.س</span></div>
  </div>
</div>
${inv.notes ? '<div style="margin-top:14px;padding:10px 14px;background:#fffbeb;border-radius:8px;font-size:12px"><strong>ملاحظات:</strong> ' + inv.notes + '</div>' : ''}
</div>
<div class="no-print" style="text-align:center;padding:16px;background:#f9fafb">
  <button onclick="window.print()" style="padding:10px 28px;background:#c81e1e;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-left:10px">🖨️ طباعة / PDF</button>
  <button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button>
</div>
</body></html>`)
    win.document.close()
  }

  async function handlePrintPO(po: PurchaseOrder) {
    const { data } = await supabase.from('finance_purchase_order_items').select('*').eq('po_id', po.id).order('id')
    setTimeout(() => printPO(po, data || []), 0)
  }

  async function handlePrintVInv(inv: VendorInvoice) {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    setTimeout(() => printVendorInvoice(inv, data || []), 0)
  }

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [poRes, invRes, retRes, venRes, projRes, whRes] = await Promise.all([
      supabase.from('finance_purchase_orders').select('*, vendor:finance_vendors(name,phone), project:projects(name)').eq('tenant_id', tenant.id).order('po_date', { ascending: false }),
      supabase.from('finance_vendor_invoices').select('*, vendor:finance_vendors(name,iban), project:projects(name), po:finance_purchase_orders(po_number)').eq('tenant_id', tenant.id).order('invoice_date', { ascending: false }),
      supabase.from('finance_purchase_returns').select('*').eq('tenant_id', tenant.id).order('return_date', { ascending: false }),
      supabase.from('finance_vendors').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('warehouses').select('id, name, wh_type').eq('tenant_id', tenant.id),
    ])
    setPurchaseOrders(poRes.data || [])
    setVendorInvoices(invRes.data || [])
    setReturns(retRes.data || [])
    setVendors(venRes.data || [])
    setProjects(projRes.data || [])
    setWarehouses(whRes.data || [])
    setLoading(false)
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

  // إحصائيات
  const today = new Date().toISOString().split('T')[0]
  const totalPO   = purchaseOrders.reduce((s, p) => s + Number(p.total_amount), 0)
  const totalInv  = vendorInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalPaid = vendorInvoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
  const totalDue  = vendorInvoices.filter(i => i.status !== 'مدفوعة' && i.status !== 'ملغاة').reduce((s, i) => s + Number(i.total_amount), 0)

  const filteredPOs  = purchaseOrders.filter(p => !search || p.po_number.includes(search) || p.vendor_name.includes(search))
  const filteredInvs = vendorInvoices.filter(i => !search || i.invoice_number.includes(search) || i.vendor_name.includes(search))

  const TABS = [
    { id: 'orders',   label: '📋 أوامر الشراء',    color: '#e6820a' },
    { id: 'invoices', label: '🧾 فواتير الموردين',  color: '#c81e1e' },
    { id: 'returns',  label: '↩️ المرتجعات',       color: '#6b7280' },
    { id: 'vendors',  label: '🏭 الموردون',         color: '#1a56db' },
  ]

  return (
    <div className="space-y-5 fade-in">

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
          {activeTab === 'invoices' && <button onClick={() => { setEditInv(null); setShowInvModal(true) }} className="btn btn-primary" style={{ background: '#c81e1e' }}><Plus style={{ width: '16px', height: '16px' }} /> فاتورة مورد</button>}
          {activeTab === 'returns'  && <button onClick={() => { setReturnInvoice(null); setShowReturnModal(true) }} className="btn btn-primary" style={{ background: '#6b7280' }}><Plus style={{ width: '16px', height: '16px' }} /> مرتجع</button>}
          {activeTab === 'vendors'  && <button onClick={() => { setEditVendor(null); setShowVendorModal(true) }} className="btn btn-primary" style={{ background: '#1a56db' }}><Plus style={{ width: '16px', height: '16px' }} /> مورد جديد</button>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الطلبات',  value: totalPO,   color: '#e6820a', bg: '#fffbeb' },
          { label: 'فواتير الموردين', value: totalInv,  color: '#c81e1e', bg: '#fef2f2' },
          { label: 'المدفوع',          value: totalPaid, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'المستحق الدفع',   value: totalDue,  color: '#1a56db', bg: '#eff6ff' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>{kpi.label} — ريال</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any); setSearch('') }}
            style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px ' + t.color + '44' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* بحث */}
      {(activeTab === 'orders' || activeTab === 'invoices') && (
        <div style={{ position: 'relative', width: '240px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '34px' }} placeholder="بحث..." />
        </div>
      )}

      {/* ══ تاب أوامر الشراء ══ */}
      {activeTab === 'orders' && (
        loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        : filteredPOs.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <ShoppingCart style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
            <p style={{ color: '#9ca3af' }}>لا توجد أوامر شراء</p>
            <button onClick={() => { setEditPO(null); setShowPOModal(true) }} className="btn btn-primary" style={{ marginTop: '16px', background: '#e6820a' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> إنشاء أول طلب
            </button>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم الطلب', 'المورد', 'المشروع', 'التاريخ', 'التسليم المتوقع', 'وجهة التسليم', 'الإجمالي', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.map(po => (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 12px', fontWeight: 700, color: '#e6820a', fontFamily: 'monospace', fontSize: '0.82rem' }}>{po.po_number}</td>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{po.vendor_name}</div>
                        {po.vendor?.phone && <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{po.vendor.phone}</div>}
                      </td>
                      <td style={{ padding: '12px 12px', fontSize: '0.82rem', color: 'var(--text3)' }}>{po.project?.name || '—'}</td>
                      <td style={{ padding: '12px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{po.po_date}</td>
                      <td style={{ padding: '12px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{po.expected_date || '—'}</td>
                      <td style={{ padding: '12px 12px', fontSize: '0.78rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                          background: po.delivery_to === 'مستودع' ? '#eff6ff' : po.delivery_to === 'أصل ثابت' ? '#ecfdf5' : '#fffbeb',
                          color: po.delivery_to === 'مستودع' ? '#1a56db' : po.delivery_to === 'أصل ثابت' ? '#065f46' : '#e6820a' }}>
                          {po.delivery_to === 'مستودع' ? '🏪' : po.delivery_to === 'أصل ثابت' ? '🏭' : '🏗️'} {po.delivery_to}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px', fontWeight: 700, color: '#e6820a', whiteSpace: 'nowrap' }}>{Number(po.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 12px' }}><span className={'badge ' + (PO_STATUS_COLOR[po.status] || 'badge-gray')}>{po.status}</span></td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {po.status === 'مسودة' && (
                            <button onClick={() => { setEditPO(po); setShowPOModal(true) }} className="btn btn-ghost btn-xs">
                              <Pencil style={{ width: '13px', height: '13px' }} />
                            </button>
                          )}
                          <button onClick={() => { setConvertPO(po); setEditInv(null); setShowInvModal(true) }} title="تحويل لفاتورة"
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                            📄
                          </button>
                          {po.status === 'مسودة' && (
                            <button onClick={() => deletePO(po.id, po.status)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                              <Trash2 style={{ width: '13px', height: '13px' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                    <td colSpan={6} style={{ padding: '10px 12px' }}>الإجمالي ({filteredPOs.length})</td>
                    <td style={{ padding: '10px 12px', color: '#e6820a' }}>{filteredPOs.reduce((s,p)=>s+Number(p.total_amount),0).toLocaleString()} ر.س</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}

      {/* ══ تاب فواتير الموردين ══ */}
      {activeTab === 'invoices' && (
        loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        : filteredInvs.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
            <p style={{ color: '#9ca3af' }}>لا توجد فواتير موردين</p>
            <button onClick={() => { setEditInv(null); setShowInvModal(true) }} className="btn btn-primary" style={{ marginTop: '16px', background: '#c81e1e' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> إضافة فاتورة
            </button>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم الفاتورة', 'المورد', 'أمر الشراء', 'التاريخ', 'الاستحقاق', 'وجهة التسليم', 'الإجمالي', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvs.map(inv => {
                    const isOverdue = inv.status !== 'مدفوعة' && inv.status !== 'ملغاة' && inv.due_date && inv.due_date < today
                    const displayStatus = isOverdue ? 'متأخرة' : inv.status
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 12px', fontWeight: 700, color: '#c81e1e', fontFamily: 'monospace', fontSize: '0.82rem' }}>{inv.invoice_number}</td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{inv.vendor_name}</div>
                          {inv.vendor?.iban && <div style={{ fontSize: '0.7rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{inv.vendor.iban}</div>}
                        </td>
                        <td style={{ padding: '12px 12px', fontSize: '0.78rem', color: '#e6820a', fontFamily: 'monospace' }}>{inv.po?.po_number || '—'}</td>
                        <td style={{ padding: '12px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{inv.invoice_date}</td>
                        <td style={{ padding: '12px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap', color: isOverdue ? '#c81e1e' : 'inherit' }}>{inv.due_date || '—'}</td>
                        <td style={{ padding: '12px 12px', fontSize: '0.78rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                            background: inv.delivery_to === 'مستودع' ? '#eff6ff' : inv.delivery_to === 'أصل ثابت' ? '#ecfdf5' : '#fffbeb',
                            color: inv.delivery_to === 'مستودع' ? '#1a56db' : inv.delivery_to === 'أصل ثابت' ? '#065f46' : '#e6820a' }}>
                            {inv.delivery_to === 'مستودع' ? '🏪' : inv.delivery_to === 'أصل ثابت' ? '🏭' : '🏗️'} {inv.delivery_to}
                          </span>
                        </td>
                        <td style={{ padding: '12px 12px', fontWeight: 700, color: '#c81e1e', whiteSpace: 'nowrap' }}>{Number(inv.total_amount).toLocaleString()} ر.س</td>
                        <td style={{ padding: '12px 12px' }}><span className={'badge ' + (INV_STATUS_COLOR[displayStatus] || 'badge-gray')}>{displayStatus}</span></td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {/* عرض */}
                            <button onClick={() => handleViewVInv(inv)} title="عرض"
                              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                              <Eye style={{ width: '13px', height: '13px' }} />
                            </button>
                            {/* طباعة */}
                            <button onClick={() => handlePrintVInv(inv)} title="طباعة"
                              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer' }}>
                              <Printer style={{ width: '13px', height: '13px' }} />
                            </button>
                            {/* تعديل — مسودة فقط */}
                            {inv.status === 'مسودة' && (
                              <button onClick={() => { setEditInv(inv); setShowInvModal(true) }} className="btn btn-ghost btn-xs">
                                <Pencil style={{ width: '13px', height: '13px' }} />
                              </button>
                            )}
                            {/* مرتجع — غير مسودة */}
                            {inv.status !== 'مسودة' && inv.status !== 'ملغاة' && (
                              <button onClick={() => { setReturnInvoice(inv); setShowReturnModal(true) }} title="مرتجع"
                                style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', color: '#e6820a', cursor: 'pointer', fontSize: '0.75rem' }}>
                                ↩️
                              </button>
                            )}
                            {/* حذف — مسودة فقط */}
                            {inv.status === 'مسودة' && (
                              <button onClick={() => deleteInv(inv.id, inv.status)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                                <Trash2 style={{ width: '13px', height: '13px' }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                    <td colSpan={6} style={{ padding: '10px 12px' }}>الإجمالي ({filteredInvs.length})</td>
                    <td style={{ padding: '10px 12px', color: '#c81e1e' }}>{filteredInvs.reduce((s,i)=>s+Number(i.total_amount),0).toLocaleString()} ر.س</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}

      {/* ══ تاب المرتجعات ══ */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.82rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ لا يمكن حذف فواتير الموردين المعتمدة — استخدم مرتجع مشتريات أو إشعار مدين للتصحيح
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
          : returns.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <RotateCcw style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: '#9ca3af' }}>لا توجد مرتجعات بعد</p>
              <button onClick={() => setShowReturnModal(true)} className="btn btn-primary" style={{ marginTop: '16px', background: '#6b7280' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> إنشاء مرتجع
              </button>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['الرقم المرجعي', 'النوع', 'المورد', 'التاريخ', 'السبب', 'الإجمالي', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {returns.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#e6820a', fontFamily: 'monospace' }}>{r.return_number}</td>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>{r.return_type}</span></td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.vendor_name}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{r.return_date}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{r.reason || '—'}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#e6820a' }}>{Number(r.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-gray">{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب الموردون ══ */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div style={{ position: 'relative', width: '240px' }}>
            <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '34px' }} placeholder="بحث باسم المورد..." />
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
          : vendors.filter(v => !search || v.name.includes(search)).length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: '#9ca3af' }}>لا يوجد موردون بعد</p>
              <button onClick={() => { setEditVendor(null); setShowVendorModal(true) }} className="btn btn-primary" style={{ marginTop: '16px', background: '#1a56db' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> إضافة أول مورد
              </button>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['المورد', 'النوع', 'الرقم الضريبي', 'الهاتف', 'المدينة', 'IBAN', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendors.filter(v => !search || v.name.includes(search)).map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700 }}>{v.name}</div>
                        {v.contact_person && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{v.contact_person}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>{v.vendor_type}</span></td>
                      <td style={{ padding: '12px 14px', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                        {v.vat_number
                          ? <span style={{ color: '#0ea77b' }}>✓ {v.vat_number}</span>
                          : <span style={{ color: '#e6820a' }}>⚠️ غير مُدخل</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{v.phone || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{v.city || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text3)' }}>{v.iban ? v.iban.substring(0, 10) + '...' : '—'}</td>
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
          warehouses={warehouses} purchaseOrders={purchaseOrders}
          tenantId={tenant!.id}
          onClose={() => { setShowInvModal(false); setEditInv(null); setConvertPO(null) }}
          onSave={() => { setShowInvModal(false); setEditInv(null); setConvertPO(null); loadAll() }} />
      )}
      {showReturnModal && (
        <PurchaseReturnModal invoice={returnInvoice} vendors={vendors}
          tenantId={tenant!.id} onClose={() => { setShowReturnModal(false); setReturnInvoice(null) }}
          onSave={() => { setShowReturnModal(false); setReturnInvoice(null); loadAll() }} />
      )}
      {showVendorModal && (
        <VendorModal vendor={editVendor} tenantId={tenant!.id}
          onClose={() => { setShowVendorModal(false); setEditVendor(null) }}
          onSave={() => { setShowVendorModal(false); setEditVendor(null); loadAll() }} />
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
