// src/app/(dashboard)/finance/purchases/orders/page.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Printer, Trash2, Pencil, Search, ShoppingCart, Eye, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePagination } from '@/hooks/usePagination'
import { nextDocNumber } from '@/lib/journal'
import { useStore } from '@/hooks/useStore'
import { usePurchases } from '../PurchasesContext'
import type { PurchaseOrder, POItem, Vendor, Project, Warehouse } from '@/lib/purchases-types'
import { PO_STATUS_COLOR } from '@/lib/purchases-types'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

function ItemsTable({ items, onChange }: { items: POItem[]; onChange: (items: POItem[]) => void }) {
  function update(idx: number, k: keyof POItem, v: any) {
    const next = [...items]
    next[idx] = { ...next[idx], [k]: v }
    if (k === 'quantity' || k === 'unit_price') next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price)
    onChange(next)
  }
  function add()               { onChange([...items, { description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]) }
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
                <td style={{ padding: '6px 8px', minWidth: '180px' }}>
                  <input value={item.description} onChange={e => update(idx, 'description', e.target.value)} onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="وصف المادة أو الخدمة" />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input type="number" value={item.quantity} onChange={e => update(idx, 'quantity', e.target.value)} onMouseDown={e => e.stopPropagation()}
                    style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <select value={item.unit} onChange={e => update(idx, 'unit', e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>
                    {['وحدة', 'م²', 'م طولي', 'طن', 'كجم', 'لتر', 'يوم', 'ساعة', 'مقطوعة'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input type="number" value={item.unit_price} onChange={e => update(idx, 'unit_price', e.target.value)} onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                </td>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{Number(item.total).toLocaleString()} ر.س</td>
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

function DeliveryField({ value, warehouseId, assetType, projects, warehouses, onChange, onAssetTypeChange }: {
  value: string; warehouseId?: string; assetType?: string; projects: Project[]; warehouses: Warehouse[]
  onChange: (delivery: string, warehouseId?: string) => void
  onAssetTypeChange?: (t: string) => void
}) {
  return (
    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 14px' }}>
      <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0369a1', display: 'block', marginBottom: '10px' }}>📦 وجهة التسليم / تصنيف الشراء</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {[{ val: 'مستودع', icon: '🏪', desc: 'يُضاف للمخزون' }, { val: 'موقع العمل', icon: '🏗️', desc: 'مباشرة للمشروع' }, { val: 'أصل ثابت', icon: '🏭', desc: 'سيارة / معدة / جهاز' }].map(opt => (
          <button key={opt.val} type="button" onClick={() => onChange(opt.val, undefined)}
            style={{ flex: 1, minWidth: '100px', padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
              borderColor: value === opt.val ? '#0369a1' : 'var(--border)', background: value === opt.val ? '#e0f2fe' : 'white', color: value === opt.val ? '#0369a1' : '#6b7280' }}>
            <div>{opt.icon}</div><div style={{ marginTop: '2px' }}>{opt.val}</div><div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '1px' }}>{opt.desc}</div>
          </button>
        ))}
      </div>
      {value === 'مستودع' && (
        <select value={warehouseId || ''} onChange={e => onChange('مستودع', e.target.value)} className="select" style={{ marginTop: '4px' }}>
          <option value="">— اختر المستودع —</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
      {value === 'أصل ثابت' && onAssetTypeChange && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          {[{ val: 'معدات', icon: '🔧', account: '1220' }, { val: 'مركبات', icon: '🚗', account: '1210' }, { val: 'أثاث', icon: '🪑', account: '1230' }].map(t => (
            <button key={t.val} type="button" onClick={() => onAssetTypeChange(t.val)}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center',
                borderColor: assetType === t.val ? '#065f46' : 'var(--border)', background: assetType === t.val ? '#d1fae5' : 'white', color: assetType === t.val ? '#065f46' : 'var(--text3)' }}>
              <div>{t.icon}</div><div style={{ marginTop: '2px' }}>{t.val}</div><div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '1px' }}>{t.account}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إنشاء/تعديل أمر شراء
// ════════════════════════════════════════
function POModal({ po, vendors, projects, warehouses, tenantId, onClose, onSave }: {
  po: PurchaseOrder | null; vendors: Vendor[]; projects: Project[]; warehouses: Warehouse[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const poStatusRef = useRef('مفتوحة')
  const [items, setItems] = useState<POItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    po_number: po?.po_number || '', po_date: po?.po_date || today, expected_date: po?.expected_date || '',
    vendor_id: po?.vendor_id ? String(po.vendor_id) : '', project_id: po?.project_id ? String(po.project_id) : '',
    delivery_to: po?.delivery_to || 'مستودع', warehouse_id: po?.warehouse_id ? String(po.warehouse_id) : '',
    vat_rate: po?.vat_rate ?? 15, status: po?.status || 'مسودة', notes: po?.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  useEffect(() => { if (po) loadItems(); else generateNumber() }, [])
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
    // ══ الرقم النهائي — ذرّي عند الحفظ ══
    let finalPoNumber = form.po_number.trim()
    if (!po && /^PO-\d{4}-\d{4}$/.test(finalPoNumber)) {
      finalPoNumber = (await nextDocNumber(tenantId, 'PO', 'PO')) || finalPoNumber
    }
    const payload = {
      tenant_id: tenantId, po_number: finalPoNumber, po_date: form.po_date, expected_date: form.expected_date || null,
      ...(po ? {} : { created_by: useStore.getState().currentUser?.name || null }),
      vendor_id: Number(form.vendor_id), vendor_name: selectedVendor!.name, vendor_vat: selectedVendor!.vat_number || null,
      project_id: form.project_id ? Number(form.project_id) : null, delivery_to: form.delivery_to,
      warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
      subtotal, vat_amount: vatAmount, total_amount: total, vat_rate: Number(form.vat_rate),
      status: poStatusRef.current || form.status, notes: form.notes || null,
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
      await supabase.from('finance_purchase_order_items').insert(validItems.map(i => ({ po_id: poId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }
    toast.success(po ? 'تم التعديل' : 'تم إنشاء أمر الشراء')
    onSave(); setSaving(false)
  }
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '780px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><ShoppingCart style={{ width: '18px', height: '18px', color: '#e6820a' }} />{po ? 'تعديل أمر الشراء' : 'أمر شراء جديد'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>رقم أمر الشراء *</label><input value={form.po_number} onChange={e => set('po_number', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
            <div><label style={lbl}>تاريخ الطلب *</label><input type="date" value={form.po_date} onChange={e => set('po_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>تاريخ التسليم المتوقع</label><input type="date" value={form.expected_date} onChange={e => set('expected_date', e.target.value)} className="input" /></div>
          </div>
          <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '14px', border: '1px solid #fde68a' }}>
            <label style={lbl}>المورد *</label>
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
          <div><label style={lbl}>المشروع</label>
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
              <div><label style={lbl}>نسبة ضريبة القيمة المضافة</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                  <option value={15}>15% — المعيارية</option><option value={0}>0% — معفي</option>
                </select>
              </div>
              <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" style={{ minHeight: '70px', resize: 'none' }} /></div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          {!po && (
            <button onClick={() => { poStatusRef.current = 'مسودة'; handleSave() }} disabled={saving || !form.vendor_id}
              style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280' }}>
              <Save style={{ width: '14px', height: '14px' }} /> حفظ مسودة
            </button>
          )}
          <button onClick={() => { poStatusRef.current = po ? (form.status || 'مفتوحة') : 'مفتوحة'; handleSave() }}
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
// مودال: معاينة أمر الشراء
// ════════════════════════════════════════
function POViewModal({ po, items, onClose, onPrint }: { po: PurchaseOrder; items: POItem[]; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Eye style={{ width: '18px', height: '18px', color: '#e6820a' }} />معاينة أمر الشراء — {po.po_number}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onPrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #fde68a', background: '#fffbeb', color: '#e6820a', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}><Printer style={{ width: '15px', height: '15px' }} /> طباعة</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '2px solid #e6820a' }}>
              <div><div style={{ fontWeight: 800, fontSize: '1rem', color: '#e6820a' }}>{po.vendor_name}</div>{po.vendor_vat && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>الرقم الضريبي: {po.vendor_vat}</div>}</div>
              <div style={{ background: '#e6820a', color: 'white', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '0.7rem', opacity: 0.85 }}>أمر شراء</div><div style={{ fontWeight: 800 }}>{po.po_number}</div><div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{po.po_date}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', marginBottom: '12px' }}>
              <div><span style={{ color: 'var(--text3)' }}>تاريخ الطلب:</span> <strong>{po.po_date}</strong></div>
              {po.expected_date && <div><span style={{ color: 'var(--text3)' }}>التسليم المتوقع:</span> <strong>{po.expected_date}</strong></div>}
              <div><span style={{ color: 'var(--text3)' }}>وجهة التسليم:</span> <strong>{po.delivery_to}</strong></div>
              <div><span style={{ color: 'var(--text3)' }}>الحالة:</span> <span className={'badge ' + (PO_STATUS_COLOR[po.status] || 'badge-gray')}>{po.status}</span></div>
            </div>
            {items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '12px' }}>
                <thead><tr style={{ background: '#e6820a', color: 'white' }}>{['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>{h}</th>)}</tr></thead>
                <tbody>{items.map((i, idx) => <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}><td style={{ padding: '8px 10px' }}>{i.description}</td><td style={{ padding: '8px 10px', textAlign: 'center' }}>{i.quantity}</td><td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text3)' }}>{i.unit}</td><td style={{ padding: '8px 10px', direction: 'ltr', textAlign: 'left' }}>{Number(i.unit_price).toLocaleString()}</td><td style={{ padding: '8px 10px', fontWeight: 700, color: '#e6820a', direction: 'ltr', textAlign: 'left' }}>{Number(i.total).toLocaleString()} ر.س</td></tr>)}</tbody>
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
// الصفحة
// ════════════════════════════════════════
export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { tenantId, vendors, projects, warehouses, reloadKpis } = usePurchases()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const poPagination = usePagination(50)

  const [showPOModal, setShowPOModal] = useState(false)
  const [editPO, setEditPO]           = useState<PurchaseOrder | null>(null)
  const [showViewPO, setShowViewPO]   = useState(false)
  const [viewPO, setViewPO]           = useState<PurchaseOrder | null>(null)
  const [viewPOItems, setViewPOItems] = useState<POItem[]>([])

  useEffect(() => { if (tenantId) loadPurchaseOrders(1) }, [tenantId])

  async function loadPurchaseOrders(page = 1, q = search) {
    if (!tenantId) return
    setLoading(true)
    const from = (page - 1) * 50
    let query = supabase.from('finance_purchase_orders').select('*, vendor:finance_vendors(name,phone), project:projects(name)', { count: 'exact' }).eq('tenant_id', tenantId).order('po_date', { ascending: false }).range(from, from + 49)
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
    setLoading(false)
  }

  async function handleViewPO(po: PurchaseOrder) {
    const { data } = await supabase.from('finance_purchase_order_items').select('*').eq('po_id', po.id).order('id')
    setViewPOItems(data || []); setViewPO(po); setShowViewPO(true)
  }

  async function handlePrintPO(po: PurchaseOrder) {
    const { data } = await supabase.from('finance_purchase_order_items').select('*').eq('po_id', po.id).order('id')
    const items = data || []
    const win = window.open('', '_blank', 'width=900,height=700'); if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>PO ${po.po_number}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;direction:rtl}.page{max-width:794px;margin:0 auto;padding:30px 40px}.header{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #e6820a}.badge{background:#e6820a;color:white;padding:10px 20px;border-radius:10px;text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#e6820a;color:white}th,td{padding:9px 12px;text-align:right;font-size:13px}tbody tr{border-bottom:1px solid #f1f5f9}.totals{width:260px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-right:auto}@media print{.noprint{display:none}body{print-color-adjust:exact}}</style></head><body><div class="page"><div class="header"><div><div style="font-size:20px;font-weight:800;color:#e6820a">${po.vendor_name}</div>${po.vendor_vat ? `<div style="font-size:12px;color:#64748b">ضريبي: ${po.vendor_vat}</div>` : ''}</div><div class="badge"><div style="font-size:11px">أمر شراء</div><div style="font-size:18px;font-weight:800">${po.po_number}</div><div style="font-size:11px">${po.po_date}</div></div></div><table><thead><tr><th>الوصف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${Number(i.unit_price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('')}</tbody></table><div style="display:flex;justify-content:flex-end"><div class="totals"><div style="display:flex;justify-content:space-between;padding:5px 0"><span>قبل الضريبة</span><span>${Number(po.subtotal).toLocaleString()} ر.س</span></div><div style="display:flex;justify-content:space-between;padding:5px 0"><span>ضريبة (${po.vat_rate}%)</span><span>${Number(po.vat_amount).toLocaleString()} ر.س</span></div><div style="border-top:2px solid #e6820a;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;color:#e6820a"><span>الإجمالي</span><span>${Number(po.total_amount).toLocaleString()} ر.س</span></div></div></div></div><div class="noprint" style="text-align:center;padding:16px"><button onclick="window.print()" style="padding:10px 28px;background:#e6820a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;margin-left:10px">طباعة</button><button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button></div></body></html>`)
    win.document.close()
  }

  async function deletePO(id: number, status: string) {
    if (status !== 'مسودة') { toast.error('لا يمكن حذف طلب مرسل'); return }
    if (!confirm('حذف هذا الطلب؟')) return
    await supabase.from('finance_purchase_orders').delete().eq('id', id)
    setPurchaseOrders(p => p.filter(x => x.id !== id)); toast.success('تم الحذف')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', maxWidth: '360px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); loadPurchaseOrders(1, e.target.value) }} placeholder="بحث برقم الطلب أو المورد..." className="input" style={{ paddingRight: '32px' }} />
        </div>
        <button onClick={() => { setEditPO(null); setShowPOModal(true) }} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> أمر شراء
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#e6820a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
        : purchaseOrders.length === 0 ? <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>لا توجد أوامر شراء</div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['رقم الطلب', 'المورد', 'التاريخ', 'التسليم', 'الإجمالي', 'الحالة', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {purchaseOrders.map(po => (
                  <tr key={po.id} style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }} onClick={() => handleViewPO(po)} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e6820a' }}>{po.po_number}</div>
                      {po.created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {po.created_by}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{po.vendor_name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{po.po_date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{po.delivery_to}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#e6820a' }}>{Number(po.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px' }}><span className={'badge ' + (PO_STATUS_COLOR[po.status] || 'badge-gray')}>{po.status}</span></td>
                    <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <button onClick={() => handlePrintPO(po)} style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', color: '#e6820a', cursor: 'pointer' }}><Printer style={{ width: '12px', height: '12px' }} /></button>
                        <button onClick={() => { setEditPO(po); setShowPOModal(true) }} style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}><Pencil style={{ width: '12px', height: '12px' }} /></button>
                        {!po.has_invoice && (
                          <button onClick={() => router.push(`/finance/purchases/invoices?convertPoId=${po.id}`)} title="تحويل لفاتورة مورد"
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <FileText style={{ width: '11px', height: '11px' }} /> تحويل لفاتورة
                          </button>
                        )}
                        {po.status === 'مسودة' && <button onClick={() => deletePO(po.id, po.status)} style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}><Trash2 style={{ width: '12px', height: '12px' }} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        <poPagination.PaginationBar color="#e6820a" />
      </div>

      {showPOModal && (
        <POModal po={editPO} vendors={vendors} projects={projects} warehouses={warehouses} tenantId={tenantId!}
          onClose={() => { setShowPOModal(false); setEditPO(null) }}
          onSave={() => { setShowPOModal(false); setEditPO(null); loadPurchaseOrders(poPagination.page); reloadKpis() }} />
      )}
      {showViewPO && viewPO && (
        <POViewModal po={viewPO} items={viewPOItems} onClose={() => setShowViewPO(false)} onPrint={() => handlePrintPO(viewPO)} />
      )}
    </div>
  )
}
