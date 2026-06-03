// src/components/inventory/TransferModal.tsx
'use client'
import { useState } from 'react'
import { ArrowLeftRight, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import MaterialSearchInput from './MaterialSearchInput'
import type { InventoryMaterial, InventoryWarehouse } from './types'
import { WH_TYPES } from './types'

export default function TransferModal({ materials, warehouses, onClose, onSave }: {
  materials: InventoryMaterial[]
  warehouses: InventoryWarehouse[]
  onClose: () => void
  onSave: (rows: { mat: InventoryMaterial; qty: number }[], toWhId: number, toWhName: string) => Promise<void>
}) {
  const [saving, setSaving]   = useState(false)
  const [toWhId, setToWh]     = useState<number | ''>(warehouses[0]?.id || '')
  const [rows, setRows] = useState<{ id: number; mat: InventoryMaterial | null; qty: number }[]>([
    { id: 1, mat: null, qty: 1 }
  ])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!toWhId) { toast.error('اختر المستودع المستقبل'); return }
    const valid = rows.filter(r => r.mat && r.qty > 0)
    if (valid.length === 0) { toast.error('أضف مادة واحدة على الأقل'); return }
    setSaving(true)
    const toWh = warehouses.find(w => w.id === Number(toWhId))
    await onSave(valid as any, Number(toWhId), toWh?.name || '')
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-500" /> تحويل مواد لمستودع آخر
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المستودع المستقبل <span className="text-red-500">*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {warehouses.map(wh => {
                  const wt = WH_TYPES.find(t => t.type === (wh as any).wh_type)
                  const selected = toWhId === wh.id
                  return (
                    <button key={wh.id} type="button" onClick={() => setToWh(wh.id)}
                      style={{ padding: '10px 12px', borderRadius: '10px', border: '2px solid', cursor: 'pointer', textAlign: 'right',
                        borderColor: selected ? (wt?.color || '#1a56db') : 'var(--border)',
                        background: selected ? (wt?.color || '#1a56db') + '15' : 'white' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selected ? (wt?.color || '#1a56db') : 'var(--text2)' }}>
                        {wt?.icon || '🏭'} {wh.name}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المواد المحوَّلة</label>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={row.id} className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-6 h-9 flex items-center justify-center text-xs text-gray-400">{i + 1}</div>
                    <div className="flex-1">
                      <MaterialSearchInput materials={materials} value={row.mat?.name || ''}
                        onChange={(name, unit, matId) => {
                          const m = materials.find(x => x.id === matId)
                          setRows(r => r.map(x => x.id === row.id ? { ...x, mat: m || null } : x))
                        }} />
                    </div>
                    <input type="number" value={row.qty} min="1" max={row.mat?.qty}
                      onChange={e => setRows(r => r.map(x => x.id === row.id ? { ...x, qty: Number(e.target.value) } : x))}
                      className="w-20 input text-sm text-center flex-shrink-0" />
                    {row.mat && <span className="h-9 flex items-center text-xs text-gray-500 flex-shrink-0">{row.mat.unit}</span>}
                    {rows.length > 1 && (
                      <button type="button" onClick={() => setRows(r => r.filter(x => x.id !== row.id))}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button"
                onClick={() => setRows(r => [...r, { id: Date.now(), mat: null, qty: 1 }])}
                className="mt-2 btn btn-ghost btn-sm w-full border border-dashed border-gray-300">
                <Plus className="w-3.5 h-3.5" /> إضافة مادة
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
              تأكيد التحويل
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
