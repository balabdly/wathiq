'use client'
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, MapPin } from 'lucide-react'
import { zonesApi } from '@/lib/db'
import toast from 'react-hot-toast'

export interface WarehouseZone {
  id: number
  tenant_id: string
  branch_id: number
  warehouse_id: number
  name: string
  zone_type: 'عام'|'جديد'|'مرتجعات'|'تخلص'|'صيانة'|'حجز'|'أخرى'
  color: string | null
  notes: string | null
}

const ZONE_TYPES = [
  { v: 'جديد',     l: '🆕 ساحة الجديد',     c: '#10b981' },
  { v: 'مرتجعات',  l: '↩️ ساحة المرتجعات',  c: '#f59e0b' },
  { v: 'تخلص',     l: '🗑️ ساحة التخلص',    c: '#ef4444' },
  { v: 'صيانة',    l: '🔧 ساحة الصيانة',    c: '#3b82f6' },
  { v: 'حجز',      l: '🔒 ساحة الحجز',      c: '#8b5cf6' },
  { v: 'عام',      l: '📦 عام',             c: '#64748b' },
  { v: 'أخرى',     l: '✦ أخرى',             c: '#475569' },
] as const

export function WarehouseZonesPanel({
  warehouseId, tenantId, branchId, canEdit,
}: {
  warehouseId: number
  tenantId: string
  branchId: number
  canEdit: boolean
}) {
  const [zones, setZones] = useState<WarehouseZone[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<WarehouseZone | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { load() }, [warehouseId])

  async function load() {
    setLoading(true)
    const { data, error } = await zonesApi.list(warehouseId)
    if (error) toast.error('تعذّر تحميل الأقسام')
    setZones((data as WarehouseZone[]) || [])
    setLoading(false)
  }

  async function handleDelete(z: WarehouseZone) {
    if (!confirm(`حذف القسم "${z.name}"؟ المواد لن تُحذف لكن ستُلغى من القسم.`)) return
    const { error } = await zonesApi.delete(z.id)
    if (error) { toast.error('فشل الحذف'); return }
    toast.success('تم حذف القسم')
    load()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary-500" />
          أقسام / ساحات المستودع
          <span className="text-xs text-gray-400 font-normal">({zones.length})</span>
        </h3>
        {canEdit && (
          <button
            onClick={() => { setEditing(null); setShowModal(true) }}
            className="btn btn-primary btn-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> قسم جديد
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-3">جارٍ التحميل…</div>
      ) : zones.length === 0 ? (
        <div className="text-sm text-gray-400 py-3">
          لا توجد أقسام بعد. أضف ساحة التخلص، المرتجعات، الجديد، الصيانة، الحجز…
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {zones.map(z => {
            const meta = ZONE_TYPES.find(t => t.v === z.zone_type)
            const color = z.color || meta?.c || '#64748b'
            return (
              <div key={z.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 hover:shadow-sm transition">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{z.name}</div>
                    <div className="text-[10px] text-gray-400">{meta?.l || z.zone_type}</div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(z); setShowModal(true) }}
                      className="p-1 hover:bg-gray-100 rounded">
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(z)}
                      className="p-1 hover:bg-red-50 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <ZoneModal
          zone={editing}
          warehouseId={warehouseId}
          tenantId={tenantId}
          branchId={branchId}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function ZoneModal({
  zone, warehouseId, tenantId, branchId, onClose, onSaved,
}: {
  zone: WarehouseZone | null
  warehouseId: number
  tenantId: string
  branchId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: zone?.name || '',
    zone_type: (zone?.zone_type || 'جديد') as WarehouseZone['zone_type'],
    notes: zone?.notes || '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const meta = ZONE_TYPES.find(t => t.v === form.zone_type)
    const color = meta?.c || '#64748b'
    if (zone) {
      const { error } = await zonesApi.update(zone.id, { name: form.name, zone_type: form.zone_type, color, notes: form.notes })
      if (error) { toast.error('فشل الحفظ'); setSaving(false); return }
      toast.success('تم التعديل ✅')
    } else {
      const { error } = await zonesApi.create({
        tenant_id: tenantId, branch_id: branchId, warehouse_id: warehouseId,
        name: form.name, zone_type: form.zone_type, color, notes: form.notes || undefined,
      })
      if (error) {
        toast.error(error.code === '23505' ? 'يوجد قسم بنفس الاسم' : 'فشل الإضافة')
        setSaving(false); return
      }
      toast.success('تمت الإضافة ✅')
    }
    setSaving(false); onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{zone ? 'تعديل قسم' : 'إضافة قسم جديد'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                اسم القسم <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input"
                placeholder="مثال: ساحة التخلص — جهة B"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع القسم</label>
              <div className="grid grid-cols-2 gap-2">
                {ZONE_TYPES.map(t => (
                  <button key={t.v} type="button"
                    onClick={() => setForm(f => ({ ...f, zone_type: t.v as WarehouseZone['zone_type'] }))}
                    className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      form.zone_type === t.v
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-500'
                    }`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات (اختياري)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="input min-h-[60px]"
                placeholder="وصف القسم، حدوده، تعليمات…"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {zone ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
