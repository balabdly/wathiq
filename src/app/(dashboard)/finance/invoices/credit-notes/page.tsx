// src/app/(dashboard)/finance/invoices/credit-notes/page.tsx
'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Search, Eye, Printer, RotateCcw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createJournalEntry, nextDocNumber, reverseJournalByReference } from '@/lib/journal'
import { ACC } from '@/lib/account-codes'
import { useStore } from '@/hooks/useStore'
import { useSales } from '../SalesContext'
import type { Invoice, InvoiceItem, Client, Company, CreditNote } from '@/lib/sales-types'

// ══ مكوّنات مساعدة محلية ══
function ItemsTable({ items, onChange }: { items: InvoiceItem[]; onChange: (items: InvoiceItem[]) => void }) {
  function update(idx: number, k: keyof InvoiceItem, v: any) {
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
                <td style={{ padding: '6px 8px', minWidth: '180px' }}><input value={item.description} onChange={e => update(idx, 'description', e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="وصف الخدمة أو المنتج" /></td>
                <td style={{ padding: '6px 8px' }}><input type="number" value={item.quantity} onChange={e => update(idx, 'quantity', e.target.value)} style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" /></td>
                <td style={{ padding: '6px 8px' }}><select value={item.unit} onChange={e => update(idx, 'unit', e.target.value)} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>{['وحدة', 'م²', 'م طولي', 'طن', 'كجم', 'لتر', 'يوم', 'ساعة', 'مقطوعة'].map(u => <option key={u}>{u}</option>)}</select></td>
                <td style={{ padding: '6px 8px' }}><input type="number" value={item.unit_price} onChange={e => update(idx, 'unit_price', e.target.value)} style={{ width: '100px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" /></td>
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
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
      <div style={{ width: '280px', background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)' }}>
        {[{ label: 'المجموع قبل الضريبة', value: subtotal }, { label: `ضريبة القيمة المضافة (${vatRate}%)`, value: vatAmount }].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.85rem', color: 'var(--text3)' }}>
            <span>{r.label}</span><span style={{ fontWeight: 600, direction: 'ltr' }}>{r.value.toLocaleString()} ر.س</span>
          </div>
        ))}
        <div style={{ borderTop: '2px solid var(--primary)', marginTop: '8px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>
          <span>الإجمالي الكلي</span><span style={{ direction: 'ltr' }}>{total.toLocaleString()} ر.س</span>
        </div>
      </div>
    </div>
  )
}

function generateZATCAQR(company: Company, doc: { invoice_date?: string; total_amount?: number; vat_amount?: number }): string {
  const encode = (tag: number, value: string): string => {
    const bytes = new TextEncoder().encode(value)
    let result = String.fromCharCode(tag) + String.fromCharCode(bytes.length)
    for (let i = 0; i < bytes.length; i++) result += String.fromCharCode(bytes[i])
    return result
  }
  const tlv = encode(1, company.name || '') + encode(2, company.vat_number || '') + encode(3, doc.invoice_date || new Date().toISOString()) + encode(4, String(doc.total_amount || 0)) + encode(5, String(doc.vat_amount || 0))
  return btoa(unescape(encodeURIComponent(tlv)))
}

function printCreditNote(doc: any, items: any[], company: Company, client?: Client | null) {
  const color = '#c81e1e'
  const qr = generateZATCAQR(company, { invoice_date: doc.note_date, total_amount: doc.total_amount, vat_amount: doc.vat_amount })
  const clientAddr = client ? [client.street, client.district, client.city].filter(Boolean).join('، ') : ''
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>إشعار دائن — ${doc.note_number}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f1f5f9;padding:20px;color:#1e293b}.page{background:white;max-width:800px;margin:0 auto;padding:32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid ${color}}.company-name{font-size:20px;font-weight:800;color:${color};margin-bottom:4px}.company-info{font-size:11px;color:#64748b;line-height:1.6}.inv-badge{background:${color};color:white;padding:10px 20px;border-radius:10px;text-align:center}.inv-badge .num{font-size:18px;font-weight:800}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}.info-item{background:#f8fafc;border-radius:6px;padding:8px 12px}.info-label{font-size:10px;color:#94a3b8;margin-bottom:2px}.info-value{font-size:13px;font-weight:600}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:${color};color:white}th{padding:10px 12px;text-align:right;font-size:12px;font-weight:700}tbody tr{border-bottom:1px solid #f1f5f9}tbody tr:nth-child(even){background:#f8fafc}td{padding:10px 12px;font-size:13px}.totals{display:flex;justify-content:flex-end;margin-bottom:20px}.totals-box{width:280px;background:#f8fafc;border-radius:10px;padding:14px}.total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}.total-final{border-top:2px solid ${color};margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;font-weight:800;font-size:16px;color:${color}}.note-box{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:12px;color:#92400e;margin-bottom:14px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
<div class="page"><div class="header"><div><div class="company-name">${company.name || ''}</div>${company.name_en ? `<div style="font-size:13px;color:#64748b;margin-bottom:4px">${company.name_en}</div>` : ''}<div class="company-info">${company.vat_number ? `الرقم الضريبي: ${company.vat_number}<br>` : ''}${company.cr_number ? `السجل التجاري: ${company.cr_number}<br>` : ''}${[company.street, company.district, company.city].filter(Boolean).join('، ')}</div></div><div class="inv-badge"><div style="font-size:11px;opacity:0.85">إشعار دائن</div><div class="num">${doc.note_number}</div><div style="font-size:11px;margin-top:4px;opacity:0.85">${doc.note_date}</div></div></div>
<div class="info-grid"><div class="info-item"><div class="info-label">العميل</div><div class="info-value">${doc.client_name}</div>${doc.client_vat ? `<div style="font-size:11px;color:#64748b">الرقم الضريبي: ${doc.client_vat}</div>` : ''}${clientAddr ? `<div style="font-size:11px;color:#64748b">العنوان: ${clientAddr}</div>` : ''}${client?.phone ? `<div style="font-size:11px;color:#64748b">هاتف: ${client.phone}</div>` : ''}</div>${doc.original_invoice_number ? `<div class="info-item"><div class="info-label">الفاتورة المرجعية</div><div class="info-value">${doc.original_invoice_number}</div></div>` : ''}${doc.note_type ? `<div class="info-item"><div class="info-label">نوع الإشعار</div><div class="info-value">${doc.note_type}</div></div>` : ''}</div>
${doc.reason ? `<div class="note-box">سبب الإشعار: ${doc.reason}</div>` : ''}
<table><thead><tr><th>الوصف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${items.map((i: any) => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${Number(i.unit_price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('')}</tbody></table>
<div class="totals"><div class="totals-box"><div class="total-row"><span>المجموع قبل الضريبة</span><span>${Number(doc.subtotal).toLocaleString()} ر.س</span></div><div class="total-row"><span>ضريبة القيمة المضافة (${doc.vat_rate}%)</span><span>${Number(doc.vat_amount).toLocaleString()} ر.س</span></div><div class="total-final"><span>الإجمالي</span><span>${Number(doc.total_amount).toLocaleString()} ر.س</span></div></div></div>
${qr ? `<div style="text-align:center;margin-top:16px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qr)}" /><div style="font-size:10px;color:#94a3b8;margin-top:4px">QR Code — ZATCA Phase 1</div></div>` : ''}
</div></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html); w.document.close(); w.onload = () => w.print()
}

// ════════════════════════════════════════
// مودال: إنشاء إشعار دائن
// ════════════════════════════════════════
function CreditNoteModal({ invoice, clients, invoices, tenantId, onClose, onSave }: {
  invoice: Invoice | null; clients: Client[]; invoices: Invoice[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { if (invoice?.id) loadInvoiceItems() }, [invoice?.id])

  async function loadInvoiceItems() {
    const { data } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', invoice!.id).order('id')
    if (data && data.length > 0) setItems(data)
  }

  const [form, setForm] = useState({
    note_number: '', note_date: today, note_type: 'إشعار دائن',
    original_invoice_id: invoice?.id ? String(invoice.id) : '', client_id: invoice?.client_id ? String(invoice.client_id) : '',
    vat_rate: invoice?.vat_rate ?? 15, reason: '', status: 'مسودة', notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const clientInvoices = invoices.filter(inv => inv.client_id === Number(form.client_id) && (inv.status === 'مرسلة' || inv.status === 'مدفوعة' || inv.status === 'متأخرة'))
  const selectedInvoice = clientInvoices.find(inv => inv.id === Number(form.original_invoice_id))

  function handleClientChange(clientId: string) {
    set('client_id', clientId); set('original_invoice_id', '')
    setItems([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  }

  async function handleInvoiceSelect(invoiceId: string) {
    set('original_invoice_id', invoiceId)
    if (!invoiceId) { setItems([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]); return }
    const { data } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', Number(invoiceId)).order('id')
    if (data && data.length > 0) setItems(data)
    const inv = clientInvoices.find(i => i.id === Number(invoiceId))
    if (inv) set('vat_rate', inv.vat_rate ?? 15)
  }

  useEffect(() => { generateNumber() }, [])
  async function generateNumber() {
    const { count } = await supabase.from('finance_credit_notes').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    set('note_number', `CN-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`)
  }

  const selectedClient = clients.find(c => c.id === Number(form.client_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.note_number.trim()) { toast.error('رقم الإشعار مطلوب'); return }
    if (!form.client_id) { toast.error('اختر العميل'); return }
    if (!form.original_invoice_id) { toast.error('الفاتورة المرجعية إلزامية — لا يمكن إنشاء إشعار بدون فاتورة'); return }
    if (!form.reason.trim()) { toast.error('سبب الإشعار مطلوب'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }

    if (selectedInvoice) {
      const { data: prevNotes } = await supabase.from('finance_credit_notes').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', Number(form.original_invoice_id))
      const prevTotal = (prevNotes || []).reduce((s: number, n: any) => s + Number(n.total_amount), 0)
      const invTotal  = Number(selectedInvoice.total_amount)
      const available = invTotal - prevTotal
      if (total > available + 0.01) {
        toast.error(
          prevTotal > 0
            ? `⛔ الفاتورة قيمتها ${invTotal.toLocaleString()} ر.س وعليها إشعارات سابقة بـ ${prevTotal.toLocaleString()} ر.س — المتاح للإشعار: ${Math.max(0, available).toLocaleString()} ر.س فقط`
            : `⛔ مبلغ الإشعار (${total.toLocaleString()} ر.س) يتجاوز قيمة الفاتورة (${invTotal.toLocaleString()} ر.س)`,
          { duration: 6000 })
        return
      }
    }

    setSaving(true)
    let finalNoteNumber = form.note_number.trim()
    if (/^CN-\d{4}-\d{4}$/.test(finalNoteNumber)) finalNoteNumber = (await nextDocNumber(tenantId, 'CN', 'CN')) || finalNoteNumber

    const payload = {
      tenant_id: tenantId, note_number: finalNoteNumber, created_by: useStore.getState().currentUser?.name || null,
      note_date: form.note_date, note_type: form.note_type,
      original_invoice_id: form.original_invoice_id ? Number(form.original_invoice_id) : null,
      client_id: Number(form.client_id), client_name: selectedClient!.name, client_vat: selectedClient!.vat_number || null,
      subtotal, vat_amount: vatAmount, total_amount: total, vat_rate: Number(form.vat_rate),
      reason: form.reason || null, status: form.status, notes: form.notes || null,
    }

    const { data, error } = await supabase.from('finance_credit_notes').insert({ ...payload, status: 'مسودة' }).select('id').single()
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_credit_note_items').insert(validItems.map(i => ({ note_id: data.id, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }

    // ══ لا ترحيل هنا — القيد فقط عند الاعتماد (نفس نمط مرتجعات المشتريات) ══
    toast.success('✅ تم حفظ الإشعار كمسودة — اعتمده من الجدول لترحيل القيد')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><RotateCcw style={{ width: '18px', height: '18px', color: '#c81e1e' }} />إشعار دائن / مرتجع</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم الإشعار</label><input value={form.note_number} onChange={e => set('note_number', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>التاريخ</label><input type="date" value={form.note_date} onChange={e => set('note_date', e.target.value)} className="input" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>النوع</label><select value={form.note_type} onChange={e => set('note_type', e.target.value)} className="select">{['إشعار دائن', 'مرتجع مبيعات'].map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>العميل *</label><select value={form.client_id} onChange={e => handleClientChange(e.target.value)} className="select"><option value="">— اختر العميل —</option>{clients.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الفاتورة المرجعية <span style={{ color: '#c81e1e' }}>*</span></label>
              {!form.client_id ? (
                <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', border: '1px solid #fde68a' }}>← اختر العميل أولاً</div>
              ) : clientInvoices.length === 0 ? (
                <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.8rem', color: '#c81e1e', border: '1px solid #fecaca' }}>⚠️ لا توجد فواتير مرسلة أو مدفوعة لهذا العميل</div>
              ) : (
                <>
                  <select value={form.original_invoice_id} onChange={e => handleInvoiceSelect(e.target.value)} className="select">
                    <option value="">— اختر الفاتورة —</option>
                    {clientInvoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — {Number(inv.total_amount).toLocaleString()} ر.س ({inv.status})</option>)}
                  </select>
                  {selectedInvoice && <div style={{ marginTop: '6px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.78rem', color: '#1a56db', border: '1px solid #bfdbfe' }}>✅ الفاتورة: {selectedInvoice.invoice_number} · المبلغ: {Number(selectedInvoice.total_amount).toLocaleString()} ر.س · الحالة: {selectedInvoice.status}</div>}
                </>
              )}
            </div>
          </div>
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>سبب الإشعار</label><textarea value={form.reason} onChange={e => set('reason', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
          <ItemsTable items={items} onChange={setItems} />
          <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.client_id} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            إنشاء الإشعار
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة (ملفوفة بـ Suspense لاستخدام useSearchParams)
// ════════════════════════════════════════
export default function CreditNotesPageWrapper() {
  return <Suspense fallback={null}><CreditNotesPage /></Suspense>
}

function CreditNotesPage() {
  const { tenantId, clients } = useSales()
  const searchParams = useSearchParams()
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [invoices, setInvoices]       = useState<Invoice[]>([]) // قائمة خفيفة للربط فقط
  const [company, setCompany]         = useState<Company>({} as Company)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  const [showCreditModal, setShowCreditModal] = useState(false)
  const [creditInvoice, setCreditInvoice]     = useState<Invoice | null>(null)
  const [viewDoc, setViewDoc] = useState<{ doc: any; items: any[]; loading: boolean } | null>(null)

  useEffect(() => { if (tenantId) { loadCreditNotes(); loadLightInvoices(); loadCompany() } }, [tenantId])

  // ══ فتح المودال تلقائياً عند القدوم من "إشعار دائن" بجدول الفواتير ══
  useEffect(() => {
    const fromInvoiceId = searchParams.get('fromInvoiceId')
    if (fromInvoiceId && invoices.length > 0) {
      const inv = invoices.find(i => i.id === Number(fromInvoiceId))
      if (inv) { setCreditInvoice(inv); setShowCreditModal(true) }
    }
  }, [searchParams, invoices])

  async function loadCompany() {
    if (!tenantId) return
    const { data } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
    if (data) setCompany(data)
  }

  async function loadLightInvoices() {
    if (!tenantId) return
    const { data } = await supabase.from('finance_invoices').select('*').eq('tenant_id', tenantId).order('invoice_date', { ascending: false })
    setInvoices(data || [])
  }

  async function loadCreditNotes() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('finance_credit_notes').select('*').eq('tenant_id', tenantId).order('note_date', { ascending: false }).limit(200)
    setCreditNotes(data || [])
    setLoading(false)
  }

  async function openViewDoc(cn: CreditNote) {
    setViewDoc({ doc: cn, items: [], loading: true })
    const { data } = await supabase.from('finance_credit_note_items').select('*').eq('note_id', cn.id).order('id')
    setViewDoc({ doc: cn, items: data || [], loading: false })
  }

  // ══ اعتماد إشعار دائن: يرحّل القيد ويحدّث الحالة (نفس نمط مرتجعات المشتريات) ══
  async function approveCreditNote(cn: any) {
    if (!confirm(`اعتماد الإشعار ${cn.note_number}؟\nسيُسجَّل القيد المحاسبي (تخفيض ذمة العميل) وينعكس على صافي الفاتورة.`)) return

    const result = await createJournalEntry({
      tenantId: tenantId!, date: cn.note_date, description: `${cn.note_type} ${cn.note_number} — ${cn.client_name}`,
      referenceType: cn.note_type, referenceId: cn.id, source: 'آلي',
      lines: [
        { accountCode: ACC.SALES_REVENUE, debit: Number(cn.subtotal), credit: 0, description: `${cn.note_type} ${cn.note_number}` },
        ...(Number(cn.vat_amount) > 0 ? [{ accountCode: ACC.VAT_OUTPUT, debit: Number(cn.vat_amount), credit: 0, description: 'ضريبة مستردة' }] : []),
        { accountCode: ACC.CUSTOMER_RECEIVABLE, debit: 0, credit: Number(cn.total_amount), description: `إشعار للعميل ${cn.client_name}` },
      ],
    })
    if (!result) { toast.error('تعذر ترحيل قيد الإشعار'); return }

    await supabase.from('finance_credit_notes').update({ status: 'معتمد' }).eq('id', cn.id)
    toast.success(`✅ اعتُمد الإشعار ${cn.note_number} وسُجّل القيد ${result.entryNumber}`)
    loadCreditNotes()
  }

  // ══ حذف إشعار (مسودة فقط) ══
  async function deleteCreditNote(cn: any) {
    if (!confirm(`حذف المسودة ${cn.note_number}؟`)) return
    await supabase.from('finance_credit_note_items').delete().eq('note_id', cn.id)
    await supabase.from('finance_credit_notes').delete().eq('id', cn.id)
    toast.success('تم حذف المسودة')
    loadCreditNotes()
  }

  // ══ إلغاء إشعار معتمد بقيد عكسي — لا إلغاء صامت لمستند ضريبي صادر ══
  async function cancelCreditNote(cn: any) {
    if (!confirm(`إلغاء الإشعار المعتمد ${cn.note_number}؟\nسيُنشأ قيد عكسي يلغي أثره ويعيد ذمة العميل.`)) return
    const result = await reverseJournalByReference({
      tenantId: tenantId!,
      date: new Date().toISOString().split('T')[0],
      referenceType: cn.note_type,
      referenceId: cn.id,
      reverseReferenceType: 'إلغاء إشعار دائن',
      description: `قيد عكسي — إلغاء إشعار ${cn.note_number} — ${cn.client_name}`,
    })
    if (!result) {
      toast.error('⚠️ تعذّر إنشاء القيد العكسي — الإشعار لا يزال معتمداً ولم يُلغَ. حاول مجدداً أو راجع شجرة الحسابات', { duration: 8000 })
      return
    }
    await supabase.from('finance_credit_notes').update({ status: 'ملغي' }).eq('id', cn.id)
    toast.success(`✅ أُلغي الإشعار ${cn.note_number} وسُجّل القيد العكسي`)
    loadCreditNotes()
  }

  const filtered = creditNotes.filter(cn => !search || cn.note_number.includes(search) || cn.client_name.includes(search))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', maxWidth: '360px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الإشعار أو العميل..." className="input" style={{ paddingRight: '32px' }} />
        </div>
        <button onClick={() => { setCreditInvoice(null); setShowCreditModal(true) }} className="btn btn-primary" style={{ background: '#c81e1e' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> إشعار دائن
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#c81e1e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
        : filtered.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد إشعارات</div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['رقم الإشعار', 'العميل', 'النوع', 'التاريخ', 'الإجمالي', 'السبب', 'الحالة', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(cn => (
                  <tr key={cn.id} style={{ borderBottom: '1px solid var(--bg2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{cn.note_number}</div>
                      {cn.created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {cn.created_by}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{cn.client_name}</td>
                    <td style={{ padding: '10px 14px' }}><span className="badge badge-red">{cn.note_type}</span></td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{cn.note_date}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#c81e1e' }}>{Number(cn.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{cn.reason || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span className={'badge ' + (cn.status === 'معتمد' ? 'badge-green' : cn.status === 'ملغي' ? 'badge-red' : 'badge-gray')}>{cn.status}</span></td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openViewDoc(cn)} title="استعراض" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}><Eye style={{ width: '13px', height: '13px' }} /></button>
                        {cn.status === 'مسودة' && (
                          <>
                            <button onClick={() => approveCreditNote(cn)} title="اعتماد وترحيل القيد" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>✓ اعتماد</button>
                            <button onClick={() => deleteCreditNote(cn)} title="حذف المسودة" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                          </>
                        )}
                        {cn.status === 'معتمد' && (
                          <button onClick={() => cancelCreditNote(cn)} title="إلغاء بقيد عكسي" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>إلغاء</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>

      {showCreditModal && (
        <CreditNoteModal invoice={creditInvoice} clients={clients} invoices={invoices} tenantId={tenantId!}
          onClose={() => { setShowCreditModal(false); setCreditInvoice(null) }}
          onSave={() => { setShowCreditModal(false); setCreditInvoice(null); loadCreditNotes() }} />
      )}

      {viewDoc && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setViewDoc(null)}>
          <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '85vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>🔻 إشعار دائن — {viewDoc.doc.note_number}</h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{viewDoc.doc.client_name} · {viewDoc.doc.note_date} · {viewDoc.doc.status}</p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => printCreditNote(viewDoc.doc, viewDoc.items, company, clients.find(c => c.id === viewDoc.doc.client_id) || null)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                  <Printer style={{ width: '14px', height: '14px' }} /> طباعة
                </button>
                {(() => {
                  const cl = clients.find(c => c.id === viewDoc.doc.client_id)
                  const subj = encodeURIComponent(`إشعار دائن ${viewDoc.doc.note_number} — ${company.name || ''}`)
                  const body = encodeURIComponent(`السلام عليكم،\n\nمرفق الإشعار الدائن رقم ${viewDoc.doc.note_number} بإجمالي ${Number(viewDoc.doc.total_amount).toLocaleString()} ر.س.\n\nمع التحية،\n${company.name || ''}`)
                  return (
                    <a href={`mailto:${cl?.email || ''}?subject=${subj}&body=${body}`} title={cl?.email ? `إرسال إلى ${cl.email}` : 'بريد العميل غير مسجل'}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}>
                      ✉️ إرسال بالبريد
                    </a>
                  )
                })()}
                <button onClick={() => setViewDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 0, overflowY: 'auto' }}>
              {(() => {
                const cl = clients.find(c => c.id === viewDoc.doc.client_id)
                const addr = cl ? [cl.street, cl.district, cl.city].filter(Boolean).join('، ') : ''
                return (addr || cl?.phone || cl?.email) ? (
                  <div style={{ padding: '10px 16px', background: '#f8fafc', fontSize: '0.75rem', color: 'var(--text3)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    {addr && <span>📍 {addr}</span>}{cl?.phone && <span>📞 {cl.phone}</span>}{cl?.email && <span>✉️ {cl.email}</span>}
                  </div>
                ) : null
              })()}
              {viewDoc.doc.reason && <div style={{ padding: '10px 16px', background: '#fef2f2', fontSize: '0.78rem', color: '#b91c1c', borderBottom: '1px solid #fecaca' }}>السبب: {viewDoc.doc.reason}</div>}
              {viewDoc.loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>جاري التحميل...</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['البند', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => <th key={h} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {viewDoc.items.map((it: any, i: number) => (
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
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>الإجمالي قبل الضريبة</span><span style={{ fontFamily: 'monospace' }}>{Number(viewDoc.doc.subtotal).toLocaleString()} ر.س</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>الضريبة ({Number(viewDoc.doc.vat_rate)}%)</span><span style={{ fontFamily: 'monospace' }}>{Number(viewDoc.doc.vat_amount).toLocaleString()} ر.س</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: '#c81e1e' }}><span>الإجمالي</span><span style={{ fontFamily: 'monospace' }}>{Number(viewDoc.doc.total_amount).toLocaleString()} ر.س</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
