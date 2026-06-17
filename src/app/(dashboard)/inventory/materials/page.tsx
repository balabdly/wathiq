'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  Plus, X, Save, Search, Pencil, Trash2, Download,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw, ArrowLeftRight,
  Package, Settings, Scale, Filter, Paperclip,
  ChevronLeft, ChevronRight, FileSpreadsheet, Upload
} from 'lucide-react'
import toast from 'react-hot-toast'

// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════
type Warehouse = {
  id: number; name: string; location?: string
  capacity?: string; sections?: string[]; tenant_id: string
  mode?: 'عام' | 'مشاريع' | 'مرن'
}
type Material = {
  id: number; warehouse_id: number; catalog_no?: string
  sec_number?: string; name: string; unit: string
  mat_code?: string; item_code?: string; barcode?: string; is_active?: boolean
  qty: number; reorder: number; source?: string
  location?: string; notes?: string; project_name?: string
  warehouse?: { name: string }
}
type LedgerEntry = {
  id: number; type: string; mat_name: string; unit: string
  qty: number; qty_before: number; qty_after: number
  wh_name: string; project_name?: string; dispatch_note?: string
  vendor_name?: string; doc_code?: string; created_at: string
  attachment_url?: string
}

const UNITS = ['قطعة', 'متر', 'كجم', 'لتر', 'علبة', 'رول', 'طن', 'م²', 'م³', 'كيس', 'برميل', 'أمبير', 'متر كيبل']
const PAGE_SIZE = 50

// ══════════════════════════════════════════
// رفع مرفق
// ══════════════════════════════════════════
async function uploadAttachment(file: File, tenantId: string): Promise<string | null> {
  const ext  = file.name.split('.').pop()
  const path = `${tenantId}/inventory/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: true })
  if (error) { toast.error('فشل رفع المرفق'); return null }
  const { data } = supabase.storage.from('attachments').getPublicUrl(path)
  return data?.publicUrl || null
}

// ══════════════════════════════════════════
// مودال: تعريف مادة
// ══════════════════════════════════════════
function MaterialDefineModal({ tenantId, branchId, warehouses, onClose, onSave }: {
  tenantId: string; branchId: number; warehouses: Warehouse[]
  onClose: () => void; onSave: () => void
}) {
  const [tab,     setTab]     = useState<'manual' | 'import'>('manual')
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({
    warehouse_id: warehouses[0]?.id ? String(warehouses[0].id) : '',
    name: '', catalog_no: '', sec_number: '', mat_code: '', item_code: '',
    unit: 'قطعة', qty: '0', reorder: '0', source: 'خاص', location: '', notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const [importData, setImportData] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    if (!form.name.trim())       { toast.error('اسم المادة مطلوب'); return }
    if (!form.warehouse_id)      { toast.error('اختر المستودع'); return }
    setSaving(true)
    const { error } = await supabase.from('materials').insert({
      tenant_id: tenantId, branch_id: branchId,
      warehouse_id: Number(form.warehouse_id),
      name: form.name.trim(), catalog_no: form.catalog_no || null,
      sec_number: form.sec_number || null, mat_code: form.mat_code || null,
      item_code: form.item_code || null, unit: form.unit,
      qty: Number(form.qty) || 0, reorder: Number(form.reorder) || 0,
      source: form.source, location: form.location || null,
      notes: form.notes || null, is_active: true,
    })
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('تمت إضافة المادة ✅')
    onSave(); onClose()
  }

  async function handleImport() {
    if (!form.warehouse_id) { toast.error('اختر المستودع'); return }
    if (importData.length === 0) { toast.error('لا توجد بيانات للاستيراد'); return }
    setSaving(true)
    const rows = importData.map(r => ({
      tenant_id: tenantId, branch_id: branchId,
      warehouse_id: Number(form.warehouse_id),
      name: r['اسم المادة'] || r['name'] || '', unit: r['الوحدة'] || r['unit'] || 'قطعة',
      catalog_no: r['رقم الكتالوج'] || r['catalog_no'] || null,
      sec_number: r['رقم SEC'] || r['sec_number'] || null,
      qty: Number(r['الكمية'] || r['qty'] || 0), reorder: Number(r['حد الأمان'] || r['reorder'] || 0),
      source: 'خاص', is_active: true,
    })).filter(r => r.name)
    const { error } = await supabase.from('materials').insert(rows)
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success(`تم استيراد ${rows.length} مادة ✅`)
    onSave(); onClose()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text   = ev.target?.result as string
        const lines  = text.split('\n').filter(Boolean)
        const headers = lines[0].split('\t').map(h => h.trim())
        const data   = lines.slice(1).map(line => {
          const vals = line.split('\t')
          const obj: any = {}
          headers.forEach((h, i) => { obj[h] = vals[i]?.trim() })
          return obj
        }).filter(r => Object.values(r).some(v => v))
        setImportData(data)
        toast.success(`تم قراءة ${data.length} سطر`)
      } catch { toast.error('خطأ في قراءة الملف') }
    }
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>إضافة مادة للمخزون</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        {/* تبويبات */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
          {[{ id: 'manual', label: '✍️ يدوي' }, { id: 'import', label: '📊 استيراد Excel' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{ flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                background: tab === t.id ? 'white' : 'transparent',
                color: tab === t.id ? '#1a56db' : '#9ca3af',
                borderBottom: tab === t.id ? '2px solid #1a56db' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* اختيار المستودع مشترك */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المستودع <span style={{ color: '#c81e1e' }}>*</span></label>
            <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
              <option value="">— اختر المستودع —</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {tab === 'manual' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>اسم المادة <span style={{ color: '#c81e1e' }}>*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: كيبل 4×10 مم" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الوحدة</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم الكتالوج</label>
                <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)} className="input" placeholder="CAT-001" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم SEC</label>
                <input value={form.sec_number} onChange={e => set('sec_number', e.target.value)} className="input" placeholder="SEC-001" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المصدر</label>
                <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
                  <option value="خاص">خاص</option>
                  <option value="SEC">SEC</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الكمية الافتتاحية</label>
                <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} className="input" min="0" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>حد الأمان</label>
                <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)} className="input" min="0" />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الموقع في المستودع</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="مثال: رف A — قسم 3" />
            </div>
          </>)}

          {tab === 'import' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', fontSize: '0.78rem', color: '#1a56db' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>📋 تنسيق الملف (Excel → حفظ كـ TSV أو نسخ مباشر)</div>
                <div>الأعمدة المطلوبة: <strong>اسم المادة</strong> | الوحدة | رقم الكتالوج | رقم SEC | الكمية | حد الأمان</div>
              </div>
              <div>
                <input ref={fileRef} type="file" accept=".txt,.tsv,.csv" onChange={handleFile} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}>
                  <Upload style={{ width: '16px', height: '16px' }} /> اختر ملف TSV / CSV
                </button>
              </div>
              {importData.length > 0 && (
                <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#0ea77b', fontWeight: 600 }}>
                  ✅ تم قراءة {importData.length} مادة — جاهزة للاستيراد
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={tab === 'manual' ? handleSave : handleImport} disabled={saving} className="btn btn-primary">
            {saving ? 'جاري الحفظ...' : tab === 'manual' ? 'إضافة المادة' : `استيراد ${importData.length} مادة`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// مودال: تعديل مادة
// ══════════════════════════════════════════
function MaterialEditModal({ material, warehouses, onClose, onSave }: {
  material: Material; warehouses: Warehouse[]
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:        material.name,
    catalog_no:  material.catalog_no  || '',
    sec_number:  material.sec_number  || '',
    mat_code:    material.mat_code    || '',
    unit:        material.unit,
    reorder:     String(material.reorder),
    source:      material.source      || 'خاص',
    location:    material.location    || '',
    notes:       material.notes       || '',
    warehouse_id: String(material.warehouse_id),
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return }
    setSaving(true)
    const { error } = await supabase.from('materials').update({
      name: form.name.trim(), catalog_no: form.catalog_no || null,
      sec_number: form.sec_number || null, mat_code: form.mat_code || null,
      unit: form.unit, reorder: Number(form.reorder) || 0,
      source: form.source, location: form.location || null,
      notes: form.notes || null, warehouse_id: Number(form.warehouse_id),
    }).eq('id', material.id)
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('تم التعديل ✅'); onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>تعديل المادة — {material.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المستودع</label>
            <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الاسم <span style={{ color: '#c81e1e' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الوحدة</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم الكتالوج</label>
              <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم SEC</label>
              <input value={form.sec_number} onChange={e => set('sec_number', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>حد الأمان</label>
              <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)} className="input" min="0" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المصدر</label>
              <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
                <option value="خاص">خاص</option>
                <option value="SEC">SEC</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الموقع في المستودع</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} className="input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// مودال: عملية (استلام/صرف/إرجاع/تحويل)
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// دالة طباعة وصل العملية
// ══════════════════════════════════════════
function printOperationReceipt({ type, warehouseName, projectName, date, rows, vendorName, docCode, bookingNo, clientName, exitPermitNo, txnNumber }: {
  type: string; warehouseName: string; projectName: string; date: string
  rows: { name: string; unit: string; qty: number; note: string }[]
  vendorName?: string; docCode?: string; bookingNo?: string
  clientName?: string; exitPermitNo?: string; txnNumber?: string
}) {
  const win = window.open('', '_blank', 'width=700,height=600')
  if (!win) return
  const color = type === 'استلام' ? '#0ea77b' : type === 'إرجاع' || type === 'إرجاع للعميل' ? '#e6820a' : '#c81e1e'
  const title = type === 'استلام' ? 'وصل استلام مواد' : type === 'إرجاع' || type === 'إرجاع للعميل' ? 'وصل إرجاع مواد للعميل' : 'أذن صرف مواد'
  const rowsHtml = rows.map((r, i) => `
    <tr style="border-bottom:1px solid #f1f5f9;background:${i%2===0?'white':'#f8fafc'}">
      <td style="padding:8px 10px">${r.name}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:700">${r.qty}</td>
      <td style="padding:8px 10px;text-align:center;color:#6b7280">${r.unit}</td>
      <td style="padding:8px 10px;color:#6b7280">${r.note || '—'}</td>
    </tr>`).join('')
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1a2e;direction:rtl;padding:24px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid ${color}}
  .badge{background:${color};color:white;padding:10px 18px;border-radius:10px;text-align:center}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead tr{background:${color};color:white}
  th{padding:9px 10px;text-align:right;font-size:13px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px}
  .info-item{background:#f8fafc;padding:8px 12px;border-radius:8px}
  .info-label{color:#9ca3af;font-size:11px;margin-bottom:2px}
  .info-value{font-weight:600}
  .footer{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:12px}
  .sign-box{border-top:1px solid #e5e7eb;padding-top:8px;text-align:center;color:#6b7280}
  @media print{.noprint{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<div class="header">
  <div>
    <div style="font-size:22px;font-weight:800;color:${color}">${title}</div>
    <div style="font-size:12px;color:#9ca3af;margin-top:4px">${new Date().toLocaleString('ar-SA')}</div>
    ${txnNumber ? `<div style="font-size:13px;color:${color};font-weight:700;margin-top:4px;direction:ltr"># ${txnNumber}</div>` : ''}
  </div>
  <div class="badge">
    <div style="font-size:11px;opacity:0.85">${type}</div>
    <div style="font-size:15px;font-weight:800">${date}</div>
  </div>
</div>
<div class="info-grid">
  ${warehouseName ? `<div class="info-item"><div class="info-label">المستودع</div><div class="info-value">${warehouseName}</div></div>` : ''}
  ${projectName   ? `<div class="info-item"><div class="info-label">المشروع</div><div class="info-value">${projectName}</div></div>` : ''}
  ${clientName    ? `<div class="info-item"><div class="info-label">العميل</div><div class="info-value">${clientName}</div></div>` : ''}
  ${exitPermitNo  ? `<div class="info-item"><div class="info-label">رقم إذن الخروج</div><div class="info-value" style="direction:ltr">${exitPermitNo}</div></div>` : ''}
  ${bookingNo     ? `<div class="info-item"><div class="info-label">رقم الحجز</div><div class="info-value" style="direction:ltr">${bookingNo}</div></div>` : ''}
  ${vendorName    ? `<div class="info-item"><div class="info-label">المورد</div><div class="info-value">${vendorName}</div></div>` : ''}
  ${docCode       ? `<div class="info-item"><div class="info-label">رقم الوثيقة</div><div class="info-value" style="direction:ltr">${docCode}</div></div>` : ''}
</div>
<table>
  <thead><tr><th>اسم المادة</th><th style="text-align:center">الكمية</th><th style="text-align:center">الوحدة</th><th>ملاحظة</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div class="footer">
  <div class="sign-box">توقيع المستلم</div>
  <div class="sign-box">توقيع المسلّم</div>
</div>
<div class="noprint" style="text-align:center;padding:16px;margin-top:16px;border-top:1px solid #e5e7eb">
  <button onclick="window.print()" style="padding:10px 28px;background:${color};color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-left:10px">🖨️ طباعة</button>
  <button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">إغلاق</button>
</div>
</body></html>`)
  win.document.close()
}

function OperationModal({ type, tenantId, branchId, warehouses, projects, onClose, onSave }: {
  type: 'استلام' | 'صرف' | 'إرجاع' | 'تحويل'
  tenantId: string; branchId: number
  warehouses: Warehouse[]; projects: any[]
  onClose: () => void; onSave: () => void
}) {
  const [saving,          setSaving]          = useState(false)
  const [materials,       setMaterials]       = useState<Material[]>([])
  const [projectBalances, setProjectBalances] = useState<Record<number, number>>({})
  const [directQtys,      setDirectQtys]      = useState<Record<number, string>>({})
  const [rows,            setRows]            = useState([{ mat_id: '', qty: '', note: '' }])
  const [attachmentFile,  setAttachmentFile]  = useState<File | null>(null)
  const attachRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    warehouse_id:    warehouses[0]?.id ? String(warehouses[0].id) : '',
    to_warehouse_id: '', project_id: '', project_name: '',
    vendor_name: '', doc_code: '', booking_no: '',
    client_name_recv: '', exit_permit_no: '',
    date: new Date().toISOString().split('T')[0], return_type: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // قائمة العملاء المحفوظة محلياً
  const [savedClients,    setSavedClients]    = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('wathiq_clients') || '[]') } catch { return [] }
  })
  const [newClientInput,  setNewClientInput]  = useState('')
  const [showClientInput, setShowClientInput] = useState(false)

  function addClient() {
    const name = newClientInput.trim()
    if (!name) return
    const updated = Array.from(new Set([name, ...savedClients])).slice(0, 20)
    setSavedClients(updated)
    localStorage.setItem('wathiq_clients', JSON.stringify(updated))
    set('client_name_recv', name)
    setNewClientInput('')
    setShowClientInput(false)
  }

  const selectedWh               = warehouses.find(w => w.id === Number(form.warehouse_id))
  const isProjectWh              = (selectedWh as any)?.wh_category === 'مشاريع' || (selectedWh as any)?.mode === 'مشاريع'
  const showProjectOnReceive     = isProjectWh
  const projectRequiredOnReceive = isProjectWh

  useEffect(() => { if (form.warehouse_id) loadMats() }, [form.warehouse_id])
  useEffect(() => {
    if (isProjectWh && form.project_id && (type === 'صرف' || type === 'إرجاع')) { loadProjectBalances(); setDirectQtys({}) }
    else { setProjectBalances({}); setDirectQtys({}) }
  }, [form.project_id, form.warehouse_id, type])

  async function loadMats() {
    const { data } = await supabase.from('materials').select('*')
      .eq('tenant_id', tenantId).eq('warehouse_id', Number(form.warehouse_id)).order('name')
    setMaterials(data || [])
  }

  async function loadProjectBalances() {
    if (!form.project_id) return
    const { data } = await supabase.from('project_materials')
      .select('material_id, qty_balance')
      .eq('tenant_id', tenantId).eq('project_id', Number(form.project_id)).eq('warehouse_id', Number(form.warehouse_id))
    const map: Record<number, number> = {}
    ;(data || []).forEach((pm: any) => { map[pm.material_id] = Number(pm.qty_balance) })
    setProjectBalances(map)
  }

  function setRow(i: number, k: string, v: string) {
    setRows(prev => { const next = [...prev]; next[i] = { ...next[i], [k]: v }; return next })
  }

  function handleProjectChange(projectId: string) {
    const proj = projects.find((p: any) => p.id === Number(projectId))
    set('project_id', projectId); set('project_name', proj?.name || '')
  }

  async function handleSave() {
    let effectiveRows = rows
    if (isProjectWh && form.project_id && (type === 'صرف' || type === 'إرجاع') && Object.keys(directQtys).length > 0) {
      effectiveRows = Object.entries(directQtys).filter(([, qty]) => Number(qty) > 0)
        .map(([matId, qty]) => ({ mat_id: matId, qty, note: '' }))
    }
    const validRows = effectiveRows.filter(r => r.mat_id && Number(r.qty) > 0)
    if (validRows.length === 0) { toast.error('أدخل كمية لمادة واحدة على الأقل'); return }
    if (type === 'صرف' && !form.project_id) { toast.error('اسم المشروع مطلوب'); return }
    if (type === 'إرجاع' && !form.project_id && isProjectWh) { toast.error('اختر المشروع'); return }
    if (type === 'استلام' && projectRequiredOnReceive && !form.project_id) { toast.error('المشروع إلزامي لهذا المستودع'); return }
    if (type === 'تحويل' && !form.to_warehouse_id) { toast.error('اختر المستودع المستلم'); return }
    if (type === 'إرجاع' && !form.return_type) { toast.error('يجب تحديد نوع الإرجاع'); return }

    setSaving(true)
    let attachmentUrl: string | null = null
    if (attachmentFile) attachmentUrl = await uploadAttachment(attachmentFile, tenantId)

    const wh = warehouses.find(w => w.id === Number(form.warehouse_id))
    const { data: freshMats } = await supabase.from('materials').select('*')
      .in('id', validRows.map(r => Number(r.mat_id))).eq('tenant_id', tenantId)
    const matsMap: Record<number, any> = {}
    ;(freshMats || []).forEach((m: any) => { matsMap[m.id] = m })

    for (const row of validRows) {
      const mat = matsMap[Number(row.mat_id)]
      if (!mat) { toast.error('لم يتم العثور على المادة'); setSaving(false); return }
      const qty = Number(row.qty)

      if (type === 'صرف' || type === 'تحويل') {
        const available = isProjectWh && form.project_id ? (projectBalances[mat.id] ?? 0) : mat.qty
        if (qty > available) { toast.error(`⛔ رصيد "${mat.name}" المتاح: ${available} ${mat.unit} فقط`); setSaving(false); return }
      }
      if (type === 'إرجاع' && isProjectWh && form.project_id) {
        const available = projectBalances[mat.id] ?? 0
        if (qty > available) { toast.error(`⛔ رصيد "${mat.name}" المتاح: ${available} ${mat.unit} فقط`); setSaving(false); return }
      }

      const qtyBefore = mat.qty
      let   qtyAfter  = qtyBefore

      if (type === 'استلام')                    qtyAfter = qtyBefore + qty
      else if (type === 'صرف' || type === 'تحويل') qtyAfter = qtyBefore - qty
      else if (type === 'إرجاع') {
        if (form.return_type === 'فائض') qtyAfter = qtyBefore + qty
        else qtyAfter = qtyBefore
      }

      await supabase.from('materials').update({ qty: qtyAfter }).eq('id', mat.id)

      // تحديد نوع الحركة وفئتها
      const isProjectWarehouse = isProjectWh && !!form.project_id
      let ledgerType: string
      let movementCategory: string

      if (type === 'استلام') {
        ledgerType       = 'استلام'
        movementCategory = isProjectWarehouse ? 'استلام_عهدة' : 'استلام_عام'
      } else if (type === 'صرف') {
        ledgerType       = 'صرف'
        movementCategory = isProjectWarehouse ? 'صرف_عهدة' : 'صرف_عام'
      } else if (type === 'تحويل') {
        ledgerType       = 'صرف'
        movementCategory = 'تحويل'
      } else if (type === 'إرجاع') {
        if (form.return_type === 'فائض') {
          // فائض من مستودع مشاريع → إرجاع للعميل
          // فائض من مستودع عام → يرجع للمستودع
          ledgerType       = isProjectWarehouse ? 'إرجاع للعميل' : 'استلام'
          movementCategory = isProjectWarehouse ? 'ارجاع_عميل' : 'ارجاع_مستودع'
        } else {
          // سكراب
          ledgerType       = 'إرجاع للعميل'
          movementCategory = 'ارجاع_عميل'
        }
      } else {
        ledgerType = type; movementCategory = 'استلام_عام'
      }

      await supabase.from('stock_ledger').insert({
        tenant_id: tenantId, branch_id: branchId,
        type: ledgerType,
        movement_category: movementCategory,
        mat_name: mat.name, mat_code: mat.mat_code || null,
        unit: mat.unit, qty, qty_before: qtyBefore, qty_after: qtyAfter,
        wh_name: wh?.name || '',
        project_id:       form.project_id        ? Number(form.project_id) : null,
        project_name:     form.project_name       || null,
        vendor_name:      form.vendor_name        || null,
        client_name:      form.client_name_recv   || null,
        exit_permit_no:   form.exit_permit_no     || null,
        doc_code:         form.doc_code           || null,
        booking_no:       form.booking_no         || null,
        dispatch_note:    row.note                || null,
        attachment_url:   attachmentUrl,
      })

      // ── تحديث project_materials ──
      if (type === 'استلام' && form.project_id) {
        const { data: pm } = await supabase.from('project_materials').select('*')
          .eq('tenant_id', tenantId).eq('project_id', Number(form.project_id))
          .eq('material_id', mat.id).eq('warehouse_id', mat.warehouse_id).maybeSingle()
        if (pm) {
          await supabase.from('project_materials').update({
            qty_received: Number(pm.qty_received) + qty,
            qty_balance:  Number(pm.qty_balance)  + qty,
          }).eq('id', pm.id)
        } else {
          await supabase.from('project_materials').insert({
            tenant_id: tenantId, project_id: Number(form.project_id),
            material_id: mat.id, warehouse_id: mat.warehouse_id,
            qty_received: qty, qty_issued: 0, qty_balance: qty,
          })
        }
      }

      if (type === 'صرف' && form.project_id) {
        const { data: pm } = await supabase.from('project_materials').select('*')
          .eq('tenant_id', tenantId).eq('project_id', Number(form.project_id))
          .eq('material_id', mat.id).eq('warehouse_id', mat.warehouse_id).maybeSingle()
        if (pm) {
          await supabase.from('project_materials').update({
            qty_issued:  Number(pm.qty_issued)  + qty,
            qty_balance: Math.max(0, Number(pm.qty_balance) - qty),
          }).eq('id', pm.id)
        }
      }

      // إرجاع للعميل — ينقص من رصيد العهدة ولا يعود للمستودع العام
      if (type === 'إرجاع' && form.project_id && isProjectWarehouse) {
        const { data: pm } = await supabase.from('project_materials').select('*')
          .eq('tenant_id', tenantId).eq('project_id', Number(form.project_id))
          .eq('material_id', mat.id).eq('warehouse_id', mat.warehouse_id).maybeSingle()
        if (pm) {
          await supabase.from('project_materials').update({
            qty_balance: Math.max(0, Number(pm.qty_balance) - qty),
          }).eq('id', pm.id)
        }
      }

      if (type === 'تحويل' && form.to_warehouse_id) {
        const toWh = warehouses.find(w => w.id === Number(form.to_warehouse_id))
        const { data: toMat } = await supabase.from('materials').select('*')
          .eq('tenant_id', tenantId).eq('warehouse_id', Number(form.to_warehouse_id))
          .eq('name', mat.name).maybeSingle()
        if (toMat) {
          await supabase.from('materials').update({ qty: toMat.qty + qty }).eq('id', toMat.id)
        } else {
          await supabase.from('materials').insert({ ...mat, id: undefined, warehouse_id: Number(form.to_warehouse_id), qty })
        }
        await supabase.from('stock_ledger').insert({
          tenant_id: tenantId, branch_id: branchId,
          type: 'استلام', mat_name: mat.name, unit: mat.unit, qty,
          qty_before: toMat?.qty ?? 0, qty_after: (toMat?.qty ?? 0) + qty,
          wh_name: toWh?.name || '', dispatch_note: 'تحويل من ' + (wh?.name || ''),
        })
      }
    }

    setSaving(false)
    toast.success(type + ' تم بنجاح ✅')

    // طباعة وصل واحد لكل العملية بعد الحفظ
    if (type === 'استلام' || type === 'صرف' || type === 'إرجاع') {
      const { data: lastEntry } = await supabase.from('stock_ledger')
        .select('txn_number').eq('tenant_id', tenantId)
        .order('id', { ascending: false }).limit(1).maybeSingle()
      const wh   = warehouses.find(w => w.id === Number(form.warehouse_id))
      const proj = projects.find((p: any) => p.id === Number(form.project_id))
      // جمع كل مواد العملية في وصل واحد
      const printRows = validRows.map(r => {
        const mat = materials.find(m => String(m.id) === String(r.mat_id))
        return { name: mat?.name || '', unit: mat?.unit || '', qty: Number(r.qty), note: r.note }
      })
      printOperationReceipt({
        type,
        warehouseName:  wh?.name           || '',
        projectName:    proj?.name          || form.project_name || '',
        date:           form.date,
        rows:           printRows,
        vendorName:     form.vendor_name    || '',
        docCode:        form.doc_code       || '',
        bookingNo:      form.booking_no     || '',
        clientName:     form.client_name_recv || '',
        exitPermitNo:   form.exit_permit_no || '',
        txnNumber:      lastEntry?.txn_number || '',
      })
    }

    onSave(); onClose()
  }

  const OP_META = {
    'استلام': { color: '#0ea77b', icon: ArrowDownToLine },
    'صرف':    { color: '#c81e1e', icon: ArrowUpFromLine },
    'إرجاع':  { color: '#e6820a', icon: RotateCcw },
    'تحويل':  { color: '#1a56db', icon: ArrowLeftRight },
  }
  const meta = OP_META[type]

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: meta.color + '10', borderBottom: `2px solid ${meta.color}22` }}>
          <h3 style={{ fontWeight: 700, color: meta.color, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <meta.icon style={{ width: '18px', height: '18px' }} /> {type} مواد
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* المستودع */}
          <div style={{ display: 'grid', gridTemplateColumns: type === 'تحويل' ? '1fr 1fr' : '1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                {type === 'تحويل' ? 'من مستودع' : 'المستودع'} <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {type === 'تحويل' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>إلى مستودع <span style={{ color: '#c81e1e' }}>*</span></label>
                <select value={form.to_warehouse_id} onChange={e => set('to_warehouse_id', e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {warehouses.filter(w => w.id !== Number(form.warehouse_id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* المشروع */}
          {(type === 'صرف' || type === 'إرجاع' || (type === 'استلام' && showProjectOnReceive)) && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                المشروع {(type === 'صرف' || type === 'إرجاع' || projectRequiredOnReceive) && <span style={{ color: '#c81e1e' }}>*</span>}
              </label>
              <select value={form.project_id} onChange={e => handleProjectChange(e.target.value)} className="select">
                <option value="">— اختر المشروع —</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* نوع الإرجاع */}
          {type === 'إرجاع' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>نوع الإرجاع <span style={{ color: '#c81e1e' }}>*</span></label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { val: 'فائض',  desc: 'مواد فائضة ترجع للعميل',  color: '#e6820a', icon: '↩️' },
                  { val: 'سكراب', desc: 'مواد تالفة فقط',           color: '#c81e1e', icon: '🗑️' },
                ].map(rt => (
                  <button key={rt.val} type="button" onClick={() => set('return_type', rt.val)}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', textAlign: 'center',
                      borderColor: form.return_type === rt.val ? rt.color : '#e5e7eb',
                      background: form.return_type === rt.val ? rt.color + '10' : 'white',
                      color: form.return_type === rt.val ? rt.color : '#9ca3af' }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{rt.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{rt.val}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8, marginTop: '3px' }}>{rt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* حقول إضافية */}
          {type === 'استلام' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {isProjectWh ? (<>
                {/* مستودع مشاريع: العميل + رقم إذن الخروج + رقم الحجز */}
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>اسم العميل</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={form.client_name_recv} onChange={e => set('client_name_recv', e.target.value)} className="select" style={{ flex: 1 }}>
                      <option value="">— اختر العميل —</option>
                      {savedClients.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowClientInput(v => !v)}
                      style={{ padding: '0 14px', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>+</button>
                  </div>
                  {showClientInput && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <input value={newClientInput} onChange={e => setNewClientInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addClient())}
                        className="input" placeholder="اسم العميل الجديد..." style={{ flex: 1 }} autoFocus />
                      <button onClick={addClient} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>إضافة</button>
                      <button onClick={() => setShowClientInput(false)} className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '6px 10px' }}>✕</button>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم إذن الخروج</label>
                  <input value={form.exit_permit_no} onChange={e => set('exit_permit_no', e.target.value)} className="input" placeholder="رقم إذن خروج المواد" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم الحجز</label>
                  <input value={form.booking_no} onChange={e => set('booking_no', e.target.value)} className="input" placeholder="رقم حجز العميل" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم المستند</label>
                  <input value={form.doc_code} onChange={e => set('doc_code', e.target.value)} className="input" placeholder="رقم المستند" />
                </div>
              </>) : (<>
                {/* مستودع عام: المورد + رقم المستند */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المورد</label>
                  <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} className="input" placeholder="اسم المورد" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم المستند</label>
                  <input value={form.doc_code} onChange={e => set('doc_code', e.target.value)} className="input" placeholder="رقم الفاتورة أو أمر الشراء" />
                </div>
              </>)}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>التاريخ</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" />
              </div>
            </div>
          )}
          {type !== 'استلام' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>التاريخ</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" />
            </div>
          )}

          {/* المواد */}
          {isProjectWh && form.project_id && (type === 'صرف' || type === 'إرجاع') ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px', color: '#1a56db' }}>
                {type === 'صرف' ? 'مواد المشروع — أدخل الكميات المصروفة:' : 'مواد المشروع — أدخل الكميات المُرجعة (اختياري):'}
              </label>
              {type === 'إرجاع' && (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '8px' }}>
                  💡 أدخل الكمية فقط للمواد التي تريد إرجاعها — يمكن ترك باقي المواد فارغة
                </div>
              )}
              {Object.keys(projectBalances).length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>لا توجد مواد لهذا المشروع في هذا المستودع</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                  {Object.entries(projectBalances).map(([matIdStr, balance]) => {
                    const matId = Number(matIdStr)
                    const mat   = materials.find(m => m.id === matId)
                    if (!mat) return null
                    return (
                      <div key={matId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.name}</div>
                          <div style={{ fontSize: '0.7rem', color: type === 'صرف' ? '#0ea77b' : '#e6820a', fontWeight: 600 }}>
                            رصيد المشروع: {balance} {mat.unit}
                          </div>
                        </div>
                        <input type="number" value={directQtys[matId] || ''} min="0" max={balance}
                          onChange={e => setDirectQtys(prev => ({ ...prev, [matId]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                          placeholder="0" style={{ width: '70px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', textAlign: 'center' }} />
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af', minWidth: '30px' }}>{mat.unit}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>المواد:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {rows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select value={row.mat_id} onChange={e => setRow(i, 'mat_id', e.target.value)} className="select" style={{ flex: 2 }}>
                      <option value="">— اختر مادة —</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}{!isProjectWh ? ` (${m.qty} ${m.unit})` : ''}
                        </option>
                      ))}
                    </select>
                    <input type="number" value={row.qty} onChange={e => setRow(i, 'qty', e.target.value)} className="input" placeholder="الكمية" min="0" style={{ width: '90px' }} />
                    <input value={row.note} onChange={e => setRow(i, 'note', e.target.value)} className="input" placeholder="بيان" style={{ flex: 1 }} />
                    {rows.length > 1 && (
                      <button onClick={() => setRows(r => r.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '4px' }}>
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => setRows(r => [...r, { mat_id: '', qty: '', note: '' }])}
                  style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed #d1d5db', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', color: '#6b7280' }}>
                  + إضافة مادة
                </button>
              </div>
            </div>
          )}

          {/* مرفق */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>مرفق (اختياري)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input ref={attachRef} type="file" accept="image/*,.pdf" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <button onClick={() => attachRef.current?.click()} className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
                <Paperclip style={{ width: '13px', height: '13px' }} /> {attachmentFile ? attachmentFile.name : 'إرفاق ملف'}
              </button>
              {attachmentFile && <button onClick={() => setAttachmentFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}><X style={{ width: '14px', height: '14px' }} /></button>}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: meta.color }}>
            {saving ? 'جاري الحفظ...' : 'تأكيد ' + type}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// مودال: مرتجع موقع
// ══════════════════════════════════════════
function ReturnModal({ tenantId, branchId, warehouses, projects, onClose, onSave }: {
  tenantId: string; branchId: number
  warehouses: any[]; projects: any[]
  onClose: () => void; onSave: () => void
}) {
  const [saving,         setSaving]         = useState(false)
  const [warehouseId,    setWarehouseId]    = useState('')
  const [projectId,      setProjectId]      = useState('')
  const [projectName,    setProjectName]    = useState('')
  const [issuedMats,     setIssuedMats]     = useState<any[]>([])
  const [returnQtys,     setReturnQtys]     = useState<Record<number, string>>({})
  const [date,           setDate]           = useState(new Date().toISOString().split('T')[0])
  const [notes,          setNotes]          = useState('')

  async function loadIssuedMats() {
    if (!warehouseId || !projectId) return
    const { data } = await supabase.from('project_materials')
      .select('*, material:materials(id, name, unit, catalog_no)')
      .eq('tenant_id', tenantId)
      .eq('project_id', Number(projectId))
      .eq('warehouse_id', Number(warehouseId))
      .gt('qty_issued', 0)
    setIssuedMats(data || [])
    setReturnQtys({})
  }

  useEffect(() => { loadIssuedMats() }, [warehouseId, projectId])

  async function handleSave() {
    const validRows = Object.entries(returnQtys).filter(([, qty]) => Number(qty) > 0)
    if (validRows.length === 0) { toast.error('أدخل كمية مرتجعة لمادة واحدة على الأقل'); return }
    if (!projectId) { toast.error('اختر المشروع'); return }
    setSaving(true)

    const wh   = warehouses.find(w => w.id === Number(warehouseId))
    const printRows: { name: string; unit: string; qty: number; note: string }[] = []

    for (const [pmIdStr, qtyStr] of validRows) {
      const qty = Number(qtyStr)
      const pm  = issuedMats.find(m => String(m.id) === pmIdStr)
      if (!pm) continue

      const maxReturn = Number(pm.qty_issued)
      if (qty > maxReturn) {
        toast.error(`لا يمكن إرجاع أكثر من ${maxReturn} ${pm.material?.unit} من "${pm.material?.name}"`)
        setSaving(false); return
      }

      // جلب رصيد المادة
      const { data: mat } = await supabase.from('materials').select('qty, name, unit')
        .eq('id', pm.material_id).single()
      if (!mat) continue

      const qtyBefore = Number(mat.qty)
      const qtyAfter  = qtyBefore + qty

      // تحديث المادة في المستودع
      await supabase.from('materials').update({ qty: qtyAfter }).eq('id', pm.material_id)

      // تحديث project_materials
      await supabase.from('project_materials').update({
        qty_issued:  Math.max(0, Number(pm.qty_issued)  - qty),
        qty_balance: Number(pm.qty_balance) + qty,
      }).eq('id', pm.id)

      // تسجيل في stock_ledger
      await supabase.from('stock_ledger').insert({
        tenant_id:         tenantId,
        branch_id:         branchId,
        type:              'استلام',
        movement_category: 'مرتجع_موقع',
        mat_name:          mat.name,
        unit:              mat.unit,
        qty,
        qty_before:        qtyBefore,
        qty_after:         qtyAfter,
        wh_name:           wh?.name || '',
        project_id:        Number(projectId),
        project_name:      projectName,
        dispatch_note:     notes || 'مرتجع موقع',
      })

      printRows.push({ name: mat.name, unit: mat.unit, qty, note: notes || '' })
    }

    setSaving(false)
    toast.success(`✅ تم تسجيل المرتجع — ${printRows.length} مادة`)

    // طباعة وصل المرتجع
    const { data: lastEntry } = await supabase.from('stock_ledger')
      .select('txn_number').eq('tenant_id', tenantId)
      .order('id', { ascending: false }).limit(1).maybeSingle()

    printOperationReceipt({
      type: 'مرتجع موقع',
      warehouseName: wh?.name || '',
      projectName,
      date,
      rows: printRows,
      txnNumber: lastEntry?.txn_number || '',
    })

    onSave(); onClose()
  }

  const isProjectWh = warehouses.find(w => w.id === Number(warehouseId))
  const totalReturn = Object.values(returnQtys).reduce((s, v) => s + Number(v || 0), 0)

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
          <h3 style={{ fontWeight: 700, color: '#1a56db', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw style={{ width: '18px', height: '18px' }} /> مرتجع موقع
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#1a56db' }}>
            📦 مواد خرجت للموقع ولم تُستخدم — ترجع للمستودع وتزيد رصيد العهدة
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                المستودع <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="select">
                <option value="">— اختر المستودع —</option>
                {warehouses.filter(w => w.wh_category === 'مشاريع' || w.mode === 'مشاريع').map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                المشروع <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <select value={projectId} onChange={e => {
                const p = projects.find((p: any) => p.id === Number(e.target.value))
                setProjectId(e.target.value)
                setProjectName(p?.name || '')
              }} className="select">
                <option value="">— اختر المشروع —</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>التاريخ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" style={{ maxWidth: '200px' }} />
          </div>

          {/* قائمة المواد المصروفة */}
          {warehouseId && projectId && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1a56db' }}>
                  المواد المصروفة — أدخل الكمية المرتجعة:
                </label>
                {totalReturn > 0 && (
                  <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                    إجمالي المرتجع: {totalReturn}
                  </span>
                )}
              </div>

              {issuedMats.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', color: 'var(--text3)', fontSize: '0.875rem' }}>
                  لا توجد مواد مصروفة لهذا المشروع في هذا المستودع
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                  {issuedMats.map(pm => (
                    <div key={pm.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', borderRadius: '10px',
                      background: returnQtys[pm.id] && Number(returnQtys[pm.id]) > 0 ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${returnQtys[pm.id] && Number(returnQtys[pm.id]) > 0 ? '#bfdbfe' : 'var(--border)'}`,
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pm.material?.name || '—'}
                        </div>
                        <div style={{ fontSize: '0.72rem', marginTop: '2px', display: 'flex', gap: '10px' }}>
                          <span style={{ color: '#c81e1e' }}>مصروف: <strong>{pm.qty_issued}</strong></span>
                          <span style={{ color: '#0ea77b' }}>الرصيد: <strong>{pm.qty_balance}</strong></span>
                          <span style={{ color: 'var(--text3)' }}>{pm.material?.unit}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <input
                          type="number"
                          value={returnQtys[pm.id] || ''}
                          min="0"
                          max={pm.qty_issued}
                          onChange={e => setReturnQtys(prev => ({ ...prev, [pm.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                          placeholder="0"
                          style={{
                            width: '75px', padding: '6px 8px', borderRadius: '8px',
                            border: '2px solid #bfdbfe', fontSize: '0.875rem',
                            textAlign: 'center', fontWeight: 700,
                            background: returnQtys[pm.id] && Number(returnQtys[pm.id]) > 0 ? '#eff6ff' : 'white',
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text3)', minWidth: '35px' }}>
                          {pm.material?.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>ملاحظات</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="input" placeholder="سبب الإرجاع (اختياري)" />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || totalReturn === 0}
            className="btn btn-primary" style={{ background: '#1a56db' }}>
            {saving ? 'جاري الحفظ...' : `تأكيد المرتجع${totalReturn > 0 ? ` (${totalReturn})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════
export default function InventoryMaterialsPage() {
  const { tenant, activeBranch } = useStore()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [projects,   setProjects]   = useState<any[]>([])
  const [materials,  setMaterials]  = useState<Material[]>([])
  const [matTotal,   setMatTotal]   = useState(0)
  const [matPage,    setMatPage]    = useState(1)
  const [loading,    setLoading]    = useState(false)

  // فلاتر
  const [search,      setSearch]      = useState('')
  const [filterWh,    setFilterWh]    = useState('')
  const [filterQty,   setFilterQty]   = useState<'all' | 'with' | 'without' | 'low'>('all')
  const [filterSource, setFilterSource] = useState<'all' | 'خاص' | 'SEC'>('all')
  const [viewMode,    setViewMode]    = useState<'all' | 'project'>('all')
  const [projectId,   setProjectId]   = useState('')

  // modals
  const [modal,      setModal]      = useState<'define' | 'edit' | 'استلام' | 'صرف' | 'إرجاع' | 'تحويل' | 'مرتجع' | 'check' | null>(null)
  const [editMat,    setEditMat]    = useState<Material | null>(null)
  const [checkItems, setCheckItems] = useState<any[]>([])
  const [checkWh,    setCheckWh]    = useState('')

  const totalPages = Math.ceil(matTotal / PAGE_SIZE)

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id])

  async function loadBase() {
    if (!tenant) return
    const [whRes, projRes] = await Promise.all([
      supabase.from('warehouses').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('projects').select('id, name, status').eq('tenant_id', tenant.id)
        .not('status', 'eq', 'مكتمل').order('name'),
    ])
    setWarehouses(whRes.data || [])
    setProjects(projRes.data || [])
    loadMaterials(1, whRes.data || [])
  }

  async function loadMaterials(page = 1, whs?: Warehouse[]) {
    if (!tenant) return
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE

    if (viewMode === 'project' && projectId) {
      const { data } = await supabase.from('project_materials')
        .select('*, material:materials(id, name, unit, catalog_no, sec_number, mat_code), warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('project_id', Number(projectId))
      const proj = projects.find((p: any) => p.id === Number(projectId))
      const mapped = (data || []).map((pm: any) => ({
        id: pm.material?.id, name: pm.material?.name || '—', unit: pm.material?.unit || '—',
        catalog_no: pm.material?.catalog_no, sec_number: pm.material?.sec_number,
        mat_code: pm.material?.mat_code, qty: pm.qty_balance,
        qty_received: pm.qty_received, qty_issued: pm.qty_issued,
        reorder: 0, warehouse_id: pm.warehouse_id,
        warehouse: { name: pm.warehouse?.name || '—' }, project_name: proj?.name || '',
      }))
      const filtered = search ? mapped.filter((m: any) => m.name?.includes(search)) : mapped
      setMaterials(filtered as any); setMatTotal(filtered.length); setMatPage(1)
      setLoading(false); return
    }

    let q = supabase.from('materials')
      .select('*, warehouse:warehouses(name)', { count: 'exact' })
      .eq('tenant_id', tenant.id).order('name').range(from, from + PAGE_SIZE - 1)

    if (filterWh)                  q = q.eq('warehouse_id', Number(filterWh))
    if (filterSource !== 'all')    q = q.eq('source', filterSource)
    if (filterQty === 'with')      q = q.gt('qty', 0)
    if (filterQty === 'without')   q = q.lte('qty', 0)
    if (filterQty === 'low')       q = q.gt('qty', 0).lte('qty', 10)
    if (search) q = q.or(`name.ilike.%${search}%,catalog_no.ilike.%${search}%,sec_number.ilike.%${search}%,mat_code.ilike.%${search}%`)

    const { data, count } = await q
    setMaterials(data || []); setMatTotal(count || 0); setMatPage(page)
    setLoading(false)
  }

  async function toggleMaterial(id: number, current: boolean) {
    if (!confirm(current ? 'تعطيل هذه المادة؟' : 'تفعيل هذه المادة؟')) return
    await supabase.from('materials').update({ is_active: !current }).eq('id', id)
    loadMaterials(matPage)
    toast.success(current ? 'تم التعطيل' : 'تم التفعيل')
  }

  async function deleteMaterial(id: number, name: string) {
    if (!confirm(`حذف "${name}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return
    await supabase.from('materials').delete().eq('id', id)
    toast.success('تم الحذف')
    loadMaterials(matPage)
  }

  async function loadInventoryCheck() {
    if (!tenant || !checkWh) return
    const { data } = await supabase.from('materials').select('*')
      .eq('tenant_id', tenant.id).eq('warehouse_id', Number(checkWh)).order('name')
    setCheckItems((data || []).map(m => ({ ...m, actualQty: m.qty, systemQty: m.qty })))
  }

  async function saveInventoryCheck() {
    if (!tenant || !activeBranch) return
    const changed = checkItems.filter(i => i.actualQty !== i.systemQty)
    if (changed.length === 0) { toast.error('لا توجد فروقات للتسوية'); return }
    for (const item of changed) {
      const diff = item.actualQty - item.systemQty
      await supabase.from('materials').update({ qty: item.actualQty }).eq('id', item.id)
      await supabase.from('stock_ledger').insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: diff > 0 ? 'استلام' : 'صرف', mat_name: item.name, unit: item.unit,
        qty: Math.abs(diff), qty_before: item.systemQty, qty_after: item.actualQty,
        wh_name: warehouses.find(w => w.id === Number(checkWh))?.name || '',
        dispatch_note: 'تسوية جرد',
      })
    }
    toast.success(`✅ تم جرد وتسوية ${changed.length} مادة`)
    setModal(null); loadMaterials(matPage)
  }

  function exportCSV() {
    const headers = ['الاسم', 'رقم الكتالوج', 'رقم SEC', 'المستودع', 'الوحدة', 'الكمية', 'حد الأمان', 'المصدر']
    const rows = materials.map(m => [m.name, m.catalog_no || '', m.sec_number || '', (m.warehouse as any)?.name || '', m.unit, m.qty, m.reorder, m.source || ''])
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'المواد.xls'; a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* العنوان */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package style={{ width: '22px', height: '22px', color: '#1a56db' }} /> المواد
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>
            {matTotal.toLocaleString()} مادة — إدارة وعرض وتحكم كامل
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setModal('define')} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
            <Plus style={{ width: '15px', height: '15px' }} /> إضافة مادة
          </button>
          <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            <Download style={{ width: '15px', height: '15px' }} /> تصدير
          </button>
          <button onClick={() => setModal('check')} className="btn btn-ghost" style={{ fontSize: '0.82rem', color: '#e6820a', borderColor: '#fde68a' }}>
            <Scale style={{ width: '15px', height: '15px' }} /> جرد المستودع
          </button>
        </div>
      </div>

      {/* أزرار العمليات — مجموعتان */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* المجموعة الأولى: حركات الموقع */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap', minWidth: '80px' }}>حركات الموقع</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', flex: 1 }}>
            {([
              { type: 'استلام', emoji: '📥', color: '#0ea77b', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '#86efac', desc: 'استلام مواد' },
              { type: 'صرف',    emoji: '📤', color: '#c81e1e', bg: 'linear-gradient(135deg, #fef2f2, #fecaca)', border: '#fca5a5', desc: 'صرف للموقع' },
              { type: 'مرتجع', emoji: '📦', color: '#1a56db', bg: 'linear-gradient(135deg, #eff6ff, #bfdbfe)', border: '#93c5fd', desc: 'مرتجع من الموقع' },
            ] as const).map(btn => (
              <button key={btn.type} onClick={() => setModal(btn.type as any)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '14px 10px', borderRadius: '12px', border: `2px solid ${btn.border}`, background: btn.bg, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${btn.color}25` }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{btn.emoji}</span>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: btn.color }}>{btn.type}</div>
                <div style={{ fontSize: '0.65rem', color: btn.color, opacity: 0.75 }}>{btn.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* المجموعة الثانية: حركات إدارية */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap', minWidth: '80px' }}>حركات إدارية</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', flex: 1 }}>
            {([
              { type: 'تحويل',  emoji: '🔄', color: '#0891b2', bg: 'linear-gradient(135deg, #ecfeff, #a5f3fc)', border: '#67e8f9', desc: 'نقل بين المستودعات' },
              { type: 'إرجاع',  emoji: '↩️', color: '#e6820a', bg: 'linear-gradient(135deg, #fffbeb, #fde68a)', border: '#fcd34d', desc: 'إرجاع فائض للعميل' },
            ] as const).map(btn => (
              <button key={btn.type} onClick={() => setModal(btn.type)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '12px 10px', borderRadius: '12px', border: `2px solid ${btn.border}`, background: btn.bg, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${btn.color}25` }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{btn.emoji}</span>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: btn.color }}>{btn.type === 'إرجاع' ? 'إرجاع للعميل' : btn.type}</div>
                <div style={{ fontSize: '0.65rem', color: btn.color, opacity: 0.75 }}>{btn.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* الفلاتر */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* طريقة العرض */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[{ id: 'all', label: '📦 كل المواد' }, { id: 'project', label: '🏗️ مشروع' }].map(opt => (
            <button key={opt.id} onClick={() => { setViewMode(opt.id as any); setMaterials([]); setMatTotal(0) }}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                borderColor: viewMode === opt.id ? '#1a56db' : 'var(--border)',
                background: viewMode === opt.id ? '#eff6ff' : 'transparent',
                color: viewMode === opt.id ? '#1a56db' : 'var(--text3)' }}>
              {opt.label}
            </button>
          ))}
        </div>

        {viewMode === 'project' ? (
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="select" style={{ minWidth: '200px', fontSize: '0.82rem' }}>
            <option value="">— اختر المشروع —</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (<>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadMaterials(1)}
              placeholder="بحث بالاسم أو الكود..." className="input" style={{ paddingRight: '32px', width: '200px', fontSize: '0.82rem' }} />
          </div>
          <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
            <option value="">كل المستودعات</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={filterQty} onChange={e => setFilterQty(e.target.value as any)} className="select" style={{ fontSize: '0.82rem' }}>
            <option value="all">كل الكميات</option>
            <option value="with">لها كمية</option>
            <option value="without">كمية صفر</option>
            <option value="low">منخفضة</option>
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value as any)} className="select" style={{ fontSize: '0.82rem' }}>
            <option value="all">كل المصادر</option>
            <option value="خاص">خاص</option>
            <option value="SEC">SEC</option>
          </select>
        </>)}

        <button onClick={() => loadMaterials(1)} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
          <Filter style={{ width: '13px', height: '13px' }} /> عرض
        </button>
      </div>

      {/* الجدول */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : materials.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📦</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {search || filterWh || filterQty !== 'all' ? 'لا توجد نتائج بهذه الفلاتر' : 'لا توجد مواد — ابدأ بإضافة مادة'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2, #f8fafc)', position: 'sticky', top: 0 }}>
                    {(viewMode === 'project'
                      ? ['الاسم', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'الرصيد']
                      : ['الكود', 'رقم الكتالوج', 'رقم SEC', 'الاسم', 'المستودع', 'الوحدة', 'الكمية', 'حد الأمان', 'الحالة', '']
                    ).map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2, #f8fafc)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      {viewMode === 'project' ? (<>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: '0.78rem' }}>{(m as any).warehouse?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{m.unit}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: 700 }}>{(m as any).qty_received ?? '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#c81e1e', fontWeight: 700 }}>{(m as any).qty_issued ?? '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 800, color: m.qty <= 0 ? '#c81e1e' : '#1a56db', fontSize: '0.9rem' }}>{m.qty}</td>
                      </>) : (<>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700 }}>{m.mat_code || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a56db' }}>{m.catalog_no || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af' }}>{m.sec_number || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.source === 'SEC' && <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem', fontWeight: 700, marginLeft: '5px' }}>SEC</span>}
                          {m.name}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{(m.warehouse as any)?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{m.unit}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', color: m.qty <= 0 ? '#c81e1e' : m.qty <= m.reorder ? '#d97706' : '#0ea77b' }}>
                          {m.qty}
                          {m.qty > 0 && m.qty <= m.reorder && <span style={{ marginRight: '4px', fontSize: '0.68rem' }}>⚠️</span>}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text3)' }}>{m.reorder || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge ${m.qty <= 0 ? 'badge-red' : m.qty <= m.reorder ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '0.68rem' }}>
                            {m.qty <= 0 ? 'نفدت' : m.qty <= m.reorder ? 'منخفض' : 'متوفر'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => { setEditMat(m); setModal('edit') }}
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                              <Pencil style={{ width: '12px', height: '12px' }} />
                            </button>
                            <button onClick={() => toggleMaterial(m.id, m.is_active !== false)}
                              style={{ padding: '4px 7px', borderRadius: '6px', border: `1px solid ${m.is_active !== false ? '#fecaca' : '#bbf7d0'}`, background: m.is_active !== false ? '#fef2f2' : '#ecfdf5', cursor: 'pointer', color: m.is_active !== false ? '#c81e1e' : '#0ea77b', fontSize: '0.68rem', fontWeight: 600 }}>
                              {m.is_active !== false ? 'تعطيل' : 'تفعيل'}
                            </button>
                          </div>
                        </td>
                      </>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2, #f8fafc)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                  {((matPage - 1) * PAGE_SIZE) + 1} — {Math.min(matPage * PAGE_SIZE, matTotal)} من {matTotal.toLocaleString()} مادة
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { setMatPage(p => p - 1); loadMaterials(matPage - 1) }} disabled={matPage === 1}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: matPage === 1 ? 'not-allowed' : 'pointer', opacity: matPage === 1 ? 0.4 : 1 }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                  <span style={{ padding: '5px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{matPage} / {totalPages}</span>
                  <button onClick={() => { setMatPage(p => p + 1); loadMaterials(matPage + 1) }} disabled={matPage === totalPages}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: matPage === totalPages ? 'not-allowed' : 'pointer', opacity: matPage === totalPages ? 0.4 : 1 }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal === 'define' && tenant && activeBranch && (
        <MaterialDefineModal tenantId={tenant.id} branchId={activeBranch.id} warehouses={warehouses}
          onClose={() => setModal(null)} onSave={() => loadMaterials(1)} />
      )}
      {modal === 'edit' && editMat && (
        <MaterialEditModal material={editMat} warehouses={warehouses}
          onClose={() => { setModal(null); setEditMat(null) }} onSave={() => loadMaterials(matPage)} />
      )}
      {(['استلام', 'صرف', 'إرجاع', 'تحويل'] as const).map(type => (
        modal === type && tenant && activeBranch && (
          <OperationModal key={type} type={type}
            tenantId={tenant.id} branchId={activeBranch.id}
            warehouses={warehouses} projects={projects}
            onClose={() => setModal(null)} onSave={() => { setModal(null); loadMaterials(matPage) }} />
        )
      ))}

      {modal === 'مرتجع' && tenant && activeBranch && (
        <ReturnModal
          tenantId={tenant.id} branchId={activeBranch.id}
          warehouses={warehouses} projects={projects}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadMaterials(matPage) }}
        />
      )}

      {/* جرد المستودع */}
      {modal === 'check' && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale style={{ width: '18px', height: '18px', color: '#e6820a' }} /> جرد المستودع
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>اختر المستودع</label>
                  <select value={checkWh} onChange={e => setCheckWh(e.target.value)} className="select">
                    <option value="">— اختر —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <button onClick={loadInventoryCheck} disabled={!checkWh} className="btn btn-primary" style={{ background: '#e6820a' }}>
                  تحميل المواد
                </button>
              </div>
              {checkItems.length > 0 && (
                <>
                  <div style={{ overflowY: 'auto', maxHeight: '380px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                          {['المادة', 'الوحدة', 'كمية النظام', 'الكمية الفعلية', 'الفرق'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {checkItems.map((item, i) => {
                          const diff = item.actualQty - item.systemQty
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--bg2)', background: diff !== 0 ? '#fffbeb' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.name}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{item.unit}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#9ca3af' }}>{item.systemQty}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <input type="number" value={item.actualQty} min="0"
                                  onChange={e => setCheckItems(prev => prev.map((ci, j) => j === i ? { ...ci, actualQty: Number(e.target.value) } : ci))}
                                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                  style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', textAlign: 'center' }} dir="ltr" />
                              </td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: diff !== 0 ? 700 : 400, color: diff > 0 ? '#0ea77b' : diff < 0 ? '#c81e1e' : '#9ca3af' }}>
                                {diff > 0 ? '+' : ''}{diff}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', border: '1px solid #fde68a' }}>
                    🔔 الخلايا الصفراء تعني وجود فروقات — عدّل الكمية الفعلية ثم احفظ
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal(null)} className="btn btn-ghost">إلغاء</button>
              {checkItems.length > 0 && (
                <button onClick={saveInventoryCheck} className="btn btn-primary" style={{ background: '#e6820a' }}>
                  <Save style={{ width: '14px', height: '14px' }} /> حفظ الجرد
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
