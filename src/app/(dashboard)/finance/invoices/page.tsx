'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Printer, Trash2, Pencil, Search, FileText, Users, RotateCcw, ClipboardList, CheckCircle, AlertCircle, Eye, ExternalLink, Package, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { createJournalEntry, journalSalesInvoice, journalSalesCollection, journalCreditNote, getCashAccountCode, nextDocNumber } from '@/lib/journal'
import AttachmentUploader from '@/components/finance/AttachmentUploader'
import { loadAttachments, saveAttachments, type FinanceAttachment } from '@/lib/attachments'
import { usePagination } from '@/hooks/usePagination'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Client = {
  id: number; tenant_id: string; name: string; name_en?: string
  vat_number?: string; cr_number?: string; client_type: string
  city?: string; district?: string; street?: string; postal_code?: string
  country: string; phone?: string; email?: string; contact_person?: string
  is_active: boolean; notes?: string
}

type InvoiceItem = {
  id?: number; description: string; quantity: number; unit: string; unit_price: number; total: number
}

type CatalogItem = {
  id: number; name: string; item_type: string; unit: string; unit_price: number; is_active: boolean
}

type Invoice = {
  id: number; invoice_number: string; invoice_date: string; due_date?: string
  client_id?: number; client_name: string; client_vat?: string; client_cr?: string; client_address?: string
  project_id?: number; extract_ref?: string
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  status: string; notes?: string
  client?: Client; project?: { name: string }
}

type CreditNote = {
  id: number; note_number: string; note_date: string; note_type: string
  original_invoice_id?: number; client_id?: number; client_name: string; client_vat?: string
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  reason?: string; status: string; notes?: string
  original_invoice?: { invoice_number: string }
}

type Quotation = {
  id: number; quote_number: string; quote_date: string; valid_until?: string
  client_id?: number; client_name: string; client_vat?: string
  project_id?: number; subtotal: number; vat_amount: number; total_amount: number
  vat_rate: number; status: string; notes?: string; terms?: string
  client?: Client; project?: { name: string }
}

type Company = {
  name: string; name_en?: string; vat_number?: string; cr_number?: string
  city?: string; district?: string; street?: string; postal_code?: string
  phone?: string; email?: string; iban?: string; ceo_name?: string
}

type Project     = { id: number; name: string }
type CashAccount = {
  id: number; name: string; account_type: string
  bank_name?: string; account_no?: string; iban?: string; account_id?: string; account_code?: string
}

const INV_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'مرسلة': 'badge-blue', 'مدفوعة': 'badge-green',
  'ملغاة': 'badge-red', 'متأخرة': 'badge-red', 'إشعار جزئي': 'badge-amber', 'مسدد بإشعار': 'badge-red'
}
const QUOTE_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'مرسلة': 'badge-blue', 'مقبولة': 'badge-green',
  'مرفوضة': 'badge-red', 'منتهية': 'badge-gray'
}

// ════════════════════════════════════════
// QR Code ZATCA المرحلة الأولى
// ════════════════════════════════════════
function generateZATCAQR(company: Company, invoice: Partial<Invoice>): string {
  const encode = (tag: number, value: string): string => {
    const bytes = new TextEncoder().encode(value)
    let result = String.fromCharCode(tag) + String.fromCharCode(bytes.length)
    for (let i = 0; i < bytes.length; i++) result += String.fromCharCode(bytes[i])
    return result
  }
  const tlv =
    encode(1, company.name || '') +
    encode(2, company.vat_number || '') +
    encode(3, invoice.invoice_date || new Date().toISOString()) +
    encode(4, String(invoice.total_amount || 0)) +
    encode(5, String(invoice.vat_amount || 0))
  return btoa(unescape(encodeURIComponent(tlv)))
}

// ════════════════════════════════════════
// مكوّن: بنود الفاتورة — مع اختيار من الكتالوج
// ════════════════════════════════════════
function ItemsTable({ items, onChange, catalogItems }: {
  items: InvoiceItem[]
  onChange: (items: InvoiceItem[]) => void
  catalogItems: CatalogItem[]
}) {
  function update(idx: number, k: keyof InvoiceItem, v: any) {
    const next = [...items]
    next[idx] = { ...next[idx], [k]: v }
    if (k === 'quantity' || k === 'unit_price') {
      next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price)
    }
    onChange(next)
  }

  function selectCatalog(idx: number, catalogId: string) {
    if (!catalogId) return
    const cat = catalogItems.find(c => c.id === Number(catalogId))
    if (!cat) return
    const next = [...items]
    next[idx] = {
      ...next[idx],
      description: cat.name,
      unit: cat.unit,
      unit_price: cat.unit_price,
      total: Number(next[idx].quantity) * cat.unit_price,
    }
    onChange(next)
  }

  function add() { onChange([...items, { description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]) }
  function remove(idx: number) { if (items.length > 1) onChange(items.filter((_, i) => i !== idx)) }

  const activeCatalog = catalogItems.filter(c => c.is_active)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Tag style={{ width: '15px', height: '15px', color: 'var(--primary)' }} />
          البنود
          {activeCatalog.length > 0 && (
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 400 }}>
              — اختر من الكتالوج أو اكتب يدوياً
            </span>
          )}
        </label>
        <button type="button" onClick={add}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
          <Plus style={{ width: '13px', height: '13px' }} /> إضافة بند
        </button>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg2)' }}>
              {activeCatalog.length > 0 && (
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                  📦 من الكتالوج
                </th>
              )}
              {['الوصف *', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                {activeCatalog.length > 0 && (
                  <td style={{ padding: '6px 8px', minWidth: '160px' }}>
                    <select
                      onChange={e => selectCatalog(idx, e.target.value)}
                      defaultValue=""
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.78rem', background: '#eff6ff', color: '#1a56db' }}>
                      <option value="">— اختر بنداً —</option>
                      {activeCatalog.map(c => (
                        <option key={c.id} value={c.id}>
                          [{c.item_type}] {c.name} — {c.unit_price.toLocaleString()} ر.س
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td style={{ padding: '6px 8px', minWidth: '180px' }}>
                  <input
                    value={item.description}
                    onChange={e => update(idx, 'description', e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
                    placeholder="وصف الخدمة أو المنتج *"
                  />
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
// مكوّن: إجماليات الفاتورة
// ════════════════════════════════════════
function TotalsBox({ subtotal, vatRate, vatAmount, total }: {
  subtotal: number; vatRate: number; vatAmount: number; total: number
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
      <div style={{ width: '280px', background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)' }}>
        {[
          { label: 'المجموع قبل الضريبة', value: subtotal },
          { label: `ضريبة القيمة المضافة (${vatRate}%)`, value: vatAmount },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.85rem', color: 'var(--text3)' }}>
            <span>{r.label}</span>
            <span style={{ fontWeight: 600, direction: 'ltr' }}>{r.value.toLocaleString()} ر.س</span>
          </div>
        ))}
        <div style={{ borderTop: '2px solid var(--primary)', marginTop: '8px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>
          <span>الإجمالي الكلي</span>
          <span style={{ direction: 'ltr' }}>{total.toLocaleString()} ر.س</span>
        </div>
      </div>
    </div>
  )
}

// القيود تستخدم @/lib/journal

// ════════════════════════════════════════
// طباعة الفاتورة
// ════════════════════════════════════════
// ══ طباعة إشعار دائن / عرض سعر — بنفس هوية الفاتورة ══
function printDoc(kind: 'cn' | 'qt', doc: any, items: any[], company: Company, client?: Client | null) {
  const isCN   = kind === 'cn'
  const title  = isCN ? 'إشعار دائن' : 'عرض سعر'
  const color  = isCN ? '#c81e1e' : '#7c3aed'
  const number = isCN ? doc.note_number : doc.quote_number
  const date   = isCN ? doc.note_date   : doc.quote_date
  // QR للإشعار الدائن (ZATCA المرحلة الأولى تشمل الإشعارات الضريبية)
  const qr = isCN ? generateZATCAQR(company, { invoice_date: date, total_amount: doc.total_amount, vat_amount: doc.vat_amount } as any) : ''
  const clientAddr = client ? [client.street, client.district, client.city].filter(Boolean).join('، ') : ''
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>${title} — ${number}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f1f5f9;padding:20px;color:#1e293b}
.page{background:white;max-width:800px;margin:0 auto;padding:32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid ${color}}
.company-name{font-size:20px;font-weight:800;color:${color};margin-bottom:4px}
.company-info{font-size:11px;color:#64748b;line-height:1.6}
.inv-badge{background:${color};color:white;padding:10px 20px;border-radius:10px;text-align:center}
.inv-badge .num{font-size:18px;font-weight:800}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}
.info-item{background:#f8fafc;border-radius:6px;padding:8px 12px}
.info-label{font-size:10px;color:#94a3b8;margin-bottom:2px}
.info-value{font-size:13px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:${color};color:white}
th{padding:10px 12px;text-align:right;font-size:12px;font-weight:700}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:nth-child(even){background:#f8fafc}
td{padding:10px 12px;font-size:13px}
.totals{display:flex;justify-content:flex-end;margin-bottom:20px}
.totals-box{width:280px;background:#f8fafc;border-radius:10px;padding:14px}
.total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
.total-final{border-top:2px solid ${color};margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;font-weight:800;font-size:16px;color:${color}}
.note-box{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:12px;color:#92400e;margin-bottom:14px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<div class="page">
<div class="header">
  <div>
    <div class="company-name">${company.name || ''}</div>
    ${company.name_en ? `<div style="font-size:13px;color:#64748b;margin-bottom:4px">${company.name_en}</div>` : ''}
    <div class="company-info">
      ${company.vat_number ? `الرقم الضريبي: ${company.vat_number}<br>` : ''}
      ${company.cr_number  ? `السجل التجاري: ${company.cr_number}<br>` : ''}
      ${[company.street, company.district, company.city].filter(Boolean).join('، ')}
    </div>
  </div>
  <div class="inv-badge">
    <div style="font-size:11px;opacity:0.85">${title}</div>
    <div class="num">${number}</div>
    <div style="font-size:11px;margin-top:4px;opacity:0.85">${date}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-item"><div class="info-label">العميل</div><div class="info-value">${doc.client_name}</div>${doc.client_vat ? `<div style="font-size:11px;color:#64748b">الرقم الضريبي: ${doc.client_vat}</div>` : ''}${clientAddr ? `<div style="font-size:11px;color:#64748b">العنوان: ${clientAddr}</div>` : ''}${client?.phone ? `<div style="font-size:11px;color:#64748b">هاتف: ${client.phone}</div>` : ''}</div>
  ${isCN && doc.original_invoice_number ? `<div class="info-item"><div class="info-label">الفاتورة المرجعية</div><div class="info-value">${doc.original_invoice_number}</div></div>` : ''}
  ${!isCN && doc.valid_until ? `<div class="info-item"><div class="info-label">العرض صالح حتى</div><div class="info-value">${doc.valid_until}</div></div>` : ''}
  ${isCN && doc.note_type ? `<div class="info-item"><div class="info-label">نوع الإشعار</div><div class="info-value">${doc.note_type}</div></div>` : ''}
</div>
${isCN && doc.reason ? `<div class="note-box">سبب الإشعار: ${doc.reason}</div>` : ''}
<table>
<thead><tr><th>الوصف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr></thead>
<tbody>
${items.map((i: any) => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${Number(i.unit_price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('')}
</tbody>
</table>
<div class="totals">
<div class="totals-box">
  <div class="total-row"><span>المجموع قبل الضريبة</span><span>${Number(doc.subtotal).toLocaleString()} ر.س</span></div>
  <div class="total-row"><span>ضريبة القيمة المضافة (${doc.vat_rate}%)</span><span>${Number(doc.vat_amount).toLocaleString()} ر.س</span></div>
  <div class="total-final"><span>الإجمالي</span><span>${Number(doc.total_amount).toLocaleString()} ر.س</span></div>
</div>
</div>
${!isCN && doc.terms ? `<div class="note-box" style="background:#f5f3ff;border-color:#e9d5ff;color:#5b21b6">الشروط والأحكام: ${doc.terms}</div>` : ''}
${qr ? `<div style="text-align:center;margin-top:16px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qr)}" /><div style="font-size:10px;color:#94a3b8;margin-top:4px">QR Code — ZATCA Phase 1</div></div>` : ''}
</div></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.onload = () => w.print()
}

function printInvoice(invoice: Invoice, items: InvoiceItem[], company: Company, client?: Client | null) {
  const isCredit = false
  const title = 'فاتورة ضريبية'
  const qr = generateZATCAQR(company, invoice)
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>${title} — ${invoice.invoice_number}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f1f5f9;padding:20px;color:#1e293b}
.page{background:white;max-width:800px;margin:0 auto;padding:32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid ${isCredit ? '#c81e1e' : '#1a56db'}}
.company-name{font-size:20px;font-weight:800;color:${isCredit ? '#c81e1e' : '#1a56db'};margin-bottom:4px}
.company-info{font-size:11px;color:#64748b;line-height:1.6}
.inv-badge{background:${isCredit ? '#c81e1e' : '#1a56db'};color:white;padding:10px 20px;border-radius:10px;text-align:center}
.inv-badge .num{font-size:18px;font-weight:800}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}
.info-item{background:#f8fafc;border-radius:6px;padding:8px 12px}
.info-label{font-size:10px;color:#94a3b8;margin-bottom:2px}
.info-value{font-size:13px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:${isCredit ? '#c81e1e' : '#1a56db'};color:white}
th{padding:10px 12px;text-align:right;font-size:12px;font-weight:700}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:nth-child(even){background:#f8fafc}
td{padding:10px 12px;font-size:13px}
.totals{display:flex;justify-content:flex-end;margin-bottom:20px}
.totals-box{width:280px;background:#f8fafc;border-radius:10px;padding:14px}
.total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
.total-final{border-top:2px solid ${isCredit ? '#c81e1e' : '#1a56db'};margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;font-weight:800;font-size:16px;color:${isCredit ? '#c81e1e' : '#1a56db'}}
.footer-section{display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<div class="page">
<div class="header">
  <div>
    <div class="company-name">${company.name || ''}</div>
    ${company.name_en ? `<div style="font-size:13px;color:#64748b;margin-bottom:4px">${company.name_en}</div>` : ''}
    <div class="company-info">
      ${company.vat_number ? `الرقم الضريبي: ${company.vat_number}<br>` : ''}
      ${company.cr_number  ? `السجل التجاري: ${company.cr_number}<br>` : ''}
      ${[company.street, company.district, company.city].filter(Boolean).join('، ')}
    </div>
  </div>
  <div class="inv-badge">
    <div style="font-size:11px;opacity:0.85">${title}</div>
    <div class="num">${invoice.invoice_number}</div>
    <div style="font-size:11px;margin-top:4px;opacity:0.85">${invoice.invoice_date}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-item"><div class="info-label">العميل</div><div class="info-value">${invoice.client_name}</div>${invoice.client_vat ? `<div style="font-size:11px;color:#64748b">الرقم الضريبي: ${invoice.client_vat}</div>` : ''}${client && [client.street, client.district, client.city].filter(Boolean).length ? `<div style="font-size:11px;color:#64748b">العنوان: ${[client.street, client.district, client.city].filter(Boolean).join('، ')}</div>` : ''}${client?.phone ? `<div style="font-size:11px;color:#64748b">هاتف: ${client.phone}</div>` : ''}</div>
  <div class="info-item"><div class="info-label">تاريخ الفاتورة</div><div class="info-value">${invoice.invoice_date}</div></div>
  ${invoice.due_date ? `<div class="info-item"><div class="info-label">تاريخ الاستحقاق</div><div class="info-value">${invoice.due_date}</div></div>` : ''}
  ${invoice.extract_ref ? `<div class="info-item"><div class="info-label">رقم المستخلص</div><div class="info-value">${invoice.extract_ref}</div></div>` : ''}
</div>
<table>
<thead><tr><th>الوصف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr></thead>
<tbody>
${items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${Number(i.unit_price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('')}
</tbody>
</table>
<div class="totals">
<div class="totals-box">
  <div class="total-row"><span>المجموع قبل الضريبة</span><span>${Number(invoice.subtotal).toLocaleString()} ر.س</span></div>
  <div class="total-row"><span>ضريبة القيمة المضافة (${invoice.vat_rate}%)</span><span>${Number(invoice.vat_amount).toLocaleString()} ر.س</span></div>
  <div class="total-final"><span>الإجمالي</span><span>${Number(invoice.total_amount).toLocaleString()} ر.س</span></div>
</div>
</div>
${qr ? `<div style="text-align:center;margin-top:16px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qr)}" /><div style="font-size:10px;color:#94a3b8;margin-top:4px">QR Code — ZATCA Phase 1</div></div>` : ''}
</div></body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.onload = () => w.print()
}

// ════════════════════════════════════════
// مودال: إدارة الكتالوج (الخدمات والمنتجات)
// ════════════════════════════════════════
function CatalogModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const [items, setItems]     = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editItem, setEditItem] = useState<CatalogItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', item_type: 'خدمة', unit: 'وحدة', unit_price: '0', is_active: true })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase.from('finance_catalog_items').select('*').eq('tenant_id', tenantId).order('item_type').order('name')
    setItems(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditItem(null)
    setForm({ name: '', item_type: 'خدمة', unit: 'وحدة', unit_price: '0', is_active: true })
    setShowForm(true)
  }

  function openEdit(item: CatalogItem) {
    setEditItem(item)
    setForm({ name: item.name, item_type: item.item_type, unit: item.unit, unit_price: String(item.unit_price), is_active: item.is_active })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم البند مطلوب'); return }
    setSaving(true)
    const payload = { tenant_id: tenantId, name: form.name.trim(), item_type: form.item_type, unit: form.unit, unit_price: Number(form.unit_price), is_active: form.is_active }
    if (editItem) {
      await supabase.from('finance_catalog_items').update(payload).eq('id', editItem.id)
      toast.success('تم التعديل ✅')
    } else {
      await supabase.from('finance_catalog_items').insert(payload)
      toast.success('تم الإضافة ✅')
    }
    setSaving(false)
    setShowForm(false)
    loadItems()
  }

  async function toggleActive(item: CatalogItem) {
    await supabase.from('finance_catalog_items').update({ is_active: !item.is_active }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            إدارة الخدمات والمنتجات
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* فورم الإضافة / التعديل */}
          {showForm && (
            <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '16px', border: '1px solid #bae6fd' }}>
              <h4 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px', color: '#1a56db' }}>
                {editItem ? '✏️ تعديل البند' : '➕ إضافة بند جديد'}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>اسم الخدمة / المنتج *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: أعمال كهربائية — مستوى 1" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>النوع</label>
                  <select value={form.item_type} onChange={e => set('item_type', e.target.value)} className="select">
                    <option>خدمة</option>
                    <option>منتج</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>الوحدة</label>
                  <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                    {['وحدة', 'م²', 'م طولي', 'طن', 'كجم', 'لتر', 'يوم', 'ساعة', 'مقطوعة'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>سعر الوحدة (ر.س)</label>
                  <input type="number" min="0" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} className="input" dir="ltr" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="cat-active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: '16px', height: '16px' }} />
                  <label htmlFor="cat-active" style={{ fontSize: '0.8rem', fontWeight: 600 }}>نشط</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">إلغاء</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                  {saving ? '...' : editItem ? 'حفظ التعديل' : 'إضافة'}
                </button>
              </div>
            </div>
          )}

          {/* زر إضافة */}
          {!showForm && (
            <button onClick={openAdd} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> إضافة بند
            </button>
          )}

          {/* قائمة البنود */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>جاري التحميل...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <Package style={{ width: '32px', height: '32px', margin: '0 auto 8px', opacity: 0.4 }} />
              <div>لم تُضَف أي خدمات أو منتجات بعد</div>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    {['البند', 'النوع', 'الوحدة', 'السعر', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border)', opacity: item.is_active ? 1 : 0.5 }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={item.item_type === 'خدمة' ? 'badge badge-blue' : 'badge badge-amber'}>
                          {item.item_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{item.unit}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary)', direction: 'ltr' }}>
                        {item.unit_price.toLocaleString()} ر.س
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={item.is_active ? 'badge badge-green' : 'badge badge-gray'}>
                          {item.is_active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => openEdit(item)} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '12px', height: '12px' }} />
                          </button>
                          <button onClick={() => toggleActive(item)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text3)' }}>
                            {item.is_active ? 'إيقاف' : 'تفعيل'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إغلاق</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إضافة / تعديل عميل
// ════════════════════════════════════════
function ClientModal({ client, tenantId, onClose, onSave }: {
  client: Client | null; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:           client?.name           || '',
    name_en:        client?.name_en        || '',
    vat_number:     client?.vat_number     || '',
    cr_number:      client?.cr_number      || '',
    client_type:    client?.client_type    || 'شركة',
    city:           client?.city           || '',
    district:       client?.district       || '',
    street:         client?.street         || '',
    postal_code:    client?.postal_code    || '',
    country:        client?.country        || 'SA',
    phone:          client?.phone          || '',
    email:          client?.email          || '',
    contact_person: client?.contact_person || '',
    is_active:      client?.is_active      ?? true,
    notes:          client?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم العميل مطلوب'); return }
    setSaving(true)
    const payload = { ...form, tenant_id: tenantId }
    if (client) {
      await supabase.from('finance_clients').update(payload).eq('id', client.id)
    } else {
      const { error } = await supabase.from('finance_clients').insert(payload)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    }
    toast.success(client ? 'تم التعديل ✅' : '✅ تم إضافة العميل')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {client ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>اسم العميل *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الاسم بالإنجليزية</label>
              <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>نوع العميل</label>
              <select value={form.client_type} onChange={e => set('client_type', e.target.value)} className="select">
                {['شركة', 'مؤسسة', 'حكومي', 'فرد'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الرقم الضريبي (ZATCA)</label>
              <input value={form.vat_number} onChange={e => set('vat_number', e.target.value)} className="input" dir="ltr" placeholder="15 رقم" maxLength={15} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>السجل التجاري</label>
              <input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المدينة</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الحي</label>
              <input value={form.district} onChange={e => set('district', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الشارع</label>
              <input value={form.street} onChange={e => set('street', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الرمز البريدي</label>
              <input value={form.postal_code} onChange={e => set('postal_code', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الهاتف</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>البريد الإلكتروني</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} className="input" dir="ltr" type="email" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>جهة الاتصال</label>
              <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="cl-active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: '16px', height: '16px' }} />
              <label htmlFor="cl-active" style={{ fontSize: '0.875rem', fontWeight: 600 }}>عميل نشط</label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            {client ? 'حفظ التعديل' : 'إضافة العميل'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: فاتورة جديدة / تعديل
// ════════════════════════════════════════
function InvoiceModal({ invoice, clients, projects, company, tenantId, catalogItems, onClose, onSave }: {
  invoice: Invoice | null; clients: Client[]; projects: Project[]
  company: Company; tenantId: string; catalogItems: CatalogItem[]
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([])
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    invoice_number: invoice?.invoice_number || '',
    invoice_date:   invoice?.invoice_date   || today,
    due_date:       invoice?.due_date       || '',
    client_id:      invoice?.client_id      ? String(invoice.client_id) : '',
    project_id:     invoice?.project_id     ? String(invoice.project_id) : '',
    extract_ref:    invoice?.extract_ref    || '',
    vat_rate:       invoice?.vat_rate       ?? 15,
    notes:          invoice?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (invoice) {
      loadItems()
      loadAttachments(tenantId, 'فاتورة مبيعات', invoice.id).then(setAttachments)
    } else generateNumber()
  }, [])

  async function loadItems() {
    const { data } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', invoice!.id).order('id')
    if (data && data.length > 0) setItems(data)
  }

  async function generateNumber() {
    const { count } = await supabase.from('finance_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const num = String((count || 0) + 1).padStart(4, '0')
    set('invoice_number', `INV-${new Date().getFullYear()}-${num}`)
  }

  const selectedClient = clients.find(c => c.id === Number(form.client_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave(asDraft: boolean) {
    if (invoice && invoice.status !== 'مسودة') {
      toast.error('لا يمكن تعديل الفاتورة — التعديل متاح للمسودات فقط')
      return
    }
    if (!form.invoice_number.trim()) { toast.error('رقم الفاتورة مطلوب'); return }
    if (!form.client_id) { toast.error('يجب اختيار عميل من القائمة'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }
    setSaving(true)

    const finalStatus = asDraft ? 'مسودة' : 'مرسلة'

    // ══ الرقم النهائي — ذرّي عند الحفظ (الرقم المعروض معاينة فقط) ══
    // إذا أدخل المستخدم رقماً مخصصاً خارج النمط التلقائي يُحترم كما هو
    let finalInvoiceNumber = form.invoice_number.trim()
    if (!invoice && /^INV-\d{4}-\d{4}$/.test(finalInvoiceNumber)) {
      finalInvoiceNumber = (await nextDocNumber(tenantId, 'INV', 'INV')) || finalInvoiceNumber
    }

    const payload = {
      tenant_id: tenantId,
      invoice_number: finalInvoiceNumber,
      ...(invoice ? {} : { created_by: useStore.getState().currentUser?.name || null }),
      invoice_date: form.invoice_date, due_date: form.due_date || null,
      client_id: Number(form.client_id),
      client_name: selectedClient!.name,
      client_vat: selectedClient!.vat_number || null,
      client_cr: selectedClient!.cr_number || null,
      client_address: [selectedClient!.street, selectedClient!.district, selectedClient!.city].filter(Boolean).join('، ') || null,
      project_id: form.project_id ? Number(form.project_id) : null,
      extract_ref: form.extract_ref || null,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate), status: finalStatus, notes: form.notes || null,
    }

    let invoiceId = invoice?.id
    if (invoice) {
      await supabase.from('finance_invoices').update(payload).eq('id', invoice.id)
      await supabase.from('finance_invoice_items').delete().eq('invoice_id', invoice.id)
    } else {
      const { data, error } = await supabase.from('finance_invoices').insert(payload).select('id').single()
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
      invoiceId = data.id
    }

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_invoice_items').insert(
        validItems.map(i => ({ invoice_id: invoiceId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) }))
      )
    }

    // ══ حفظ المرفقات ══
    if (invoiceId) await saveAttachments(tenantId, 'فاتورة مبيعات', invoiceId, attachments)

    // ══ قيد محاسبي تلقائي عند الإرسال (ليس المسودة) ══
    if (finalStatus === 'مرسلة' && invoiceId) {
      await createJournalEntry({
        tenantId,
        date:          payload.invoice_date,
        description:   `فاتورة مبيعات ${payload.invoice_number} — ${payload.client_name}`,
        referenceType: 'فاتورة مبيعات',
        referenceId:   invoiceId,
        source:        'آلي',
        lines: [
          { accountCode: '1120', debit: payload.total_amount, credit: 0,               description: `فاتورة ${payload.invoice_number}` },
          { accountCode: '4110', debit: 0,                    credit: payload.subtotal, description: `إيرادات ${payload.invoice_number}` },
          ...(payload.vat_amount > 0 ? [{ accountCode: '2130', debit: 0, credit: payload.vat_amount, description: 'ضريبة القيمة المضافة' }] : []),
        ]
      })
    }

    toast.success(asDraft ? '💾 تم الحفظ كمسودة' : '✅ تم إنشاء الفاتورة وإرسالها')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '820px', maxHeight: '92vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            {invoice ? 'تعديل فاتورة' : 'فاتورة مبيعات جديدة'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', borderRadius: '6px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* رأس الفاتورة */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم الفاتورة *</label>
              <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ الإصدار *</label>
              <input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ الاستحقاق</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>

          {/* اختيار العميل */}
          <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '14px', border: '1px solid #bae6fd' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              العميل <span style={{ color: '#c81e1e' }}>*</span> — يجب اختيار عميل مضاف مسبقاً
            </label>
            <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="select">
              <option value="">— اختر العميل —</option>
              {clients.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.vat_number ? `(${c.vat_number})` : '⚠️ بدون رقم ضريبي'}
                </option>
              ))}
            </select>
            {form.client_id && !clients.find(c => c.id === Number(form.client_id))?.vat_number && (
              <p style={{ color: '#e6820a', fontSize: '0.78rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle style={{ width: '13px', height: '13px' }} />
                تحذير: هذا العميل بدون رقم ضريبي — الفاتورة لن تكون متوافقة مع ZATCA
              </p>
            )}
          </div>

          {/* المشروع ورقم المستخلص */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم المستخلص</label>
              <input value={form.extract_ref} onChange={e => set('extract_ref', e.target.value)} className="input" dir="ltr" placeholder="اختياري" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>نسبة ضريبة القيمة المضافة</label>
              <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                <option value={15}>15% — المعيارية</option>
                <option value={0}>0% — معفي</option>
              </select>
            </div>
          </div>

          {/* البنود */}
          <ItemsTable items={items} onChange={setItems} catalogItems={catalogItems} />

          {/* الإجماليات */}
          <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />

          {/* المرفقات */}
          <AttachmentUploader value={attachments} onChange={setAttachments} label="مرفقات الفاتورة (PDF / صور)" />

          {/* الملاحظات */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} />
          </div>
        </div>

        {/* ════ Footer — زرا الحفظ والإنشاء ════ */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* حفظ مسودة */}
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', border: '2px solid #6b7280', background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
              {saving ? '...' : <Save style={{ width: '15px', height: '15px' }} />}
              حفظ مسودة
            </button>
            {/* إنشاء فاتورة */}
            <button
              onClick={() => handleSave(false)}
              disabled={saving || !form.client_id}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 24px', fontSize: '0.875rem', fontWeight: 700 }}>
              {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle style={{ width: '15px', height: '15px' }} />}
              إنشاء فاتورة
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إشعار دائن / مرتجع
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
    note_number:         '',
    note_date:           today,
    note_type:           'إشعار دائن',
    original_invoice_id: invoice?.id ? String(invoice.id) : '',
    client_id:           invoice?.client_id ? String(invoice.client_id) : '',
    vat_rate:            invoice?.vat_rate ?? 15,
    reason:              '',
    status:              'مسودة',
    notes:               '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // فواتير العميل المختار (مرسلة أو مدفوعة فقط)
  const clientInvoices = invoices.filter(inv =>
    inv.client_id === Number(form.client_id) &&
    (inv.status === 'مرسلة' || inv.status === 'مدفوعة' || inv.status === 'متأخرة')
  )
  const selectedInvoice = clientInvoices.find(inv => inv.id === Number(form.original_invoice_id))

  // عند تغيير العميل — أعد ضبط الفاتورة المرجعية
  function handleClientChange(clientId: string) {
    set('client_id', clientId)
    set('original_invoice_id', '')
    setItems([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  }

  // عند اختيار فاتورة — تعبئة البنود تلقائياً
  async function handleInvoiceSelect(invoiceId: string) {
    set('original_invoice_id', invoiceId)
    if (!invoiceId) {
      setItems([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
      return
    }
    const { data } = await supabase.from('finance_invoice_items')
      .select('*').eq('invoice_id', Number(invoiceId)).order('id')
    if (data && data.length > 0) setItems(data)
    // تعيين نسبة الضريبة من الفاتورة
    const inv = clientInvoices.find(i => i.id === Number(invoiceId))
    if (inv) set('vat_rate', inv.vat_rate ?? 15)
  }

  useEffect(() => { generateNumber() }, [])

  async function generateNumber() {
    const { count } = await supabase.from('finance_credit_notes').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const num = String((count || 0) + 1).padStart(4, '0')
    set('note_number', `CN-${new Date().getFullYear()}-${num}`)
  }

  const selectedClient = clients.find(c => c.id === Number(form.client_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.note_number.trim())          { toast.error('رقم الإشعار مطلوب'); return }
    if (!form.client_id)                   { toast.error('اختر العميل'); return }
    if (!form.original_invoice_id)         { toast.error('الفاتورة المرجعية إلزامية — لا يمكن إنشاء إشعار بدون فاتورة'); return }
    if (!form.reason.trim())               { toast.error('سبب الإشعار مطلوب'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }

    // ══ ضابط ERP: مجموع كل الإشعارات على الفاتورة (السابقة + الحالي) لا يتجاوز قيمتها ══
    // يمنع تكرار حالة الذمم السالبة
    if (selectedInvoice) {
      const { data: prevNotes } = await supabase.from('finance_credit_notes')
        .select('total_amount')
        .eq('tenant_id', tenantId)
        .eq('original_invoice_id', Number(form.original_invoice_id))
      const prevTotal = (prevNotes || []).reduce((s: number, n: any) => s + Number(n.total_amount), 0)
      const invTotal  = Number(selectedInvoice.total_amount)
      const available = invTotal - prevTotal
      if (total > available + 0.01) {
        toast.error(
          prevTotal > 0
            ? `⛔ الفاتورة قيمتها ${invTotal.toLocaleString()} ر.س وعليها إشعارات سابقة بـ ${prevTotal.toLocaleString()} ر.س — المتاح للإشعار: ${Math.max(0, available).toLocaleString()} ر.س فقط`
            : `⛔ مبلغ الإشعار (${total.toLocaleString()} ر.س) يتجاوز قيمة الفاتورة (${invTotal.toLocaleString()} ر.س)`,
          { duration: 6000 }
        )
        return
      }
    }

    setSaving(true)

    // ══ الرقم النهائي — ذرّي عند الحفظ ══
    let finalNoteNumber = form.note_number.trim()
    if (/^CN-\d{4}-\d{4}$/.test(finalNoteNumber)) {
      finalNoteNumber = (await nextDocNumber(tenantId, 'CN', 'CN')) || finalNoteNumber
    }

    const payload = {
      tenant_id: tenantId, note_number: finalNoteNumber,
      created_by: useStore.getState().currentUser?.name || null,
      note_date: form.note_date, note_type: form.note_type,
      original_invoice_id: form.original_invoice_id ? Number(form.original_invoice_id) : null,
      client_id: Number(form.client_id), client_name: selectedClient!.name,
      client_vat: selectedClient!.vat_number || null,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate), reason: form.reason || null,
      status: form.status, notes: form.notes || null,
    }

    const { data, error } = await supabase.from('finance_credit_notes').insert(payload).select('id').single()
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_credit_note_items').insert(validItems.map(i => ({ note_id: data.id, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }

    await createJournalEntry({
        tenantId,
      date: form.note_date,
      description: `${form.note_type} ${finalNoteNumber} — ${selectedClient!.name}`,
      referenceType: form.note_type, referenceId: data.id, source: 'آلي',
      lines: [
        { accountCode: '4110', debit: subtotal,    credit: 0,       description: `${form.note_type} ${form.note_number}` },
        ...(vatAmount > 0 ? [{ accountCode: '2130', debit: vatAmount, credit: 0, description: 'ضريبة مستردة' }] : []),
        { accountCode: '1120', debit: 0,           credit: total,   description: `إشعار للعميل ${selectedClient!.name}` },
      ]
    })

    toast.success('✅ تم إنشاء الإشعار والقيد المحاسبي')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            إشعار دائن / مرتجع
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم الإشعار</label>
              <input value={form.note_number} onChange={e => set('note_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>التاريخ</label>
              <input type="date" value={form.note_date} onChange={e => set('note_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>النوع</label>
              <select value={form.note_type} onChange={e => set('note_type', e.target.value)} className="select">
                {['إشعار دائن', 'مرتجع مبيعات'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>العميل *</label>
              <select value={form.client_id} onChange={e => handleClientChange(e.target.value)} className="select">
                <option value="">— اختر العميل —</option>
                {clients.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                الفاتورة المرجعية <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              {!form.client_id ? (
                <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', border: '1px solid #fde68a' }}>
                  ← اختر العميل أولاً
                </div>
              ) : clientInvoices.length === 0 ? (
                <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.8rem', color: '#c81e1e', border: '1px solid #fecaca' }}>
                  ⚠️ لا توجد فواتير مرسلة أو مدفوعة لهذا العميل
                </div>
              ) : (
                <>
                  <select value={form.original_invoice_id} onChange={e => handleInvoiceSelect(e.target.value)} className="select">
                    <option value="">— اختر الفاتورة —</option>
                    {clientInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} — {Number(inv.total_amount).toLocaleString()} ر.س ({inv.status})
                      </option>
                    ))}
                  </select>
                  {selectedInvoice && (
                    <div style={{ marginTop: '6px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.78rem', color: '#1a56db', border: '1px solid #bfdbfe' }}>
                      ✅ الفاتورة: {selectedInvoice.invoice_number} · المبلغ: {Number(selectedInvoice.total_amount).toLocaleString()} ر.س · الحالة: {selectedInvoice.status}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>سبب الإشعار</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
          </div>
          <ItemsTable items={items} onChange={setItems} catalogItems={[]} />
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
// مودال: عرض الفاتورة
// ════════════════════════════════════════
function InvoiceViewModal({ invoice, items, company, client, onClose, onPrint }: {
  invoice: Invoice; items: InvoiceItem[]; company: Company; client?: Client | null
  onClose: () => void; onPrint: () => void
}) {
  const qr = generateZATCAQR(company, invoice)
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '720px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            معاينة الفاتورة — {invoice.invoice_number}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={onPrint}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <Printer style={{ width: '15px', height: '15px' }} /> طباعة
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '2px solid #1a56db' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a56db' }}>{company.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '4px', lineHeight: '1.6' }}>
                  {company.vat_number && <div>الرقم الضريبي: {company.vat_number}</div>}
                  {company.phone && <div>هاتف: {company.phone}</div>}
                </div>
              </div>
              <div style={{ background: '#1a56db', color: 'white', padding: '12px 20px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>فاتورة ضريبية</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{invoice.invoice_number}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>{invoice.invoice_date}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', fontSize: '0.85rem' }}>
              <div><span style={{ color: 'var(--text3)' }}>العميل:</span> <strong>{invoice.client_name}</strong></div>
              {invoice.client_vat && <div><span style={{ color: 'var(--text3)' }}>الرقم الضريبي:</span> {invoice.client_vat}</div>}
              {client && [client.street, client.district, client.city].filter(Boolean).length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text3)' }}>العنوان:</span> <strong>{[client.street, client.district, client.city].filter(Boolean).join('، ')}</strong></div>
              )}
              {client?.phone && <div><span style={{ color: 'var(--text3)' }}>هاتف العميل:</span> {client.phone}</div>}
              <div><span style={{ color: 'var(--text3)' }}>تاريخ الإصدار:</span> <strong>{invoice.invoice_date}</strong></div>
              {invoice.due_date && <div><span style={{ color: 'var(--text3)' }}>تاريخ الاستحقاق:</span> <strong>{invoice.due_date}</strong></div>}
              {invoice.extract_ref && <div><span style={{ color: 'var(--text3)' }}>المستخلص:</span> <strong>{invoice.extract_ref}</strong></div>}
            </div>
            {items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ background: '#1a56db', color: 'white' }}>
                    {['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '8px 10px' }}>{item.description}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text3)' }}>{item.unit}</td>
                      <td style={{ padding: '8px 10px', direction: 'ltr', textAlign: 'left' }}>{Number(item.unit_price).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1a56db', direction: 'ltr', textAlign: 'left' }}>{Number(item.total).toLocaleString()} ر.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <TotalsBox subtotal={Number(invoice.subtotal)} vatRate={invoice.vat_rate} vatAmount={Number(invoice.vat_amount)} total={Number(invoice.total_amount)} />
            {qr && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qr)}`} alt="QR ZATCA" />
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '4px' }}>ZATCA QR — المرحلة الأولى</div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إغلاق</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: تسجيل دفعة
// ════════════════════════════════════════
function PaymentModal({ invoice, tenantId, onClose, onSave }: {
  invoice: Invoice; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving]             = useState(false)
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  // ══ صافي المستحق = قيمة الفاتورة − الإشعارات الدائنة المرتبطة بها ══
  const [netDue, setNetDue]             = useState<number>(Number(invoice.total_amount))
  const [cnTotal, setCnTotal]           = useState<number>(0)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    payment_date:    today,
    payment_method:  'تحويل بنكي',
    cash_account_id: '',
    reference:       '',
    notes:           '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('finance_cash_accounts')
      .select('*, fa:finance_accounts(code)')
      .eq('tenant_id', tenantId).eq('is_active', true).order('name')
      .then(({ data }) => setCashAccounts((data || []).map((a: any) => ({ ...a, account_code: a.fa?.code }))))
    // خصم الإشعارات الدائنة المرتبطة من المستحق
    supabase.from('finance_credit_notes')
      .select('total_amount')
      .eq('tenant_id', tenantId).eq('original_invoice_id', invoice.id)
      .then(({ data }) => {
        const cn = (data || []).reduce((s: number, n: any) => s + Number(n.total_amount), 0)
        setCnTotal(cn)
        setNetDue(Math.max(0, Number(invoice.total_amount) - cn))
      })
  }, [])

  const bankAccounts    = cashAccounts.filter(a => a.account_type === 'بنك' || a.account_type === 'حساب بنكي')
  const cashBoxes       = cashAccounts.filter(a => a.account_type === 'صندوق' || a.account_type === 'نقدية')
  const selectedAccount = cashAccounts.find(a => a.id === Number(form.cash_account_id))

  function getDebitAccountCode(): string {
    // account_code = كود الحساب الحقيقي من finance_accounts
    if (selectedAccount?.account_code) return selectedAccount.account_code
    if (form.payment_method === 'نقداً') return '1111'
    return '1120'
  }

  async function handleSave() {
    if ((form.payment_method === 'تحويل بنكي' || form.payment_method === 'شيك' || form.payment_method === 'بطاقة') && !form.cash_account_id) {
      toast.error('يجب تحديد الحساب البنكي'); return
    }
    if (form.payment_method === 'نقداً' && !form.cash_account_id) {
      toast.error('يجب تحديد الصندوق'); return
    }
    // ══ ضابط ERP: لا تحصيل لفاتورة مغطاة بالكامل بإشعار دائن ══
    if (netDue <= 0) {
      toast.error('⛔ هذه الفاتورة مغطاة بالكامل بإشعار دائن — لا يوجد مبلغ مستحق للتحصيل', { duration: 6000 })
      return
    }
    setSaving(true)

    const accountLabel = selectedAccount
      ? `${selectedAccount.name}${selectedAccount.bank_name ? ` — ${selectedAccount.bank_name}` : ''}`
      : form.payment_method

    await supabase.from('finance_invoices').update({ status: 'مدفوعة' }).eq('id', invoice.id)

    await createJournalEntry({
        tenantId,
      date:          form.payment_date,
      description:   `تحصيل فاتورة ${invoice.invoice_number} — ${invoice.client_name} (${accountLabel})`,
      referenceType: 'تحصيل فاتورة', referenceId: invoice.id, source: 'آلي',
      lines: [
        { accountCode: getDebitAccountCode(), debit: netDue, credit: 0,      description: `${form.payment_method} — ${accountLabel}` },
        { accountCode: '1120',                debit: 0,      credit: netDue, description: `إقفال ذمة ${invoice.client_name}` },
      ]
    })

    toast.success('✅ تم تسجيل الدفعة والقيد المحاسبي')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💵 تسجيل دفعة — {invoice.invoice_number}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>المبلغ المستحق</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#0ea77b' }}>{netDue.toLocaleString()} ر.س</div>
            {cnTotal > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#e6820a', marginTop: '2px' }}>
                (الفاتورة {Number(invoice.total_amount).toLocaleString()} − إشعار دائن {cnTotal.toLocaleString()})
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{invoice.client_name}</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>تاريخ الدفعة</label>
            <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>طريقة الدفع</label>
            <select value={form.payment_method} onChange={e => { set('payment_method', e.target.value); set('cash_account_id', '') }} className="select">
              {['تحويل بنكي', 'شيك', 'نقداً', 'بطاقة'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          {/* قائمة الحسابات البنكية */}
          {(form.payment_method === 'تحويل بنكي' || form.payment_method === 'شيك' || form.payment_method === 'بطاقة') && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                الحساب البنكي <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              {bankAccounts.length === 0 ? (
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', border: '1px solid #fde68a' }}>
                  ⚠️ لا توجد حسابات بنكية — أضفها من إعدادات الخزينة
                </div>
              ) : (
                <>
                  <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                    <option value="">— اختر الحساب البنكي —</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}{a.bank_name ? ` — ${a.bank_name}` : ''}{a.account_no ? ` (${a.account_no})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedAccount?.iban && (
                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text3)', fontFamily: 'monospace' }}>
                      IBAN: {selectedAccount.iban}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {/* الصندوق النقدي */}
          {form.payment_method === 'نقداً' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                الصندوق <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              {cashBoxes.length === 0 ? (
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', border: '1px solid #fde68a' }}>
                  ⚠️ لا توجد صناديق — أضفها من إعدادات الخزينة
                </div>
              ) : (
                <select value={form.cash_account_id} onChange={e => set('cash_account_id', e.target.value)} className="select">
                  <option value="">— اختر الصندوق —</option>
                  {cashBoxes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
              {form.payment_method === 'شيك' ? 'رقم الشيك' : 'رقم المرجع / التحويل'}
            </label>
            <input value={form.reference} onChange={e => set('reference', e.target.value)} className="input" dir="ltr" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : '💵'}
            تسجيل الدفعة
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: عرض عرض السعر
// ════════════════════════════════════════
function QuotationModal({ quote, clients, projects, company, tenantId, onClose, onSave }: {
  quote?: any; clients: Client[]; projects: Project[]; company: Company
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    quote_number: quote?.quote_number || '',
    quote_date:   quote?.quote_date   || today,
    valid_until:  quote?.valid_until  || '',
    client_id:    quote?.client_id ? String(quote.client_id) : '',
    project_id:   quote?.project_id ? String(quote.project_id) : '',
    vat_rate:     quote?.vat_rate ?? 15,
    notes:        quote?.notes || '',
    terms:        quote?.terms || '',
    status:       quote?.status || 'مسودة',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (quote) {
      supabase.from('finance_quotation_items').select('*').eq('quotation_id', quote.id).order('id')
        .then(({ data }) => { if (data && data.length > 0) setItems(data) })
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

    // ══ الرقم النهائي — ذرّي عند الحفظ (العرض الموجود يحتفظ برقمه) ══
    let finalQuoteNumber = form.quote_number
    if (!quote && /^QT-\d{4}-\d{4}$/.test(finalQuoteNumber)) {
      finalQuoteNumber = (await nextDocNumber(tenantId, 'QT', 'QT')) || finalQuoteNumber
    }

    const payload = {
      tenant_id: tenantId, quote_number: finalQuoteNumber, quote_date: form.quote_date,
      ...(quote ? {} : { created_by: useStore.getState().currentUser?.name || null }),
      valid_until: form.valid_until || null,
      client_id: Number(form.client_id), client_name: selectedClient!.name,
      client_vat: selectedClient!.vat_number || null,
      project_id: form.project_id ? Number(form.project_id) : null,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate), status: form.status,
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
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            عرض سعر جديد
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>رقم العرض</label>
              <input value={form.quote_number} onChange={e => set('quote_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>تاريخ العرض</label>
              <input type="date" value={form.quote_date} onChange={e => set('quote_date', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>صالح حتى</label>
              <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>العميل *</label>
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="select">
                <option value="">— اختر العميل —</option>
                {clients.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <ItemsTable items={items} onChange={setItems} catalogItems={[]} />
          <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.client_id} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? '...' : <Save style={{ width: '15px', height: '15px' }} />}
            إنشاء عرض السعر
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function InvoicesPage() {
  const router = useRouter()
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'invoices' | 'creditnotes' | 'quotations' | 'clients'>('invoices')
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices]       = useState<Invoice[]>([])
  const [filterStatus, setFilterStatus] = useState('الكل')

  // ══ Pagination للفواتير — الـ hook الأصلي ══
  const invPagination = usePagination(50)
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  // ══ إشعارات دائنة (غير ملغاة) مجمعة حسب الفاتورة — لحساب الحالة العرضية والشارات ══
  const cnByInvoice = useMemo(() => {
    const m: Record<number, number> = {}
    creditNotes.forEach((cn: any) => {
      if (cn.status !== 'ملغي' && cn.original_invoice_id) {
        m[cn.original_invoice_id] = (m[cn.original_invoice_id] || 0) + Number(cn.total_amount)
      }
    })
    return m
  }, [creditNotes])
  const [quotations, setQuotations]   = useState<Quotation[]>([])
  const [clients, setClients]         = useState<Client[]>([])
  const [company, setCompany]         = useState<Company>({} as Company)
  const [projects, setProjects]       = useState<Project[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [search, setSearch]           = useState('')

  const [showInvoiceModal,  setShowInvoiceModal]  = useState(false)
  const [showCreditModal,   setShowCreditModal]   = useState(false)
  const [showPaymentModal,  setShowPaymentModal]  = useState(false)
  const [showCatalogModal,  setShowCatalogModal]  = useState(false)
  const [showClientModal,   setShowClientModal]   = useState(false)
  const [editInvoice,       setEditInvoice]       = useState<Invoice | null>(null)
  const [editClient,        setEditClient]        = useState<Client | null>(null)
  const [paymentInvoice,    setPaymentInvoice]    = useState<Invoice | null>(null)
  const [creditInvoice,     setCreditInvoice]     = useState<Invoice | null>(null)
  const [showQuoteModal,    setShowQuoteModal]     = useState(false)
  const [showViewModal,     setShowViewModal]     = useState(false)
  const [viewInvoice,       setViewInvoice]       = useState<Invoice | null>(null)
  const [viewItems,         setViewItems]         = useState<InvoiceItem[]>([])
  const [editQuote,         setEditQuote]          = useState<any | null>(null)
  const [viewDoc,           setViewDoc]            = useState<{ kind: 'cn' | 'qt'; doc: any; items: any[]; loading: boolean } | null>(null)

  // ══ استعراض إشعار / عرض سعر مع بنوده ══
  async function openViewDoc(kind: 'cn' | 'qt', doc: any) {
    setViewDoc({ kind, doc, items: [], loading: true })
    const table = kind === 'cn' ? 'finance_credit_note_items' : 'finance_quotation_items'
    const fk    = kind === 'cn' ? 'note_id' : 'quotation_id'
    const { data } = await supabase.from(table).select('*').eq(fk, doc.id).order('id')
    setViewDoc({ kind, doc, items: data || [], loading: false })
  }

  // ══ تحميل بيانات الصفحة عند توفر tenant لأول مرة (كانت مفقودة) ══
  useEffect(() => {
    if (tenant?.id) loadAll()
  }, [tenant?.id])

  async function loadInvoices(page: number, status: string, q: string) {
    if (!tenant) return
    try {
      const from = (page - 1) * 50
      const to   = from + 49
      let query = supabase.from('finance_invoices')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .order('invoice_date', { ascending: false })
        .order('id', { ascending: false })
      if (status && status !== 'الكل') query = query.eq('status', status)
      if (q) query = query.or(`invoice_number.ilike.%${q}%,client_name.ilike.%${q}%`)
      const { data, count, error } = await query.range(from, to)
      if (error) { console.error('[loadInvoices]', error.message); setInvoices([]); return }
      setInvoices(data || [])
      invPagination.setPage(page)
      invPagination.setTotal(count || 0)
    } catch (err) {
      console.error('[loadInvoices] استثناء:', err)
      setInvoices([])
    }
  }

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    try {
      const [cnRes, qtRes, clRes, compRes, projRes, catRes] = await Promise.all([
        supabase.from('finance_credit_notes').select('*').eq('tenant_id', tenant.id).order('note_date', { ascending: false }).limit(200),
        supabase.from('finance_quotations').select('*, client:finance_clients(name), project:projects(name)').eq('tenant_id', tenant.id).order('quote_date', { ascending: false }).limit(200),
        supabase.from('finance_clients').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('tenants').select('*').eq('id', tenant.id).single(),
        supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
        supabase.from('finance_catalog_items').select('*').eq('tenant_id', tenant.id).order('item_type').order('name'),
      ])
      setCreditNotes(cnRes.data || [])
      setQuotations(qtRes.data || [])
      setClients(clRes.data || [])
      if (compRes.data) setCompany(compRes.data)
      setProjects(projRes.data || [])
      setCatalogItems(catRes.data || [])
      await loadInvoices(1, filterStatus, search)
    } catch (err) {
      console.error('[invoices] فشل تحميل البيانات:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleViewInvoice(inv: Invoice) {
    const { data: items } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    setViewItems(items || [])
    setViewInvoice(inv)
    setShowViewModal(true)
  }

  async function handlePrintInvoice(inv: Invoice) {
    const { data: items } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    const client = clients.find(c => c.id === inv.client_id) || null
    setTimeout(() => printInvoice(inv, items || [], company, client), 0)
  }

  async function deleteInvoice(inv: Invoice) {
    if (inv.status !== 'مسودة') {
      toast.error('لا يمكن حذف الفاتورة — الحذف متاح للمسودات فقط. استخدم إشعار دائن للتصحيح')
      return
    }
    if (!confirm('حذف هذه الفاتورة نهائياً؟')) return
    await supabase.from('finance_invoices').delete().eq('id', inv.id)
    setInvoices(p => p.filter(i => i.id !== inv.id))
    toast.success('تم الحذف')
  }

  const today = new Date().toISOString().split('T')[0]

  const totalInvoiced  = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalCollected = invoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
  const totalPending   = invoices.filter(i => i.status === 'مرسلة' || i.status === 'مسودة').reduce((s, i) => s + Number(i.total_amount), 0)

  // الفلترة تتم server-side في loadInvoices — invoices هي الصفحة الحالية فقط
  const filteredInvoices = invoices

  const TABS = [
    { id: 'invoices',    label: '🧾 الفواتير',       count: invPagination.total, color: '#1a56db' },
    { id: 'creditnotes', label: '↩️ الإشعارات',      count: creditNotes.length, color: '#c81e1e' },
    { id: 'quotations',  label: '📋 عروض الأسعار',   count: quotations.length,  color: '#7c3aed' },
    { id: 'clients',     label: '👥 العملاء',         count: clients.length,     color: '#e6820a' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
            فواتير المبيعات
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
            الفواتير — الإشعارات الدائنة — عروض الأسعار — العملاء
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* زر إدارة الكتالوج */}
          <button
            onClick={() => setShowCatalogModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '2px solid var(--primary)', background: 'white', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
            <Package style={{ width: '16px', height: '16px' }} />
            الخدمات والمنتجات
          </button>
          {activeTab === 'invoices' && (
            <button onClick={() => { setEditInvoice(null); setShowInvoiceModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> فاتورة جديدة
            </button>
          )}
          {activeTab === 'creditnotes' && (
            <button onClick={() => { setCreditInvoice(null); setShowCreditModal(true) }} className="btn btn-primary" style={{ background: '#c81e1e' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> إشعار دائن
            </button>
          )}
          {activeTab === 'quotations' && (
            <button onClick={() => { setEditQuote(null); setShowQuoteModal(true) }} className="btn btn-primary" style={{ background: '#7c3aed' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> عرض سعر
            </button>
          )}
          {activeTab === 'clients' && (
            <button onClick={() => { setEditClient(null); setShowClientModal(true) }} className="btn btn-primary" style={{ background: '#e6820a' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> عميل جديد
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الفواتير',  value: totalInvoiced,  color: '#1a56db', bg: '#eff6ff' },
          { label: 'إجمالي المحصّل',   value: totalCollected, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'قيد التحصيل',      value: totalPending,   color: '#e6820a', bg: '#fffbeb' },
          { label: 'عدد الفواتير',     value: invoices.length, color: '#374151', bg: '#f3f4f6', isCount: true },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>
              {(kpi as any).isCount ? kpi.value : `${Number(kpi.value).toLocaleString()} ر.س`}
            </div>
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
            {t.label} <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* بحث + فلاتر حالة */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search}
            onChange={e => { setSearch(e.target.value); if (activeTab === 'invoices') loadInvoices(1, filterStatus, e.target.value) }}
            placeholder="بحث برقم الفاتورة أو العميل..." className="input" style={{ paddingRight: '32px', width: '280px' }} />
        </div>
        {activeTab === 'invoices' && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {['الكل', 'مسودة', 'مرسلة', 'مدفوعة', 'ملغاة'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                  borderColor: filterStatus === s ? '#1a56db' : 'var(--border)',
                  background:  filterStatus === s ? '#1a56db' : 'white',
                  color:       filterStatus === s ? 'white'   : 'var(--text3)' }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══ تاب: الفواتير ══ */}
      {activeTab === 'invoices' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
              <FileText style={{ width: '40px', height: '40px', margin: '0 auto 12px', opacity: 0.3 }} />
              <div>لا توجد فواتير</div>
              <button onClick={() => setShowInvoiceModal(true)} className="btn btn-primary" style={{ marginTop: '12px' }}>
                <Plus style={{ width: '15px', height: '15px' }} /> إنشاء أول فاتورة
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم الفاتورة', 'العميل', 'التاريخ', 'الاستحقاق', 'المجموع', 'ض.ق.م', 'الإجمالي', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(inv => {
                    // ══ الحالة العرضية تُحسب من البيانات: فاتورة − إشعاراتها ══
                    const cnTotal       = cnByInvoice[inv.id] || 0
                    const fullyCredited = cnTotal > 0 && cnTotal >= Number(inv.total_amount) - 0.01 && inv.status !== 'مدفوعة'
                    const isOverdue = !fullyCredited && inv.status !== 'مدفوعة' && inv.status !== 'ملغاة' && inv.due_date && inv.due_date < today
                    const displayStatus = fullyCredited ? 'مسدد بإشعار' : isOverdue ? 'متأخرة' : inv.status
                    return (
                      <tr key={inv.id}
                        style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                        onClick={() => handleViewInvoice(inv)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1a56db' }}>{inv.invoice_number}</div>
                          {(inv as any).created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {(inv as any).created_by}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{inv.client_name}</td>
                        <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{inv.invoice_date}</td>
                        <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: isOverdue ? '#c81e1e' : 'var(--text3)' }}>{inv.due_date || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{Number(inv.subtotal).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', color: '#e6820a' }}>{Number(inv.vat_amount).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1a56db' }}>{Number(inv.total_amount).toLocaleString()} ر.س</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <span className={'badge ' + (INV_STATUS_COLOR[displayStatus] || 'badge-gray')}>{displayStatus}</span>
                            {cnTotal > 0 && !fullyCredited && (
                              <span title={`إشعار دائن مرتبط بـ ${cnTotal.toLocaleString()} ر.س — المتبقي للتحصيل: ${(Number(inv.total_amount) - cnTotal).toLocaleString()} ر.س`}
                                style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', background: '#fef2f2', color: '#c81e1e', fontWeight: 700, border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>
                                ↩️ إشعار {cnTotal.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            {/* عرض الفاتورة */}
                            <button onClick={() => handleViewInvoice(inv)} title="عرض الفاتورة"
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                              <Eye style={{ width: '12px', height: '12px' }} />
                            </button>
                            <button onClick={() => handlePrintInvoice(inv)} title="طباعة"
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer' }}>
                              <Printer style={{ width: '12px', height: '12px' }} />
                            </button>
                            {inv.status === 'مسودة' && (
                              <button onClick={() => { setEditInvoice(inv); setShowInvoiceModal(true) }}
                                style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}>
                                <Pencil style={{ width: '12px', height: '12px' }} />
                              </button>
                            )}
                            {(inv.status === 'مرسلة' || inv.status === 'متأخرة') && !fullyCredited && (
                              <button onClick={() => { setPaymentInvoice(inv); setShowPaymentModal(true) }}
                                style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                💵 تحصيل
                              </button>
                            )}
                            {(inv.status === 'مرسلة' || inv.status === 'مدفوعة') && !fullyCredited && (
                              <button onClick={() => { setCreditInvoice(inv); setShowCreditModal(true) }}
                                title="إشعار دائن"
                                style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <RotateCcw style={{ width: '11px', height: '11px' }} /> إشعار دائن
                              </button>
                            )}
                            {inv.status === 'مسودة' && (
                              <button onClick={() => deleteInvoice(inv)}
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
          {/* شريط التصفح الصفحي */}
        </div>
      )}

      {/* ══ تاب: الإشعارات الدائنة ══ */}
      {activeTab === 'creditnotes' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {creditNotes.filter(cn => !search || cn.note_number.includes(search) || cn.client_name.includes(search)).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد إشعارات</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم الإشعار', 'العميل', 'النوع', 'التاريخ', 'الإجمالي', 'السبب', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.filter(cn => !search || cn.note_number.includes(search) || cn.client_name.includes(search)).map(cn => (
                    <tr key={cn.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{cn.note_number}</div>
                        {(cn as any).created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {(cn as any).created_by}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{cn.client_name}</td>
                      <td style={{ padding: '10px 14px' }}><span className="badge badge-red">{cn.note_type}</span></td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{cn.note_date}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#c81e1e' }}>{Number(cn.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{cn.reason || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><span className={'badge ' + (cn.status === 'ملغي' ? 'badge-red' : 'badge-gray')}>{cn.status}</span></td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => openViewDoc('cn', cn)} title="استعراض"
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                            <Eye style={{ width: '13px', height: '13px' }} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب: عروض الأسعار ══ */}
      {activeTab === 'quotations' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {quotations.filter(q => !search || q.quote_number.includes(search) || q.client_name.includes(search)).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد عروض أسعار</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['رقم العرض', 'العميل', 'التاريخ', 'صالح حتى', 'الإجمالي', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotations.filter(q => !search || q.quote_number.includes(search) || q.client_name.includes(search)).map(q => (
                    <tr key={q.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>{q.quote_number}</div>
                        {(q as any).created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {(q as any).created_by}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{q.client_name}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{q.quote_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{q.valid_until || '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#7c3aed' }}>{Number(q.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px' }}><span className={'badge ' + (QUOTE_STATUS_COLOR[q.status] || 'badge-gray')}>{q.status}</span></td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => openViewDoc('qt', q)} title="استعراض"
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                            <Eye style={{ width: '13px', height: '13px' }} />
                          </button>
                          <button onClick={() => { setEditQuote(q); setShowQuoteModal(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '13px', height: '13px' }} /> تعديل
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب: العملاء ══ */}
      {activeTab === 'clients' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {clients.filter(c => !search || c.name.includes(search)).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا يوجد عملاء</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['اسم العميل', 'النوع', 'الرقم الضريبي', 'الهاتف', 'المدينة', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.filter(c => !search || c.name.includes(search)).map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-blue">{c.client_type}</span></td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        {c.vat_number
                          ? <span style={{ color: '#0ea77b' }}><CheckCircle style={{ width: '12px', height: '12px', display: 'inline', marginLeft: '4px' }} />{c.vat_number}</span>
                          : <span style={{ color: '#e6820a' }}><AlertCircle style={{ width: '12px', height: '12px', display: 'inline', marginLeft: '4px' }} />غير مُدخل</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{c.city || '—'}</td>
                      <td style={{ padding: '12px 14px' }}><span className={'badge ' + (c.is_active ? 'badge-green' : 'badge-gray')}>{c.is_active ? 'نشط' : 'موقوف'}</span></td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => router.push(`/finance/invoices/clients/${c.id}`)}
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                            <Eye style={{ width: '13px', height: '13px' }} />
                          </button>
                          <button onClick={() => { setEditClient(c); setShowClientModal(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '13px', height: '13px' }} /> تعديل
                          </button>
                        </div>
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
      {showCatalogModal && (
        <CatalogModal tenantId={tenant!.id} onClose={() => { setShowCatalogModal(false); loadAll() }} />
      )}
      {showInvoiceModal && (
        <InvoiceModal
          invoice={editInvoice} clients={clients} projects={projects}
          company={company} tenantId={tenant!.id} catalogItems={catalogItems}
          onClose={() => { setShowInvoiceModal(false); setEditInvoice(null) }}
          onSave={() => { setShowInvoiceModal(false); setEditInvoice(null); loadAll() }} />
      )}
      {showCreditModal && (
        <CreditNoteModal invoice={creditInvoice} clients={clients} invoices={invoices} tenantId={tenant!.id}
          onClose={() => { setShowCreditModal(false); setCreditInvoice(null) }}
          onSave={() => { setShowCreditModal(false); setCreditInvoice(null); loadAll() }} />
      )}
      {showQuoteModal && (
        <QuotationModal quote={editQuote} clients={clients} projects={projects} company={company}
          tenantId={tenant!.id}
          onClose={() => { setShowQuoteModal(false); setEditQuote(null) }}
          onSave={() => { setShowQuoteModal(false); setEditQuote(null); loadAll() }} />
      )}

      {/* ══ مودال استعراض إشعار / عرض سعر ══ */}
      {viewDoc && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setViewDoc(null)}>
          <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '85vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {viewDoc.kind === 'cn' ? '🔻 إشعار دائن' : '📄 عرض سعر'} — {viewDoc.kind === 'cn' ? viewDoc.doc.note_number : viewDoc.doc.quote_number}
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>
                  {viewDoc.doc.client_name} · {viewDoc.kind === 'cn' ? viewDoc.doc.note_date : viewDoc.doc.quote_date} · {viewDoc.doc.status}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => printDoc(viewDoc.kind, viewDoc.doc, viewDoc.items, company, clients.find(c => c.id === viewDoc.doc.client_id) || null)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                  <Printer style={{ width: '14px', height: '14px' }} /> طباعة
                </button>
                {(() => {
                  const cl = clients.find(c => c.id === viewDoc.doc.client_id)
                  const num = viewDoc.kind === 'cn' ? viewDoc.doc.note_number : viewDoc.doc.quote_number
                  const subj = encodeURIComponent(`${viewDoc.kind === 'cn' ? 'إشعار دائن' : 'عرض سعر'} ${num} — ${company.name || ''}`)
                  const body = encodeURIComponent(`السلام عليكم،\n\nمرفق ${viewDoc.kind === 'cn' ? 'الإشعار الدائن' : 'عرض السعر'} رقم ${num} بإجمالي ${Number(viewDoc.doc.total_amount).toLocaleString()} ر.س.\n\nمع التحية،\n${company.name || ''}`)
                  return (
                    <a href={`mailto:${cl?.email || ''}?subject=${subj}&body=${body}`}
                      title={cl?.email ? `إرسال إلى ${cl.email}` : 'بريد العميل غير مسجل — سيُفتح بريد فارغ'}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}>
                      ✉️ إرسال بالبريد
                    </a>
                  )
                })()}
                <button onClick={() => setViewDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}>
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 0, overflowY: 'auto' }}>
              {(() => {
                const cl = clients.find(c => c.id === viewDoc.doc.client_id)
                const addr = cl ? [cl.street, cl.district, cl.city].filter(Boolean).join('، ') : ''
                return (addr || cl?.phone || cl?.email) ? (
                  <div style={{ padding: '10px 16px', background: '#f8fafc', fontSize: '0.75rem', color: 'var(--text3)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    {addr && <span>📍 {addr}</span>}
                    {cl?.phone && <span>📞 {cl.phone}</span>}
                    {cl?.email && <span>✉️ {cl.email}</span>}
                  </div>
                ) : null
              })()}
              {viewDoc.kind === 'cn' && (viewDoc.doc.reason || viewDoc.doc.original_invoice_id) && (
                <div style={{ padding: '10px 16px', background: '#fef2f2', fontSize: '0.78rem', color: '#b91c1c', borderBottom: '1px solid #fecaca' }}>
                  {viewDoc.doc.reason && <>السبب: {viewDoc.doc.reason}</>}
                </div>
              )}
              {viewDoc.kind === 'qt' && viewDoc.doc.valid_until && (
                <div style={{ padding: '10px 16px', background: '#f5f3ff', fontSize: '0.78rem', color: '#5b21b6', borderBottom: '1px solid #e9d5ff' }}>
                  صالح حتى: {viewDoc.doc.valid_until}
                </div>
              )}
              {viewDoc.loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>جاري التحميل...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['البند', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: viewDoc.kind === 'cn' ? '#c81e1e' : '#7c3aed' }}><span>الإجمالي</span><span style={{ fontFamily: 'monospace' }}>{Number(viewDoc.doc.total_amount).toLocaleString()} ر.س</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showClientModal && (
        <ClientModal client={editClient} tenantId={tenant!.id}
          onClose={() => { setShowClientModal(false); setEditClient(null) }}
          onSave={() => { setShowClientModal(false); setEditClient(null); loadAll() }} />
      )}
      {showPaymentModal && paymentInvoice && (
        <PaymentModal invoice={paymentInvoice} tenantId={tenant!.id}
          onClose={() => { setShowPaymentModal(false); setPaymentInvoice(null) }}
          onSave={() => { setShowPaymentModal(false); setPaymentInvoice(null); loadAll() }} />
      )}
      {showViewModal && viewInvoice && (
        <InvoiceViewModal
          invoice={viewInvoice} items={viewItems} company={company}
          client={clients.find(c => c.id === viewInvoice.client_id) || null}
          onClose={() => { setShowViewModal(false); setViewInvoice(null) }}
          onPrint={() => handlePrintInvoice(viewInvoice)}
        />
      )}
    </div>
  )
}
