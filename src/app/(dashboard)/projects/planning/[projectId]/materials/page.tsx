'use client'
import { useEffect, useState } from 'react'
import { Save, Package, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectPlanning } from '../ProjectPlanningContext'
import {
  updateProjectPlanning,
  notifyWarehouseMaterialPickup,
  type MaterialAvailability,
} from '@/lib/project-planning-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

const AVAILABILITY_OPTIONS: { value: MaterialAvailability; label: string; color: string }[] = [
  { value: 'pending', label: 'قيد الانتظار', color: '#9ca3af' },
  { value: 'available', label: 'متوفرة — جاهزة للاستلام', color: '#0ea77b' },
  { value: 'not_available', label: 'غير متوفرة', color: '#c81e1e' },
]

export default function MaterialsTabPage() {
  const { tenantId, projectId, project, planning, reload } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    material_reservation_date: planning?.material_reservation_date || '',
    material_reservation_number: planning?.material_reservation_number || '',
    material_availability: (planning?.material_availability || 'pending') as MaterialAvailability,
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!planning) return
    setForm({
      material_reservation_date: planning.material_reservation_date || '',
      material_reservation_number: planning.material_reservation_number || '',
      material_availability: (planning.material_availability || 'pending') as MaterialAvailability,
    })
  }, [planning?.id, planning?.updated_at])

  async function handleSave() {
    if (!form.material_reservation_date) { toast.error('تاريخ حجز المواد مطلوب'); return }
    if (!form.material_reservation_number.trim()) { toast.error('رقم الحجز مطلوب'); return }

    setSaving(true)
    try {
      const wasAvailable = planning?.material_availability === 'available'
      const nowAvailable = form.material_availability === 'available'
      const alreadyNotified = !!planning?.material_pickup_notified_at

      await updateProjectPlanning(tenantId, projectId, {
        material_reservation_date: form.material_reservation_date,
        material_reservation_number: form.material_reservation_number.trim(),
        material_availability: form.material_availability,
      })

      if (nowAvailable && !wasAvailable && !alreadyNotified) {
        await notifyWarehouseMaterialPickup(
          tenantId,
          projectId,
          project.name,
          form.material_reservation_number.trim(),
        )
        await updateProjectPlanning(tenantId, projectId, {
          material_pickup_notified_at: new Date().toISOString(),
        })
        toast.success('تم الحفظ وإرسال إشعار للمخزون لإرسال الشاحنة ✅')
      } else if (nowAvailable && alreadyNotified) {
        toast.success('تم الحفظ ✅ — سبق إشعار المخزون')
      } else {
        toast.success('تم الحفظ ✅')
      }

      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في الحفظ')
    }
    setSaving(false)
  }

  const avail = AVAILABILITY_OPTIONS.find(o => o.value === form.material_availability)

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Package style={{ width: '17px', height: '17px', color: '#6366f1' }} /> خطة استلام المواد
      </h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '16px', lineHeight: 1.6 }}>
        أول خطوة في التخطيط — حجز المواد قبل تصريح البلدية. عند توفر المواد يُرسل إشعار تلقائي لفريق المخزون لإرسال شاحنة الاستلام.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div>
          <label style={lbl}>تاريخ حجز المواد *</label>
          <input type="date" value={form.material_reservation_date} onChange={e => set('material_reservation_date', e.target.value)} className="input" />
        </div>
        <div>
          <label style={lbl}>رقم الحجز *</label>
          <input value={form.material_reservation_number} onChange={e => set('material_reservation_number', e.target.value)} className="input" placeholder="مثال: BK-2026-0142" dir="ltr" />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={lbl}>توفر المواد</label>
        <select value={form.material_availability} onChange={e => set('material_availability', e.target.value)} className="select">
          {AVAILABILITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {form.material_availability === 'available' && (
        <div style={{
          background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '10px',
          padding: '12px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#065f46',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <Truck style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>عند الحفظ:</strong> يُرسل إشعار لفريق المخزون (<code style={{ fontSize: '0.75rem' }}>inventory</code>) لترتيب شاحنة استلام المواد للمشروع.
            {planning?.material_pickup_notified_at && (
              <div style={{ marginTop: '6px', color: '#047857', fontSize: '0.75rem' }}>
                ✓ تم إرسال الإشعار سابقاً
              </div>
            )}
          </div>
        </div>
      )}

      {avail && form.material_availability !== 'available' && (
        <div style={{
          padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.82rem',
          background: form.material_availability === 'not_available' ? '#fef2f2' : '#f3f4f6',
          color: avail.color, fontWeight: 600,
        }}>
          الحالة: {avail.label}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#6366f1' }}>
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  )
}
