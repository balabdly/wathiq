'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Save, Package, Warehouse } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  updateProjectPlanning,
  notifyWarehouseMaterialPickup,
  type MaterialAvailability,
} from '@/lib/project-planning-service'
import {
  fetchPlanningMaterialsWarehouseStatus,
  resolveMaterialReservationId,
  type PlanningMaterialsWarehouseSummary,
} from '@/lib/planning-materials-warehouse'
import { fetchOpenReservations, ensureReservationByNumber } from '@/lib/pmc-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }

const AVAILABILITY_OPTIONS: { value: MaterialAvailability; label: string }[] = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'available', label: 'متوفرة' },
  { value: 'not_available', label: 'غير متوفرة' },
]

export function MaterialsReservationBlock({
  tenantId,
  projectId,
  projectName,
  clientName,
  planning,
  readOnly,
  onSaved,
  embedded = false,
}: {
  tenantId: string
  projectId: number
  projectName: string
  clientName?: string
  planning: import('@/lib/project-planning-service').ProjectPlanning | null
  readOnly?: boolean
  onSaved?: () => void
  embedded?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [loadingWh, setLoadingWh] = useState(false)
  const [warehouse, setWarehouse] = useState<PlanningMaterialsWarehouseSummary | null>(null)
  const [reservations, setReservations] = useState<{ id: number; reservation_no: string }[]>([])
  const [form, setForm] = useState({
    material_reservation_date: planning?.material_reservation_date || '',
    material_reservation_id: planning?.material_reservation_id ? String(planning.material_reservation_id) : '',
    material_reservation_number: planning?.material_reservation_number || '',
    material_availability: (planning?.material_availability || 'pending') as MaterialAvailability,
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
    if (!planning) return
    setForm({
      material_reservation_date: planning.material_reservation_date || '',
      material_reservation_id: planning.material_reservation_id ? String(planning.material_reservation_id) : '',
      material_reservation_number: planning.material_reservation_number || '',
      material_availability: (planning.material_availability || 'pending') as MaterialAvailability,
    })
  }, [planning?.id, planning?.updated_at])

  useEffect(() => {
    fetchOpenReservations(tenantId, projectId).then(({ data }) => setReservations(data || []))
  }, [tenantId, projectId])

  useEffect(() => {
    if (form.material_reservation_number.trim()) loadWarehouse(form.material_reservation_number)
  }, [form.material_reservation_number, planning?.updated_at, loadWarehouse])

  async function handleSaveReservation() {
    if (!form.material_reservation_number.trim()) {
      toast.error('رقم الحجز مطلوب للربط مع المخزون')
      return
    }
    setSaving(true)
    try {
      let resId = form.material_reservation_id ? Number(form.material_reservation_id) : null
      if (!resId) {
        const found = await resolveMaterialReservationId(tenantId, projectId, form.material_reservation_number.trim())
        if (found) resId = found
        else {
          const { data: ensured, error } = await ensureReservationByNumber(
            tenantId, projectId, form.material_reservation_number.trim(), clientName,
          )
          if (error || !ensured) throw new Error(error?.message || 'تعذّر إنشاء الحجز')
          resId = ensured.id
        }
      }

      const wasAvailable = planning?.material_availability === 'available'
      const nowAvailable = form.material_availability === 'available'

      await updateProjectPlanning(tenantId, projectId, {
        material_reservation_date: form.material_reservation_date || null,
        material_reservation_number: form.material_reservation_number.trim(),
        material_reservation_id: resId,
        material_availability: form.material_availability,
        material_receipt_type: warehouse?.receipt_type === 'none' ? 'full' : warehouse?.receipt_type,
      })

      if (nowAvailable && !wasAvailable && !planning?.material_pickup_notified_at) {
        await notifyWarehouseMaterialPickup(tenantId, projectId, projectName, form.material_reservation_number.trim())
        await updateProjectPlanning(tenantId, projectId, { material_pickup_notified_at: new Date().toISOString() })
      }

      toast.success('تم حفظ بيانات الحجز ✅')
      onSaved?.()
      await loadWarehouse(form.material_reservation_number)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    }
    setSaving(false)
  }

  const matRows = warehouse?.rows.filter(r => r.qty_planned > 0) || []

  return (
    <div style={embedded
      ? { padding: '12px 16px', background: '#faf5ff', borderBottom: '1px solid #c7d2fe' }
      : { marginTop: '24px', padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: embedded ? '0.8rem' : '0.875rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#4338ca' }}>
          <Package style={{ width: '16px', height: '16px' }} /> حجز المواد (SEC)
        </div>
        <Link href="/inventory/pmc" className="btn btn-ghost" style={{ fontSize: '0.72rem' }}>
          <Warehouse style={{ width: '13px', height: '13px' }} /> المخزون
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={lbl}>تاريخ الحجز</label>
          <input type="date" value={form.material_reservation_date} onChange={e => setForm(f => ({ ...f, material_reservation_date: e.target.value }))} className="input" disabled={readOnly} dir="ltr" />
        </div>
        <div>
          <label style={lbl}>رقم الحجز *</label>
          <input value={form.material_reservation_number} onChange={e => setForm(f => ({ ...f, material_reservation_number: e.target.value }))} className="input" placeholder="SEC booking #" dir="ltr" disabled={readOnly} />
        </div>
        <div>
          <label style={lbl}>توفر المواد</label>
          <select value={form.material_availability} onChange={e => setForm(f => ({ ...f, material_availability: e.target.value as MaterialAvailability }))} className="input" disabled={readOnly}>
            {AVAILABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
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
        <button onClick={handleSaveReservation} disabled={saving} className="btn btn-ghost" style={{ fontSize: '0.78rem', border: '1px solid #c7d2fe', color: '#4338ca', marginBottom: '12px' }}>
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ الحجز'}
        </button>
      )}
      {loadingWh ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>جاري تحميل حالة المخزون...</div>
      ) : matRows.length > 0 ? (
        <div style={{ overflow: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#eef2ff' }}>
                {['المادة', 'محجوز', 'مستلم', 'مصروف', 'متبقي'].map(h => (
                  <th key={h} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#4338ca' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matRows.map(r => (
                <tr key={r.key} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px' }}>{r.description}</td>
                  <td style={{ padding: '8px' }} dir="ltr">{r.qty_planned}</td>
                  <td style={{ padding: '8px' }} dir="ltr">{r.qty_received}</td>
                  <td style={{ padding: '8px' }} dir="ltr">{r.qty_issued}</td>
                  <td style={{ padding: '8px', fontWeight: 700, color: r.qty_remaining > 0 ? '#e6820a' : '#0ea77b' }} dir="ltr">{r.qty_remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : form.material_reservation_number.trim() ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text3)', margin: 0 }}>لا حركات مخزنية بعد — بنود المواد في المقايسة أعلاه</p>
      ) : null}
    </div>
  )
}

export default function BoqReservationPanel(props: Parameters<typeof MaterialsReservationBlock>[0]) {
  return <MaterialsReservationBlock {...props} />
}
