'use client'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { Save, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  saveProjectMaterialReservation,
} from '@/lib/project-planning-service'
import { formatSupabaseError } from '@/lib/pmc-service'
import {
  fetchPlanningMaterialsWarehouseStatus,
  type PlanningMaterialsWarehouseSummary,
  type PlanningMaterialAlert,
} from '@/lib/planning-materials-warehouse'
import { fetchOpenReservations } from '@/lib/pmc-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }

export type MaterialsReservationDraft = {
  material_reservation_date: string
  material_reservation_id: string
  material_reservation_number: string
}

export type MaterialsReservationHandle = {
  getDraft: () => MaterialsReservationDraft
  saveReservation: () => Promise<number | null>
}

export const MaterialsReservationBlock = forwardRef<
  MaterialsReservationHandle,
  {
    tenantId: string
    projectId: number
    projectName: string
    clientName?: string
    planning: import('@/lib/project-planning-service').ProjectPlanning | null
    readOnly?: boolean
    hasMaterialLines?: boolean
    onSaved?: () => void
    embedded?: boolean
  }
>(function MaterialsReservationBlock({
  tenantId,
  projectId,
  projectName,
  clientName,
  planning,
  readOnly,
  hasMaterialLines = false,
  onSaved,
  embedded = false,
}, ref) {
  const [saving, setSaving] = useState(false)
  const [loadingWh, setLoadingWh] = useState(false)
  const [warehouse, setWarehouse] = useState<PlanningMaterialsWarehouseSummary | null>(null)
  const [reservations, setReservations] = useState<{ id: number; reservation_no: string }[]>([])
  const [savedNumber, setSavedNumber] = useState(planning?.material_reservation_number || '')
  const [form, setForm] = useState({
    material_reservation_date: planning?.material_reservation_date || '',
    material_reservation_id: planning?.material_reservation_id ? String(planning.material_reservation_id) : '',
    material_reservation_number: planning?.material_reservation_number || '',
  })

  const loadWarehouse = useCallback(async (resNo?: string) => {
    setLoadingWh(true)
    const summary = await fetchPlanningMaterialsWarehouseStatus(
      tenantId,
      projectId,
      planning?.material_reservation_id,
      resNo || form.material_reservation_number,
    )
    setWarehouse(summary)
    setLoadingWh(false)
  }, [tenantId, projectId, planning?.material_reservation_id, form.material_reservation_number])

  useEffect(() => {
    const no = planning?.material_reservation_number || ''
    setSavedNumber(no)
    setForm({
      material_reservation_date: planning?.material_reservation_date || '',
      material_reservation_id: planning?.material_reservation_id ? String(planning.material_reservation_id) : '',
      material_reservation_number: no,
    })
  }, [planning?.id, planning?.updated_at, planning?.material_reservation_number, planning?.material_reservation_id, planning?.material_reservation_date])

  useEffect(() => {
    fetchOpenReservations(tenantId, projectId).then(({ data }) => setReservations(data || []))
  }, [tenantId, projectId])

  useEffect(() => {
    if (form.material_reservation_number.trim()) loadWarehouse(form.material_reservation_number)
  }, [form.material_reservation_number, planning?.updated_at, loadWarehouse])

  async function handleSaveReservation(): Promise<number | null> {
    if (!hasMaterialLines) {
      toast.error('أضف بنود مواد في المقايسة أولاً قبل حفظ رقم الحجز')
      return null
    }
    if (!form.material_reservation_number.trim()) {
      toast.error('رقم الحجز مطلوب للربط مع المخزون')
      return null
    }
    setSaving(true)
    try {
      const resId = await saveProjectMaterialReservation(
        tenantId,
        projectId,
        form.material_reservation_number,
        {
          reservationDate: form.material_reservation_date || null,
          clientName,
          reservationId: form.material_reservation_id ? Number(form.material_reservation_id) : null,
        },
      )
      if (form.material_reservation_id) {
        // keep id
      } else if (resId) {
        setForm(f => ({ ...f, material_reservation_id: String(resId) }))
      }
      setSavedNumber(form.material_reservation_number.trim())
      toast.success('تم حفظ بيانات الحجز ✅')
      onSaved?.()
      await loadWarehouse(form.material_reservation_number)
      return resId
    } catch (e: unknown) {
      toast.error(formatSupabaseError(e, 'فشل حفظ الحجز'))
      throw e
    } finally {
      setSaving(false)
    }
  }

  useImperativeHandle(ref, () => ({
    getDraft: () => ({ ...form }),
    saveReservation: handleSaveReservation,
  }), [form, tenantId, projectId, clientName, hasMaterialLines])

  const matRows = warehouse?.rows.filter(r => r.qty_planned > 0 || r.qty_received > 0) || []
  const isDirty = form.material_reservation_number.trim() !== (savedNumber || '').trim()
    || (form.material_reservation_date || '') !== (planning?.material_reservation_date || '')

  const alertLabel = (alert: PlanningMaterialAlert) => {
    if (alert === 'not_in_plan') return 'غير موجود بالمقايسة'
    if (alert === 'over_received') return 'استلام زائد'
    if (alert === 'under_received') return 'لم يُستلم بعد'
    if (alert === 'none') return 'مطابق'
    return '—'
  }
  const alertColor = (alert: PlanningMaterialAlert) => {
    if (alert === 'not_in_plan') return { bg: '#fef2f2', color: '#c81e1e' }
    if (alert === 'over_received') return { bg: '#fffbeb', color: '#e6820a' }
    if (alert === 'under_received') return { bg: '#f8fafc', color: '#64748b' }
    return { bg: '#ecfdf5', color: '#0ea77b' }
  }

  return (
    <div style={embedded
      ? { padding: '12px 16px', background: '#faf5ff', borderBottom: '1px solid #c7d2fe' }
      : { marginTop: '24px', padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ fontWeight: 700, fontSize: embedded ? '0.8rem' : '0.875rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#4338ca', marginBottom: '12px' }}>
          <Package style={{ width: '16px', height: '16px' }} /> حجز المواد (SEC)
      </div>
      {!hasMaterialLines ? (
        <div style={{
          fontSize: '0.78rem', color: '#4338ca', marginBottom: '12px', padding: '12px 14px',
          background: '#eef2ff', borderRadius: '10px', border: '1px solid #c7d2fe',
        }}>
          <strong>لم تضف مواد بعد.</strong> أضف بنود المواد في الجدول أعلاه أولاً، ثم أدخل رقم الحجز — لا يُحفظ الحجز بدون مواد.
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 10px' }}>
            أدخل رقم الحجز من SEC — يُحفظ مع <strong>حفظ المقايسة</strong> أو عبر زر «حفظ الحجز».
          </p>
          {isDirty && form.material_reservation_number.trim() && (
            <div style={{ fontSize: '0.72rem', color: '#92400e', marginBottom: '10px', padding: '8px 10px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
              ⚠ رقم الحجز لم يُحفظ بعد — اضغط «حفظ الحجز» أو «حفظ المقايسة»
            </div>
          )}
          {savedNumber && !isDirty && (
            <div style={{ fontSize: '0.72rem', color: '#0ea77b', marginBottom: '10px', padding: '8px 10px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #86efac' }}>
              ✓ الحجز محفوظ: <strong dir="ltr">{savedNumber}</strong>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={lbl}>تاريخ الحجز</label>
              <input type="date" value={form.material_reservation_date} onChange={e => setForm(f => ({ ...f, material_reservation_date: e.target.value }))} className="input" disabled={readOnly} dir="ltr" />
            </div>
            <div>
              <label style={lbl}>رقم الحجز *</label>
              <input value={form.material_reservation_number} onChange={e => setForm(f => ({ ...f, material_reservation_number: e.target.value }))} className="input" placeholder="SEC booking #" dir="ltr" disabled={readOnly} />
            </div>
            {reservations.length > 0 && (
              <div>
                <label style={lbl}>ربط حجز</label>
                <select value={form.material_reservation_id} onChange={e => {
                  const res = reservations.find(r => r.id === Number(e.target.value))
                  setForm(f => ({ ...f, material_reservation_id: e.target.value, material_reservation_number: res?.reservation_no || f.material_reservation_number }))
                }} className="input" disabled={readOnly}>
                  <option value="">—</option>
                  {reservations.map(r => <option key={r.id} value={r.id}>{r.reservation_no}</option>)}
                </select>
              </div>
            )}
          </div>
          {!readOnly && (
            <button onClick={() => void handleSaveReservation()} disabled={saving} className="btn btn-ghost" style={{ fontSize: '0.78rem', border: '1px solid #c7d2fe', color: '#4338ca', marginBottom: '12px' }}>
              <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ الحجز'}
            </button>
          )}
        </>
      )}
      {loadingWh ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>جاري تحميل حالة المخزون...</div>
      ) : warehouse?.has_planning_drift ? (
        <div style={{
          marginBottom: '10px', padding: '10px 12px', borderRadius: '8px',
          background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.75rem', color: '#92400e',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}>
          <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong>تنبيه فجوة مقايسة:</strong> {warehouse.planning_drift_summary}
            <div style={{ marginTop: '4px', opacity: 0.9 }}>يُنصح بتعديل المقايسة لتطابق ما استُلم فعلياً في المخزون.</div>
          </div>
        </div>
      ) : null}
      {loadingWh ? null : matRows.length > 0 ? (
        <div style={{ overflow: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#eef2ff' }}>
                {['المادة', 'مخطط', 'مستلم', 'مصروف', 'متبقي', 'الحالة'].map(h => (
                  <th key={h} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#4338ca' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matRows.map(r => {
                const style = alertColor(r.planning_alert)
                const rowBg = r.is_unplanned ? '#fef2f2' : r.is_over_received ? '#fffbeb' : undefined
                return (
                  <tr key={r.key} style={{ borderTop: '1px solid #e2e8f0', background: rowBg }}>
                    <td style={{ padding: '8px' }}>{r.description}</td>
                    <td style={{ padding: '8px', color: r.qty_planned <= 0 ? '#94a3b8' : undefined }} dir="ltr">
                      {r.qty_planned > 0 ? r.qty_planned : '—'}
                    </td>
                    <td style={{ padding: '8px', fontWeight: r.qty_received > 0 ? 700 : 400 }} dir="ltr">{r.qty_received}</td>
                    <td style={{ padding: '8px' }} dir="ltr">{r.qty_issued}</td>
                    <td style={{ padding: '8px', fontWeight: 700, color: r.qty_remaining > 0 ? '#e6820a' : '#0ea77b' }} dir="ltr">
                      {r.qty_planned > 0 ? r.qty_remaining : '—'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
                        fontSize: '0.68rem', fontWeight: 700, background: style.bg, color: style.color,
                      }}>
                        {alertLabel(r.planning_alert)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : hasMaterialLines && form.material_reservation_number.trim() ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text3)', margin: 0 }}>لا حركات مخزنية بعد — بنود المواد في المقايسة أعلاه</p>
      ) : null}
    </div>
  )
})

export default function BoqReservationPanel(props: React.ComponentProps<typeof MaterialsReservationBlock>) {
  return <MaterialsReservationBlock {...props} />
}
