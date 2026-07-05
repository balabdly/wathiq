// src/app/(dashboard)/finance/invoices/quotations/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Search, Eye, Printer, Pencil, Trash2, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import { nextDocNumber } from '@/lib/journal'
import { useStore } from '@/hooks/useStore'
import { useSales } from '../SalesContext'
import type { Quotation, InvoiceItem, Client, Project, Company } from '@/lib/sales-types'
import { QUOTE_STATUS_COLOR } from '@/lib/sales-types'

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
  return btoa(unescape(encodeURIComponent(encode(1, company.name || '') + encode(2, company.vat_number || '') + encode(3, doc.invoice_date || new Date().toISOString()) + encode(4, String(doc.total_amount || 0)) + encode(5, String(doc.vat_amount || 0)))))
}

function printQuotation(doc: any, items: any[], company: Company, client?: Client | null) {
  const color = '#7c3aed'
  const clientAddr = client ? [client.street, client.district, client.city].filter(Boolean).join('، ') : ''
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>عرض سعر — ${doc.quote_number}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f1f5f9;padding:20px;color:#1e293b}.page{background:white;max-width:800px;margin:0 auto;padding:32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid ${color}}.company-name{font-size:20px;font-weight:800;color:${color};margin-bottom:4px}.company-info{font-size:11px;color:#64748b;line-height:1.6}.inv-badge{background:${color};color:white;padding:10px 20px;border-radius:10px;text-align:center}.inv-badge .num{font-size:18px;font-weight:800}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}.info-item{background:#f8fafc;border-radius:6px;padding:8px 12px}.info-label{font-size:10px;color:#94a3b8;margin-bottom:2px}.info-value{font-size:13px;font-weight:600}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:${color};color:white}th{padding:10px 12px;text-align:right;font-size:12px;font-weight:700}tbody tr{border-bottom:1px solid #f1f5f9}tbody tr:nth-child(even){background:#f8fafc}td{padding:10px 12px;font-size:13px}.totals{display:flex;justify-content:flex-end;margin-bottom:20px}.totals-box{width:280px;background:#f8fafc;border-radius:10px;padding:14px}.total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}.total-final{border-top:2px solid ${color};margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;font-weight:800;font-size:16px;color:${color}}.note-box{background:#f5f3ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px 14px;font-size:12px;color:#5b21b6;margin-top:14px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
<div class="page"><div class="header"><div><div class="company-name">${company.name || ''}</div>${company.name_en ? `<div style="font-size:13px;color:#64748b;margin-bottom:4px">${company.name_en}</div>` : ''}<div class="company-info">${company.vat_number ? `الرقم الضريبي: ${company.vat_number}<br>` : ''}${company.cr_number ? `السجل التجاري: ${company.cr_number}<br>` : ''}${[company.street, company.district, company.city].filter(Boolean).join('، ')}</div></div><div class="inv-badge"><div style="font-size:11px;opacity:0.85">عرض سعر</div><div class="num">${doc.quote_number}</div><div style="font-size:11px;margin-top:4px;opacity:0.85">${doc.quote_date}</div></div></div>
<div class="info-grid"><div class="info-item"><div class="info-label">العميل</div><div class="info-value">${doc.client_name}</div>${doc.client_vat ? `<div style="font-size:11px;color:#64748b">الرقم الضريبي: ${doc.client_vat}</div>` : ''}${clientAddr ? `<div style="font-size:11px;color:#64748b">العنوان: ${clientAddr}</div>` : ''}${client?.phone ? `<div style="font-size:11px;color:#64748b">هاتف: ${client.phone}</div>` : ''}</div>${doc.valid_until ? `<div class="info-item"><div class="info-label">العرض صالح حتى</div><div class="info-value">${doc.valid_until}</div></div>` : ''}</div>
<table><thead><tr><th>الوصف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${items.map((i: any) => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${Number(i.unit_price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('')}</tbody></table>
<div class="totals"><div class="totals-box"><div class="total-row"><span>المجموع قبل الضريبة</span><span>${Number(doc.subtotal).toLocaleString()} ر.س</span></div><div class="total-row"><span>ضريبة القيمة المضافة (${doc.vat_rate}%)</span><span>${Number(doc.vat_amount).toLocaleString()} ر.س</span></div><div class="total-final"><span>الإجمالي</span><span>${Number(doc.total_amount).toLocaleString()} ر.س</span></div></div></div>
${doc.terms ? `<div class="note-box">الشروط والأحكام: ${doc.terms}</div>` : ''}
</div></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html); w.document.close(); w.onload = () => w.print()
}

// ════════════════════════════════════════
// مودال: عرض سعر
// ════════════════════════════════════════
function QuotationModal({ quote, clients, projects, tenantId, onClose, onSave }: {
  quote?: Quotation | null; clients: Client[]; projects: Project[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    quote_number: quote?.quote_number || '', quote_date: quote?.quote_date || today, valid_until: quote?.valid_until || '',
    client_id: quote?.client_id ? String(quote.client_id) : '', project_id: quote?.project_id ? String(quote.project_id) : '',
    vat_rate: quote?.vat_rate ?? 15, notes: quote?.notes || '', terms: quote?.terms || '', status: quote?.status || 'مسودة',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (quote) {
      supabase.from('finance_quotation_items').select('*').eq('quotation_id', quote.id).order('id').then(({ data }) => { if (data && data.length > 0) setItems(data) })
    } else generateNumber()
  }, [])

  async function generateNumber() {
    const { count } = await supabase.from('finance_quotations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    set('quote_number', `QT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`)
  }

  const selectedClient = clients.find(c => c.id === Number(form.client_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.client_id) { toast.error('اختر العميل'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً على الأقل'); return }
    setSaving(true)

    let finalQuoteNumber = form.quote_number
    if (!quote && /^QT-\d{4}-\d{4}$/.test(finalQuoteNumber)) finalQuoteNumber = (await nextDocNumber(tenantId, 'QT', 'QT')) || finalQuoteNumber

    const payload = {
      tenant_id: tenantId, quote_number: finalQuoteNumber, quote_date: form.quote_date,
      ...(quote ? {} : { created_by: useStore.getState().currentUser?.name || null }),
      valid_until: form.valid_until || null, client_id: Number(form.client_id), client_name: selectedClient!.name,
      client_vat: selectedClient!.vat_number || null, project_id: form.project_id ? Number(form.project_id) : null,
      subtotal, vat_amount: vatAmount, total_amount: total, vat_rate: Number(form.vat_rate), status: form.status,
      notes: form.notes || null, terms: form.terms || null,
    }

    let quoteId = quote?.id
    if (quote) {
      const { error } = await supabase.from('finance_quotations').update(payload).eq('id', quote.id)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
      await supabase.from('finance_quotation_items').delete().eq('quotation_id', quote.id)
    } else {
      const { data, error } = await supabase.from('finance_quotations').insert(payload).select('id').single()
      if (error || !data) { toast.error('خطأ: ' + (error?.message || '')); setSaving(false); return }
      quoteId = data.id
    }
    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0 && quoteId) {
      await supabase.from('finance_quotation_items').insert(validItems.map(i => ({ quotation_id: quoteId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }

    toast.success(quote ? '✅ تم تعديل عرض السعر' : '✅ تم إنشاء عرض السعر')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '780px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList style={{ width: '18px', height: '18px', color: '#7c3aed' }} />{quote ? 'تعديل عرض السعر' : 'عرض سعر جديد'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم العرض</label><input value={form.quote_number} onChange={e => set('quote_number', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ العرض</label><input type="date" value={form.quote_date} onChange={e => set('quote_date', e.target.value)} className="input" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>صالح حتى</label><input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} className="input" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>العميل *</label><select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="select"><option value="">— اختر العميل —</option>{clients.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المشروع</label><select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select"><option value="">— اختياري —</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          <ItemsTable items={items} onChange={setItems} />
          <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ملاحظات</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الشروط والأحكام</label><textarea value={form.terms} onChange={e => set('terms', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.client_id} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? '...' : <Save style={{ width: '15px', height: '15px' }} />} {quote ? 'حفظ التعديل' : 'إنشاء عرض السعر'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة
// ════════════════════════════════════════
export default function QuotationsPage() {
  const { tenantId, clients, projects } = useSales()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [company, setCompany]       = useState<Company>({} as Company)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [editQuote, setEditQuote]           = useState<Quotation | null>(null)
  const [viewDoc, setViewDoc] = useState<{ doc: any; items: any[]; loading: boolean } | null>(null)

  useEffect(() => { if (tenantId) { loadQuotations(); loadCompany() } }, [tenantId])

  async function loadCompany() {
    if (!tenantId) return
    const { data } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
    if (data) setCompany(data)
  }

  async function loadQuotations() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('finance_quotations').select('*').eq('tenant_id', tenantId).order('quote_date', { ascending: false }).limit(200)
    setQuotations(data || [])
    setLoading(false)
  }

  async function openViewDoc(q: Quotation) {
    setViewDoc({ doc: q, items: [], loading: true })
    const { data } = await supabase.from('finance_quotation_items').select('*').eq('quotation_id', q.id).order('id')
    setViewDoc({ doc: q, items: data || [], loading: false })
  }

  const filtered = quotations.filter(q => !search || q.quote_number.includes(search) || q.client_name.includes(search))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', maxWidth: '360px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم العرض أو العميل..." className="input" style={{ paddingRight: '32px' }} />
        </div>
        <button onClick={() => { setEditQuote(null); setShowQuoteModal(true) }} className="btn btn-primary" style={{ background: '#7c3aed' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> عرض سعر
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
        : filtered.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد عروض أسعار</div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['رقم العرض', 'العميل', 'التاريخ', 'صالح حتى', 'الإجمالي', 'الحالة', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} style={{ borderBottom: '1px solid var(--bg2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>{q.quote_number}</div>
                      {q.created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {q.created_by}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{q.client_name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{q.quote_date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{q.valid_until || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#7c3aed' }}>{Number(q.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px' }}><span className={'badge ' + (QUOTE_STATUS_COLOR[q.status] || 'badge-gray')}>{q.status}</span></td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openViewDoc(q)} title="استعراض" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}><Eye style={{ width: '13px', height: '13px' }} /></button>
                        <button onClick={() => { setEditQuote(q); setShowQuoteModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /> تعديل</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>

      {showQuoteModal && (
        <QuotationModal quote={editQuote} clients={clients} projects={projects} tenantId={tenantId!}
          onClose={() => { setShowQuoteModal(false); setEditQuote(null) }}
          onSave={() => { setShowQuoteModal(false); setEditQuote(null); loadQuotations() }} />
      )}

      {viewDoc && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setViewDoc(null)}>
          <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '85vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>📄 عرض سعر — {viewDoc.doc.quote_number}</h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{viewDoc.doc.client_name} · {viewDoc.doc.quote_date} · {viewDoc.doc.status}</p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => printQuotation(viewDoc.doc, viewDoc.items, company, clients.find(c => c.id === viewDoc.doc.client_id) || null)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                  <Printer style={{ width: '14px', height: '14px' }} /> طباعة
                </button>
                {(() => {
                  const cl = clients.find(c => c.id === viewDoc.doc.client_id)
                  const subj = encodeURIComponent(`عرض سعر ${viewDoc.doc.quote_number} — ${company.name || ''}`)
                  const body = encodeURIComponent(`السلام عليكم،\n\nمرفق عرض السعر رقم ${viewDoc.doc.quote_number} بإجمالي ${Number(viewDoc.doc.total_amount).toLocaleString()} ر.س.\n\nمع التحية،\n${company.name || ''}`)
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
              {viewDoc.doc.valid_until && <div style={{ padding: '10px 16px', background: '#f5f3ff', fontSize: '0.78rem', color: '#5b21b6', borderBottom: '1px solid #e9d5ff' }}>صالح حتى: {viewDoc.doc.valid_until}</div>}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: '#7c3aed' }}><span>الإجمالي</span><span style={{ fontFamily: 'monospace' }}>{Number(viewDoc.doc.total_amount).toLocaleString()} ر.س</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
