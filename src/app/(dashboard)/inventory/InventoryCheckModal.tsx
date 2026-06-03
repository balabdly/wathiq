// src/components/inventory/InventoryCheckModal.tsx
'use client'
import { useState } from 'react'
import { ClipboardCheck, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { InventoryMaterial } from './types'

export default function InventoryCheckModal({ materials, onClose, onSave }: {
  materials: InventoryMaterial[]
  onClose: () => void
  onSave: (items: { matId: number; matName: string; systemQty: number; actualQty: number; unit: string }[]) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState(
    materials.map(m => ({ matId: m.id, matName: m.name, systemQty: m.qty, actualQty: m.qty, unit: m.unit }))
  )

  const changed = items.filter(i => i.actualQty !== i.systemQty).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(items)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-orange-500" /> جرد المستودع
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">أدخل الكمية الفعلية لكل مادة</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {changed > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', fontSize: '0.875rem', color: '#92400e' }}>
                <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                يوجد {changed} مادة فيها فارق
              </div>
            )}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    {['المادة','في النظام','الكمية الفعلية','الفارق','الوحدة'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '0.75rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const diff = item.actualQty - item.systemQty
                    return (
                      <tr key={item.matId} style={{ borderTop: '1px solid #f3f4f6', background: diff !== 0 ? '#fffbeb' : 'transparent' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{item.matName}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#3b82f6', fontWeight: 700 }}>{item.systemQty}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <input type="number" min="0" value={item.actualQty}
                            onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, actualQty: Number(e.target.value) } : x))}
                            style={{ width: '80px', padding: '5px 8px', border: `1px solid ${diff !== 0 ? '#fcd34d' : '#e5e7eb'}`, borderRadius: '6px', textAlign: 'center', fontSize: '0.875rem' }} />
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {diff === 0
                            ? <span style={{ color: '#0ea77b' }}>✓</span>
                            : <span style={{ fontWeight: 700, color: diff > 0 ? '#0ea77b' : '#c81e1e' }}>{diff > 0 ? '+' : ''}{diff}</span>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#9ca3af' }}>{item.unit}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: 'auto' }}>
              {changed > 0 ? `⚠ ${changed} مادة بها فارق` : '✓ كل المواد مطابقة'}
            </div>
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
              تأكيد الجرد
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
