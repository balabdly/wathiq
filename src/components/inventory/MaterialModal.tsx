// src/components/inventory/MaterialModal.tsx
'use client'
import { useEffect, useState } from 'react'
import { X, Save } from 'lucide-react'
import type { InventoryMaterial, InventoryWarehouse } from './types'

const UNITS = ['قطعة','متر','كجم','لتر','علبة','رول','طن','م²','م³']

export default function MaterialModal({ mat, warehouses, onClose, onSave }: {
  mat: InventoryMaterial | null
  warehouses: InventoryWarehouse[]
  onClose: () => void
  onSave: (d: Partial<InventoryMaterial>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    catalog_no:   mat?.catalog_no   || '',
    sec_number:   mat?.sec_number   || '',
    sku:          mat?.sku          || '',
    name:         mat?.name         || '',
    unit:         mat?.unit         || 'قطعة',
    qty:          mat?.qty          ?? 0,
    reorder:      mat?.reorder      ?? 5,
    warehouse_id: mat?.warehouse_id || warehouses[0]?.id || 0,
    source:       mat?.source       || 'كهرباء' as 'كهرباء' | 'خاص',
    notes:        mat?.notes        || '',
    location:     (mat as any)?.location || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.catalog_no.trim()) return
    import('react-hot-toast').then(({ default: toast }) => {
      if (form.source === 'كهرباء' && !form.sec_number.trim()) {
        toast.error('SEC Number إلزامي لمواد الكهرباء'); return
      }
    })
    setSaving(true)
    await onSave({
      ...(mat ? { id: mat.id } : {}),
      catalog_no: form.catalog_no, sec_number: form.sec_number || undefined,
      sku: form.sku || undefined, name: form.name, unit: form.unit,
      qty: Number(form.qty), reorder: Number(form.reorder),
      warehouse_id: Number(form.warehouse_id), source: form.source,
      notes: form.notes || undefined,
      location: form.location || undefined,
    } as any)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{mat ? 'تعديل مادة' : 'إضافة مادة جديدة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* المصدر */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">مصدر المادة</label>
              <div className="flex gap-2">
                {(['كهرباء', 'خاص'] as const).map(s => (
                  <button key={s} type="button" onClick={() => set('source', s)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.source === s
                        ? s === 'كهرباء' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-500'}`}>
                    {s === 'كهرباء' ? '⚡ مواد كهرباء' : '🏢 مواد خاصة'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الكتالوج <span className="text-red-500">*</span></label>
                <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  SEC Number {form.source === 'كهرباء' && <span className="text-red-500">*</span>}
                </label>
                <input value={form.sec_number} onChange={e => set('sec_number', e.target.value)} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المادة <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الوحدة</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم SKU</label>
                <input value={form.sku} onChange={e => set('sku', e.target.value)} className="input" placeholder="اختياري" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية الابتدائية</label>
                <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} className="input" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">حد الأمان</label>
                <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)} className="input" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المستودع</label>
                <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع الداخلي</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="مثال: رف A3" />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {mat ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
