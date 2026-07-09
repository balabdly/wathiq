// src/app/(dashboard)/finance/purchases/returns/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Trash2, Search, RotateCcw, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { createJournalEntry, nextDocNumber, reverseJournalByReference } from '@/lib/journal'
import { ACC, getPurchaseDebitAccountCode } from '@/lib/account-codes'
import { useStore } from '@/hooks/useStore'
import { usePurchases } from '../PurchasesContext'
import type { PurchaseReturn, VendorInvoice, POItem, Vendor } from '@/lib/purchases-types'

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
          <thead><tr style={{ background: 'var(--bg2)' }}>{['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي', ''].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', minWidth: '180px' }}><input value={item.description} onChange={e => update(idx, 'description', e.target.value)} onMouseDown={e => e.stopPropagation()} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="وصف المادة أو الخدمة" /></td>
                <td style={{ padding: '6px 8px' }}><input type="number" value={item.quantity} onChange={e => update(idx, 'quantity', e.target.value)} onMouseDown={e => e.stopPropagation()} style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" /></td>
                <td style={{ padding: '6px 8px' }}><select value={item.unit} onChange={e => update(idx, 'unit', e.target.value)} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>{['وحدة', 'م²', 'م طولي', 'طن', 'كجم', 'لتر', 'يوم', 'ساعة', 'مقطوعة'].map(u => <option key={u}>{u}</option>)}</select></td>
                <td style={{ padding: '6px 8px' }}><input type="number" value={item.unit_price} onChange={e => update(idx, 'unit_price', e.target.value)} onMouseDown={e => e.stopPropagation()} style={{ width: '100px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" /></td>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{Number(item.total).toLocaleString()} ر.س</td>
                <td style={{ padding: '6px 8px' }}><button type="button" onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}><Trash2 style={{ width: '14px', height: '14px' }} /></button></td>
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
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>الإجمالي</span><span style={{ fontWeight: 700, fontSize: '1.3rem', color: '#e6820a' }}>{total.toLocaleString()} ر.س</span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إنشاء مرتجع
// ════════════════════════════════════════
function PurchaseReturnModal({ invoice, vendors, tenantId, onClose, onSave }: { invoice: VendorInvoice | null; vendors: Vendor[]; tenantId: string; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<POItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ return_number: '', return_date: today, return_type: 'مرتجع مشتريات', original_invoice_id: invoice?.id ? String(invoice.id) : '', vendor_id: invoice?.vendor_id ? String(invoice.vendor_id) : '', vat_rate: invoice?.vat_rate ?? 15, reason: '', status: 'مسودة', notes: '' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  useEffect(() => { generateNumber(); if (invoice?.id) loadInvoiceItems() }, [])
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
    let finalPrNumber = form.return_number.trim()
    if (/^PR-\d{4}-\d{4}$/.test(finalPrNumber)) finalPrNumber = (await nextDocNumber(tenantId, 'PR', 'PR')) || finalPrNumber

    let prevReturns = 0, origInvTotal = 0
    if (form.original_invoice_id) {
      const invId = Number(form.original_invoice_id)
      const [{ data: origInv }, { data: prevRets }] = await Promise.all([
        supabase.from('finance_vendor_invoices').select('total_amount').eq('id', invId).single(),
        supabase.from('finance_purchase_returns').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', invId).eq('status', 'معتمد'),
      ])
      origInvTotal = Number(origInv?.total_amount || 0)
      prevReturns  = (prevRets || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0)
      const available = origInvTotal - prevReturns
      if (origInvTotal > 0 && total > available + 0.01) {
        toast.error(prevReturns > 0
          ? `⛔ الفاتورة قيمتها ${origInvTotal.toLocaleString()} ر.س وعليها مرتجعات سابقة بـ ${prevReturns.toLocaleString()} ر.س — المتاح: ${Math.max(0, available).toLocaleString()} ر.س فقط`
          : `⛔ مبلغ المرتجع (${total.toLocaleString()} ر.س) يتجاوز قيمة الفاتورة (${origInvTotal.toLocaleString()} ر.س)`, { duration: 6000 })
        setSaving(false); return
      }
    }
    const payload = { tenant_id: tenantId, return_number: finalPrNumber, return_date: form.return_date, return_type: form.return_type, original_invoice_id: form.original_invoice_id ? Number(form.original_invoice_id) : null, vendor_id: Number(form.vendor_id), vendor_name: selectedVendor!.name, subtotal, vat_amount: vatAmount, total_amount: total, vat_rate: Number(form.vat_rate), reason: form.reason, status: 'مسودة', notes: form.notes || null, created_by: useStore.getState().currentUser?.name || null }
    const { data, error } = await supabase.from('finance_purchase_returns').insert(payload).select('id').single()
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_purchase_return_items').insert(validItems.map(i => ({ return_id: data.id, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }
    // لا ترحيل هنا — القيد فقط عند الاعتماد
    toast.success('✅ تم حفظ المرتجع كمسودة — اعتمده من الجدول لترحيل القيد')
    onSave(); setSaving(false)
  }
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><RotateCcw style={{ width: '18px', height: '18px', color: '#6b7280' }} />مرتجع مشتريات</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>رقم المرتجع</label><input value={form.return_number} onChange={e => set('return_number', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
            <div><label style={lbl}>التاريخ</label><input type="date" value={form.return_date} onChange={e => set('return_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>النوع</label><select value={form.return_type} onChange={e => set('return_type', e.target.value)} className="select">{['مرتجع مشتريات', 'خصم مورد'].map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div><label style={lbl}>المورد *</label><select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select"><option value="">— اختر المورد —</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          <div><label style={lbl}>سبب الإرجاع *</label><input value={form.reason} onChange={e => set('reason', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" placeholder="مثال: بضاعة تالفة..." /></div>
          <ItemsTable items={items} onChange={setItems} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
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
// الصفحة
// ════════════════════════════════════════
export default function PurchaseReturnsPage() {
  const { tenantId, vendors, reloadKpis } = usePurchases()
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [viewReturn, setViewReturn] = useState<{ ret: any; items: any[]; loading: boolean } | null>(null)

  useEffect(() => { if (tenantId) loadReturns() }, [tenantId])

  async function loadReturns() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('finance_purchase_returns').select('*').eq('tenant_id', tenantId).order('return_date', { ascending: false }).limit(200)
    setReturns(data || [])
    setLoading(false)
  }

  async function openViewReturn(ret: any) {
    setViewReturn({ ret, items: [], loading: true })
    const { data } = await supabase.from('finance_purchase_return_items').select('*').eq('return_id', ret.id).order('id')
    setViewReturn({ ret, items: data || [], loading: false })
  }

  async function approveReturn(ret: any) {
    if (!confirm(`اعتماد المرتجع ${ret.return_number}؟\nسيُسجَّل القيد المحاسبي (تخفيض مستحق المورد) وينعكس على صافي الفاتورة.`)) return
    let origInv: any = null
    if (ret.original_invoice_id) {
      const [{ data: inv }, { data: approved }] = await Promise.all([
        supabase.from('finance_vendor_invoices').select('id, total_amount, delivery_to, status').eq('id', ret.original_invoice_id).single(),
        supabase.from('finance_purchase_returns').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', ret.original_invoice_id).eq('status', 'معتمد'),
      ])
      origInv = inv
      const prevApproved = (approved || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0)
      const invTotal = Number(inv?.total_amount || 0)
      if (invTotal > 0 && prevApproved + Number(ret.total_amount) > invTotal + 0.01) {
        toast.error(`⛔ الفاتورة ${invTotal.toLocaleString()} ر.س وعليها مرتجعات معتمدة بـ ${prevApproved.toLocaleString()} ر.س — المتاح: ${Math.max(0, invTotal - prevApproved).toLocaleString()} ر.س فقط`, { duration: 7000 })
        return
      }
    }
    const creditCode = getPurchaseDebitAccountCode(origInv?.delivery_to || '')
    const result = await createJournalEntry({
      tenantId: tenantId!, date: ret.return_date, description: `مرتجع مشتريات ${ret.return_number} — ${ret.vendor_name}`,
      referenceType: 'مرتجع مشتريات', referenceId: ret.id, source: 'آلي',
      lines: [
        { accountCode: ACC.SUPPLIER_PAYABLE, debit: Number(ret.total_amount), credit: 0, description: `تخفيض مستحق ${ret.vendor_name}` },
        { accountCode: creditCode, debit: 0, credit: Number(ret.subtotal),     description: `مرتجع ${ret.return_number}` },
        ...(Number(ret.vat_amount) > 0 ? [{ accountCode: ACC.VAT_INPUT, debit: 0, credit: Number(ret.vat_amount), description: 'عكس ضريبة المدخلات' }] : []),
      ],
    })
    if (!result) { toast.error('تعذر ترحيل قيد المرتجع'); return }
    await supabase.from('finance_purchase_returns').update({ status: 'معتمد' }).eq('id', ret.id)
    if (origInv) {
      const { data: nowApproved } = await supabase.from('finance_purchase_returns').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', origInv.id).eq('status', 'معتمد')
      const sumApproved = (nowApproved || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0)
      if (sumApproved >= Number(origInv.total_amount) - 0.01) {
        await supabase.from('finance_vendor_invoices').update({ status: 'مرتجعة' }).eq('id', origInv.id)
      }
    }
    toast.success(`✅ اعتُمد المرتجع ${ret.return_number} وسُجّل القيد ${result.entryNumber}`)
    loadReturns(); reloadKpis()
  }

  async function deleteReturn(ret: any) {
    if (!confirm(`حذف المسودة ${ret.return_number}؟`)) return
    await supabase.from('finance_purchase_return_items').delete().eq('return_id', ret.id)
    await supabase.from('finance_purchase_returns').delete().eq('id', ret.id)
    toast.success('تم حذف المسودة')
    loadReturns()
  }

  async function cancelReturn(ret: any) {
    if (!confirm(`إلغاء المرتجع المعتمد ${ret.return_number}؟\nسيُنشأ قيد عكسي يلغي أثره ويعيد مستحق المورد.`)) return
    const result = await reverseJournalByReference({
      tenantId: tenantId!,
      date: new Date().toISOString().split('T')[0],
      referenceType: 'مرتجع مشتريات',
      referenceId: ret.id,
      reverseReferenceType: 'إلغاء مرتجع',
      description: `قيد عكسي — إلغاء مرتجع ${ret.return_number} — ${ret.vendor_name}`,
    })
    await supabase.from('finance_purchase_returns').update({ status: 'ملغي' }).eq('id', ret.id)
    if (ret.original_invoice_id) {
      const [{ data: inv }, { data: stillApproved }] = await Promise.all([
        supabase.from('finance_vendor_invoices').select('id, total_amount, status').eq('id', ret.original_invoice_id).single(),
        supabase.from('finance_purchase_returns').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', ret.original_invoice_id).eq('status', 'معتمد'),
      ])
      const sum = (stillApproved || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0)
      if (inv?.status === 'مرتجعة' && sum < Number(inv.total_amount) - 0.01) {
        await supabase.from('finance_vendor_invoices').update({ status: 'معتمدة' }).eq('id', inv.id)
      }
    }
    toast.success(`✅ أُلغي المرتجع ${ret.return_number}${result ? ' وسُجّل القيد العكسي' : ''}`)
    loadReturns(); reloadKpis()
  }

  const filtered = returns.filter(r => !search || r.return_number.includes(search) || r.vendor_name.includes(search))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', maxWidth: '360px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم المرتجع أو المورد..." className="input" style={{ paddingRight: '32px' }} />
        </div>
        <button onClick={() => setShowReturnModal(true)} className="btn btn-primary" style={{ background: '#6b7280' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> مرتجع
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#6b7280', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
        : filtered.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد مرتجعات</div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['رقم المرتجع', 'المورد', 'التاريخ', 'النوع', 'الإجمالي', 'السبب', 'الحالة', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6b7280' }}>{r.return_number}</div>
                      {r.created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {r.created_by}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{r.vendor_name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{r.return_date}</td>
                    <td style={{ padding: '10px 14px' }}><span className="badge badge-gray">{r.return_type}</span></td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{Number(r.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{r.reason || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span className={'badge ' + (r.status === 'معتمد' ? 'badge-green' : r.status === 'ملغي' ? 'badge-red' : 'badge-gray')}>{r.status}</span></td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openViewReturn(r)} title="استعراض" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}><Eye style={{ width: '13px', height: '13px' }} /></button>
                        {r.status === 'مسودة' && (
                          <>
                            <button onClick={() => approveReturn(r)} title="اعتماد وترحيل القيد" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>✓ اعتماد</button>
                            <button onClick={() => deleteReturn(r)} title="حذف المسودة" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                          </>
                        )}
                        {r.status === 'معتمد' && <button onClick={() => cancelReturn(r)} title="إلغاء بقيد عكسي" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>إلغاء</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>

      {showReturnModal && (
        <PurchaseReturnModal invoice={null} vendors={vendors} tenantId={tenantId!}
          onClose={() => setShowReturnModal(false)}
          onSave={() => { setShowReturnModal(false); loadReturns() }} />
      )}

      {viewReturn && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setViewReturn(null)}>
          <div className="modal-box" style={{ maxWidth: '620px', maxHeight: '85vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>↩️ مرتجع {viewReturn.ret.return_number}</h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{viewReturn.ret.vendor_name} · {viewReturn.ret.return_date} · {viewReturn.ret.status}{viewReturn.ret.reason ? ` · السبب: ${viewReturn.ret.reason}` : ''}</p>
              </div>
              <button onClick={() => setViewReturn(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ padding: 0, overflowY: 'auto' }}>
              {viewReturn.loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>جاري التحميل...</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['البند', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => <th key={h} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {viewReturn.items.map((it: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2)' }}>
                        <td style={{ padding: '8px 14px' }}>{it.description}</td>
                        <td style={{ padding: '8px 14px' }}>{Number(it.quantity).toLocaleString()}</td>
                        <td style={{ padding: '8px 14px', color: 'var(--text3)' }}>{it.unit}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>{Number(it.unit_price).toLocaleString()}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>{Number(it.total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ padding: '14px 16px', borderTop: '2px solid var(--border)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>الإجمالي قبل الضريبة</span><span style={{ fontFamily: 'monospace' }}>{Number(viewReturn.ret.subtotal).toLocaleString()} ر.س</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>الضريبة ({Number(viewReturn.ret.vat_rate)}%)</span><span style={{ fontFamily: 'monospace' }}>{Number(viewReturn.ret.vat_amount).toLocaleString()} ر.س</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: '#6b7280' }}><span>الإجمالي</span><span style={{ fontFamily: 'monospace' }}>{Number(viewReturn.ret.total_amount).toLocaleString()} ر.س</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
