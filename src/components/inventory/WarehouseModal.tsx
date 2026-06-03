// src/components/inventory/WarehouseModal.tsx
'use client'
import { useState } from 'react'
import { X, Save, Plus } from 'lucide-react'
import type { InventoryWarehouse } from './types'
import { WH_TYPES } from './types'

export default function WarehouseModal({ warehouse, onClose, onSave }: {
  warehouse?: InventoryWarehouse
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:      warehouse?.name       || '',
    wh_type:   (warehouse as any)?.wh_type || '',
    location:  warehouse?.location   || '',
  })
  const [sections, setSections] = useState<string[]>((warehouse as any)?.sections || [])
  const [newSection, setNewSection] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function addSection() {
    const s = newSection.trim()
    if (!s || sections.includes(s)) return
    setSections(prev => [...prev, s])
    setNewSection('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      ...(warehouse ? { id: warehouse.id } : {}),
      name: form.name,
      wh_type: form.wh_type || undefined,
      location: form.location || undefined,
      sections: sections.length > 0 ? sections : [],
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{warehouse ? 'تعديل مستودع' : 'إضافة مستودع'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستودع <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="المدينة، الحي" />
            </div>

            {/* الأقسام الداخلية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                الأقسام الداخلية
                <span className="text-xs text-gray-400 font-normal mr-2">مثال: ساحة السكراب، رف الكابلات</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input value={newSection} onChange={e => setNewSection(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSection() } }}
                  className="input flex-1" placeholder="أدخل اسم القسم ثم اضغط إضافة" />
                <button type="button" onClick={addSection} className="btn btn-ghost btn-sm border border-gray-200">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {sections.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {sections.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '4px 10px', fontSize: '0.82rem', color: '#1a56db' }}>
                      <span>📦 {s}</span>
                      <button type="button" onClick={() => setSections(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', display: 'flex', alignItems: 'center' }}>
                        <X style={{ width: '12px', height: '12px' }} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '8px', fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center' }}>
                  لا توجد أقسام — يمكنك إضافة أقسام داخلية للمستودع
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {warehouse ? 'حفظ التعديلات' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
