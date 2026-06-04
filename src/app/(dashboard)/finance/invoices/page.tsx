'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Printer, Trash2, Pencil, Search, FileText, Users, RotateCcw, ClipboardList, CheckCircle, AlertCircle, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

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

type Project = { id: number; name: string }

const INV_STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'مرسلة': 'badge-blue', 'مدفوعة': 'badge-green',
  'ملغاة': 'badge-red', 'متأخرة': 'badge-red', 'إشعار جزئي': 'badge-amber'
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
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i])
    }
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
// مكوّن: بنود الفاتورة / العرض / الإشعار
// ════════════════════════════════════════
function ItemsTable({ items, onChange }: {
  items: InvoiceItem[]
  onChange: (items: InvoiceItem[]) => void
}) {
  function update(idx: number, k: keyof InvoiceItem, v: any) {
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
                    style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="وصف العمل أو المادة" />
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
// مكوّن: ملخص الإجماليات
// ════════════════════════════════════════
function TotalsBox({ subtotal, vatRate, vatAmount, total }: { subtotal: number; vatRate: number; vatAmount: number; total: number }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>المجموع قبل الضريبة</span>
          <span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} ر.س</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>ضريبة القيمة المضافة ({vatRate}%)</span>
          <span style={{ fontWeight: 600, color: '#e6820a' }}>{vatAmount.toLocaleString()} ر.س</span>
        </div>
        <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>الإجمالي</span>
          <span style={{ fontWeight: 700, fontSize: '1.3rem', color: '#1a56db' }}>{total.toLocaleString()} ر.س</span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// طباعة الفاتورة
// ════════════════════════════════════════
function printInvoice(invoice: Invoice, items: InvoiceItem[], company: Company, isCredit = false) {
  const qr = generateZATCAQR(company, invoice)
  const title = isCredit ? 'إشعار دائن' : 'فاتورة ضريبية'
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title} ${invoice.invoice_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1a2e;background:white;direction:rtl;font-size:14px}
.page{max-width:794px;margin:0 auto;padding:30px 40px;min-height:1123px;position:relative}
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
.sig-line{border-bottom:2px solid ${isCredit ? '#c81e1e' : '#1a56db'};width:160px;margin:40px auto 6px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.no-print{display:none}}
</style></head><body>
<div class="page">
<div class="header">
  <div>
    <div class="company-name">${company.name || ''}</div>
    ${company.name_en ? '<div style="font-size:13px;color:#64748b;margin-bottom:4px">' + company.name_en + '</div>' : ''}
    <div class="company-info">
      ${company.vat_number ? 'الرقم الضريبي: ' + company.vat_number + '<br>' : ''}
      ${company.cr_number  ? 'السجل التجاري: ' + company.cr_number  + '<br>' : ''}
      ${[company.street, company.district, company.city, company.postal_code].filter(Boolean).join('، ')}${company.phone ? '<br>هاتف: ' + company.phone : ''}
    </div>
  </div>
  <div class="inv-badge">
    <div style="font-size:11px;opacity:0.85">${title}</div>
    <div class="num">${invoice.invoice_number}</div>
    <div style="font-size:11px;margin-top:4px;opacity:0.85">${invoice.invoice_date}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-item">
    <div class="info-label">العميل</div>
    <div class="info-value">${invoice.client_name}</div>
    ${invoice.client_vat ? '<div style="font-size:11px;color:#64748b">رقم ضريبي: ' + invoice.client_vat + '</div>' : ''}
    ${invoice.client_address ? '<div style="font-size:11px;color:#64748b">' + invoice.client_address + '</div>' : ''}
  </div>
  <div class="info-item">
    <div class="info-label">تفاصيل</div>
    <div style="font-size:12px;line-height:1.8">
      <div>تاريخ الإصدار: <strong>${invoice.invoice_date}</strong></div>
      ${invoice.due_date ? '<div>تاريخ الاستحقاق: <strong>' + invoice.due_date + '</strong></div>' : ''}
      ${invoice.extract_ref ? '<div>المستخلص: <strong>' + invoice.extract_ref + '</strong></div>' : ''}
    </div>
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:40%">الوصف</th><th style="width:10%;text-align:center">الكمية</th>
    <th style="width:10%;text-align:center">الوحدة</th><th style="width:15%;text-align:left">سعر الوحدة</th>
    <th style="width:15%;text-align:left">الإجمالي</th><th style="width:10%;text-align:center">ض.ق.م</th>
  </tr></thead>
  <tbody>
    ${items.map(i => `<tr><td>${i.description}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:center">${i.unit}</td><td style="text-align:left;direction:ltr">${Number(i.unit_price).toLocaleString('ar-SA')}</td><td style="text-align:left;direction:ltr;font-weight:600">${Number(i.total).toLocaleString('ar-SA')}</td><td style="text-align:center">${invoice.vat_rate}%</td></tr>`).join('')}
  </tbody>
</table>
<div class="totals">
  <div class="totals-box">
    <div class="total-row"><span>المجموع قبل الضريبة</span><span>${invoice.subtotal.toLocaleString('ar-SA')} ر.س</span></div>
    <div class="total-row"><span>ضريبة القيمة المضافة (${invoice.vat_rate}%)</span><span style="color:#e6820a">${invoice.vat_amount.toLocaleString('ar-SA')} ر.س</span></div>
    <div class="total-final"><span>الإجمالي</span><span>${invoice.total_amount.toLocaleString('ar-SA')} ر.س</span></div>
  </div>
</div>
${company.iban ? '<div style="padding:10px 14px;background:#f0fdf4;border-radius:8px;font-size:12px;margin-bottom:12px"><strong>للدفع:</strong> IBAN: ' + company.iban + '</div>' : ''}
${invoice.notes ? '<div style="padding:10px 14px;background:#fffbeb;border-radius:8px;font-size:12px;margin-bottom:12px"><strong>ملاحظات:</strong> ' + invoice.notes + '</div>' : ''}
<div class="footer-section">
  <div style="text-align:center">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qr)}" alt="QR ZATCA" style="width:100px;height:100px" />
    <div style="font-size:10px;color:#94a3b8;margin-top:4px">رمز ZATCA</div>
  </div>
  <div style="text-align:center">
    <div class="sig-line"></div>
    <div style="font-size:11px;color:#94a3b8">التوقيع والختم</div>
    <div style="font-size:12px;margin-top:4px">${company.ceo_name || company.name || ''}</div>
  </div>
</div>
</div>
<div class="no-print" style="text-align:center;padding:16px;background:#f9fafb">
  <button onclick="window.print()" style="padding:10px 28px;background:${isCredit ? '#c81e1e' : '#1a56db'};color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-left:10px">🖨️ طباعة / PDF</button>
  <button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button>
</div>
</body></html>`)
  win.document.close()
}

// ════════════════════════════════════════
// مودال: إضافة / تعديل عميل
// ════════════════════════════════════════
function ClientModal({ client, tenantId, onClose, onSave }: {
  client: Client | null; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: client?.name || '', name_en: client?.name_en || '',
    client_type: client?.client_type || 'شركة',
    vat_number: client?.vat_number || '', cr_number: client?.cr_number || '',
    phone: client?.phone || '', email: client?.email || '',
    contact_person: client?.contact_person || '',
    city: client?.city || '', district: client?.district || '',
    street: client?.street || '', postal_code: client?.postal_code || '',
    country: client?.country || 'المملكة العربية السعودية',
    notes: client?.notes || '', is_active: client?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const vatValid = !form.vat_number || (form.vat_number.length === 15 && /^\d+$/.test(form.vat_number))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم العميل مطلوب'); return }
    if (!vatValid) { toast.error('الرقم الضريبي يجب أن يكون 15 رقماً'); return }
    setSaving(true)
    const payload = {
      tenant_id: tenantId, name: form.name.trim(), name_en: form.name_en || null,
      client_type: form.client_type, vat_number: form.vat_number || null,
      cr_number: form.cr_number || null, phone: form.phone || null, email: form.email || null,
      contact_person: form.contact_person || null, city: form.city || null,
      district: form.district || null, street: form.street || null,
      postal_code: form.postal_code || null, country: form.country,
      notes: form.notes || null, is_active: form.is_active,
    }
    if (client) { await supabase.from('finance_clients').update(payload).eq('id', client.id) }
    else { await supabase.from('finance_clients').insert(payload) }
    toast.success(client ? 'تم التعديل ✅' : '✅ تمت إضافة العميل')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            {client ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* نوع العميل */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['شركة', 'مؤسسة', 'جهة حكومية', 'فرد'].map(t => (
              <button key={t} type="button" onClick={() => set('client_type', t)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                  borderColor: form.client_type === t ? 'var(--primary)' : 'var(--border)',
                  background: form.client_type === t ? 'var(--primary-light)' : 'white',
                  color: form.client_type === t ? 'var(--primary)' : 'var(--text3)' }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم العميل (عربي) <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="اسم الشركة أو المؤسسة" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم العميل (إنجليزي)</label>
              <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                الرقم الضريبي (VAT)
                {form.vat_number && <span style={{ marginRight: '6px', fontSize: '0.72rem', color: vatValid ? '#0ea77b' : '#c81e1e' }}>{vatValid ? '✓' : '✗ 15 رقم'}</span>}
              </label>
              <input value={form.vat_number} onChange={e => set('vat_number', e.target.value.replace(/\D/g, '').slice(0, 15))} className="input" dir="ltr" placeholder="300XXXXXXXXXXX3" maxLength={15} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم السجل التجاري</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المدينة</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحي</label>
              <input value={form.district} onChange={e => set('district', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الشارع</label>
              <input value={form.street} onChange={e => set('street', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الرمز البريدي</label>
              <input value={form.postal_code} onChange={e => set('postal_code', e.target.value)} className="input" dir="ltr" maxLength={5} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
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
function InvoiceModal({ invoice, clients, projects, company, tenantId, onClose, onSave }: {
  invoice: Invoice | null; clients: Client[]; projects: Project[]
  company: Company; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
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
    status:         invoice?.status         || 'مسودة',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (invoice) loadItems()
    else generateNumber()
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

  async function handleSave() {
    if (invoice && invoice.status !== 'مسودة') {
      toast.error('لا يمكن تعديل الفاتورة — التعديل متاح للمسودات فقط')
      return
    }
    if (!form.invoice_number.trim()) { toast.error('رقم الفاتورة مطلوب'); return }
    if (!form.client_id) { toast.error('يجب اختيار عميل من القائمة'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }
    setSaving(true)

    const payload = {
      tenant_id: tenantId,
      invoice_number: form.invoice_number.trim(),
      invoice_date: form.invoice_date, due_date: form.due_date || null,
      client_id: Number(form.client_id),
      client_name: selectedClient!.name,
      client_vat: selectedClient!.vat_number || null,
      client_cr: selectedClient!.cr_number || null,
      client_address: [selectedClient!.street, selectedClient!.district, selectedClient!.city].filter(Boolean).join('، ') || null,
      project_id: form.project_id ? Number(form.project_id) : null,
      extract_ref: form.extract_ref || null,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate), status: form.status, notes: form.notes || null,
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
      await supabase.from('finance_invoice_items').insert(validItems.map(i => ({ invoice_id: invoiceId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }
    // ══ قيد محاسبي تلقائي عند الإرسال ══
    const finalStatus = payload.status
    if (finalStatus === 'مرسلة' && invoiceId) {
      await createJournalEntry(tenantId, {
        date:          payload.invoice_date,
        description:   `فاتورة مبيعات ${payload.invoice_number} — ${payload.client_name}`,
        referenceType: 'فاتورة مبيعات',
        referenceId:   invoiceId,
        lines: [
          // مدين: الذمم المدينة (إجمالي الفاتورة)
          { accountCode: '1120', debit: payload.total_amount, credit: 0, description: `فاتورة ${payload.invoice_number}` },
          // دائن: إيرادات المشاريع (قبل الضريبة)
          { accountCode: '4100', debit: 0, credit: payload.subtotal, description: `إيرادات ${payload.invoice_number}` },
          // دائن: ضريبة القيمة المضافة (إذا وجدت)
          ...(payload.vat_amount > 0 ? [{ accountCode: '2130', debit: 0, credit: payload.vat_amount, description: 'ضريبة القيمة المضافة' }] : []),
        ]
      })
    }

    toast.success(invoice ? 'تم التعديل ✅' : '✅ تم إنشاء الفاتورة')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '780px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            {invoice ? 'تعديل فاتورة' : 'فاتورة مبيعات جديدة'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الفاتورة *</label>
              <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإصدار *</label>
              <input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الاستحقاق</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>

          {/* اختيار العميل */}
          <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '14px', border: '1px solid #bae6fd' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">العميل <span className="text-red-500">*</span> — يجب اختيار عميل مضاف مسبقاً</label>
            <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="select">
              <option value="">— اختر العميل —</option>
              {clients.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.vat_number ? '(' + c.vat_number + ')' : ''}</option>
              ))}
            </select>
            {selectedClient && (
              <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#0369a1', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {selectedClient.vat_number && <span>رقم ضريبي: {selectedClient.vat_number}</span>}
                {selectedClient.cr_number  && <span>س.ت: {selectedClient.cr_number}</span>}
                {selectedClient.city       && <span>📍 {selectedClient.city}</span>}
              </div>
            )}
            {clients.filter(c => c.is_active).length === 0 && (
              <p style={{ fontSize: '0.78rem', color: '#c81e1e', marginTop: '6px' }}>⚠️ لا يوجد عملاء — أضف عميلاً من تاب العملاء أولاً</p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون ربط —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم المستخلص</label>
              <input value={form.extract_ref} onChange={e => set('extract_ref', e.target.value)} className="input" />
            </div>
          </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['مسودة', 'مرسلة', 'مدفوعة', 'ملغاة'].map(s => <option key={s}>{s}</option>)}
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
          <button onClick={handleSave} disabled={saving || !form.client_id} className="btn btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
            {invoice ? 'حفظ التعديل' : 'إنشاء الفاتورة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إشعار دائن / مرتجع
// ════════════════════════════════════════
function CreditNoteModal({ invoice, clients, tenantId, onClose, onSave }: {
  invoice: Invoice | null; clients: Client[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]

  // نملأ بنود الفاتورة تلقائياً إن وجدت
  useEffect(() => {
    if (invoice?.id) loadInvoiceItems()
  }, [invoice?.id])

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
    if (!form.note_number.trim()) { toast.error('رقم الإشعار مطلوب'); return }
    if (!form.client_id) { toast.error('اختر العميل'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }
    setSaving(true)

    const payload = {
      tenant_id: tenantId, note_number: form.note_number.trim(),
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
    // ══ قيد محاسبي عكسي تلقائي ══
    await createJournalEntry(tenantId, {
      date:          form.note_date,
      description:   `${form.note_type} ${form.note_number} — ${selectedClient!.name}`,
      referenceType: form.note_type,
      referenceId:   data.id,
      lines: [
        // مدين: إيرادات المشاريع (عكس الإيراد)
        { accountCode: '4100', debit: subtotal,    credit: 0,          description: `${form.note_type} ${form.note_number}` },
        // مدين: ضريبة القيمة المضافة (إذا وجدت)
        ...(vatAmount > 0 ? [{ accountCode: '2130', debit: vatAmount, credit: 0, description: 'ضريبة القيمة المضافة' }] : []),
        // دائن: الذمم المدينة (تخفيض المديونية)
        { accountCode: '1120', debit: 0, credit: total, description: `تخفيض فاتورة ${form.original_invoice_id || ''}` },
      ]
    })

    // ══ تحديث الفاتورة الأصلية (credited_amount + الحالة) ══
    if (form.original_invoice_id) {
      const { data: origInv } = await supabase
        .from('finance_invoices')
        .select('total_amount, credited_amount')
        .eq('id', Number(form.original_invoice_id))
        .single()

      if (origInv) {
        const newCredited = Number(origInv.credited_amount || 0) + total
        const newStatus   = newCredited >= Number(origInv.total_amount) ? 'ملغاة' : 'إشعار جزئي'
        await supabase.from('finance_invoices').update({
          credited_amount: newCredited,
          status:          newStatus,
        }).eq('id', Number(form.original_invoice_id))
      }
    }

    toast.success('✅ تم إنشاء الإشعار الدائن والقيد المحاسبي')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            إنشاء إشعار دائن / مرتجع
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* نوع الإشعار */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['إشعار دائن', 'مرتجع مبيعات'].map(t => (
              <button key={t} type="button" onClick={() => set('note_type', t)}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
                  borderColor: form.note_type === t ? '#c81e1e' : 'var(--border)',
                  background: form.note_type === t ? '#fef2f2' : 'white',
                  color: form.note_type === t ? '#c81e1e' : 'var(--text3)' }}>
                {t === 'إشعار دائن' ? '📄 إشعار دائن' : '↩️ مرتجع مبيعات'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الإشعار *</label>
              <input value={form.note_number} onChange={e => set('note_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإشعار *</label>
              <input type="date" value={form.note_date} onChange={e => set('note_date', e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">العميل *</label>
            <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="select">
              <option value="">— اختر العميل —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الفاتورة الأصلية (اختياري)</label>
            <input value={form.original_invoice_id} onChange={e => set('original_invoice_id', e.target.value)} className="input" dir="ltr" placeholder="رقم الفاتورة الأصلية" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">سبب الإشعار *</label>
            <input value={form.reason} onChange={e => set('reason', e.target.value)} className="input" placeholder="مثال: خصم على الأسعار، إرجاع بضاعة، تصحيح خطأ..." />
          </div>

          <ItemsTable items={items} onChange={setItems} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نسبة ضريبة القيمة المضافة</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                  <option value={15}>15%</option><option value={0}>0% — معفي</option>
                </select>
              </div>
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
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#c81e1e' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw style={{ width: '15px', height: '15px' }} />}
            إنشاء الإشعار
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: عرض سعر
// ════════════════════════════════════════
function QuotationModal({ clients, projects, company, tenantId, onClose, onSave }: {
  clients: Client[]; projects: Project[]; company: Company
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    quote_number: '', quote_date: today, valid_until: '',
    client_id: '', project_id: '',
    vat_rate: 15, status: 'مسودة', notes: '', terms: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { generateNumber() }, [])

  async function generateNumber() {
    const { count } = await supabase.from('finance_quotations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const num = String((count || 0) + 1).padStart(4, '0')
    set('quote_number', `QT-${new Date().getFullYear()}-${num}`)
  }

  const selectedClient = clients.find(c => c.id === Number(form.client_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.quote_number.trim()) { toast.error('رقم العرض مطلوب'); return }
    if (!form.client_id) { toast.error('اختر العميل'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }
    setSaving(true)

    const payload = {
      tenant_id: tenantId, quote_number: form.quote_number.trim(),
      quote_date: form.quote_date, valid_until: form.valid_until || null,
      client_id: Number(form.client_id), client_name: selectedClient!.name,
      client_vat: selectedClient!.vat_number || null,
      project_id: form.project_id ? Number(form.project_id) : null,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate), status: form.status,
      notes: form.notes || null, terms: form.terms || null,
    }

    const { data, error } = await supabase.from('finance_quotations').insert(payload).select('id').single()
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_quotation_items').insert(validItems.map(i => ({ quote_id: data.id, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }
    toast.success('✅ تم إنشاء عرض السعر')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '780px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
            إنشاء عرض سعر جديد
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم العرض *</label>
              <input value={form.quote_number} onChange={e => set('quote_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ العرض *</label>
              <input type="date" value={form.quote_date} onChange={e => set('quote_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">صالح حتى</label>
              <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} className="input" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">العميل *</label>
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="select">
                <option value="">— اختر العميل —</option>
                {clients.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون ربط —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

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
                  {['مسودة', 'مرسلة', 'مقبولة', 'مرفوضة', 'منتهية'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الشروط والأحكام</label>
                <textarea value={form.terms} onChange={e => set('terms', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} placeholder="شروط الدفع، ضمانات، ملاحظات..." />
              </div>
            </div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ClipboardList style={{ width: '15px', height: '15px' }} />}
            إنشاء عرض السعر
          </button>
        </div>
      </div>
    </div>
  )
}


// ════════════════════════════════════════
// مودال: إضافة دفعة
// ════════════════════════════════════════
// مودال: إضافة دفعة
// ════════════════════════════════════════
function PaymentModal({ invoice, tenantId, onClose, onSave }: {
  invoice: Invoice; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    amount: String(invoice.total_amount),
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'تحويل بنكي',
    reference: '',
    notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('أدخل المبلغ'); return }
    setSaving(true)

    // إضافة للخزينة
    await supabase.from('finance_treasury').insert({
      tenant_id: tenantId,
      transaction_date: form.payment_date,
      type: 'قبض',
      amount: Number(form.amount),
      description: 'تحصيل فاتورة ' + invoice.invoice_number + ' — ' + invoice.client_name,
      reference_no: form.reference || null,
      invoice_id: invoice.id,
    })

    // تحديث حالة الفاتورة للمدفوعة
    await supabase.from('finance_invoices').update({ status: 'مدفوعة' }).eq('id', invoice.id)

    // ══ قيد محاسبي تلقائي للتحصيل ══
    await createJournalEntry(tenantId, {
      date:          form.payment_date,
      description:   `تحصيل فاتورة ${invoice.invoice_number} — ${invoice.client_name}`,
      referenceType: 'تحصيل فاتورة',
      referenceId:   invoice.id,
      lines: [
        // مدين: الصندوق/البنك (المبلغ المحصّل)
        { accountCode: '1111', debit: Number(form.amount), credit: 0, description: `تحصيل ${invoice.invoice_number}` },
        // دائن: الذمم المدينة (تقفيل المديونية)
        { accountCode: '1120', debit: 0, credit: Number(form.amount), description: `تسوية ${invoice.invoice_number}` },
      ]
    })

    toast.success('✅ تم تسجيل الدفعة والقيد المحاسبي')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            💵 تسجيل دفعة — {invoice.invoice_number}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '12px 16px', background: '#ecfdf5', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#065f46' }}>إجمالي الفاتورة</span>
            <span style={{ fontWeight: 700, color: '#0ea77b', fontSize: '1.1rem' }}>{Number(invoice.total_amount).toLocaleString()} ر.س</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المبلغ المدفوع *</label>
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="input" min="0" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الدفع *</label>
            <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">طريقة الدفع</label>
            <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">
              {['تحويل بنكي', 'نقداً', 'شيك', 'بطاقة ائتمانية', 'أخرى'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم المرجع / التحويل</label>
            <input value={form.reference} onChange={e => set('reference', e.target.value)} className="input" dir="ltr" placeholder="رقم التحويل أو الشيك" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b' }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '💵'}
            تسجيل الدفعة
          </button>
        </div>
      </div>
    </div>
  )
}


// ════════════════════════════════════════
// مودال: عرض الفاتورة
// ════════════════════════════════════════
function InvoiceViewModal({ invoice, items, company, onClose, onPrint }: {
  invoice: Invoice; items: InvoiceItem[]; company: Company
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
              <Printer style={{ width: '15px', height: '15px' }} /> طباعة / PDF
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '0' }}>
          {/* الفاتورة المعاينة */}
          <div style={{ padding: '24px', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", direction: 'rtl' }}>

            {/* هيدر الفاتورة */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '16px', borderBottom: '3px solid #1a56db' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1a56db', marginBottom: '4px' }}>{company.name || 'الشركة'}</div>
                {company.name_en && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{company.name_en}</div>}
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.7 }}>
                  {company.vat_number && <div>الرقم الضريبي: {company.vat_number}</div>}
                  {company.cr_number  && <div>السجل التجاري: {company.cr_number}</div>}
                  {[company.street, company.district, company.city].filter(Boolean).join('، ')}
                  {company.phone && <div>هاتف: {company.phone}</div>}
                </div>
              </div>
              <div style={{ background: '#1a56db', color: 'white', padding: '12px 20px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>فاتورة ضريبية</div>
                <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>{invoice.invoice_number}</div>
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.85 }}>{invoice.invoice_date}</div>
              </div>
            </div>

            {/* بيانات العميل والفاتورة */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>العميل</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{invoice.client_name}</div>
                {invoice.client_vat && <div style={{ fontSize: '11px', color: '#64748b' }}>رقم ضريبي: {invoice.client_vat}</div>}
                {invoice.client_address && <div style={{ fontSize: '11px', color: '#64748b' }}>{invoice.client_address}</div>}
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>تفاصيل الفاتورة</div>
                <div style={{ fontSize: '12px', lineHeight: 1.8 }}>
                  <div>تاريخ الإصدار: <strong>{invoice.invoice_date}</strong></div>
                  {invoice.due_date && <div>تاريخ الاستحقاق: <strong>{invoice.due_date}</strong></div>}
                  {invoice.extract_ref && <div>المستخلص: <strong>{invoice.extract_ref}</strong></div>}
                </div>
              </div>
            </div>

            {/* البنود */}
            {items.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#1a56db', color: 'white' }}>
                      <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, width: '40%' }}>الوصف</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700 }}>الكمية</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700 }}>الوحدة</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700 }}>سعر الوحدة</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700 }}>الإجمالي</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700 }}>ض.ق.م</th>
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
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>{invoice.vat_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* الإجماليات */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <div style={{ width: '260px', background: '#f8fafc', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>المجموع قبل الضريبة</span>
                  <span style={{ fontWeight: 600 }}>{Number(invoice.subtotal).toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>ضريبة القيمة المضافة ({invoice.vat_rate}%)</span>
                  <span style={{ fontWeight: 600, color: '#e6820a' }}>{Number(invoice.vat_amount).toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div style={{ borderTop: '2px solid #1a56db', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '16px', color: '#1a56db' }}>
                  <span>الإجمالي المستحق</span>
                  <span>{Number(invoice.total_amount).toLocaleString('ar-SA')} ر.س</span>
                </div>
              </div>
            </div>

            {/* IBAN + ملاحظات */}
            {company.iban && (
              <div style={{ padding: '8px 14px', background: '#f0fdf4', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>
                <strong>للدفع عبر التحويل البنكي:</strong> IBAN: {company.iban}
              </div>
            )}
            {invoice.notes && (
              <div style={{ padding: '8px 14px', background: '#fffbeb', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                <strong>ملاحظات:</strong> {invoice.notes}
              </div>
            )}

            {/* QR Code + توقيع */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ textAlign: 'center' }}>
                <img src={'https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=' + encodeURIComponent(qr)} alt="QR ZATCA" style={{ width: '90px', height: '90px' }} />
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>رمز ZATCA — المرحلة الأولى</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '2px solid #1a56db', width: '160px', margin: '30px auto 6px' }} />
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>التوقيع والختم</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>{company.ceo_name || company.name || ''}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}


// ════════════════════════════════════════
// دوال مساعدة للقيود المحاسبية
// ════════════════════════════════════════
async function getAccountId(tenantId: string, code: string): Promise<number | null> {
  const { data } = await supabase.from('finance_accounts').select('id').eq('tenant_id', tenantId).eq('code', code).single()
  return data?.id || null
}

async function createJournalEntry(tenantId: string, params: {
  date: string; description: string
  referenceType: string; referenceId: number
  lines: { accountCode: string; debit: number; credit: number; description?: string }[]
}) {
  // جلب أرقام الحسابات
  const lineIds = await Promise.all(params.lines.map(async l => ({
    ...l,
    account_id: await getAccountId(tenantId, l.accountCode)
  })))

  // تحقق أن كل الحسابات موجودة
  if (lineIds.some(l => !l.account_id)) {
    console.warn('بعض الحسابات غير موجودة في الشجرة — تم تخطي القيد')
    return null
  }

  const totalDebit  = lineIds.reduce((s, l) => s + l.debit,  0)
  const totalCredit = lineIds.reduce((s, l) => s + l.credit, 0)

  // رقم القيد
  const { count } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  const entryNumber = `JE-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

  const { data: entry, error } = await supabase.from('finance_journal_entries').insert({
    tenant_id:      tenantId,
    entry_number:   entryNumber,
    entry_date:     params.date,
    description:    params.description,
    reference_type: params.referenceType,
    reference_id:   params.referenceId,
    total_debit:    totalDebit,
    total_credit:   totalCredit,
    status:         'معتمد',
  }).select('id').single()

  if (error || !entry) { console.error('خطأ في إنشاء القيد:', error); return null }

  await supabase.from('finance_journal_lines').insert(
    lineIds.map(l => ({
      entry_id:    entry.id,
      account_id:  l.account_id,
      debit:       l.debit,
      credit:      l.credit,
      description: l.description || null,
    }))
  )

  return entry.id
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function FinanceInvoicesPage() {
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'invoices' | 'credits' | 'quotations' | 'clients'>( 'invoices')
  const [invoices,    setInvoices]    = useState<Invoice[]>([])
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [quotations,  setQuotations]  = useState<Quotation[]>([])
  const [clients,     setClients]     = useState<Client[]>([])
  const [company,     setCompany]     = useState<Company>({ name: '' })
  const [projects,    setProjects]    = useState<Project[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterStatus, setFilterStatus] = useState('الكل')

  // مودالات
  const [showInvoiceModal,  setShowInvoiceModal]  = useState(false)
  const [showCreditModal,   setShowCreditModal]   = useState(false)
  const [showQuoteModal,    setShowQuoteModal]     = useState(false)
  const [showClientModal,   setShowClientModal]   = useState(false)
  const [showPaymentModal,  setShowPaymentModal]  = useState(false)
  const [showViewModal,     setShowViewModal]     = useState(false)
  const [viewInvoice,       setViewInvoice]       = useState<Invoice | null>(null)
  const [viewItems,         setViewItems]         = useState<InvoiceItem[]>([])
  const [editInvoice,  setEditInvoice]  = useState<Invoice | null>(null)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [editClient,   setEditClient]   = useState<Client | null>(null)
  const [creditInvoice, setCreditInvoice] = useState<Invoice | null>(null)

  useEffect(() => { loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [invRes, cnRes, qtRes, clRes, compRes, projRes] = await Promise.all([
      supabase.from('finance_invoices').select('*, client:finance_clients(name,vat_number), project:projects(name)').eq('tenant_id', tenant.id).order('invoice_date', { ascending: false }),
      supabase.from('finance_credit_notes').select('*').eq('tenant_id', tenant.id).order('note_date', { ascending: false }),
      supabase.from('finance_quotations').select('*, client:finance_clients(name), project:projects(name)').eq('tenant_id', tenant.id).order('quote_date', { ascending: false }),
      supabase.from('finance_clients').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('tenants').select('*').eq('id', tenant.id).single(),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ])
    setInvoices(invRes.data || [])
    setCreditNotes(cnRes.data || [])
    setQuotations(qtRes.data || [])
    setClients(clRes.data || [])
    if (compRes.data) setCompany(compRes.data)
    setProjects(projRes.data || [])
    setLoading(false)
  }

  async function handleViewInvoice(inv: Invoice) {
    try {
      const { data: items } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
      setViewItems(items || [])
      setViewInvoice(inv)
      setShowViewModal(true)
    } catch (err) {
      toast.error('خطأ في تحميل الفاتورة')
    }
  }

  async function handlePrintInvoice(inv: Invoice) {
    try {
      const { data: items } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
      const invWithRate = { ...inv, vat_rate: inv.vat_rate || 15 }
      // نفتح نافذة الطباعة مباشرة (يجب استدعاؤها من حدث مباشر)
      setTimeout(() => {
        printInvoice(invWithRate as Invoice, items || [], company)
      }, 0)
    } catch (err) {
      toast.error('خطأ في الطباعة')
    }
  }

  async function deleteInvoice(inv: Invoice) {
    if (inv.status !== 'مسودة') {
      toast.error('لا يمكن حذف الفاتورة — الحذف متاح للمسودات فقط. استخدم إشعار دائن للتصحيح')
      return
    }
    if (!confirm('حذف هذه الفاتورة نهائياً؟')) return
    await supabase.from('finance_invoices').delete().eq('id', inv.id)
    setInvoices(p => p.filter(i => i.id !== inv.id)); toast.success('تم الحذف')
  }

  const today = new Date().toISOString().split('T')[0]

  // إحصائيات الفواتير
  const totalInvoiced  = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalCollected = invoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
  const totalPending   = invoices.filter(i => i.status === 'مرسلة' || i.status === 'مسودة').reduce((s, i) => s + Number(i.total_amount), 0)

  const filteredInvoices = invoices.filter(i => {
    const matchSearch = !search || i.invoice_number.includes(search) || i.client_name.includes(search)
    const isOverdue = i.status !== 'مدفوعة' && i.status !== 'ملغاة' && i.due_date && i.due_date < today
    const displayStatus = isOverdue ? 'متأخرة' : i.status
    const matchStatus = filterStatus === 'الكل' || displayStatus === filterStatus
    return matchSearch && matchStatus
  })

  const TABS = [
    { id: 'invoices',    label: '🧾 الفواتير',       color: '#1a56db', count: invoices.length },
    { id: 'credits',     label: '↩️ المرتجعات',      color: '#c81e1e', count: creditNotes.length },
    { id: 'quotations',  label: '📋 عروض الأسعار',   color: '#0ea77b', count: quotations.length },
    { id: 'clients',     label: '👥 العملاء',         color: '#e6820a', count: clients.length },
  ]

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
            المبيعات والفواتير
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>فاتورة ضريبية إلكترونية — ZATCA المرحلة الأولى</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'invoices'   && <button onClick={() => { setEditInvoice(null); setShowInvoiceModal(true) }} className="btn btn-primary"><Plus style={{ width: '16px', height: '16px' }} /> فاتورة جديدة</button>}
          {activeTab === 'credits'    && <button onClick={() => { setCreditInvoice(null); setShowCreditModal(true) }} className="btn btn-primary" style={{ background: '#c81e1e' }}><Plus style={{ width: '16px', height: '16px' }} /> إشعار دائن</button>}
          {activeTab === 'quotations' && <button onClick={() => setShowQuoteModal(true)} className="btn btn-primary" style={{ background: '#0ea77b' }}><Plus style={{ width: '16px', height: '16px' }} /> عرض سعر</button>}
          {activeTab === 'clients'    && <button onClick={() => { setEditClient(null); setShowClientModal(true) }} className="btn btn-primary" style={{ background: '#e6820a' }}><Plus style={{ width: '16px', height: '16px' }} /> عميل جديد</button>}
        </div>
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any); setSearch(''); setFilterStatus('الكل') }}
            style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px ' + t.color + '44' : 'none' }}>
            {t.label}
            <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', background: activeTab === t.id ? 'rgba(255,255,255,0.25)' : '#d1d5db', color: activeTab === t.id ? 'white' : '#6b7280' }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ══ تاب الفواتير ══ */}
      {activeTab === 'invoices' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'إجمالي الفواتير', value: totalInvoiced,  color: '#1a56db', bg: '#eff6ff' },
              { label: 'المحصّل',         value: totalCollected, color: '#0ea77b', bg: '#ecfdf5' },
              { label: 'المعلق',          value: totalPending,   color: '#e6820a', bg: '#fffbeb' },
            ].map(kpi => (
              <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center', background: kpi.bg }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>{kpi.label} — ريال</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['الكل', 'مسودة', 'مرسلة', 'مدفوعة', 'متأخرة', 'ملغاة'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    borderColor: filterStatus === s ? 'var(--primary)' : 'var(--border)',
                    background: filterStatus === s ? 'var(--primary)' : 'white',
                    color: filterStatus === s ? 'white' : 'var(--text3)' }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '34px', width: '220px' }} placeholder="بحث..." />
            </div>
          </div>

          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
          : filteredInvoices.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: '#9ca3af' }}>لا توجد فواتير</p>
              <button onClick={() => { setEditInvoice(null); setShowInvoiceModal(true) }} className="btn btn-primary" style={{ marginTop: '16px' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> إنشاء أول فاتورة
              </button>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['رقم الفاتورة', 'العميل', 'المشروع', 'التاريخ', 'الاستحقاق', 'الإجمالي', 'ض.ق.م', 'المستحق', 'الحالة', ''].map(h => (
                        <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map(inv => {
                      const isOverdue = inv.status !== 'مدفوعة' && inv.status !== 'ملغاة' && inv.due_date && inv.due_date < today
                      const displayStatus = isOverdue ? 'متأخرة' : inv.status
                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{inv.invoice_number}</td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{inv.client_name}</div>
                            {inv.client_vat && <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{inv.client_vat}</div>}
                          </td>
                          <td style={{ padding: '12px 12px', fontSize: '0.82rem', color: 'var(--text3)' }}>{inv.project?.name || '—'}</td>
                          <td style={{ padding: '12px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{inv.invoice_date}</td>
                          <td style={{ padding: '12px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap', color: isOverdue ? '#c81e1e' : 'inherit' }}>{inv.due_date || '—'}</td>
                          <td style={{ padding: '12px 12px', fontSize: '0.82rem' }}>{Number(inv.subtotal).toLocaleString()} ر.س</td>
                          <td style={{ padding: '12px 12px', fontSize: '0.82rem', color: '#e6820a' }}>{Number(inv.vat_amount).toLocaleString()} ر.س</td>
                          <td style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{Number(inv.total_amount).toLocaleString()} ر.س</td>
                          <td style={{ padding: '12px 12px' }}><span className={'badge ' + (INV_STATUS_COLOR[displayStatus] || 'badge-gray')}>{displayStatus}</span></td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                              {/* عرض — دائماً */}
                              <button onClick={() => handleViewInvoice(inv)} title="عرض الفاتورة"
                                style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                                <Eye style={{ width: '13px', height: '13px' }} />
                              </button>
                              {/* طباعة — دائماً */}
                              <button onClick={() => handlePrintInvoice(inv)} title="طباعة"
                                style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                                🖨️
                              </button>
                              {/* تعديل — مسودة فقط */}
                              {inv.status === 'مسودة' && (
                                <button onClick={() => { setEditInvoice(inv); setShowInvoiceModal(true) }} title="تعديل"
                                  style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                  ✏️
                                </button>
                              )}
                              {/* إشعار دائن — غير مسودة وغير ملغاة كاملاً */}
                              {inv.status !== 'مسودة' && inv.status !== 'ملغاة' && inv.status !== 'مدفوعة' && (
                                <button onClick={() => { setCreditInvoice(inv); setShowCreditModal(true) }} title="إشعار دائن"
                                  style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  ↩️
                                </button>
                              )}
                              {/* إضافة دفعة — غير مدفوعة وغير مسودة */}
                              {inv.status !== 'مدفوعة' && inv.status !== 'مسودة' && inv.status !== 'ملغاة' && (
                                <button onClick={() => { setPaymentInvoice(inv); setShowPaymentModal(true) }} title="تسجيل دفعة"
                                  style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  💵
                                </button>
                              )}
                              {/* حذف — مسودة فقط */}
                              {inv.status === 'مسودة' && (
                                <button onClick={() => deleteInvoice(inv)} title="حذف"
                                  style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.75rem' }}>
                                  🗑️
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
                      <td colSpan={5} style={{ padding: '10px 12px' }}>الإجمالي ({filteredInvoices.length})</td>
                      <td style={{ padding: '10px 12px' }}>{filteredInvoices.reduce((s,i)=>s+Number(i.subtotal),0).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 12px', color: '#e6820a' }}>{filteredInvoices.reduce((s,i)=>s+Number(i.vat_amount),0).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 12px', color: 'var(--primary)' }}>{filteredInvoices.reduce((s,i)=>s+Number(i.total_amount),0).toLocaleString()} ر.س</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ تاب المرتجعات والإشعارات ══ */}
      {activeTab === 'credits' && (
        <div className="space-y-4">
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '0.82rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            لا يمكن إلغاء الفواتير الصادرة — يجب إنشاء إشعار دائن أو مرتجع مبيعات لتصحيح أي خطأ
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
          : creditNotes.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <RotateCcw style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: '#9ca3af' }}>لا توجد إشعارات دائنة بعد</p>
              <button onClick={() => setShowCreditModal(true)} className="btn btn-primary" style={{ marginTop: '16px', background: '#c81e1e' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> إشعار دائن جديد
              </button>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['رقم الإشعار', 'النوع', 'العميل', 'التاريخ', 'السبب', 'الإجمالي', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {creditNotes.map(cn => (
                      <tr key={cn.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#c81e1e', fontFamily: 'monospace' }}>{cn.note_number}</td>
                        <td style={{ padding: '12px 14px' }}><span className="badge badge-red" style={{ fontSize: '0.72rem' }}>{cn.note_type}</span></td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>{cn.client_name}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{cn.note_date}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{cn.reason || '—'}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#c81e1e' }}>{Number(cn.total_amount).toLocaleString()} ر.س</td>
                        <td style={{ padding: '12px 14px' }}><span className="badge badge-gray">{cn.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب عروض الأسعار ══ */}
      {activeTab === 'quotations' && (
        <div className="space-y-4">
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
          : quotations.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <ClipboardList style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: '#9ca3af' }}>لا توجد عروض أسعار بعد</p>
              <button onClick={() => setShowQuoteModal(true)} className="btn btn-primary" style={{ marginTop: '16px', background: '#0ea77b' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> إنشاء أول عرض
              </button>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['رقم العرض', 'العميل', 'المشروع', 'التاريخ', 'صالح حتى', 'الإجمالي', 'الحالة', ''].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map(q => (
                      <tr key={q.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0ea77b', fontFamily: 'monospace' }}>{q.quote_number}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>{q.client_name}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{q.project?.name || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{q.quote_date}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: q.valid_until && q.valid_until < today ? '#c81e1e' : 'inherit' }}>{q.valid_until || '—'}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0ea77b' }}>{Number(q.total_amount).toLocaleString()} ر.س</td>
                        <td style={{ padding: '12px 14px' }}><span className={'badge ' + (QUOTE_STATUS_COLOR[q.status] || 'badge-gray')}>{q.status}</span></td>
                        <td style={{ padding: '12px 14px' }}>
                          {q.status === 'مقبولة' && (
                            <button onClick={() => { /* تحويل لفاتورة */ toast('قريباً: تحويل عرض السعر لفاتورة') }}
                              style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid #1a56db', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontWeight: 600 }}>
                              تحويل لفاتورة
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب العملاء ══ */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '34px', width: '220px' }} placeholder="بحث باسم العميل..." />
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{clients.length} عميل</span>
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
          : clients.filter(c => !search || c.name.includes(search)).length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ color: '#9ca3af' }}>لا يوجد عملاء بعد</p>
              <button onClick={() => { setEditClient(null); setShowClientModal(true) }} className="btn btn-primary" style={{ marginTop: '16px', background: '#e6820a' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> إضافة أول عميل
              </button>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['العميل', 'النوع', 'الرقم الضريبي', 'السجل التجاري', 'المدينة', 'الهاتف', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.filter(c => !search || c.name.includes(search)).map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        {c.contact_person && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{c.contact_person}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{c.client_type}</span></td>
                      <td style={{ padding: '12px 14px', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                        {c.vat_number
                          ? <span style={{ color: '#0ea77b' }}><CheckCircle style={{ width: '12px', height: '12px', display: 'inline', marginLeft: '4px' }} />{c.vat_number}</span>
                          : <span style={{ color: '#e6820a' }}>⚠️ غير مُدخل</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontFamily: 'monospace' }}>{c.cr_number || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{c.city || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={'badge ' + (c.is_active ? 'badge-green' : 'badge-gray')}>{c.is_active ? 'نشط' : 'موقوف'}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => { setEditClient(c); setShowClientModal(true) }} className="btn btn-ghost btn-xs">
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
      {showInvoiceModal && (
        <InvoiceModal invoice={editInvoice} clients={clients} projects={projects} company={company}
          tenantId={tenant!.id} onClose={() => { setShowInvoiceModal(false); setEditInvoice(null) }}
          onSave={() => { setShowInvoiceModal(false); setEditInvoice(null); loadAll() }} />
      )}
      {showCreditModal && (
        <CreditNoteModal invoice={creditInvoice} clients={clients} tenantId={tenant!.id}
          onClose={() => { setShowCreditModal(false); setCreditInvoice(null) }}
          onSave={() => { setShowCreditModal(false); setCreditInvoice(null); loadAll() }} />
      )}
      {showQuoteModal && (
        <QuotationModal clients={clients} projects={projects} company={company}
          tenantId={tenant!.id} onClose={() => setShowQuoteModal(false)}
          onSave={() => { setShowQuoteModal(false); loadAll() }} />
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
          invoice={viewInvoice}
          items={viewItems}
          company={company}
          onClose={() => { setShowViewModal(false); setViewInvoice(null) }}
          onPrint={() => handlePrintInvoice(viewInvoice)}
        />
      )}
    </div>
  )
}
