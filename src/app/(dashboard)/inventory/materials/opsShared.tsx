// src/app/(dashboard)/inventory/materials/opsShared.tsx
// ══════════════════════════════════════════════════════════════
// مكوّنات العمليات المشتركة بين تبويبات الأذون الأربعة:
// OperationModal (استلام/صرف/إرجاع/تحويل) + ReturnModal (مرتجع موقع)
// + printOperationReceipt + الأنواع المشتركة
// مشترك عمداً: نفس المودال يخدم ٤ تبويبات — نسخه فيها يعني تباعد النسخ عند أي إصلاح
// ══════════════════════════════════════════════════════════════
'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Plus, X, Save, Search, Trash2,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw, ArrowLeftRight,
  Paperclip,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════
export type Warehouse = {
  id: number; name: string; location?: string
  capacity?: string; sections?: string[]; tenant_id: string
  mode?: 'عام' | 'مشاريع' | 'مرن'
}
export type Material = {
  id: number; warehouse_id: number; catalog_no?: string
  sec_number?: string; name: string; unit: string
  mat_code?: string; item_code?: string; barcode?: string; is_active?: boolean
  qty: number; reorder: number; source?: string
  location?: string; notes?: string; project_name?: string
  warehouse?: { name: string }
}

export const UNITS = ['قطعة', 'متر', 'كجم', 'لتر', 'علبة', 'رول', 'طن', 'م²', 'م³', 'كيس', 'برميل', 'أمبير', 'متر كيبل']

// ══════════════════════════════════════════
// رفع مرفق
// ══════════════════════════════════════════
export async function uploadAttachment(file: File, tenantId: string): Promise<string | null> {
  const ext  = file.name.split('.').pop()
  const path = `${tenantId}/inventory/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: true })
  if (error) { toast.error('فشل رفع المرفق'); return null }
  const { data } = supabase.storage.from('attachments').getPublicUrl(path)
  return data?.publicUrl || null
}

// ══════════════════════════════════════════
// دالة طباعة وصل العملية
// ══════════════════════════════════════════
export function printOperationReceipt({ type, warehouseName, projectName, date, rows, vendorName, docCode, bookingNo, clientName, exitPermitNo, txnNumber }: {
  type: string; warehouseName: string; projectName: string; date: string
  rows: { name: string; unit: string; qty: number; note: string }[]
  vendorName?: string; docCode?: string; bookingNo?: string
  clientName?: string; exitPermitNo?: string; txnNumber?: string
}) {
  const win = window.open('', '_blank', 'width=700,height=600')
  if (!win) return
  const color = type === 'استلام' ? '#0ea77b'
    : type === 'إرجاع' || type === 'إرجاع للعميل' ? '#e6820a'
    : type === 'مرتجع موقع' ? '#1a56db'
    : '#c81e1e'
  const title = type === 'استلام' ? 'وصل استلام مواد'
    : type === 'إرجاع' || type === 'إرجاع للعميل' ? 'وصل إرجاع مواد للعميل'
    : type === 'مرتجع موقع' ? 'وصل مرتجع موقع'
    : 'أذن صرف مواد'
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


export function OperationModal({ type, tenantId, branchId, warehouses, projects, onClose, onSave }: {
  type: 'استلام' | 'صرف' | 'إرجاع' | 'تحويل'
  tenantId: string; branchId: number
  warehouses: Warehouse[]; projects: any[]
  onClose: () => void; onSave: () => void
}) {
  const [saving,          setSaving]          = useState(false)
  const savingRef = useRef(false)  // guard ضد التنفيذ المزدوج
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
    if (saving || savingRef.current) return  // منع التنفيذ المزدوج
    savingRef.current = true
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

    // ── رقم الإذن الموحد: يُولَّد مرة واحدة ويُختم على كل سطور العملية ──
    // (سابقاً كان الـ trigger يعطي كل سطر رقماً مستقلاً — إذن بثلاث مواد = ثلاثة أرقام)
    let opNumberType: string = 'استلام'
    if (type === 'صرف' || type === 'تحويل') opNumberType = 'صرف'
    else if (type === 'إرجاع') {
      const projWh = isProjectWh && !!form.project_id
      opNumberType = (form.return_type === 'فائض' && !projWh) ? 'استلام' : 'إرجاع للعميل'
    }
    const { data: voucherNo } = await supabase.rpc('generate_txn_number', { p_type: opNumberType })
    if (!voucherNo) { toast.error('تعذر توليد رقم الإذن'); setSaving(false); savingRef.current = false; return }

    // تجميع الصفوف — لو نفس المادة مكررة نجمع كمياتها
    const mergedRows: Record<number, { mat_id: number; qty: number; note: string }> = {}
    for (const row of validRows) {
      const id = Number(row.mat_id)
      if (mergedRows[id]) mergedRows[id].qty += Number(row.qty)
      else mergedRows[id] = { mat_id: id, qty: Number(row.qty), note: row.note }
    }
    const finalRows = Object.values(mergedRows)

    const { data: freshMats } = await supabase.from('materials').select('*')
      .in('id', finalRows.map(r => r.mat_id))
      .eq('tenant_id', tenantId)
      .eq('warehouse_id', Number(form.warehouse_id))
    const matsMap: Record<number, any> = {}
    ;(freshMats || []).forEach((m: any) => { matsMap[m.id] = m })


    for (const row of finalRows) {
      const mat = matsMap[Number(row.mat_id)]
      if (!mat) { toast.error('لم يتم العثور على المادة'); setSaving(false); savingRef.current = false; return }
      const qty = Number(row.qty)
      const isProjectWarehouse = isProjectWh && !!form.project_id

      // جلب الرصيد الحالي fresh من DB
      const { data: freshQty } = await supabase.from('materials').select('qty').eq('id', mat.id).single()
      const qtyBefore = Number(freshQty?.qty ?? mat.qty)

      // التحقق من الرصيد
      if (type === 'صرف' || type === 'تحويل') {
        const available = isProjectWarehouse && form.project_id ? (projectBalances[mat.id] ?? 0) : qtyBefore
        if (qty > available) { toast.error(`⛔ رصيد "${mat.name}" المتاح: ${available} ${mat.unit} فقط`); setSaving(false); savingRef.current = false; return }
      }
      if (type === 'إرجاع' && isProjectWarehouse && form.project_id) {
        const available = projectBalances[mat.id] ?? 0
        if (qty > available) { toast.error(`⛔ رصيد "${mat.name}" المتاح: ${available} ${mat.unit} فقط`); setSaving(false); savingRef.current = false; return }
      }

      // حساب الرصيد الجديد
      let qtyAfter = qtyBefore
      if (type === 'استلام') qtyAfter = qtyBefore + qty
      else if (type === 'صرف' || type === 'تحويل') qtyAfter = qtyBefore - qty
      else if (type === 'إرجاع') {
        if (form.return_type === 'فائض') qtyAfter = qtyBefore + qty
        else qtyAfter = qtyBefore
      }

      await supabase.from('materials').update({ qty: qtyAfter }).eq('id', mat.id)

      // تحديد نوع الحركة
      let ledgerType: string
      let movementCategory: string
      if (type === 'استلام') {
        ledgerType = 'استلام'; movementCategory = isProjectWarehouse ? 'استلام_عهدة' : 'استلام_عام'
      } else if (type === 'صرف') {
        ledgerType = 'صرف'; movementCategory = isProjectWarehouse ? 'صرف_عهدة' : 'صرف_عام'
      } else if (type === 'تحويل') {
        ledgerType = 'صرف'; movementCategory = 'تحويل'
      } else if (type === 'إرجاع') {
        if (form.return_type === 'فائض') {
          ledgerType = isProjectWarehouse ? 'إرجاع للعميل' : 'استلام'
          movementCategory = isProjectWarehouse ? 'ارجاع_عميل' : 'ارجاع_مستودع'
        } else {
          ledgerType = 'إرجاع للعميل'; movementCategory = 'ارجاع_عميل'
        }
      } else {
        ledgerType = type; movementCategory = 'استلام_عام'
      }

      await supabase.from('stock_ledger').insert({
        tenant_id: tenantId, branch_id: branchId,
        txn_number: voucherNo,
        type: ledgerType, movement_category: movementCategory,
        mat_name: mat.name, mat_code: mat.mat_code || null,
        unit: mat.unit, qty, qty_before: qtyBefore, qty_after: qtyAfter,
        wh_name: wh?.name || '',
        project_id:    form.project_id ? Number(form.project_id) : null,
        project_name:  form.project_name || null,
        vendor_name:   form.vendor_name || null,
        client_name:   form.client_name_recv || null,
        exit_permit_no: form.exit_permit_no || null,
        doc_code:      form.doc_code || null,
        booking_no:    form.booking_no || null,
        dispatch_note: row.note || null,
        attachment_url: attachmentUrl,
      })

      // ── project_materials يُحدَّث تلقائياً بـ trigger على stock_ledger ──

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
          txn_number: voucherNo, movement_category: 'تحويل',
          type: 'استلام', mat_name: mat.name, unit: mat.unit, qty,
          qty_before: toMat?.qty ?? 0, qty_after: (toMat?.qty ?? 0) + qty,
          wh_name: toWh?.name || '', dispatch_note: 'تحويل من ' + (wh?.name || ''),
        })
      }
    }

    setSaving(false)
    savingRef.current = false
    toast.success(type + ' تم بنجاح ✅')

    // طباعة وصل واحد لكل العملية بعد الحفظ — برقم الإذن الموحد
    if (type === 'استلام' || type === 'صرف' || type === 'إرجاع') {
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
        txnNumber:      voucherNo || '',
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
export function ReturnModal({ tenantId, branchId, warehouses, projects, onClose, onSave }: {
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

    // ── رقم الإذن الموحد لكل سطور المرتجع ──
    const { data: voucherNo } = await supabase.rpc('generate_txn_number', { p_type: 'استلام' })
    if (!voucherNo) { toast.error('تعذر توليد رقم الإذن'); setSaving(false); return }

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
      const { error: matErr } = await supabase.from('materials').update({ qty: qtyAfter }).eq('id', pm.material_id)
      if (matErr) { toast.error('خطأ تحديث المادة: ' + matErr.message); setSaving(false); return }

      // project_materials يُحدَّث تلقائياً بـ trigger

      // تسجيل في stock_ledger
      const { error: ledgerErr } = await supabase.from('stock_ledger').insert({
        tenant_id:         tenantId,
        branch_id:         branchId,
        txn_number:        voucherNo,
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
      if (ledgerErr) { toast.error('خطأ تسجيل الحركة: ' + ledgerErr.message); setSaving(false); return }

      printRows.push({ name: mat.name, unit: mat.unit, qty, note: notes || '' })
    }

    setSaving(false)
    toast.success(`✅ تم تسجيل المرتجع — ${printRows.length} مادة`)

    // طباعة وصل المرتجع — برقم الإذن الموحد
    printOperationReceipt({
      type: 'مرتجع موقع',
      warehouseName: wh?.name || '',
      projectName,
      date,
      rows: printRows,
      txnNumber: voucherNo || '',
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

