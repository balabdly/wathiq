'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Printer, Trash2, Pencil, Search, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

type InvoiceItem = {
  id?: number; description: string; quantity: number; unit: string; unit_price: number; total: number
}

type Invoice = {
  id: number; invoice_number: string; invoice_date: string; due_date?: string
  client_name: string; client_vat?: string; client_cr?: string; client_address?: string
  project_id?: number; extract_ref?: string
  subtotal: number; vat_amount: number; total_amount: number; vat_rate: number
  status: string; notes?: string
  project?: { name: string }
}

type Company = {
  name: string; name_en?: string; vat_number?: string; cr_number?: string
  city?: string; district?: string; street?: string; postal_code?: string
  phone?: string; email?: string; iban?: string; ceo_name?: string
}

type Project = { id: number; name: string }

const STATUS_COLOR: Record<string, string> = {
  'مسودة': 'badge-gray', 'مرسلة': 'badge-blue', 'مدفوعة': 'badge-green', 'ملغاة': 'badge-red', 'متأخرة': 'badge-red'
}

// ══ توليد QR Code لـ ZATCA (المرحلة الأولى) ══
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

// ══ نموذج إنشاء / تعديل فاتورة ══
function InvoiceForm({ invoice, company, projects, tenantId, onClose, onSave }: {
  invoice: Invoice | null; company: Company; projects: Project[]
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems]   = useState<InvoiceItem[]>(
    invoice ? [] : [{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]
  )

  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    invoice_number: invoice?.invoice_number || '',
    invoice_date:   invoice?.invoice_date   || today,
    due_date:       invoice?.due_date       || '',
    client_name:    invoice?.client_name    || '',
    client_vat:     invoice?.client_vat     || '',
    client_cr:      invoice?.client_cr      || '',
    client_address: invoice?.client_address || '',
    project_id:     invoice?.project_id     ? String(invoice.project_id) : '',
    extract_ref:    invoice?.extract_ref    || '',
    vat_rate:       invoice?.vat_rate       ?? 15,
    notes:          invoice?.notes          || '',
    status:         invoice?.status         || 'مسودة',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // جلب بنود الفاتورة عند التعديل
  useEffect(() => {
    if (invoice) loadItems()
    else generateNumber()
  }, [])

  async function loadItems() {
    const { data } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', invoice!.id).order('id')
    setItems(data || [{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  }

  async function generateNumber() {
    const { count } = await supabase.from('finance_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const num = String((count || 0) + 1).padStart(4, '0')
    const year = new Date().getFullYear()
    set('invoice_number', `INV-${year}-${num}`)
  }

  function updateItem(idx: number, k: keyof InvoiceItem, v: any) {
    setItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [k]: v }
      if (k === 'quantity' || k === 'unit_price') {
        next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price)
      }
      return next
    })
  }

  function addItem() { setItems(p => [...p, { description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]) }
  function removeItem(idx: number) { if (items.length > 1) setItems(p => p.filter((_, i) => i !== idx)) }

  const subtotal   = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount  = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total      = subtotal + vatAmount

  async function handleSave() {
    if (!form.invoice_number.trim()) { toast.error('رقم الفاتورة مطلوب'); return }
    if (!form.client_name.trim()) { toast.error('اسم العميل مطلوب'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }
    setSaving(true)

    const payload = {
      tenant_id:      tenantId,
      invoice_number: form.invoice_number.trim(),
      invoice_date:   form.invoice_date,
      due_date:       form.due_date || null,
      client_name:    form.client_name.trim(),
      client_vat:     form.client_vat.trim()     || null,
      client_cr:      form.client_cr.trim()      || null,
      client_address: form.client_address.trim() || null,
      project_id:     form.project_id ? Number(form.project_id) : null,
      extract_ref:    form.extract_ref.trim()    || null,
      subtotal, vat_amount: vatAmount, total_amount: total,
      vat_rate: Number(form.vat_rate),
      status: form.status, notes: form.notes || null,
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

    // حفظ البنود
    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0) {
      await supabase.from('finance_invoice_items').insert(
        validItems.map(i => ({ invoice_id: invoiceId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) }))
      )
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

          {/* رأس الفاتورة */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الفاتورة <span className="text-red-500">*</span></label>
              <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإصدار <span className="text-red-500">*</span></label>
              <input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الاستحقاق</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" />
            </div>
          </div>

          {/* بيانات العميل */}
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#64748b', marginBottom: '10px' }}>بيانات العميل</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم العميل / الجهة <span className="text-red-500">*</span></label>
                <input value={form.client_name} onChange={e => set('client_name', e.target.value)} className="input" placeholder="اسم الشركة أو الجهة الحكومية" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الرقم الضريبي للعميل</label>
                <input value={form.client_vat} onChange={e => set('client_vat', e.target.value)} className="input" dir="ltr" placeholder="300XXXXXXXXXXX3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">السجل التجاري للعميل</label>
                <input value={form.client_cr} onChange={e => set('client_cr', e.target.value)} className="input" dir="ltr" placeholder="1010XXXXXX" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">عنوان العميل</label>
                <input value={form.client_address} onChange={e => set('client_address', e.target.value)} className="input" placeholder="المدينة، الحي، الشارع" />
              </div>
            </div>
          </div>

          {/* ربط بالمشروع */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع (اختياري)</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون ربط بمشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم المستخلص (اختياري)</label>
              <input value={form.extract_ref} onChange={e => set('extract_ref', e.target.value)} className="input" placeholder="مثال: مستخلص #3" />
            </div>
          </div>

          {/* بنود الفاتورة */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>بنود الفاتورة</label>
              <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                <Plus style={{ width: '13px', height: '13px' }} /> إضافة بند
              </button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    {['الوصف','الكمية','الوحدة','سعر الوحدة','الإجمالي',''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="وصف العمل أو المادة" />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>
                          {['وحدة','م²','م طولي','طن','كجم','لتر','يوم','ساعة','مقطوعة'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} style={{ width: '100px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                      </td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        {Number(item.total).toLocaleString()} ر.س
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* الإجماليات */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نسبة ضريبة القيمة المضافة %</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className="select" style={{ width: 'auto' }}>
                  <option value={15}>15% — الضريبة المعيارية</option>
                  <option value={0}>0% — معفي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                  {['مسودة','مرسلة','مدفوعة','ملغاة'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} placeholder="شروط الدفع، ملاحظات..." />
              </div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>المجموع قبل الضريبة</span>
                  <span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} ر.س</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>ضريبة القيمة المضافة ({form.vat_rate}%)</span>
                  <span style={{ fontWeight: 600, color: '#e6820a' }}>{vatAmount.toLocaleString()} ر.س</span>
                </div>
                <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>الإجمالي</span>
                  <span style={{ fontWeight: 700, fontSize: '1.3rem', color: '#1a56db' }}>{total.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
            {invoice ? 'حفظ التعديل' : 'إنشاء الفاتورة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ طباعة الفاتورة ══
function printInvoice(invoice: Invoice, items: InvoiceItem[], company: Company) {
  const qr = generateZATCAQR(company, invoice)
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة ${invoice.invoice_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1a2e;background:white;direction:rtl;font-size:14px}
.page{max-width:794px;margin:0 auto;padding:30px 40px;min-height:1123px;position:relative}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid #1a56db}
.company-name{font-size:20px;font-weight:800;color:#1a56db;margin-bottom:4px}
.company-info{font-size:11px;color:#64748b;line-height:1.6}
.invoice-badge{background:#1a56db;color:white;padding:10px 20px;border-radius:10px;text-align:center}
.invoice-badge .num{font-size:18px;font-weight:800}
.invoice-badge .lbl{font-size:11px;opacity:0.85}
.section{margin-bottom:18px}
.section-title{font-size:12px;font-weight:700;color:#64748b;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.05em}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.info-item{background:#f8fafc;border-radius:6px;padding:8px 12px}
.info-label{font-size:10px;color:#94a3b8;margin-bottom:2px}
.info-value{font-size:13px;font-weight:600;color:#1a1a2e}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:#1a56db;color:white}
th{padding:10px 12px;text-align:right;font-size:12px;font-weight:700}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:nth-child(even){background:#f8fafc}
td{padding:10px 12px;font-size:13px}
.totals{display:flex;justify-content:flex-end}
.totals-box{width:280px;background:#f8fafc;border-radius:10px;padding:14px}
.total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
.total-final{border-top:2px solid #1a56db;margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;font-weight:800;font-size:16px;color:#1a56db}
.footer-section{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0}
.qr-section{text-align:center}
.qr-section img{width:100px;height:100px}
.qr-label{font-size:10px;color:#94a3b8;margin-top:4px}
.sig-section{text-align:center}
.sig-line{border-bottom:2px solid #1a56db;width:160px;margin:40px auto 6px}
.sig-label{font-size:11px;color:#94a3b8}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;font-weight:800;color:rgba(26,86,219,0.04);pointer-events:none;white-space:nowrap}
.status-paid{position:absolute;top:120px;left:40px;border:4px solid #0ea77b;color:#0ea77b;padding:6px 16px;border-radius:8px;font-size:22px;font-weight:800;transform:rotate(-15deg);opacity:0.6}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.no-print{display:none}}
</style></head><body>
<div class="page">
${invoice.status === 'مدفوعة' ? '<div class="status-paid">مدفوعة ✓</div>' : ''}
<div class="watermark">${company.name || ''}</div>

<div class="header">
  <div>
    <div class="company-name">${company.name || ''}</div>
    ${company.name_en ? '<div style="font-size:13px;color:#64748b;margin-bottom:4px">' + company.name_en + '</div>' : ''}
    <div class="company-info">
      ${company.vat_number ? 'الرقم الضريبي: ' + company.vat_number + '<br>' : ''}
      ${company.cr_number  ? 'السجل التجاري: ' + company.cr_number  + '<br>' : ''}
      ${[company.street, company.district, company.city, company.postal_code].filter(Boolean).join('، ')}<br>
      ${company.phone ? 'هاتف: ' + company.phone : ''} ${company.email ? '| ' + company.email : ''}
    </div>
  </div>
  <div class="invoice-badge">
    <div class="lbl">فاتورة ضريبية</div>
    <div class="num">${invoice.invoice_number}</div>
    <div style="font-size:11px;margin-top:4px;opacity:0.85">${invoice.invoice_date}</div>
  </div>
</div>

<div class="info-grid" style="margin-bottom:18px">
  <div class="info-item">
    <div class="info-label">العميل</div>
    <div class="info-value">${invoice.client_name}</div>
    ${invoice.client_vat     ? '<div style="font-size:11px;color:#64748b">رقم ضريبي: ' + invoice.client_vat + '</div>' : ''}
    ${invoice.client_address ? '<div style="font-size:11px;color:#64748b">' + invoice.client_address + '</div>' : ''}
  </div>
  <div class="info-item">
    <div class="info-label">تفاصيل الفاتورة</div>
    <div style="font-size:12px;line-height:1.8">
      <div>تاريخ الإصدار: <strong>${invoice.invoice_date}</strong></div>
      ${invoice.due_date ? '<div>تاريخ الاستحقاق: <strong>' + invoice.due_date + '</strong></div>' : ''}
      ${invoice.extract_ref ? '<div>المستخلص: <strong>' + invoice.extract_ref + '</strong></div>' : ''}
    </div>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:40%">الوصف</th>
    <th style="width:10%;text-align:center">الكمية</th>
    <th style="width:10%;text-align:center">الوحدة</th>
    <th style="width:15%;text-align:left">سعر الوحدة</th>
    <th style="width:15%;text-align:left">الإجمالي</th>
    <th style="width:10%;text-align:center">ض.ق.م</th>
  </tr></thead>
  <tbody>
    ${items.map(i => `<tr>
      <td>${i.description}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:center">${i.unit}</td>
      <td style="text-align:left;direction:ltr">${Number(i.unit_price).toLocaleString('ar-SA')}</td>
      <td style="text-align:left;direction:ltr;font-weight:600">${Number(i.total).toLocaleString('ar-SA')}</td>
      <td style="text-align:center">${invoice.vat_rate}%</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="totals">
  <div class="totals-box">
    <div class="total-row"><span>المجموع قبل الضريبة</span><span>${invoice.subtotal.toLocaleString('ar-SA')} ر.س</span></div>
    <div class="total-row"><span>ضريبة القيمة المضافة (${invoice.vat_rate}%)</span><span style="color:#e6820a">${invoice.vat_amount.toLocaleString('ar-SA')} ر.س</span></div>
    <div class="total-final"><span>الإجمالي المستحق</span><span>${invoice.total_amount.toLocaleString('ar-SA')} ر.س</span></div>
  </div>
</div>

${company.iban ? '<div style="margin-top:14px;padding:10px 14px;background:#f0fdf4;border-radius:8px;font-size:12px"><strong>للدفع عبر التحويل البنكي:</strong> IBAN: ' + company.iban + '</div>' : ''}
${invoice.notes ? '<div style="margin-top:12px;padding:10px 14px;background:#fffbeb;border-radius:8px;font-size:12px;color:#92400e"><strong>ملاحظات:</strong> ' + invoice.notes + '</div>' : ''}

<div class="footer-section">
  <div class="qr-section">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qr)}" alt="QR Code ZATCA" />
    <div class="qr-label">رمز ZATCA — المرحلة الأولى</div>
  </div>
  <div class="sig-section">
    <div class="sig-line"></div>
    <div class="sig-label">التوقيع والختم</div>
    <div style="font-size:12px;margin-top:4px;color:#374151">${company.ceo_name || company.name || ''}</div>
  </div>
</div>

</div>
<div class="no-print" style="text-align:center;padding:16px;background:#f9fafb;border-top:1px solid #e5e7eb">
  <button onclick="window.print()" style="padding:10px 28px;background:#1a56db;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-left:10px">🖨️ طباعة / PDF</button>
  <button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button>
</div>
</body></html>`)
  win.document.close()
}

// ══ الصفحة الرئيسية ══
export default function FinanceInvoicesPage() {
  const { tenant } = useStore()
  const [invoices,  setInvoices]  = useState<Invoice[]>([])
  const [company,   setCompany]   = useState<Company>({ name: '' })
  const [projects,  setProjects]  = useState<Project[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterStatus, setFilterStatus] = useState('الكل')
  const [showForm,  setShowForm]  = useState(false)
  const [editInv,   setEditInv]   = useState<Invoice | null>(null)

  useEffect(() => { loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [invRes, compRes, projRes] = await Promise.all([
      supabase.from('finance_invoices')
        .select('*, project:projects(name)')
        .eq('tenant_id', tenant.id)
        .order('invoice_date', { ascending: false }),
      supabase.from('tenants').select('*').eq('id', tenant.id).single(),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ])
    setInvoices(invRes.data || [])
    if (compRes.data) setCompany(compRes.data)
    setProjects(projRes.data || [])
    setLoading(false)
  }

  async function handlePrint(inv: Invoice) {
    const { data: items } = await supabase.from('finance_invoice_items').select('*').eq('invoice_id', inv.id).order('id')
    printInvoice(inv, items || [], company)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه الفاتورة؟')) return
    await supabase.from('finance_invoices').delete().eq('id', id)
    setInvoices(p => p.filter(i => i.id !== id))
    toast.success('تم الحذف')
  }

  const today = new Date().toISOString().split('T')[0]
  const filtered = invoices.filter(i => {
    const matchSearch = !search || i.invoice_number.includes(search) || i.client_name.includes(search)
    const isOverdue = i.status !== 'مدفوعة' && i.status !== 'ملغاة' && i.due_date && i.due_date < today
    const displayStatus = isOverdue ? 'متأخرة' : i.status
    const matchStatus = filterStatus === 'الكل' || displayStatus === filterStatus
    return matchSearch && matchStatus
  })

  const totalInvoiced  = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalCollected = invoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
  const totalPending   = invoices.filter(i => i.status === 'مرسلة' || i.status === 'مسودة').reduce((s, i) => s + Number(i.total_amount), 0)

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
            فواتير المبيعات
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>فاتورة ضريبية إلكترونية — ZATCA المرحلة الأولى</p>
        </div>
        <button onClick={() => { setEditInv(null); setShowForm(true) }} className="btn btn-primary">
          <Plus style={{ width: '16px', height: '16px' }} /> فاتورة جديدة
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الفواتير', value: totalInvoiced, color: '#1a56db', bg: '#eff6ff' },
          { label: 'المحصّل', value: totalCollected, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'المعلق', value: totalPending, color: '#e6820a', bg: '#fffbeb' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center', background: kpi.bg }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>{kpi.label} — ريال</div>
          </div>
        ))}
      </div>

      {/* فلاتر + بحث */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['الكل','مسودة','مرسلة','مدفوعة','متأخرة','ملغاة'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                borderColor: filterStatus === s ? 'var(--primary)' : 'var(--border)',
                background: filterStatus === s ? 'var(--primary)' : 'white',
                color: filterStatus === s ? 'white' : 'var(--text3)' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '34px', width: '220px' }} placeholder="بحث برقم الفاتورة أو العميل..." />
        </div>
      </div>

      {/* الجدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af' }}>لا توجد فواتير</p>
          <button onClick={() => { setEditInv(null); setShowForm(true) }} className="btn btn-primary" style={{ marginTop: '16px' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> إنشاء أول فاتورة
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم الفاتورة','العميل','المشروع','التاريخ','الاستحقاق','المجموع','ض.ق.م','الإجمالي','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
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
                      <td style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{Number(inv.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 12px' }}>
                        <span className={'badge ' + (STATUS_COLOR[displayStatus] || 'badge-gray')}>{displayStatus}</span>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handlePrint(inv)} title="طباعة"
                            style={{ padding: '5px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer' }}>
                            <Printer style={{ width: '13px', height: '13px' }} />
                          </button>
                          <button onClick={() => { setEditInv(inv); setShowForm(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '13px', height: '13px' }} />
                          </button>
                          <button onClick={() => handleDelete(inv.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                            <Trash2 style={{ width: '13px', height: '13px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <td colSpan={5} style={{ padding: '10px 12px' }}>الإجمالي ({filtered.length})</td>
                  <td style={{ padding: '10px 12px' }}>{filtered.reduce((s,i)=>s+Number(i.subtotal),0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 12px', color: '#e6820a' }}>{filtered.reduce((s,i)=>s+Number(i.vat_amount),0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 12px', color: 'var(--primary)' }}>{filtered.reduce((s,i)=>s+Number(i.total_amount),0).toLocaleString()} ر.س</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <InvoiceForm
          invoice={editInv} company={company} projects={projects}
          tenantId={tenant!.id}
          onClose={() => { setShowForm(false); setEditInv(null) }}
          onSave={() => { setShowForm(false); setEditInv(null); loadAll() }}
        />
      )}
    </div>
  )
}
