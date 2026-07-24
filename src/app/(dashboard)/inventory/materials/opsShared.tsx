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
import { fetchOpenReservations, ensureReservationByNumber } from '@/lib/pmc-service'
import { fetchAssigneeOptions, type AssigneeOption } from '@/lib/project-teams'
import { canUseAtomicVoucher, resolveVoucherMapping, submitOperationVoucher, submitSiteReturnVoucher } from '@/lib/pmc-voucher-bridge'
import type { MaterialReservation } from '@/lib/pmc-types'

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
    reservation_id: '',
    requested_by: '',
    date: new Date().toISOString().split('T')[0], return_type: '',
  })
  const [reservations, setReservations] = useState<Pick<MaterialReservation, 'id' | 'reservation_no' | 'status' | 'client_name'>[]>([])
  const [teamMembers, setTeamMembers] = useState<AssigneeOption[]>([])
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

  useEffect(() => {
    if (!form.project_id) { setReservations([]); setTeamMembers([]); return }
    fetchOpenReservations(tenantId, Number(form.project_id)).then(({ data }) => setReservations(data || []))
    supabase.from('projects').select('team_id').eq('id', Number(form.project_id)).single()
      .then(({ data: proj }) => fetchAssigneeOptions(supabase, tenantId, proj?.team_id).then(setTeamMembers))
  }, [form.project_id, tenantId])

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
    const proj = projects.find((p: { id: number; name: string }) => p.id === Number(projectId))
    set('project_id', projectId); set('project_name', proj?.name || '')
    set('reservation_id', ''); set('booking_no', ''); set('requested_by', '')
  }

  function noteWithRequester(note: string): string {
    if (!form.requested_by) return note
    const prefix = `طلب: ${form.requested_by}`
    return note ? `${prefix} — ${note}` : prefix
  }

  function handleReservationChange(reservationId: string) {
    set('reservation_id', reservationId)
    const res = reservations.find(r => String(r.id) === reservationId)
    if (res) set('booking_no', res.reservation_no)
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

    // ══ حارس السطور الناقصة: لا سطر يُرمى بصمت — مادة بلا كمية أو كمية بلا مادة = إيقاف برسالة تسمّيه ══
    if (effectiveRows === rows) {
      const incomplete = rows
        .map((r, i) => ({ ...r, idx: i + 1 }))
        .filter(r => (r.mat_id && !(Number(r.qty) > 0)) || (!r.mat_id && Number(r.qty) > 0))
      if (incomplete.length > 0) {
        const details = incomplete.map(r => {
          const matName = materials.find(m => m.id === Number(r.mat_id))?.name
          return r.mat_id
            ? `سطر ${r.idx}: "${matName || r.mat_id}" بدون كمية صالحة`
            : `سطر ${r.idx}: كمية ${r.qty} بدون اختيار مادة`
        }).join(' — ')
        toast.error(`⛔ لم يُحفظ شيء — أكمل أو احذف السطور الناقصة: ${details}`)
        savingRef.current = false
        return
      }
    }

    if (validRows.length === 0) { toast.error('أدخل كمية لمادة واحدة على الأقل'); savingRef.current = false; return }
    if (type === 'صرف' && !form.project_id) { toast.error('اسم المشروع مطلوب'); savingRef.current = false; return }
    if (type === 'إرجاع' && !form.project_id && isProjectWh) { toast.error('اختر المشروع'); savingRef.current = false; return }
    if (type === 'استلام' && projectRequiredOnReceive && !form.project_id) { toast.error('المشروع إلزامي لهذا المستودع'); savingRef.current = false; return }
    if (type === 'تحويل' && !form.to_warehouse_id) { toast.error('اختر المستودع المستلم'); savingRef.current = false; return }
    if (type === 'إرجاع' && !form.return_type) { toast.error('يجب تحديد نوع الإرجاع'); savingRef.current = false; return }

    const mapping = resolveVoucherMapping(type, isProjectWh, form.project_id, form.return_type)

    let reservationIdForSubmit = form.reservation_id
    if (mapping.requiresReservation && !reservationIdForSubmit && form.booking_no?.trim() && form.project_id) {
      const { data: ensured, error: ensureErr } = await ensureReservationByNumber(
        tenantId,
        Number(form.project_id),
        form.booking_no.trim(),
        form.client_name_recv || undefined,
      )
      if (ensureErr || !ensured) {
        toast.error(ensureErr?.message || 'تعذّر ربط رقم الحجز')
        savingRef.current = false
        return
      }
      reservationIdForSubmit = String(ensured.id)
      set('reservation_id', reservationIdForSubmit)
      set('booking_no', ensured.reservation_no)
    }

    if (mapping.requiresReservation && !reservationIdForSubmit && !form.booking_no?.trim()) {
      toast.error('أدخل رقم الحجز أو اختر حجزاً — لا يتطلب اكتمال التخطيط')
      savingRef.current = false
      return
    }

    setSaving(true)
    let attachmentUrl: string | null = null
    if (attachmentFile) attachmentUrl = await uploadAttachment(attachmentFile, tenantId)

    const wh = warehouses.find(w => w.id === Number(form.warehouse_id))

    // تجميع الصفوف
    const mergedRows: Record<number, { mat_id: number; qty: number; note: string }> = {}
    for (const row of validRows) {
      const id = Number(row.mat_id)
      if (mergedRows[id]) mergedRows[id].qty += Number(row.qty)
      else mergedRows[id] = { mat_id: id, qty: Number(row.qty), note: row.note }
    }
    const finalRows = Object.values(mergedRows)

    // ══ مسار RPC ذرّي (المرحلة 2) ══
    if (canUseAtomicVoucher(type, isProjectWh, form.project_id, form.return_type)) {
      const { data, error } = await submitOperationVoucher(
        type, tenantId, branchId,
        { ...form, reservation_id: reservationIdForSubmit },
        finalRows,
        { isProjectWh, whName: wh?.name, attachmentUrl },
      )
      if (error) {
        toast.error(`⛔ فشل الحفظ: ${error.message}`)
        setSaving(false); savingRef.current = false; return
      }
      const voucherNo = data?.voucher_no || ''
      setSaving(false); savingRef.current = false
      toast.success(`${type} تم بنجاح ✅ — إذن ${voucherNo} بعدد ${finalRows.length} صنف`)

      if (type === 'استلام' || type === 'صرف' || type === 'إرجاع') {
        const proj = projects.find((p: any) => p.id === Number(form.project_id))
        const printRows = validRows.map(r => {
          const mat = materials.find(m => String(m.id) === String(r.mat_id))
          return { name: mat?.name || '', unit: mat?.unit || '', qty: Number(r.qty), note: r.note }
        })
        printOperationReceipt({
          type, warehouseName: wh?.name || '', projectName: proj?.name || form.project_name || '',
          date: form.date, rows: printRows, vendorName: form.vendor_name || '',
          docCode: form.doc_code || '', bookingNo: form.booking_no || '',
          clientName: form.client_name_recv || '', exitPermitNo: form.exit_permit_no || '',
          txnNumber: voucherNo,
        })
      }
      onSave(); onClose()
      return
    }

    // ══ مسار قديم (سكراب بدون مشروع) ══
    let opNumberType: string = 'استلام'
    if (type === 'صرف' || type === 'تحويل') opNumberType = 'صرف'
    else if (type === 'إرجاع') {
      const projWh = isProjectWh && !!form.project_id
      opNumberType = (form.return_type === 'فائض' && !projWh) ? 'استلام' : 'إرجاع للعميل'
    }
    const { data: voucherNo } = await supabase.rpc('generate_txn_number', { p_type: opNumberType })
    if (!voucherNo) { toast.error('تعذر توليد رقم الإذن'); setSaving(false); savingRef.current = false; return }

    const { data: freshMats } = await supabase.from('materials').select('*')
      .in('id', finalRows.map(r => r.mat_id))
      .eq('tenant_id', tenantId)
      .eq('warehouse_id', Number(form.warehouse_id))
    const matsMap: Record<number, any> = {}
    ;(freshMats || []).forEach((m: any) => { matsMap[m.id] = m })

    // ══ تحقق مسبق شامل — لا نكتب حرفاً قبل سلامة كل السطور (يمنع الحفظ الجزئي الصامت) ══
    const missingRows = finalRows.filter(r => !matsMap[Number(r.mat_id)])
    if (missingRows.length > 0) {
      toast.error(`⛔ لم يُحفظ شيء — ${missingRows.length} مادة غير موجودة في المستودع المحدد. راجع اختيار المواد والمستودع`)
      setSaving(false); savingRef.current = false; return
    }
    for (const row of finalRows) {
      const mat = matsMap[Number(row.mat_id)]
      const qty = Number(row.qty)
      const isProjectWarehouse = isProjectWh && !!form.project_id
      if (type === 'صرف' || type === 'تحويل') {
        const available = isProjectWarehouse && form.project_id ? (projectBalances[mat.id] ?? 0) : Number(mat.qty)
        if (qty > available) { toast.error(`⛔ لم يُحفظ شيء — رصيد "${mat.name}" المتاح: ${available} ${mat.unit} فقط`); setSaving(false); savingRef.current = false; return }
      }
      if (type === 'إرجاع' && isProjectWarehouse && form.project_id) {
        const available = projectBalances[mat.id] ?? 0
        if (qty > available) { toast.error(`⛔ لم يُحفظ شيء — رصيد "${mat.name}" المتاح: ${available} ${mat.unit} فقط`); setSaving(false); savingRef.current = false; return }
      }
    }

    // ══ الكتابة — بفشل صاخب: أي خطأ يوقف فوراً ويصرّح بما كُتب وما لم يُكتب ══
    let savedCount = 0
    for (const row of finalRows) {
      const mat = matsMap[Number(row.mat_id)]
      const qty = Number(row.qty)
      const isProjectWarehouse = isProjectWh && !!form.project_id

      // جلب الرصيد الحالي fresh من DB
      const { data: freshQty } = await supabase.from('materials').select('qty').eq('id', mat.id).single()
      const qtyBefore = Number(freshQty?.qty ?? mat.qty)

      // حساب الرصيد الجديد
      let qtyAfter = qtyBefore
      if (type === 'استلام') qtyAfter = qtyBefore + qty
      else if (type === 'صرف' || type === 'تحويل') qtyAfter = qtyBefore - qty
      else if (type === 'إرجاع') {
        if (form.return_type === 'فائض') qtyAfter = qtyBefore + qty
        else qtyAfter = qtyBefore
      }

      const { error: updErr } = await supabase.from('materials').update({ qty: qtyAfter }).eq('id', mat.id)
      if (updErr) {
        toast.error(`⛔ توقف الحفظ عند "${mat.name}" (تحديث الرصيد): ${updErr.message} — حُفظ ${savedCount} من ${finalRows.length} صنف على الإذن ${voucherNo}`)
        setSaving(false); savingRef.current = false; return
      }

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

      const { error: ledErr } = await supabase.from('stock_ledger').insert({
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
        return_type:   type === 'إرجاع' ? (form.return_type || null) : null,
        dispatch_note: noteWithRequester(row.note || ''),
        attachment_url: attachmentUrl,
      })
      if (ledErr) {
        toast.error(`⛔ توقف الحفظ عند "${mat.name}" (قيد الدفتر): ${ledErr.message} — حُفظ ${savedCount} من ${finalRows.length} صنف على الإذن ${voucherNo}`)
        setSaving(false); savingRef.current = false; return
      }
      savedCount++

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

    // ══ تحقق بعدي: المكتوب فعلاً في الدفتر = المطلوب ══
    const expectedLines = type === 'تحويل' ? finalRows.length * 2 : finalRows.length
    const { count: writtenLines } = await supabase.from('stock_ledger')
      .select('*', { count: 'exact', head: true }).eq('txn_number', voucherNo)
    if ((writtenLines ?? 0) !== expectedLines) {
      toast.error(`⚠️ تنبيه مطابقة: الإذن ${voucherNo} فيه ${writtenLines ?? 0} سطر والمتوقع ${expectedLines} — راجع دفتر الحركات فوراً`)
    }

    setSaving(false)
    savingRef.current = false
    toast.success(`${type} تم بنجاح ✅ — إذن ${voucherNo} بعدد ${finalRows.length} صنف`)

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

          {/* طالب الصرف — من فريق المشروع */}
          {isProjectWh && form.project_id && (type === 'صرف' || type === 'استلام') && teamMembers.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                طالب العملية <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text3)' }}>(من الفريق)</span>
              </label>
              <select value={form.requested_by} onChange={e => set('requested_by', e.target.value)} className="select">
                <option value="">— اختياري —</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.name}>
                    {m.name}{m.role_in_team ? ` (${m.role_in_team})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* حجز المواد — إلزامي لعهدة SEC */}
          {isProjectWh && form.project_id && type !== 'تحويل' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                حجز المواد (Booking) <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              {reservations.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#92400e', padding: '8px 10px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  لا حجز مسجّل — أدخل <strong>رقم الحجز</strong> في الحقل أدناه (يُنشأ تلقائياً عند الحفظ)
                </div>
              ) : (
                <select value={form.reservation_id} onChange={e => handleReservationChange(e.target.value)} className="select">
                  <option value="">— أو أدخل رقم الحجز يدوياً —</option>
                  {reservations.map(r => (
                    <option key={r.id} value={r.id}>{r.reservation_no} ({r.status})</option>
                  ))}
                </select>
              )}
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
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم الحجز *</label>
                  <input value={form.booking_no} onChange={e => set('booking_no', e.target.value)} className="input"
                    placeholder="رقم حجز SEC — يكفي للاستلام دون اكتمال التخطيط"
                    dir="ltr" />
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
  const [reservationId,  setReservationId]  = useState('')
  const [bookingNo,      setBookingNo]      = useState('')
  const [reservations,   setReservations]   = useState<Pick<MaterialReservation, 'id' | 'reservation_no' | 'status'>[]>([])

  // ── وضع المودال: مرتجع مصروفات (يرد للعهدة) أو مزال من الموقع (شبكة قديمة/تالف → السكراب) ──
  const [mode,        setMode]        = useState<'مصروفات' | 'مزال'>('مصروفات')
  const [scrapWhId,   setScrapWhId]   = useState('')
  const [removedRows, setRemovedRows] = useState<{ name: string; unit: string; qty: string }[]>([{ name: '', unit: 'قطعة', qty: '' }])
  const scrapWarehouses = warehouses.filter(w => w.wh_category === 'سكراب' || (w.name || '').includes('سكراب'))
  const scrapOptions    = scrapWarehouses.length > 0 ? scrapWarehouses : warehouses

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

  useEffect(() => {
    if (!projectId) { setReservations([]); setReservationId(''); setBookingNo(''); return }
    fetchOpenReservations(tenantId, Number(projectId)).then(({ data }) => setReservations(data || []))
  }, [projectId, tenantId])

  async function handleSave() {
    const validRows = Object.entries(returnQtys).filter(([, qty]) => Number(qty) > 0)
    if (validRows.length === 0) { toast.error('أدخل كمية مرتجعة لمادة واحدة على الأقل'); return }
    if (!projectId) { toast.error('اختر المشروع'); return }

    let resolvedResId = reservationId ? Number(reservationId) : null
    if (!resolvedResId && bookingNo.trim()) {
      const { data: ensured, error: ensureErr } = await ensureReservationByNumber(
        tenantId, Number(projectId), bookingNo.trim(),
      )
      if (ensureErr || !ensured) {
        toast.error(ensureErr?.message || 'تعذّر ربط رقم الحجز')
        return
      }
      resolvedResId = ensured.id
      setReservationId(String(ensured.id))
      setBookingNo(ensured.reservation_no)
    }
    if (!resolvedResId) { toast.error('أدخل رقم الحجز أو اختر حجزاً'); return }

    setSaving(true)

    const wh = warehouses.find(w => w.id === Number(warehouseId))

    // تحقق من الحد الأقصى للإرجاع
    const lines: { material_id: number; qty: number; note?: string }[] = []
    for (const [pmIdStr, qtyStr] of validRows) {
      const qty = Number(qtyStr)
      const pm  = issuedMats.find(m => String(m.id) === pmIdStr)
      if (!pm) continue
      const maxReturn = Number(pm.qty_issued)
      if (qty > maxReturn) {
        toast.error(`لا يمكن إرجاع أكثر من ${maxReturn} ${pm.material?.unit} من "${pm.material?.name}"`)
        setSaving(false); return
      }
      lines.push({ material_id: pm.material_id, qty, note: notes || 'مرتجع موقع' })
    }

    const { data, error } = await submitSiteReturnVoucher(tenantId, branchId, {
      warehouseId: Number(warehouseId),
      whName: wh?.name,
      projectId: Number(projectId),
      projectName,
      reservationId: resolvedResId,
      bookingNo: bookingNo || undefined,
      notes: notes || undefined,
      lines,
    })

    if (error) {
      toast.error(`⛔ فشل الحفظ: ${error.message}`)
      setSaving(false); return
    }

    const voucherNo = data?.voucher_no || ''
    const printRows = lines.map(l => {
      const pm = issuedMats.find(m => m.material_id === l.material_id)
      return { name: pm?.material?.name || '', unit: pm?.material?.unit || '', qty: l.qty, note: notes || '' }
    })

    setSaving(false)
    toast.success(`✅ تم تسجيل المرتجع — ${printRows.length} مادة`)

    printOperationReceipt({
      type: 'مرتجع موقع',
      warehouseName: wh?.name || '',
      projectName,
      date,
      rows: printRows,
      bookingNo: bookingNo || '',
      txnNumber: voucherNo,
    })

    onSave(); onClose()
  }

  // ══ حفظ المزال من الموقع: إدخال حر بكميات إلزامية → مستودع السكراب مباشرة (لا يمس عهدة المشروع) ══
  async function handleSaveRemoved() {
    const rows = removedRows.map(r => ({ ...r, name: r.name.trim(), qty: Number(r.qty) })).filter(r => r.name && r.qty > 0)
    if (rows.length === 0)  { toast.error('أدخل مادة واحدة على الأقل باسم وكمية'); return }
    if (!projectId)         { toast.error('اختر المشروع'); return }
    if (!scrapWhId)         { toast.error('اختر مستودع السكراب'); return }
    setSaving(true)

    const wh = warehouses.find(w => w.id === Number(scrapWhId))
    const { data: voucherNo } = await supabase.rpc('generate_txn_number', { p_type: 'استلام' })
    if (!voucherNo) { toast.error('تعذر توليد رقم الإذن'); setSaving(false); return }

    const printRows: { name: string; unit: string; qty: number; note: string }[] = []
    for (const row of rows) {
      // المادة تدخل رصيد مستودع السكراب (لتُصرف لاحقاً بإذن إرجاع سكراب للعميل)
      const { data: existing } = await supabase.from('materials').select('id, qty')
        .eq('tenant_id', tenantId).eq('warehouse_id', Number(scrapWhId))
        .eq('name', row.name).maybeSingle()

      let qtyBefore = 0
      if (existing) {
        qtyBefore = Number(existing.qty)
        await supabase.from('materials').update({ qty: qtyBefore + row.qty }).eq('id', existing.id)
      } else {
        await supabase.from('materials').insert({
          tenant_id: tenantId, warehouse_id: Number(scrapWhId),
          name: row.name, unit: row.unit, qty: row.qty, reorder: 0, source: 'SEC',
        })
      }

      const { error: ledgerErr } = await supabase.from('stock_ledger').insert({
        tenant_id:         tenantId,
        branch_id:         branchId,
        txn_number:        voucherNo,
        type:              'استلام',
        movement_category: 'مزال_موقع',
        mat_name:          row.name,
        unit:              row.unit,
        qty:               row.qty,
        qty_before:        qtyBefore,
        qty_after:         qtyBefore + row.qty,
        wh_name:           wh?.name || '',
        project_id:        Number(projectId),
        project_name:      projectName,
        dispatch_note:     notes || 'مزال من الموقع',
      })
      if (ledgerErr) { toast.error('خطأ تسجيل الحركة: ' + ledgerErr.message); setSaving(false); return }
      printRows.push({ name: row.name, unit: row.unit, qty: row.qty, note: notes || '' })
    }

    setSaving(false)
    toast.success(`✅ تم تسجيل المزال — ${printRows.length} مادة إلى ${wh?.name || 'السكراب'}`)
    printOperationReceipt({
      type: 'مزال من الموقع',
      warehouseName: wh?.name || '',
      projectName,
      date,
      rows: printRows,
      txnNumber: voucherNo || '',
    })
    onSave(); onClose()
  }

  const totalRemoved = removedRows.reduce((s, r) => s + Number(r.qty || 0), 0)
  const isProjectWh = warehouses.find(w => w.id === Number(warehouseId))
  const totalReturn = Object.values(returnQtys).reduce((s, v) => s + Number(v || 0), 0)

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
          <h3 style={{ fontWeight: 700, color: '#1a56db', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw style={{ width: '18px', height: '18px' }} /> {mode === 'مزال' ? 'مزال من الموقع (سكراب)' : 'مرتجع موقع'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* مبدّل الوضع */}
          <div style={{ display: 'flex', gap: '6px', background: '#f3f4f6', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
            {([['مصروفات', '📦 مرتجع مصروفات'], ['مزال', '🔩 مزال من الموقع']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                  background: mode === m ? (m === 'مزال' ? '#374151' : '#1a56db') : 'transparent',
                  color: mode === m ? 'white' : 'var(--text3)', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'مصروفات' && (<>
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
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
              حجز المواد <span style={{ color: '#c81e1e' }}>*</span>
            </label>
            {reservations.length === 0 ? (
              <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.78rem', color: '#92400e' }}>
                لا توجد حجوزات — أنشئ حجزاً من حجوزات SEC
              </div>
            ) : (
              <select value={reservationId} onChange={e => {
                setReservationId(e.target.value)
                const r = reservations.find(x => String(x.id) === e.target.value)
                setBookingNo(r?.reservation_no || '')
              }} className="select">
                <option value="">— اختر الحجز —</option>
                {reservations.map(r => <option key={r.id} value={r.id}>{r.reservation_no}</option>)}
              </select>
            )}
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

          </>)}

          {mode === 'مزال' && (<>
          <div style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#374151' }}>
            🔩 شبكة قديمة مفكوكة أو مواد تالفة — تدخل مستودع السكراب مباشرة برسم الإرجاع لشركة الكهرباء، ولا تمس عهدة المشروع
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                مستودع السكراب <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <select value={scrapWhId} onChange={e => setScrapWhId(e.target.value)} className="select">
                <option value="">— اختر —</option>
                {scrapOptions.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
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

          {/* بنود المزال — كميات إلزامية */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>المواد المزالة — الاسم والوحدة والكمية:</label>
              {totalRemoved > 0 && (
                <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                  إجمالي المزال: {totalRemoved}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {removedRows.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input value={row.name} onChange={e => setRemovedRows(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                    className="input" placeholder="اسم المادة المزالة (كيبل قديم، محول...)" style={{ flex: 1 }} />
                  <select value={row.unit} onChange={e => setRemovedRows(prev => prev.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))}
                    className="select" style={{ width: '110px' }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" value={row.qty} min="0"
                    onChange={e => setRemovedRows(prev => prev.map((r, j) => j === i ? { ...r, qty: e.target.value } : r))}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    placeholder="الكمية" style={{ width: '90px', padding: '8px', borderRadius: '8px', border: '2px solid #d1d5db', fontSize: '0.875rem', textAlign: 'center', fontWeight: 700 }} dir="ltr" />
                  {removedRows.length > 1 && (
                    <button onClick={() => setRemovedRows(prev => prev.filter((_, j) => j !== i))}
                      style={{ padding: '6px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                      <Trash2 style={{ width: '13px', height: '13px' }} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setRemovedRows(prev => [...prev, { name: '', unit: 'قطعة', qty: '' }])}
                className="btn btn-ghost" style={{ fontSize: '0.78rem', width: 'fit-content' }}>
                <Plus style={{ width: '13px', height: '13px' }} /> إضافة مادة
              </button>
            </div>
          </div>
          </>)}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>ملاحظات</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="input" placeholder={mode === 'مزال' ? 'وصف المزال أو سببه (اختياري)' : 'سبب الإرجاع (اختياري)'} />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={mode === 'مزال' ? handleSaveRemoved : handleSave}
            disabled={saving || (mode === 'مزال' ? totalRemoved === 0 : totalReturn === 0)}
            className="btn btn-primary" style={{ background: mode === 'مزال' ? '#374151' : '#1a56db' }}>
            {saving ? 'جاري الحفظ...'
              : mode === 'مزال' ? `تسجيل المزال${totalRemoved > 0 ? ` (${totalRemoved})` : ''}`
              : `تأكيد المرتجع${totalReturn > 0 ? ` (${totalReturn})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════
// مودال: استعارة بين مشاريع
// صرفٌ بذمّة: مواد تخرج من عهدة المُعير لموقع المستعير — لا يمس المقايسة إطلاقاً
// ══════════════════════════════════════════
export function LoanModal({ tenantId, branchId, projects, onClose, onSave }: {
  tenantId: string; branchId: number
  projects: any[]
  onClose: () => void; onSave: () => void
}) {
  const [saving,        setSaving]        = useState(false)
  const [fromProjectId, setFromProjectId] = useState('')
  const [toProjectId,   setToProjectId]   = useState('')
  const [custody,       setCustody]       = useState<any[]>([])
  const [loanQtys,      setLoanQtys]      = useState<Record<string, string>>({})
  const [date,          setDate]          = useState(new Date().toISOString().split('T')[0])
  const [notes,         setNotes]         = useState('')

  const fromName = projects.find((p: any) => p.id === Number(fromProjectId))?.name || ''
  const toName   = projects.find((p: any) => p.id === Number(toProjectId))?.name || ''

  // عهدة المُعير المتاحة (رصيد > 0) في كل مستودعات المشاريع
  async function loadCustody() {
    if (!fromProjectId) { setCustody([]); return }
    const { data } = await supabase.from('project_materials')
      .select('*, material:materials(id, name, unit, mat_code), warehouse:warehouses(name)')
      .eq('tenant_id', tenantId)
      .eq('project_id', Number(fromProjectId))
      .gt('qty_balance', 0)
    setCustody(data || [])
    setLoanQtys({})
  }
  useEffect(() => { loadCustody() }, [fromProjectId])

  const totalLoan = Object.values(loanQtys).reduce<number>((s, v) => s + Number(v || 0), 0)

  async function handleSave() {
    const validRows = Object.entries(loanQtys).filter(([, q]) => Number(q) > 0)
    if (validRows.length === 0)              { toast.error('أدخل كمية لمادة واحدة على الأقل'); return }
    if (!fromProjectId)                      { toast.error('اختر المشروع المُعير'); return }
    if (!toProjectId)                        { toast.error('اختر المشروع المستعير'); return }
    if (fromProjectId === toProjectId)       { toast.error('لا يمكن الاستعارة من المشروع نفسه'); return }
    setSaving(true)

    const { data: voucherNo } = await supabase.rpc('generate_txn_number', { p_type: 'صرف' })
    if (!voucherNo) { toast.error('تعذر توليد رقم الإذن'); setSaving(false); return }

    const printRows: { name: string; unit: string; qty: number; note: string }[] = []
    for (const [pmIdStr, qtyStr] of validRows) {
      const qty = Number(qtyStr)
      const pm  = custody.find(c => String(c.id) === pmIdStr)
      if (!pm) continue

      if (qty > Number(pm.qty_balance)) {
        toast.error(`رصيد "${pm.material?.name}" في عهدة المُعير: ${pm.qty_balance} فقط`)
        setSaving(false); return
      }

      // المواد تخرج فعلياً من المستودع لموقع المستعير — التحقق من رصيد المستودع
      const { data: mat } = await supabase.from('materials').select('id, qty, name, unit, mat_code')
        .eq('id', pm.material_id).single()
      if (!mat) continue
      const qtyBefore = Number(mat.qty)
      if (qty > qtyBefore) {
        toast.error(`رصيد المستودع من "${mat.name}": ${qtyBefore} فقط`)
        setSaving(false); return
      }
      await supabase.from('materials').update({ qty: qtyBefore - qty }).eq('id', mat.id)

      // سجل الذمّة
      const { data: loan, error: loanErr } = await supabase.from('project_material_loans').insert({
        tenant_id: tenantId,
        from_project_id: Number(fromProjectId), to_project_id: Number(toProjectId),
        material_id: pm.material_id, warehouse_id: pm.warehouse_id,
        qty_loaned: qty, qty_returned: 0, status: 'نشط',
        loan_date: date, notes: notes || null,
      }).select('id').single()
      if (loanErr) { toast.error('خطأ تسجيل الذمّة: ' + loanErr.message); setSaving(false); return }

      // سطر الدفتر: صرف من عهدة المُعير (الـ trigger يزيد qty_issued له فينخفض رصيده)
      const { error: ledgerErr } = await supabase.from('stock_ledger').insert({
        tenant_id: tenantId, branch_id: branchId,
        txn_number: voucherNo,
        type: 'صرف', movement_category: 'صرف_عهدة',
        mat_name: mat.name, mat_code: mat.mat_code || null, unit: mat.unit,
        qty, qty_before: qtyBefore, qty_after: qtyBefore - qty,
        wh_name: pm.warehouse?.name || '',
        project_id: Number(fromProjectId), project_name: fromName,
        is_loan: true, loan_from_project: fromName, loan_to_project: toName,
        loan_id: loan?.id || null,
        dispatch_note: notes || `استعارة لمشروع ${toName}`,
      })
      if (ledgerErr) { toast.error('خطأ تسجيل الحركة: ' + ledgerErr.message); setSaving(false); return }
      printRows.push({ name: mat.name, unit: mat.unit, qty, note: notes || '' })
    }

    setSaving(false)
    toast.success(`🔁 تم تسجيل الاستعارة — ${printRows.length} مادة (ذمّة مفتوحة على ${toName})`)
    printOperationReceipt({
      type: 'استعارة بين مشاريع',
      warehouseName: custody[0]?.warehouse?.name || '',
      projectName: `من: ${fromName} ← إلى: ${toName}`,
      date, rows: printRows,
      txnNumber: voucherNo || '',
    })
    onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#f5f3ff', borderBottom: '2px solid #ddd6fe' }}>
          <h3 style={{ fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeftRight style={{ width: '18px', height: '18px' }} /> استعارة بين مشاريع
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#7c3aed' }}>
            🔁 صرفٌ بذمّة داخلية — لا يمس المقايسة، ويُسوَّى لاحقاً بإعادة الكمية للمُعير. ذمّة مفتوحة = لا إقفال للمشروع
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                المشروع المُعير (صاحب العهدة) <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <select value={fromProjectId} onChange={e => setFromProjectId(e.target.value)} className="select">
                <option value="">— اختر —</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                المشروع المستعير (المستعجل) <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <select value={toProjectId} onChange={e => setToProjectId(e.target.value)} className="select">
                <option value="">— اختر —</option>
                {projects.filter((p: any) => String(p.id) !== fromProjectId).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>التاريخ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" style={{ maxWidth: '200px' }} />
          </div>

          {fromProjectId && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed' }}>عهدة المُعير المتاحة — أدخل الكمية المستعارة:</label>
                {totalLoan > 0 && (
                  <span style={{ background: '#f5f3ff', color: '#7c3aed', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                    إجمالي الاستعارة: {totalLoan}
                  </span>
                )}
              </div>
              {custody.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', color: 'var(--text3)', fontSize: '0.875rem' }}>
                  لا توجد عهدة متاحة لهذا المشروع
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                  {custody.map(pm => (
                    <div key={pm.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px',
                      background: loanQtys[pm.id] && Number(loanQtys[pm.id]) > 0 ? '#f5f3ff' : '#f8fafc',
                      border: `1px solid ${loanQtys[pm.id] && Number(loanQtys[pm.id]) > 0 ? '#ddd6fe' : 'var(--border)'}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pm.material?.name || '—'}</div>
                        <div style={{ fontSize: '0.72rem', marginTop: '2px', display: 'flex', gap: '10px' }}>
                          <span style={{ color: '#0ea77b' }}>الرصيد: <strong>{pm.qty_balance}</strong></span>
                          <span style={{ color: 'var(--text3)' }}>{pm.material?.unit} — {pm.warehouse?.name}</span>
                        </div>
                      </div>
                      <input type="number" value={loanQtys[pm.id] || ''} min="0" max={pm.qty_balance}
                        onChange={e => setLoanQtys(prev => ({ ...prev, [pm.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                        placeholder="0"
                        style={{ width: '75px', padding: '6px 8px', borderRadius: '8px', border: '2px solid #ddd6fe', fontSize: '0.875rem', textAlign: 'center', fontWeight: 700 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>ملاحظات</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="سبب الاستعارة — تصريح بلدية، متابعة... (اختياري)" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || totalLoan === 0}
            className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? 'جاري الحفظ...' : `تسجيل الاستعارة${totalLoan > 0 ? ` (${totalLoan})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// مودال: تسوية استعارة
// سداد داخلي بحت: عهدة المستعير تُسدد للمُعير — بلا حركة مستودع فيزيائية وبلا تعديل مقايسة
// ══════════════════════════════════════════
export function SettleLoanModal({ tenantId, branchId, onClose, onSave }: {
  tenantId: string; branchId: number
  onClose: () => void; onSave: () => void
}) {
  const [saving,     setSaving]     = useState(false)
  const [loans,      setLoans]      = useState<any[]>([])
  const [projNames,  setProjNames]  = useState<Record<number, string>>({})
  const [settleQtys, setSettleQtys] = useState<Record<string, string>>({})
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [loansRes, projRes] = await Promise.all([
      supabase.from('project_material_loans')
        .select('*, material:materials(id, name, unit, mat_code), warehouse:warehouses(name)')
        .eq('tenant_id', tenantId).neq('status', 'مُعاد كلياً').order('loan_date'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenantId),
    ])
    setLoans(loansRes.data || [])
    const map: Record<number, string> = {}
    ;(projRes.data || []).forEach((p: any) => { map[p.id] = p.name })
    setProjNames(map)
    setLoading(false)
  }

  const totalSettle = Object.values(settleQtys).reduce<number>((s, v) => s + Number(v || 0), 0)

  async function handleSave() {
    const validRows = Object.entries(settleQtys).filter(([, q]) => Number(q) > 0)
    if (validRows.length === 0) { toast.error('أدخل كمية تسوية لذمّة واحدة على الأقل'); return }
    setSaving(true)

    const { data: voucherNo } = await supabase.rpc('generate_txn_number', { p_type: 'صرف' })
    if (!voucherNo) { toast.error('تعذر توليد رقم الإذن'); setSaving(false); return }

    const printRows: { name: string; unit: string; qty: number; note: string }[] = []
    for (const [loanId, qtyStr] of validRows) {
      const qty  = Number(qtyStr)
      const loan = loans.find(l => l.id === loanId)
      if (!loan) continue

      const remaining = Number(loan.qty_loaned) - Number(loan.qty_returned)
      if (qty > remaining) {
        toast.error(`المتبقي على ذمّة "${loan.material?.name}": ${remaining} فقط`)
        setSaving(false); return
      }

      const fromName = projNames[loan.from_project_id] || `مشروع ${loan.from_project_id}`
      const toName   = projNames[loan.to_project_id]   || `مشروع ${loan.to_project_id}`

      // شرط السداد: المستعير يجب أن يملك عهدة كافية (استلم مواده من SEC)
      const { data: borrowerPm } = await supabase.from('project_materials')
        .select('qty_balance')
        .eq('tenant_id', tenantId).eq('project_id', loan.to_project_id)
        .eq('material_id', loan.material_id).eq('warehouse_id', loan.warehouse_id)
        .maybeSingle()
      const borrowerBalance = Number(borrowerPm?.qty_balance ?? 0)
      if (qty > borrowerBalance) {
        toast.error(`عهدة "${toName}" من "${loan.material?.name}": ${borrowerBalance} — استلم مواده من SEC أولاً`)
        setSaving(false); return
      }

      // رصيد المستودع الفيزيائي لا يتغير — تسوية ورقية بين عهدتين
      const { data: mat } = await supabase.from('materials').select('qty').eq('id', loan.material_id).single()
      const stockQty = Number(mat?.qty ?? 0)

      // السطر ١: المستعير يسدد (يخرج من عهدته — trigger: qty_issued له +)
      const { error: e1 } = await supabase.from('stock_ledger').insert({
        tenant_id: tenantId, branch_id: branchId,
        txn_number: voucherNo,
        type: 'صرف', movement_category: 'صرف_عهدة',
        mat_name: loan.material?.name || '', mat_code: loan.material?.mat_code || null,
        unit: loan.material?.unit || '', qty,
        qty_before: stockQty, qty_after: stockQty,
        wh_name: loan.warehouse?.name || '',
        project_id: loan.to_project_id, project_name: toName,
        is_loan: true, loan_from_project: fromName, loan_to_project: toName, loan_id: loan.id,
        dispatch_note: `تسوية استعارة — سداد إلى ${fromName}`,
      })
      if (e1) { toast.error('خطأ تسجيل السداد: ' + e1.message); setSaving(false); return }

      // السطر ٢: المُعير يسترد (يعود لعهدته — trigger: qty_issued له −)
      const { error: e2 } = await supabase.from('stock_ledger').insert({
        tenant_id: tenantId, branch_id: branchId,
        txn_number: voucherNo,
        type: 'استلام', movement_category: 'مرتجع_موقع',
        mat_name: loan.material?.name || '', mat_code: loan.material?.mat_code || null,
        unit: loan.material?.unit || '', qty,
        qty_before: stockQty, qty_after: stockQty,
        wh_name: loan.warehouse?.name || '',
        project_id: loan.from_project_id, project_name: fromName,
        is_loan: true, loan_from_project: fromName, loan_to_project: toName, loan_id: loan.id,
        dispatch_note: `تسوية استعارة — استرداد من ${toName}`,
      })
      if (e2) { toast.error('خطأ تسجيل الاسترداد: ' + e2.message); setSaving(false); return }

      // تحديث الذمّة
      const newReturned = Number(loan.qty_returned) + qty
      const fully = newReturned >= Number(loan.qty_loaned)
      await supabase.from('project_material_loans').update({
        qty_returned: newReturned,
        status: fully ? 'مُعاد كلياً' : 'مُعاد جزئياً',
        return_date: fully ? new Date().toISOString().split('T')[0] : null,
      }).eq('id', loan.id)

      printRows.push({ name: loan.material?.name || '', unit: loan.material?.unit || '', qty, note: `${toName} ← ${fromName}` })
    }

    setSaving(false)
    toast.success(`✅ تمت التسوية — ${printRows.length} ذمّة`)
    printOperationReceipt({
      type: 'تسوية استعارة',
      warehouseName: '', projectName: 'تسوية ذمم داخلية',
      date: new Date().toISOString().split('T')[0],
      rows: printRows,
      txnNumber: voucherNo || '',
    })
    onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#ecfdf5', borderBottom: '2px solid #a7f3d0' }}>
          <h3 style={{ fontWeight: 700, color: '#0ea77b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save style={{ width: '18px', height: '18px' }} /> تسوية استعارة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#065f46' }}>
            ✅ سداد داخلي: عهدة المستعير (بعد استلام مواده) تسدد للمُعير — لا حركة مستودع ولا تعديل مقايسة
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div style={{ width: '26px', height: '26px', border: '3px solid var(--border)', borderTopColor: '#0ea77b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : loans.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', color: 'var(--text3)', fontSize: '0.875rem' }}>
              🎉 لا توجد ذمم استعارة مفتوحة
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '380px', overflowY: 'auto' }}>
              {loans.map(loan => {
                const remaining = Number(loan.qty_loaned) - Number(loan.qty_returned)
                const active = Number(settleQtys[loan.id] || 0) > 0
                return (
                  <div key={loan.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px',
                    background: active ? '#ecfdf5' : '#f8fafc',
                    border: `1px solid ${active ? '#a7f3d0' : 'var(--border)'}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{loan.material?.name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#7c3aed', fontWeight: 600 }}>
                          {projNames[loan.from_project_id] || loan.from_project_id} ← {projNames[loan.to_project_id] || loan.to_project_id}
                        </span>
                        <span style={{ color: 'var(--text3)' }}>مستعار: <strong>{loan.qty_loaned}</strong></span>
                        <span style={{ color: '#0ea77b' }}>مُسوّى: <strong>{loan.qty_returned}</strong></span>
                        <span style={{ color: '#c81e1e' }}>متبقٍ: <strong>{remaining}</strong></span>
                        <span style={{ color: 'var(--text3)' }}>{loan.loan_date}</span>
                      </div>
                    </div>
                    <input type="number" value={settleQtys[loan.id] || ''} min="0" max={remaining}
                      onChange={e => setSettleQtys(prev => ({ ...prev, [loan.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                      placeholder={String(remaining)}
                      style={{ width: '75px', padding: '6px 8px', borderRadius: '8px', border: '2px solid #a7f3d0', fontSize: '0.875rem', textAlign: 'center', fontWeight: 700 }} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || totalSettle === 0}
            className="btn btn-primary" style={{ background: '#0ea77b' }}>
            {saving ? 'جاري الحفظ...' : `تأكيد التسوية${totalSettle > 0 ? ` (${totalSettle})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
