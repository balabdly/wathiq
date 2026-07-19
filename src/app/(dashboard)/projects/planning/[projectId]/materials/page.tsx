'use client'
import { useEffect, useState } from 'react'
import { Save, Package, Truck, Upload, Paperclip, AlertTriangle, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectPlanning } from '../ProjectPlanningContext'
import {
  updateProjectPlanning,
  uploadPlanningFile,
  notifyWarehouseMaterialPickup,
  type MaterialAvailability,
  type MaterialReceiptType,
} from '@/lib/project-planning-service'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

const AVAILABILITY_OPTIONS: { value: MaterialAvailability; label: string; color: string }[] = [
  { value: 'pending', label: 'قيد الانتظار', color: '#9ca3af' },
  { value: 'available', label: 'متوفرة — جاهزة للاستلام', color: '#0ea77b' },
  { value: 'not_available', label: 'غير متوفرة', color: '#c81e1e' },
]

const CLIENT_DELAY_REASON = 'تأخر تنفيذ المشروع — استلام جزئي للمواد / تأخر صرف المواد (مسؤولية العميل — ليس المقاول)'

export default function MaterialsTabPage() {
  const { tenantId, projectId, project, planning, reload } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    material_reservation_date: planning?.material_reservation_date || '',
    material_reservation_number: planning?.material_reservation_number || '',
    material_availability: (planning?.material_availability || 'pending') as MaterialAvailability,
    material_receipt_type: (planning?.material_receipt_type || 'full') as MaterialReceiptType,
    material_receipt_notes: planning?.material_receipt_notes || '',
    material_delay_client_caused: planning?.material_delay_client_caused ?? false,
    material_delay_revised_end: planning?.material_delay_revised_end || '',
  })
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!planning) return
    setForm({
      material_reservation_date: planning.material_reservation_date || '',
      material_reservation_number: planning.material_reservation_number || '',
      material_availability: (planning.material_availability || 'pending') as MaterialAvailability,
      material_receipt_type: (planning.material_receipt_type || 'full') as MaterialReceiptType,
      material_receipt_notes: planning.material_receipt_notes || '',
      material_delay_client_caused: planning.material_delay_client_caused ?? false,
      material_delay_revised_end: planning.material_delay_revised_end || '',
    })
  }, [planning?.id, planning?.updated_at])

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

  async function handleSave() {
    if (!form.material_reservation_date) { toast.error('تاريخ حجز المواد مطلوب'); return }
    if (!form.material_reservation_number.trim()) { toast.error('رقم الحجز مطلوب'); return }
    if (form.material_receipt_type === 'partial' && !form.material_receipt_notes.trim()) {
      toast.error('وضّح المواد غير المستلمة أو المتأخرة عند الاستلام الجزئي')
      return
    }
    if (form.material_receipt_type === 'partial' && form.material_delay_client_caused && !form.material_delay_revised_end) {
      toast.error('حدّد تاريخ النهاية المعدّل للمشروع بسبب تأخر المواد')
      return
    }

    setSaving(true)
    try {
      const wasAvailable = planning?.material_availability === 'available'
      const nowAvailable = form.material_availability === 'available'
      const alreadyNotified = !!planning?.material_pickup_notified_at

      const payload: Record<string, unknown> = {
        material_reservation_date: form.material_reservation_date,
        material_reservation_number: form.material_reservation_number.trim(),
        material_availability: form.material_availability,
        material_receipt_type: form.material_receipt_type,
        material_receipt_notes: form.material_receipt_notes.trim() || null,
        material_delay_client_caused: form.material_receipt_type === 'partial' ? form.material_delay_client_caused : false,
        material_delay_revised_end: form.material_receipt_type === 'partial' && form.material_delay_revised_end
          ? form.material_delay_revised_end : null,
      }

      if (form.material_receipt_type === 'partial' && form.material_delay_client_caused && form.material_delay_revised_end) {
        payload.timeline_revised_end = form.material_delay_revised_end
        payload.timeline_revision_reason = CLIENT_DELAY_REASON
      }

      await updateProjectPlanning(tenantId, projectId, payload)

      if (nowAvailable && !wasAvailable && !alreadyNotified) {
        const receiptLabel = form.material_receipt_type === 'partial' ? ' (استلام جزئي)' : ''
        await notifyWarehouseMaterialPickup(
          tenantId,
          projectId,
          project.name,
          `${form.material_reservation_number.trim()}${receiptLabel}`,
        )
        await updateProjectPlanning(tenantId, projectId, {
          material_pickup_notified_at: new Date().toISOString(),
        })
        toast.success('تم الحفظ وإرسال إشعار للمخزون ✅')
      } else if (form.material_receipt_type === 'partial' && form.material_delay_client_caused && form.material_delay_revised_end) {
        toast.success('تم الحفظ — وُثّق التأخير بمسؤولية العميل وحدّثت الخطة الزمنية ✅')
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
  const isPartial = form.material_receipt_type === 'partial'

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Package style={{ width: '17px', height: '17px', color: '#6366f1' }} /> خطة استلام المواد
      </h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '16px', lineHeight: 1.6 }}>
        أول خطوة في التخطيط — حجز واستلام المواد قبل تصريح البلدية. يمكن رفع قائمة المواد (Excel / PDF / صورة).
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
        <label style={lbl}>قائمة المواد (Excel / PDF / صورة)</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="btn btn-ghost" style={{ cursor: uploading ? 'wait' : 'pointer', margin: 0 }}>
            <Upload style={{ width: '14px', height: '14px' }} /> {uploading ? 'جاري الرفع...' : 'رفع الملف'}
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,image/*"
              hidden
              disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}
            />
          </label>
          {planning?.materials_list_file_name && (
            <span style={{ fontSize: '0.78rem', color: '#1a56db', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Paperclip style={{ width: '13px', height: '13px' }} /> {planning.materials_list_file_name}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div>
          <label style={lbl}>توفر المواد</label>
          <select value={form.material_availability} onChange={e => set('material_availability', e.target.value)} className="select">
            {AVAILABILITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>نوع الاستلام</label>
          <select value={form.material_receipt_type} onChange={e => set('material_receipt_type', e.target.value)} className="select">
            <option value="full">استلام كلي — جميع المواد</option>
            <option value="partial">استلام جزئي — جزء من المواد</option>
          </select>
        </div>
      </div>

      {isPartial && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#92400e', fontWeight: 700, fontSize: '0.85rem' }}>
            <AlertTriangle style={{ width: '16px', height: '16px' }} /> استلام جزئي — تأثير على الجدول الزمني
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>المواد المتأخرة / غير المستلمة *</label>
            <textarea
              value={form.material_receipt_notes}
              onChange={e => set('material_receipt_notes', e.target.value)}
              className="input"
              rows={3}
              placeholder="مثال: كابلات 4×240mm² لم تُصرف — باقي المواد مستلمة..."
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={form.material_delay_client_caused}
              onChange={e => set('material_delay_client_caused', e.target.checked)}
              style={{ width: '17px', height: '17px', marginTop: '2px' }}
            />
            <span style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
              <strong>التأخير بسبب العميل</strong> — تأخر صرف المواد من الجهة المالكة / SEC وليس بسبب المقاول.
              يُستخدم لتبرير تمديد مدة المشروع.
            </span>
          </label>
          {form.material_delay_client_caused && (
            <div>
              <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarClock style={{ width: '15px', height: '15px' }} /> تاريخ النهاية المعدّل للمشروع *
              </label>
              <input
                type="date"
                value={form.material_delay_revised_end}
                onChange={e => set('material_delay_revised_end', e.target.value)}
                className="input"
                style={{ maxWidth: '220px' }}
              />
              <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '8px', lineHeight: 1.5 }}>
                عند الحفظ يُحدَّث تبويب <strong>الخطة الزمنية</strong> تلقائياً بسبب: «{CLIENT_DELAY_REASON}»
              </p>
            </div>
          )}
        </div>
      )}

      {form.material_availability === 'available' && (
        <div style={{
          background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '10px',
          padding: '12px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#065f46',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <Truck style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>عند الحفظ:</strong> يُرسل إشعار لفريق المخزون لترتيب شاحنة الاستلام
            {isPartial ? ' (استلام جزئي)' : ''}.
            {planning?.material_pickup_notified_at && (
              <div style={{ marginTop: '6px', color: '#047857', fontSize: '0.75rem' }}>✓ تم إرسال الإشعار سابقاً</div>
            )}
          </div>
        </div>
      )}

      {avail && form.material_availability !== 'available' && !isPartial && (
        <div style={{
          padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.82rem',
          background: form.material_availability === 'not_available' ? '#fef2f2' : '#f3f4f6',
          color: avail.color, fontWeight: 600,
        }}>
          الحالة: {avail.label}
        </div>
      )}

      {planning?.timeline_revision_reason === CLIENT_DELAY_REASON && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '0.78rem', color: '#1e40af' }}>
          ✓ التأخير موثّق في الخطة الزمنية — مسؤولية العميل
          {planning.timeline_revised_end && (
            <span> — النهاية المعدّلة: {planning.timeline_revised_end}</span>
          )}
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
