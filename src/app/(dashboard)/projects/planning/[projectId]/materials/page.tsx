'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Save, Package, Truck, Upload, Paperclip, AlertTriangle, CalendarClock, RefreshCw, Warehouse, Plus, Trash2, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectPlanning } from '../ProjectPlanningContext'
import {
  updateProjectPlanning,
  uploadPlanningFile,
  notifyWarehouseMaterialPickup,
  type MaterialAvailability,
} from '@/lib/project-planning-service'
import {
  fetchPlanningMaterialsWarehouseStatus,
  resolveMaterialReservationId,
  getPlanningMaterialsFileUrl,
  type PlanningMaterialsWarehouseSummary,
} from '@/lib/planning-materials-warehouse'
import { fetchOpenReservations, ensureReservationByNumber } from '@/lib/pmc-service'
import { RESERVATION_STATUS_LABELS } from '@/lib/pmc-types'
import {
  fetchPlanningMaterialLines,
  savePlanningMaterialLines,
  parseMaterialsSpreadsheet,
  type PlanningMaterialLine,
} from '@/lib/planning-material-lines-service'

const UNITS = ['قطعة', 'متر', 'كجم', 'لتر', 'علبة', 'رول', 'طن', 'م²', 'م³', 'كيس']

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

const AVAILABILITY_OPTIONS: { value: MaterialAvailability; label: string; color: string }[] = [
  { value: 'pending', label: 'قيد الانتظار', color: '#9ca3af' },
  { value: 'available', label: 'متوفرة — جاهزة للاستلام', color: '#0ea77b' },
  { value: 'not_available', label: 'غير متوفرة', color: '#c81e1e' },
]

const CLIENT_DELAY_REASON = 'تأخر تنفيذ المشروع — استلام جزئي للمواد / تأخر صرف المواد (مسؤولية العميل — ليس المقاول)'

const STATUS_COLORS = { complete: '#0ea77b', partial: '#e6820a', pending: '#9ca3af' }
const STATUS_LABELS = { complete: 'مكتمل', partial: 'جزئي', pending: 'لم يُستلم' }

export default function MaterialsTabPage() {
  const { tenantId, projectId, project, planning, reload, readOnly } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loadingWh, setLoadingWh] = useState(false)
  const [reservations, setReservations] = useState<{ id: number; reservation_no: string; status: string }[]>([])
  const [warehouse, setWarehouse] = useState<PlanningMaterialsWarehouseSummary | null>(null)
  const [materialsFileUrl, setMaterialsFileUrl] = useState<string | null>(null)
  const [matLines, setMatLines] = useState<PlanningMaterialLine[]>([])
  const [form, setForm] = useState({
    material_reservation_date: planning?.material_reservation_date || '',
    material_reservation_id: planning?.material_reservation_id ? String(planning.material_reservation_id) : '',
    material_reservation_number: planning?.material_reservation_number || '',
    material_availability: (planning?.material_availability || 'pending') as MaterialAvailability,
    material_receipt_notes: planning?.material_receipt_notes || '',
    material_delay_client_caused: planning?.material_delay_client_caused ?? false,
    material_delay_revised_end: planning?.material_delay_revised_end || '',
  })
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const isPartial = warehouse?.receipt_type === 'partial'
  const isFull = warehouse?.receipt_type === 'full'
  const hasWarehouse = !!warehouse?.reservation_id && (warehouse.rows.length > 0 || warehouse.totals.received > 0)

  const loadWarehouse = useCallback(async (resId?: string, resNo?: string) => {
    if (!tenantId || !projectId) return
    setLoadingWh(true)
    const summary = await fetchPlanningMaterialsWarehouseStatus(
      tenantId,
      projectId,
      resId ? Number(resId) : planning?.material_reservation_id,
      resNo || form.material_reservation_number,
    )
    setWarehouse(summary)
    setLoadingWh(false)
  }, [tenantId, projectId, planning?.material_reservation_id])

  useEffect(() => {
    if (!planning) return
    setForm({
      material_reservation_date: planning.material_reservation_date || '',
      material_reservation_id: planning.material_reservation_id ? String(planning.material_reservation_id) : '',
      material_reservation_number: planning.material_reservation_number || '',
      material_availability: (planning.material_availability || 'pending') as MaterialAvailability,
      material_receipt_notes: planning.material_receipt_notes || '',
      material_delay_client_caused: planning.material_delay_client_caused ?? false,
      material_delay_revised_end: planning.material_delay_revised_end || '',
    })
  }, [planning?.id, planning?.updated_at])

  useEffect(() => {
    if (!tenantId) return
    fetchOpenReservations(tenantId, projectId).then(({ data }) => setReservations(data || []))
  }, [tenantId, projectId])

  useEffect(() => {
    if (!tenantId || !projectId) return
    fetchPlanningMaterialLines(tenantId, projectId).then(({ data }) => {
      setMatLines(data?.length ? data : [{ project_id: projectId, description: '', unit: 'قطعة', qty_planned: 0 }])
    })
  }, [tenantId, projectId, planning?.updated_at])

  useEffect(() => {
    if (warehouse?.receipt_type === 'partial' && warehouse.pending_summary && !planning?.material_receipt_notes) {
      setForm(f => ({ ...f, material_receipt_notes: warehouse.pending_summary }))
    }
  }, [warehouse?.pending_summary, warehouse?.receipt_type, planning?.material_receipt_notes])

  useEffect(() => {
    if (form.material_reservation_id || form.material_reservation_number) {
      loadWarehouse(form.material_reservation_id, form.material_reservation_number)
    }
  }, [form.material_reservation_id, form.material_reservation_number, planning?.updated_at, loadWarehouse])

  useEffect(() => {
    if (!planning?.materials_list_file_path) {
      setMaterialsFileUrl(null)
      return
    }
    getPlanningMaterialsFileUrl(planning.materials_list_file_path).then(setMaterialsFileUrl)
  }, [planning?.materials_list_file_path])

  function selectReservation(id: string) {
    const res = reservations.find(r => r.id === Number(id))
    setForm(f => ({
      ...f,
      material_reservation_id: id,
      material_reservation_number: res?.reservation_no || f.material_reservation_number,
    }))
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const { path, name } = await uploadPlanningFile(tenantId, projectId, file, 'materials_list')
      await updateProjectPlanning(tenantId, projectId, {
        materials_list_file_path: path,
        materials_list_file_name: name,
      })
      await reload()
      toast.success('تم رفع قائمة المواد ✅')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
    }
    setUploading(false)
  }

  function addMatLine() {
    setMatLines(lines => [...lines, { project_id: projectId, description: '', unit: 'قطعة', qty_planned: 0 }])
  }

  function updateMatLine(idx: number, patch: Partial<PlanningMaterialLine>) {
    setMatLines(lines => lines.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  function removeMatLine(idx: number) {
    setMatLines(lines => lines.length <= 1 ? lines : lines.filter((_, i) => i !== idx))
  }

  async function handleImportExcel(file: File) {
    setImporting(true)
    try {
      const parsed = await parseMaterialsSpreadsheet(file)
      if (!parsed.length) {
        toast.error('لم تُعثر على بنود صالحة — تأكد من أعمدة: المادة، الكمية، الوحدة')
        return
      }
      setMatLines(parsed.map(l => ({ ...l, project_id: projectId })))
      toast.success(`تم استيراد ${parsed.length} بند`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الاستيراد')
    }
    setImporting(false)
  }

  async function handleSave() {
    if (!form.material_reservation_number.trim()) {
      toast.error('رقم الحجز مطلوب — يكفي للاستلام في المخزون حتى لو الخطة غير مكتملة')
      return
    }
    if (isPartial && !form.material_receipt_notes.trim()) {
      toast.error('وضّح المواد المتبقية (تُعبّأ تلقائياً من المخزون — راجعها)')
      return
    }
    if (isPartial && form.material_delay_client_caused && !form.material_delay_revised_end) {
      toast.error('حدّد تاريخ النهاية المعدّل للمشروع بسبب تأخر المواد')
      return
    }

    setSaving(true)
    try {
      const wasAvailable = planning?.material_availability === 'available'
      const nowAvailable = form.material_availability === 'available'
      const alreadyNotified = !!planning?.material_pickup_notified_at

      let resId = form.material_reservation_id ? Number(form.material_reservation_id) : null
      if (!resId) {
        const found = await resolveMaterialReservationId(tenantId, projectId, form.material_reservation_number.trim())
        if (found) resId = found
        else {
          const { data: ensured, error: ensureErr } = await ensureReservationByNumber(
            tenantId,
            projectId,
            form.material_reservation_number.trim(),
            project.client_name,
          )
          if (ensureErr || !ensured) throw new Error(ensureErr?.message || 'تعذّر إنشاء الحجز')
          resId = ensured.id
        }
      }

      const validLines = matLines.filter(l => l.description.trim() && Number(l.qty_planned) > 0)
      if (validLines.length && !readOnly) {
        await savePlanningMaterialLines(tenantId, projectId, validLines)
      }

      const payload: Record<string, unknown> = {
        material_reservation_date: form.material_reservation_date || null,
        material_reservation_number: form.material_reservation_number.trim(),
        material_reservation_id: resId,
        material_availability: form.material_availability,
        material_receipt_type: warehouse?.receipt_type === 'none' ? 'full' : warehouse?.receipt_type,
        material_receipt_notes: isPartial ? form.material_receipt_notes.trim() : null,
        material_delay_client_caused: isPartial ? form.material_delay_client_caused : false,
        material_delay_revised_end: isPartial && form.material_delay_revised_end ? form.material_delay_revised_end : null,
      }

      if (isPartial && form.material_delay_client_caused && form.material_delay_revised_end) {
        payload.timeline_revised_end = form.material_delay_revised_end
        payload.timeline_revision_reason = CLIENT_DELAY_REASON
      }

      await updateProjectPlanning(tenantId, projectId, payload)

      if (nowAvailable && !wasAvailable && !alreadyNotified) {
        const receiptLabel = isPartial ? ' (استلام جزئي)' : ''
        await notifyWarehouseMaterialPickup(
          tenantId, projectId, project.name,
          `${form.material_reservation_number.trim()}${receiptLabel}`,
        )
        await updateProjectPlanning(tenantId, projectId, {
          material_pickup_notified_at: new Date().toISOString(),
        })
        toast.success('تم الحفظ وإرسال إشعار للمخزون ✅')
      } else {
        toast.success('تم الحفظ ✅')
      }

      await reload()
      await loadWarehouse(String(resId || ''), form.material_reservation_number)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في الحفظ')
    }
    setSaving(false)
  }

  const avail = AVAILABILITY_OPTIONS.find(o => o.value === form.material_availability)
  const reservedRows = warehouse?.rows.filter(r => r.qty_planned > 0) || []
  const hasIssued = (warehouse?.totals.issued || 0) > 0

  function fmtQty(n: number, unit: string) {
    return n > 0 ? `${n.toLocaleString('ar-SA')} ${unit}` : '—'
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package style={{ width: '17px', height: '17px', color: '#6366f1' }} /> خطة حجز المواد
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '6px', lineHeight: 1.6, maxWidth: '580px' }}>
            تاريخ الحجز + رقم الحجز + قائمة المواد — ثم متابعة <strong>محجوز / مصروف / متبقي</strong> من المخزون بعد الاستلام والصرف.
          </p>
        </div>
        <Link href="/inventory/pmc" className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
          <Warehouse style={{ width: '14px', height: '14px' }} /> حجوزات SEC / المخزون
        </Link>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '12px', color: '#334155' }}>📋 بيانات الحجز</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={lbl}>تاريخ الحجز <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(اختياري)</span></label>
            <input type="date" value={form.material_reservation_date} onChange={e => set('material_reservation_date', e.target.value)} className="input" disabled={readOnly} />
          </div>
          <div>
            <label style={lbl}>رقم الحجز *</label>
            <input value={form.material_reservation_number} onChange={e => set('material_reservation_number', e.target.value)} className="input" placeholder="رقم حجز SEC — يكفي للمخzون" dir="ltr" disabled={readOnly} />
          </div>
          <div>
            <label style={lbl}>ربط بحجز المخزون</label>
            {reservations.length > 0 ? (
              <select value={form.material_reservation_id} onChange={e => selectReservation(e.target.value)} className="select">
                <option value="">— اختر —</option>
                {reservations.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.reservation_no} ({RESERVATION_STATUS_LABELS[r.status as keyof typeof RESERVATION_STATUS_LABELS] || r.status})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#92400e', padding: '8px 0' }}>
                يُنشأ الحجز تلقائياً عند الحفظ برقم الحجز أعلاه
              </div>
            )}
          </div>
        </div>
        <div>
          <label style={lbl}>المواد المحجوزة — مرفق (Excel / PDF / صورة)</label>
          <p style={{ fontSize: '0.72rem', color: 'var(--text3)', margin: '0 0 8px' }}>
            ارفع قائمة المواد من SEC — أو أدخل/استورد البنود في الجدول أدناه (أو BOQ من PMC).
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="btn btn-ghost" style={{ cursor: uploading ? 'wait' : 'pointer', margin: 0 }}>
              <Upload style={{ width: '14px', height: '14px' }} /> {uploading ? 'جاري الرفع...' : 'رفع الملف'}
              <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" hidden disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
            </label>
            {planning?.materials_list_file_name && (
              <span style={{ fontSize: '0.78rem', color: '#1a56db', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Paperclip style={{ width: '13px', height: '13px' }} />
                {materialsFileUrl ? (
                  <a href={materialsFileUrl} target="_blank" rel="noopener noreferrer">{planning.materials_list_file_name}</a>
                ) : planning.materials_list_file_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {warehouse?.has_boq_lines && reservedRows.length > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e40af', marginBottom: '10px' }}>📦 المواد المحجوزة (من BOQ — PMC)</div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', background: 'white', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#dbeafe' }}>
                  {['المادة', 'الوحدة', 'محجوز'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservedRows.map(r => (
                  <tr key={`res-${r.key}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.description}</td>
                    <td style={{ padding: '8px 10px' }}>{r.unit}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1a56db' }}>{fmtQty(r.qty_planned, r.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ background: '#f5f3ff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Warehouse style={{ width: '16px', height: '16px' }} />
            متابعة الصرف — محجوز / مصروف / متبقي
            {warehouse?.reservation_status && (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, background: 'white', padding: '2px 8px', borderRadius: '6px', color: '#6366f1' }}>
                {RESERVATION_STATUS_LABELS[warehouse.reservation_status as keyof typeof RESERVATION_STATUS_LABELS] || warehouse.reservation_status}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => loadWarehouse(form.material_reservation_id, form.material_reservation_number)}
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            disabled={loadingWh}
          >
            <RefreshCw style={{ width: '13px', height: '13px' }} /> {loadingWh ? 'جاري التحديث...' : 'تحديث'}
          </button>
        </div>

        {warehouse?.reservation_id && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '0.82rem' }}>
            <span><strong style={{ color: '#1a56db' }}>{warehouse.totals.planned.toLocaleString('ar-SA')}</strong> <span style={{ color: 'var(--text3)' }}>محجوز</span></span>
            <span><strong style={{ color: '#e6820a' }}>{warehouse.totals.issued.toLocaleString('ar-SA')}</strong> <span style={{ color: 'var(--text3)' }}>مصروف</span></span>
            <span><strong style={{ color: '#c81e1e' }}>{warehouse.totals.remaining_issue.toLocaleString('ar-SA')}</strong> <span style={{ color: 'var(--text3)' }}>متبقي صرف</span></span>
            <span><strong style={{ color: '#0ea77b' }}>{warehouse.totals.received.toLocaleString('ar-SA')}</strong> <span style={{ color: 'var(--text3)' }}>مستلم</span></span>
            <span><strong>{warehouse.totals.on_hand.toLocaleString('ar-SA')}</strong> <span style={{ color: 'var(--text3)' }}>بالعهدة</span></span>
            <span style={{
              marginRight: 'auto', fontWeight: 700, padding: '2px 10px', borderRadius: '6px', fontSize: '0.78rem',
              background: isFull ? '#ecfdf5' : isPartial ? '#fffbeb' : '#f3f4f6',
              color: isFull ? '#0ea77b' : isPartial ? '#e6820a' : '#9ca3af',
            }}>
              {isFull ? '✓ استلام كلي' : isPartial ? '⚠ استلام جزئي' : hasWarehouse ? 'لم يُستلم بعد' : '—'}
            </span>
          </div>
        )}

        {loadingWh ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: '0.82rem' }}>جاري تحميل بيانات المخزون...</div>
        ) : !warehouse?.reservation_id ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text3)', padding: '8px 0' }}>
            اختر حجزاً أو أدخل رقم حجز — بعد الاستلام والصرف في المخزون يظهر جدول محجوز / مصروف / متبقي.
          </div>
        ) : warehouse.rows.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
            الحجز مربوط — لا حركات بعد. سجّل الاستلام من{' '}
            <Link href="/inventory/materials/receive" style={{ color: '#1a56db' }}>المخزون → استلام</Link>
            {' '}والصرف من{' '}
            <Link href="/inventory/materials/issue" style={{ color: '#1a56db' }}>المخزون → صرف</Link>.
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', background: 'white', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#eef2ff' }}>
                  {['المادة', 'محجوز', 'مصروف', 'متبقي', 'مستلم', 'بالعهدة', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#4338ca', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warehouse.rows.map(r => (
                  <tr key={r.key} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.description}</td>
                    <td style={{ padding: '8px 10px', color: '#1a56db', fontWeight: 600 }}>{fmtQty(r.qty_planned, r.unit)}</td>
                    <td style={{ padding: '8px 10px', color: '#e6820a', fontWeight: 600 }}>{r.qty_issued > 0 ? fmtQty(r.qty_issued, r.unit) : '—'}</td>
                    <td style={{ padding: '8px 10px', color: r.qty_remaining_issue > 0 ? '#c81e1e' : 'var(--text3)', fontWeight: r.qty_remaining_issue > 0 ? 700 : 400 }}>
                      {r.qty_planned > 0 ? fmtQty(r.qty_remaining_issue, r.unit) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#0ea77b' }}>{r.qty_received > 0 ? fmtQty(r.qty_received, r.unit) : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.qty_on_hand > 0 ? fmtQty(r.qty_on_hand, r.unit) : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: STATUS_COLORS[r.line_status] }}>
                        {STATUS_LABELS[r.line_status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {hasIssued && (
                <tfoot>
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #c7d2fe' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>الإجمالي</td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: '#1a56db' }}>{warehouse.totals.planned.toLocaleString('ar-SA')}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: '#e6820a' }}>{warehouse.totals.issued.toLocaleString('ar-SA')}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: '#c81e1e' }}>{warehouse.totals.remaining_issue.toLocaleString('ar-SA')}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0ea77b' }}>{warehouse.totals.received.toLocaleString('ar-SA')}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>{warehouse.totals.on_hand.toLocaleString('ar-SA')}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '16px', maxWidth: '360px' }}>
        <label style={lbl}>توفر المواد (لإشعار المخزون)</label>
        <select value={form.material_availability} onChange={e => set('material_availability', e.target.value)} className="select">
          {AVAILABILITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isPartial && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#92400e', fontWeight: 700, fontSize: '0.85rem' }}>
            <AlertTriangle style={{ width: '16px', height: '16px' }} /> استلام جزئي (من المخزون) — تأثير على الجدول الزمني
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>المواد المتأخرة / المتبقية</label>
            <textarea
              value={form.material_receipt_notes}
              onChange={e => set('material_receipt_notes', e.target.value)}
              className="input"
              rows={3}
              placeholder="تُعبّأ تلقائياً من المخزون — يمكنك التعديل"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
            <input type="checkbox" checked={form.material_delay_client_caused}
              onChange={e => set('material_delay_client_caused', e.target.checked)}
              style={{ width: '17px', height: '17px', marginTop: '2px' }} />
            <span style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
              <strong>التأخير بسبب العميل</strong> — تأخر صرف المواد من SEC وليس المقاول.
            </span>
          </label>
          {form.material_delay_client_caused && (
            <div>
              <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarClock style={{ width: '15px', height: '15px' }} /> تاريخ النهاية المعدّل *
              </label>
              <input type="date" value={form.material_delay_revised_end}
                onChange={e => set('material_delay_revised_end', e.target.value)} className="input" style={{ maxWidth: '220px' }} />
            </div>
          )}
        </div>
      )}

      {form.material_availability === 'available' && (
        <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#065f46', display: 'flex', gap: '10px' }}>
          <Truck style={{ width: '18px', height: '18px', flexShrink: 0 }} />
          <div>
            <strong>عند الحفظ:</strong> إشعار للمخzون لإرسال الشاحنة{isPartial ? ' (استلام جزئي)' : ''}.
            {planning?.material_pickup_notified_at && <div style={{ marginTop: '4px', fontSize: '0.75rem' }}>✓ تم الإشعار سابقاً</div>}
          </div>
        </div>
      )}

      {avail && form.material_availability !== 'available' && !isPartial && (
        <div style={{ padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.82rem', background: '#f3f4f6', color: avail.color, fontWeight: 600 }}>
          الحالة: {avail.label}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving || uploading} className="btn btn-primary" style={{ background: '#6366f1' }}>
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  )
}
