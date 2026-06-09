'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import type { InventoryMaterial, InventoryWarehouse } from './types'

const UNITS = ['قطعة', 'متر', 'كجم', 'لتر', 'علبة', 'رول', 'طن', 'م²', 'م³', 'كيس', 'برميل', 'أمبير', 'متر كيبل']

export default function MaterialModal({ mat, warehouses, onClose, onSave }: {
  mat:        InventoryMaterial | null
  warehouses: InventoryWarehouse[]
  onClose:    () => void
  onSave:     (d: Partial<InventoryMaterial>) => Promise<void>
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
    source:       (mat?.source      || 'كهرباء') as 'كهرباء' | 'خاص',
    notes:        mat?.notes        || '',
    location:     (mat as any)?.location || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // ✅ التحقق الصحيح — متزامن
    if (!form.name.trim())       { toast.error('اسم المادة مطلوب');      return }
    if (!form.catalog_no.trim()) { toast.error('رقم الكتالوج مطلوب');    return }
    if (!form.warehouse_id)      { toast.error('اختر المستودع');         return }
    if (form.source === 'كهرباء' && !form.sec_number.trim()) {
      toast.error('SEC Number إلزامي لمواد الكهرباء'); return
    }

    setSaving(true)
    await onSave({
      ...(mat ? { id: mat.id } : {}),
      catalog_no:   form.catalog_no.trim(),
      sec_number:   form.sec_number.trim() || undefined,
      sku:          form.sku.trim()        || undefined,
      name:         form.name.trim(),
      unit:         form.unit,
      qty:          Number(form.qty),
      reorder:      Number(form.reorder),
      warehouse_id: Number(form.warehouse_id),
      source:       form.source,
      notes:        form.notes.trim() || undefined,
      location:     form.location.trim() || undefined,
    } as any)
    setSaving(false)
  }

  const lbl = 'block text-sm font-medium text-gray-700 mb-1.5'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">
            {mat ? '✏️ تعديل مادة' : '➕ إضافة مادة جديدة'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* المصدر */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['كهرباء', 'خاص'] as const).map(src => (
                <button key={src} type="button" onClick={() => set('source', src)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                    borderColor: form.source === src ? (src === 'كهرباء' ? '#1a56db' : '#0ea77b') : 'var(--border)',
                    background:  form.source === src ? (src === 'كهرباء' ? '#eff6ff' : '#ecfdf5') : 'white',
                    color:       form.source === src ? (src === 'كهرباء' ? '#1a56db' : '#0ea77b') : 'var(--text3)',
                  }}>
                  {src === 'كهرباء' ? '⚡ مواد كهرباء (SEC)' : '🏪 مواد خاصة'}
                </button>
              ))}
            </div>

            {/* رقم الكتالوج + SEC */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className={lbl}>
                  رقم الكتالوج <span className="text-red-500">*</span>
                </label>
                <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" dir="ltr" placeholder="CAT-001" required />
              </div>
              <div>
                <label className={lbl}>
                  SEC Number {form.source === 'كهرباء' && <span className="text-red-500">*</span>}
                </label>
                <input value={form.sec_number} onChange={e => set('sec_number', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" dir="ltr"
                  placeholder={form.source === 'كهرباء' ? 'إلزامي لمواد SEC' : 'اختياري'}
                  style={{ borderColor: form.source === 'كهرباء' && !form.sec_number ? '#fca5a5' : undefined }} />
              </div>
            </div>

            {/* اسم المادة */}
            <div>
              <label className={lbl}>اسم المادة <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                className="input" placeholder="وصف تفصيلي للمادة" required />
            </div>

            {/* الوحدة + SKU */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className={lbl}>الوحدة</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>رقم SKU</label>
                <input value={form.sku} onChange={e => set('sku', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" dir="ltr" placeholder="اختياري" />
              </div>
            </div>

            {/* الكمية + حد الأمان */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className={lbl}>الكمية الابتدائية</label>
                <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" min="0" dir="ltr" />
              </div>
              <div>
                <label className={lbl}>حد الأمان (إعادة الطلب)</label>
                <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" min="0" dir="ltr" />
              </div>
            </div>

            {/* المستودع + الموقع */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className={lbl}>المستودع <span className="text-red-500">*</span></label>
                {warehouses.length === 0 ? (
                  <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.8rem', color: '#c81e1e', border: '1px solid #fecaca' }}>
                    ⚠️ لا توجد مستودعات
                  </div>
                ) : (
                  <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
                    <option value="">— اختر المستودع —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className={lbl}>الموقع الداخلي</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" placeholder="مثال: رف A-3" />
              </div>
            </div>

            {/* ملاحظات */}
            <div>
              <label className={lbl}>ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="input" style={{ minHeight: '60px', resize: 'none' }} />
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Save className="w-4 h-4" />}
              {mat ? 'حفظ التعديل' : 'إضافة المادة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
