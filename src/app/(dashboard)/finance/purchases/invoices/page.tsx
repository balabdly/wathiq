// src/app/(dashboard)/finance/purchases/invoices/page.tsx
'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Printer, Trash2, Pencil, Search, FileText, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePagination } from '@/hooks/usePagination'
import { createJournalEntry, nextDocNumber, confirmCashSpend, getCashAccountCode } from '@/lib/journal'
import { ACC, getPurchaseDebitAccountCode, PURCHASE_ASSET_OPTIONS } from '@/lib/account-codes'
import { registerAssetFromVendorInvoice } from '@/lib/asset-coa'
import { receiveVendorInvoiceToWarehouse } from '@/lib/inventory-purchase-bridge'
import { useStore } from '@/hooks/useStore'
import AttachmentUploader from '@/components/finance/AttachmentUploader'
import { loadAttachments, saveAttachments, type FinanceAttachment } from '@/lib/attachments'
import { usePurchases } from '../PurchasesContext'
import type { VendorInvoice, PurchaseOrder, POItem, Vendor, Project, Warehouse, CashAccount } from '@/lib/purchases-types'
import { INV_STATUS_COLOR } from '@/lib/purchases-types'

// ══ مكوّنات مساعدة محلية (بلا اعتماد على ملف مشترك) ══
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
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>المجموع قبل الضريبة</span><span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} ر.س</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>ضريبة القيمة المضافة ({vatRate}%)</span><span style={{ fontWeight: 600, color: '#e6820a' }}>{vatAmount.toLocaleString()} ر.س</span></div>
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
          {PURCHASE_ASSET_OPTIONS.map(t => (
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
// مودال: إنشاء/تعديل فاتورة مورد
// ════════════════════════════════════════
function VendorInvoiceModal({ invoice, convertFromPO, vendors, projects, warehouses, purchaseOrders, tenantId, onClose, onSave }: {
  invoice: VendorInvoice | null; convertFromPO?: PurchaseOrder | null; vendors: Vendor[]; projects: Project[]
  warehouses: Warehouse[]; purchaseOrders: PurchaseOrder[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const { activeBranch } = useStore()
  const [saving, setSaving] = useState(false)
  const invStatusRef = useRef('معتمدة')
  const [items, setItems] = useState<POItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    invoice_number: invoice?.invoice_number || '', invoice_date: invoice?.invoice_date || today,
    due_date: invoice?.due_date || '', vendor_id: invoice?.vendor_id ? String(invoice.vendor_id) : '',
    po_id: invoice?.po_id ? String(invoice.po_id) : '', project_id: invoice?.project_id ? String(invoice.project_id) : '',
    delivery_to: invoice?.delivery_to || 'مستودع', warehouse_id: invoice?.warehouse_id ? String(invoice.warehouse_id) : '',
    asset_type: '', vat_rate: invoice?.vat_rate ?? 15, status: invoice?.status || 'مسودة', notes: invoice?.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  useEffect(() => {
    if (invoice) {
      loadItems()
      loadAttachments(tenantId, 'فاتورة مورد', invoice.id).then(setAttachments)
    } else {
      generateNumber()
      if (convertFromPO) {
        setForm(f => ({ ...f, vendor_id: convertFromPO.vendor_id ? String(convertFromPO.vendor_id) : '', po_id: String(convertFromPO.id), project_id: convertFromPO.project_id ? String(convertFromPO.project_id) : '', delivery_to: convertFromPO.delivery_to || 'مستودع', warehouse_id: convertFromPO.warehouse_id ? String(convertFromPO.warehouse_id) : '', vat_rate: convertFromPO.vat_rate ?? 15 }))
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
      set('vendor_id', String(po.vendor_id || '')); set('project_id', String(po.project_id || ''))
      set('delivery_to', po.delivery_to); set('warehouse_id', String(po.warehouse_id || ''))
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
    let finalVinvNumber = form.invoice_number.trim()
    if (!invoice && /^VINV-\d{4}-\d{4}$/.test(finalVinvNumber)) {
      finalVinvNumber = (await nextDocNumber(tenantId, 'VINV', 'VINV')) || finalVinvNumber
    }
    const payload = {
      tenant_id: tenantId, invoice_number: finalVinvNumber, invoice_date: form.invoice_date, due_date: form.due_date || null,
      ...(invoice ? {} : { created_by: useStore.getState().currentUser?.name || null }),
      vendor_id: Number(form.vendor_id), vendor_name: selectedVendor!.name, vendor_vat: selectedVendor!.vat_number || null,
      po_id: form.po_id ? Number(form.po_id) : null, project_id: form.project_id ? Number(form.project_id) : null,
      delivery_to: form.delivery_to, warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
      subtotal, vat_amount: vatAmount, total_amount: total, vat_rate: Number(form.vat_rate),
      status: invStatusRef.current || form.status, notes: form.notes || null,
    }
    let invId = invoice?.id
    if (invoice) {
      if (wasApproved && payload.status === 'معتمدة') {
        const oldDebitCode = getPurchaseDebitAccountCode(invoice.delivery_to || '')
        const jrRev = await createJournalEntry({ tenantId, date: payload.invoice_date, description: `قيد تصحيحي — تعديل فاتورة مورد ${invoice.invoice_number}`, referenceType: 'تصحيح فاتورة مورد', referenceId: invoice.id, source: 'آلي',
          lines: [
            { accountCode: oldDebitCode, debit: 0, credit: Number(invoice.subtotal), description: `عكس: فاتورة ${invoice.invoice_number}` },
            ...(Number(invoice.vat_amount) > 0 ? [{ accountCode: ACC.VAT_INPUT, debit: 0, credit: Number(invoice.vat_amount), description: 'عكس ضريبة المدخلات' }] : []),
            { accountCode: ACC.SUPPLIER_PAYABLE, debit: Number(invoice.total_amount), credit: 0, description: `عكس مستحق المورد ${invoice.vendor_name}` },
          ]
        })
        if (!jrRev) { toast.error('⚠️ فشل القيد التصحيحي — لم يُحفظ التعديل، راجع شجرة الحسابات', { duration: 8000 }); setSaving(false); return }
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
      await supabase.from('finance_vendor_invoice_items').insert(validItems.map(i => ({ invoice_id: invId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }
    if (invId) await saveAttachments(tenantId, 'فاتورة مورد', invId, attachments)
    if (payload.status === 'معتمدة' && invId) {
      const debitAccountCode = getPurchaseDebitAccountCode(payload.delivery_to, form.asset_type)
      const jr = await createJournalEntry({ tenantId, date: payload.invoice_date, description: `${wasApproved ? 'تعديل ' : ''}فاتورة مورد ${payload.invoice_number} — ${payload.vendor_name}`, referenceType: 'فاتورة مورد', referenceId: invId, source: 'آلي',
        lines: [
          { accountCode: debitAccountCode, debit: payload.subtotal, credit: 0, description: `فاتورة ${payload.invoice_number}` },
          ...(payload.vat_amount > 0 ? [{ accountCode: ACC.VAT_INPUT, debit: payload.vat_amount, credit: 0, description: 'ضريبة المدخلات' }] : []),
          { accountCode: ACC.SUPPLIER_PAYABLE, debit: 0, credit: payload.total_amount, description: `مستحق للمورد ${payload.vendor_name}` },
        ]
      })
      if (!jr) {
        toast.error('⚠️ الفاتورة حُفظت لكن القيد المحاسبي فشل — راجع شجرة الحسابات', { duration: 8000 })
        onSave(); setSaving(false); return
      }
      if (payload.delivery_to === 'أصل ثابت' && invId) {
        const itemDesc = validItems.map(i => i.description).filter(Boolean).join('، ')
        const assetId = await registerAssetFromVendorInvoice({
          tenantId,
          invoiceId: invId,
          invoiceNumber: payload.invoice_number,
          invoiceDate: payload.invoice_date,
          vendorName: payload.vendor_name,
          subtotal: payload.subtotal,
          assetType: form.asset_type,
          assetAccountCode: debitAccountCode,
          projectId: payload.project_id,
          description: itemDesc || `أصل — ${payload.vendor_name}`,
        })
        if (assetId) toast.success('📦 تم إنشاء سجل الأصل في سجل الأصول الثابتة')
      }
      if (payload.delivery_to === 'مستودع' && payload.warehouse_id && activeBranch?.id) {
        const stockResult = await receiveVendorInvoiceToWarehouse({
          tenantId,
          branchId:    activeBranch.id,
          warehouseId: payload.warehouse_id,
          invoiceNumber: payload.invoice_number,
          vendorName:    payload.vendor_name,
          invoiceDate:   payload.invoice_date,
          items: validItems.map(i => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit || 'وحدة' })),
        })
        if (!stockResult.ok) toast.error(`⚠️ القيد سُجّل لكن المخزون: ${stockResult.error}`, { duration: 7000 })
      }
    }
    toast.success(invoice ? (wasApproved ? 'تم التعديل مع قيد تصحيحي' : 'تم التعديل') : 'تم حفظ فاتورة المورد')
    onSave(); setSaving(false)
  }
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '780px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText style={{ width: '18px', height: '18px', color: '#c81e1e' }} />{invoice ? 'تعديل فاتورة المورد' : 'فاتورة مورد جديدة'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>رقم الفاتورة *</label><input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
            <div><label style={lbl}>تاريخ الفاتورة *</label><input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>تاريخ الاستحقاق</label><input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" /></div>
          </div>
          <div><label style={lbl}>ربط بأمر شراء (اختياري)</label>
            <select value={form.po_id} onChange={e => handlePOSelect(e.target.value)} className="select">
              <option value="">— بدون ربط —</option>
              {purchaseOrders.filter(p => p.status !== 'ملغي').map(p => <option key={p.id} value={p.id}>{p.po_number} — {p.vendor_name}</option>)}
            </select>
          </div>
          <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '14px', border: '1px solid #fecaca' }}>
            <label style={lbl}>المورد *</label>
            <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select">
              <option value="">— اختر المورد —</option>
              {vendors.filter(v => v.is_active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {selectedVendor?.iban && <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#991b1b' }}>IBAN: <strong>{selectedVendor.iban}</strong></div>}
          </div>
          <div><label style={lbl}>المشروع</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
              <option value="">— مشتريات عامة —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <DeliveryField value={form.delivery_to} warehouseId={form.warehouse_id} assetType={form.asset_type} projects={projects} warehouses={warehouses}
            onChange={(delivery, wh) => { set('delivery_to', delivery); set('warehouse_id', wh || ''); set('asset_type', '') }}
            onAssetTypeChange={t => set('asset_type', t)} />
          <ItemsTable items={items} onChange={setItems} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><label style={lbl}>ضريبة القيمة المضافة</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                  <option value={15}>15%</option><option value={0}>0% — معفي</option>
                </select>
              </div>
              <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
          <AttachmentUploader value={attachments} onChange={setAttachments} label="مرفقات الفاتورة (PDF / صور)" />
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          {!invoice && (
            <button onClick={() => { invStatusRef.current = 'مسودة'; handleSave() }} disabled={saving || !form.vendor_id}
              style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280' }}>
              <Save style={{ width: '14px', height: '14px' }} /> حفظ مسودة
            </button>
          )}
          <button onClick={() => { invStatusRef.current = invoice ? (form.status || 'معتمدة') : 'معتمدة'; handleSave() }}
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
// مودال: معاينة فاتورة المورد
// ════════════════════════════════════════
function VInvViewModal({ inv, items, onClose, onPrint }: { inv: VendorInvoice; items: POItem[]; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Eye style={{ width: '18px', height: '18px', color: '#c81e1e' }} />معاينة فاتورة المورد — {inv.invoice_number}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onPrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}><Printer style={{ width: '15px', height: '15px' }} /> طباعة</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '2px solid #c81e1e' }}>
              <div><div style={{ fontWeight: 800, fontSize: '1rem', color: '#c81e1e' }}>{inv.vendor_name}</div>{inv.vendor_vat && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>الرقم الضريبي: {inv.vendor_vat}</div>}</div>
              <div style={{ background: '#c81e1e', color: 'white', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '0.7rem', opacity: 0.85 }}>فاتورة مورد</div><div style={{ fontWeight: 800 }}>{inv.invoice_number}</div><div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{inv.invoice_date}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', marginBottom: '12px' }}>
              <div><span style={{ color: 'var(--text3)' }}>تاريخ الفاتورة:</span> <strong>{inv.invoice_date}</strong></div>
              {inv.due_date && <div><span style={{ color: 'var(--text3)' }}>تاريخ الاستحقاق:</span> <strong>{inv.due_date}</strong></div>}
              <div><span style={{ color: 'var(--text3)' }}>وجهة التسليم:</span> <strong>{inv.delivery_to}</strong></div>
              <div><span style={{ color: 'var(--text3)' }}>الحالة:</span> <span className={'badge ' + (INV_STATUS_COLOR[inv.status] || 'badge-gray')}>{inv.status}</span></div>
            </div>
            {items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '12px' }}>
                <thead><tr style={{ background: '#c81e1e', color: 'white' }}>{['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>{h}</th>)}</tr></thead>
                <tbody>{items.map((i, idx) => <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}><td style={{ padding: '8px 10px' }}>{i.description}</td><td style={{ padding: '8px 10px', textAlign: 'center' }}>{i.quantity}</td><td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text3)' }}>{i.unit}</td><td style={{ padding: '8px 10px', direction: 'ltr', textAlign: 'left' }}>{Number(i.unit_price).toLocaleString()}</td><td style={{ padding: '8px 10px', fontWeight: 700, color: '#c81e1e', direction: 'ltr', textAlign: 'left' }}>{Number(i.total).toLocaleString()} ر.س</td></tr>)}</tbody>
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
// مودال: دفع فاتورة مورد
// ════════════════════════════════════════
function VendorPaymentModal({ invoice, tenantId, onClose, onSave }: { invoice: VendorInvoice; tenantId: string; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false)
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [netDue, setNetDue]     = useState<number>(Number(invoice.total_amount))
  const [retTotal, setRetTotal] = useState<number>(0)
  const [form, setForm] = useState({ amount: String(invoice.total_amount), payment_date: new Date().toISOString().split('T')[0], payment_method: 'تحويل بنكي', cash_account_id: '', reference: '', notes: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  useEffect(() => {
    supabase.from('finance_cash_accounts').select('*, fa:finance_accounts(code)').eq('tenant_id', tenantId).eq('is_active', true).order('name')
      .then(({ data }) => setCashAccounts((data || []).map((a: any) => ({ ...a, account_code: a.fa?.code }))))
    supabase.from('finance_purchase_returns').select('total_amount')
      .eq('tenant_id', tenantId).eq('original_invoice_id', invoice.id).eq('status', 'معتمد')
      .then(({ data }) => {
        const rt = (data || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0)
        setRetTotal(rt)
        const due = Math.max(0, Number(invoice.total_amount) - rt)
        setNetDue(due)
        set('amount', String(due))
      })
  }, [])
  const bankAccounts = cashAccounts.filter(a => a.account_type === 'بنك' || a.account_type === 'حساب بنكي')
  const cashBoxes    = cashAccounts.filter(a => a.account_type === 'صندوق' || a.account_type === 'نقدية')
  const selectedAccount = cashAccounts.find(a => a.id === Number(form.cash_account_id))
  async function getCreditCode() {
    if (selectedAccount?.account_code) return selectedAccount.account_code
    if (form.cash_account_id) return await getCashAccountCode(Number(form.cash_account_id))
    if (form.payment_method === 'نقداً') return ACC.CASH_LOCAL
    return ACC.BANK
  }
  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('أدخل المبلغ'); return }
    if ((form.payment_method === 'تحويل بنكي' || form.payment_method === 'شيك') && !form.cash_account_id) { toast.error('يجب تحديد الحساب البنكي'); return }
    if (form.payment_method === 'نقداً' && !form.cash_account_id) { toast.error('يجب تحديد الصندوق'); return }
    if (netDue <= 0) { toast.error('⛔ هذه الفاتورة مرتجعة بالكامل — لا يوجد مستحق للمورد', { duration: 6000 }); return }
    if (Number(form.amount) > netDue + 0.01) {
      toast.error(`⛔ المبلغ يتجاوز صافي المستحق (${netDue.toLocaleString()} ر.س) بعد خصم مرتجعات بـ ${retTotal.toLocaleString()} ر.س`, { duration: 6000 })
      return
    }
    if (selectedAccount && !(await confirmCashSpend(tenantId, selectedAccount, Number(form.amount)))) return
    setSaving(true)
    await supabase.from('finance_vendor_invoices').update({ status: Number(form.amount) >= netDue - 0.01 ? 'مدفوعة' : 'مدفوعة جزئياً' }).eq('id', invoice.id)
    const accountLabel = selectedAccount ? `${selectedAccount.name}${selectedAccount.bank_name ? ` — ${selectedAccount.bank_name}` : ''}` : form.payment_method
    const jr = await createJournalEntry({ tenantId, date: form.payment_date, description: `دفع فاتورة ${invoice.invoice_number} — ${invoice.vendor_name}`, referenceType: 'دفع مورد', referenceId: invoice.id, source: 'آلي',
      lines: [
        { accountCode: ACC.SUPPLIER_PAYABLE,         debit: Number(form.amount), credit: 0,                   description: `تسوية مستحق ${invoice.vendor_name}` },
        { accountCode: await getCreditCode(), debit: 0,                   credit: Number(form.amount), description: `دفع عبر ${accountLabel}` },
      ]
    })
    if (!jr) {
      toast.error('⚠️ حالة الفاتورة تحدّثت لكن القيد المحاسبي فشل — راجع شجرة الحسابات فوراً', { duration: 8000 })
      onSave(); setSaving(false); return
    }
    toast.success('تم تسجيل الدفعة')
    onSave(); setSaving(false)
  }
  const showList = form.payment_method === 'نقداً' ? cashBoxes : bankAccounts
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>💸 دفع فاتورة — {invoice.invoice_number}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '12px', border: '1px solid #fecaca', textAlign: 'center' }}>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>صافي المستحق</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#c81e1e' }}>{netDue.toLocaleString()} ر.س</div>
            {retTotal > 0 && <div style={{ fontSize: '0.72rem', color: '#e6820a', marginTop: '2px' }}>(الفاتورة {Number(invoice.total_amount).toLocaleString()} − مرتجعات {retTotal.toLocaleString()})</div>}
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{invoice.vendor_name}</div>
          </div>
          <div><label style={lbl}>المبلغ</label><input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
          <div><label style={lbl}>تاريخ الدفع *</label><input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className="input" /></div>
          <div><label style={lbl}>طريقة الدفع *</label><select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">{['تحويل بنكي', 'شيك', 'نقداً'].map(m => <option key={m}>{m}</option>)}</select></div>
          {showList.length > 0 && <div><label style={lbl}>{form.payment_method === 'نقداً' ? 'الصندوق' : 'الحساب البنكي'}</label><select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select"><option value="">— اختر —</option>{showList.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank_name ? ` — ${a.bank_name}` : ''}</option>)}</select></div>}
          <div><label style={lbl}>{form.payment_method === 'شيك' ? 'رقم الشيك' : 'رقم المرجع'}</label><input value={form.reference} onChange={e => set('reference', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
          <div><label style={lbl}>ملاحظات</label><input value={form.notes} onChange={e => set('notes', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" /></div>
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
// الصفحة (ملفوفة بـ Suspense لأن useSearchParams يتطلبه)
// ════════════════════════════════════════
export default function VendorInvoicesPageWrapper() {
  return <Suspense fallback={null}><VendorInvoicesPage /></Suspense>
}

function VendorInvoicesPage() {
  const { tenantId, vendors, projects, warehouses, reloadKpis } = usePurchases()
  const searchParams = useSearchParams()
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]) // قائمة خفيفة للربط/التحويل فقط
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const invPagination = usePagination(50)
  const today = new Date().toISOString().split('T')[0]

  const [showInvModal, setShowInvModal] = useState(false)
  const [editInv, setEditInv]           = useState<VendorInvoice | null>(null)
  const [convertPO, setConvertPO]       = useState<PurchaseOrder | null>(null)
  const [showViewVInv, setShowViewVInv] = useState(false)
  const [viewVInv, setViewVInv]         = useState<VendorInvoice | null>(null)
  const [viewVInvItems, setViewVInvItems] = useState<POItem[]>([])
  const [showPayModal, setShowPayModal] = useState(false)
  const [payInvoice, setPayInvoice]     = useState<VendorInvoice | null>(null)

  useEffect(() => { if (tenantId) { loadVendorInvoices(1); loadLightPOs() } }, [tenantId])

  // ══ فتح مودال الفاتورة تلقائياً عند القدوم من "تحويل لفاتورة" بأمر الشراء ══
  useEffect(() => {
    const convertPoId = searchParams.get('convertPoId')
    if (convertPoId && purchaseOrders.length > 0) {
      const po = purchaseOrders.find(p => p.id === Number(convertPoId))
      if (po) { setConvertPO(po); setEditInv(null); setShowInvModal(true) }
    }
  }, [searchParams, purchaseOrders])

  async function loadLightPOs() {
    if (!tenantId) return
    const { data } = await supabase.from('finance_purchase_orders').select('*').eq('tenant_id', tenantId).order('po_date', { ascending: false })
    setPurchaseOrders(data || [])
  }

  async function loadVendorInvoices(page = 1, q = search) {
    if (!tenantId) return
    setLoading(true)
    const from = (page - 1) * 50
    let query = supabase.from('finance_vendor_invoices').select('*, vendor:finance_vendors(name,iban), project:projects(name), po:finance_purchase_orders(po_number)', { count: 'exact' }).eq('tenant_id', tenantId).order('invoice_date', { ascending: false }).range(from, from + 49)
    if (q) query = query.or(`invoice_number.ilike.%${q}%,vendor_name.ilike.%${q}%`)
    const { data, count } = await query
    setVendorInvoices(data || []); invPagination.setTotal(count || 0)
    setLoading(false)
  }

  async function handleViewVInv(inv: VendorInvoice) {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    setViewVInvItems(data || []); setViewVInv(inv); setShowViewVInv(true)
  }

  async function handlePrintVInv(inv: VendorInvoice) {
    const { data } = await supabase.from('finance_vendor_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    const items = data || []
    const win = window.open('', '_blank', 'width=900,height=700'); if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>VINV ${inv.invoice_number}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;direction:rtl}.page{max-width:794px;margin:0 auto;padding:30px 40px}.header{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #c81e1e}.badge{background:#c81e1e;color:white;padding:10px 20px;border-radius:10px;text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#c81e1e;color:white}th,td{padding:9px 12px;text-align:right;font-size:13px}tbody tr{border-bottom:1px solid #f1f5f9}.totals{width:260px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-right:auto}@media print{.noprint{display:none}body{print-color-adjust:exact}}</style></head><body><div class="page"><div class="header"><div><div style="font-size:20px;font-weight:800;color:#c81e1e">${inv.vendor_name}</div>${inv.vendor_vat ? `<div style="font-size:12px;color:#64748b">ضريبي: ${inv.vendor_vat}</div>` : ''}</div><div class="badge"><div style="font-size:11px">فاتورة مورد</div><div style="font-size:18px;font-weight:800">${inv.invoice_number}</div><div style="font-size:11px">${inv.invoice_date}</div></div></div><table><thead><tr><th>الوصف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${Number(i.unit_price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('')}</tbody></table><div style="display:flex;justify-content:flex-end"><div class="totals"><div style="display:flex;justify-content:space-between;padding:5px 0"><span>قبل الضريبة</span><span>${Number(inv.subtotal).toLocaleString()} ر.س</span></div><div style="display:flex;justify-content:space-between;padding:5px 0"><span>ضريبة (${inv.vat_rate}%)</span><span>${Number(inv.vat_amount).toLocaleString()} ر.س</span></div><div style="border-top:2px solid #c81e1e;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;color:#c81e1e"><span>الإجمالي</span><span>${Number(inv.total_amount).toLocaleString()} ر.س</span></div></div></div></div><div class="noprint" style="text-align:center;padding:16px"><button onclick="window.print()" style="padding:10px 28px;background:#c81e1e;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;margin-left:10px">طباعة</button><button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button></div></body></html>`)
    win.document.close()
  }

  async function deleteInv(id: number, status: string) {
    if (status !== 'مسودة') { toast.error('لا يمكن حذف فاتورة معتمدة — استخدم المرتجع'); return }
    if (!confirm('حذف هذه الفاتورة؟')) return
    await supabase.from('finance_vendor_invoices').delete().eq('id', id)
    setVendorInvoices(p => p.filter(x => x.id !== id)); toast.success('تم الحذف')
  }

  async function approveInvoice(inv: VendorInvoice) {
    const debitCode = getPurchaseDebitAccountCode(inv.delivery_to || '', (inv as { asset_type?: string }).asset_type)
    await supabase.from('finance_vendor_invoices').update({ status: 'معتمدة' }).eq('id', inv.id)
    const jr = await createJournalEntry({ tenantId: tenantId!, date: inv.invoice_date, description: `فاتورة مورد ${inv.invoice_number} — ${inv.vendor_name}`, referenceType: 'فاتورة مورد', referenceId: inv.id, source: 'آلي',
      lines: [
        { accountCode: debitCode, debit: Number(inv.subtotal), credit: 0, description: `فاتورة ${inv.invoice_number}` },
        ...(Number(inv.vat_amount) > 0 ? [{ accountCode: ACC.VAT_INPUT, debit: Number(inv.vat_amount), credit: 0, description: 'ضريبة المدخلات' }] : []),
        { accountCode: ACC.SUPPLIER_PAYABLE, debit: 0, credit: Number(inv.total_amount), description: `مستحق للمورد ${inv.vendor_name}` },
      ]
    })
    if (!jr) {
      toast.error('⚠️ اعتُمدت الفاتورة لكن القيد المحاسبي فشل — راجع شجرة الحسابات', { duration: 8000 })
    } else {
      if (inv.delivery_to === 'أصل ثابت') {
        const assetId = await registerAssetFromVendorInvoice({
          tenantId: tenantId!,
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.invoice_date,
          vendorName: inv.vendor_name,
          subtotal: Number(inv.subtotal),
          assetAccountCode: debitCode,
          projectId: inv.project_id,
          description: `أصل — ${inv.vendor_name}`,
        })
        if (assetId) toast.success('📦 تم إنشاء سجل الأصل في سجل الأصول الثابتة')
      }
      toast.success('تم الاعتماد والقيد المحاسبي')
    }
    loadVendorInvoices(invPagination.page); reloadKpis()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', maxWidth: '360px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); loadVendorInvoices(1, e.target.value) }} placeholder="بحث برقم الفاتورة أو المورد..." className="input" style={{ paddingRight: '32px' }} />
        </div>
        <button onClick={() => { setEditInv(null); setConvertPO(null); setShowInvModal(true) }} className="btn btn-primary" style={{ background: '#c81e1e' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> فاتورة مورد
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#c81e1e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
        : vendorInvoices.length === 0 ? <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>لا توجد فواتير</div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['رقم الفاتورة', 'المورد', 'التاريخ', 'الاستحقاق', 'التسليم', 'الإجمالي', 'الحالة', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {vendorInvoices.map(inv => {
                  const isOverdue = inv.status !== 'مدفوعة' && inv.status !== 'ملغاة' && inv.due_date && inv.due_date < today
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }} onClick={() => handleViewVInv(inv)} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{inv.invoice_number}</div>
                        {inv.created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {inv.created_by}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{inv.vendor_name}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{inv.invoice_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: isOverdue ? '#c81e1e' : 'var(--text3)' }}>{inv.due_date || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{inv.delivery_to}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#c81e1e' }}>{Number(inv.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px' }}><span className={'badge ' + (INV_STATUS_COLOR[isOverdue ? 'متأخرة' : inv.status] || 'badge-gray')}>{isOverdue ? 'متأخرة' : inv.status}</span></td>
                      <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <button onClick={() => handlePrintVInv(inv)} style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}><Printer style={{ width: '12px', height: '12px' }} /></button>
                          <button onClick={() => { setEditInv(inv); setConvertPO(null); setShowInvModal(true) }} style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}><Pencil style={{ width: '12px', height: '12px' }} /></button>
                          {inv.status === 'مسودة' && (
                            <button onClick={async e => { e.stopPropagation(); await approveInvoice(inv) }} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>اعتماد</button>
                          )}
                          {inv.status === 'معتمدة' && <button onClick={() => { setPayInvoice(inv); setShowPayModal(true) }} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>دفع</button>}
                          {inv.status === 'مسودة' && <button onClick={() => deleteInv(inv.id, inv.status)} style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}><Trash2 style={{ width: '12px', height: '12px' }} /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
        <invPagination.PaginationBar color="#c81e1e" />
      </div>

      {showInvModal && (
        <VendorInvoiceModal invoice={editInv} convertFromPO={convertPO} vendors={vendors} projects={projects} warehouses={warehouses} purchaseOrders={purchaseOrders} tenantId={tenantId!}
          onClose={() => { setShowInvModal(false); setEditInv(null); setConvertPO(null) }}
          onSave={() => { setShowInvModal(false); setEditInv(null); setConvertPO(null); loadVendorInvoices(invPagination.page); loadLightPOs(); reloadKpis() }} />
      )}
      {showViewVInv && viewVInv && (
        <VInvViewModal inv={viewVInv} items={viewVInvItems} onClose={() => setShowViewVInv(false)} onPrint={() => handlePrintVInv(viewVInv)} />
      )}
      {showPayModal && payInvoice && (
        <VendorPaymentModal invoice={payInvoice} tenantId={tenantId!}
          onClose={() => { setShowPayModal(false); setPayInvoice(null) }}
          onSave={() => { setShowPayModal(false); setPayInvoice(null); loadVendorInvoices(invPagination.page); reloadKpis() }} />
      )}
    </div>
  )
}
