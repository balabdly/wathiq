// src/components/inventory/DispatchModal.tsx
'use client'
import { useState } from 'react'
import { ArrowUpFromLine, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { InventoryMaterial, InventoryWarehouse } from './types'

export default function DispatchModal({ materials, projects, warehouse, onClose, onSave }: {
  materials: InventoryMaterial[]
  projects: { id: number; name: string }[]
  warehouse: InventoryWarehouse
  onClose: () => void
  onSave: (rows: { mat: InventoryMaterial; qty: number }[], projectName: string, note: string) => Promise<void>
}) {
  const [saving, setSaving]     = useState(false)
  const [projectId, setProject] = useState<number | ''>('')
  const [note, setNote]         = useState('')
  const [checked, setChecked]   = useState<Record<number, { on: boolean; qty: number }>>({})

  // كل المواد المتاحة في المستودع (qty > 0)
  const availableMats = materials.filter(m => m.qty > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) { toast.error('يجب اختيار المشروع'); return }
    const selected = availableMats.filter(m => checked[m.id]?.on)
    if (selected.length === 0) { toast.error('حدد مادة واحدة على الأقل'); return }
    for (const m of selected) {
      const qty = checked[m.id]?.qty || 0
      if (qty <= 0 || qty > m.qty) { toast.error('كمية غير صحيحة لـ "' + m.name + '"'); return }
    }
    setSaving(true)
    const projectName = projects.find(p => p.id === Number(projectId))?.name || ''
    await onSave(
      selected.map(m => ({ mat: m, qty: checked[m.id]?.qty || m.qty })),
      projectName, note
    )
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <ArrowUpFromLine className="w-5 h-5 text-red-500" /> صرف مواد للمشروع
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">من: {warehouse.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع <span className="text-red-500">*</span></label>
                <select value={projectId} onChange={e => setProject(e.target.value ? Number(e.target.value) : '')} className="select">
                  <option value="">— اختر المشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظة</label>
                <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="اختياري" />
              </div>
            </div>

            {availableMats.length === 0 ? (
              <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '10px', textAlign: 'center', color: '#c81e1e', fontSize: '0.875rem' }}>
                ⛔ لا توجد مواد متاحة في هذا المستودع
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#6b7280' }}>
                    المواد المتاحة — أشّر ما تريد صرفه
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {Object.values(checked).filter(r => r.on).length} محدد
                  </span>
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', maxHeight: '320px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ width: '40px', padding: '8px 12px' }}>
                          <input type="checkbox"
                            checked={availableMats.length > 0 && availableMats.every(m => checked[m.id]?.on)}
                            onChange={e => {
                              const newChecked: Record<number, { on: boolean; qty: number }> = {}
                              availableMats.forEach(m => { newChecked[m.id] = { on: e.target.checked, qty: m.qty } })
                              setChecked(newChecked)
                            }}
                            className="w-4 h-4 rounded cursor-pointer" />
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>المادة</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#0ea77b' }}>المتاح</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>الكمية المصروفة</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>الوحدة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableMats.map(m => {
                        const row = checked[m.id]
                        return (
                          <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6', background: row?.on ? '#fff5f5' : 'transparent' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <input type="checkbox" checked={row?.on || false}
                                onChange={() => setChecked(prev => ({
                                  ...prev,
                                  [m.id]: { on: !prev[m.id]?.on, qty: prev[m.id]?.qty || m.qty }
                                }))}
                                className="w-4 h-4 rounded cursor-pointer" />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{m.name}</div>
                              {m.sec_number && <div style={{ fontSize: '0.72rem', color: '#3b82f6' }}>SEC: {m.sec_number}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0ea77b' }}>{m.qty}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <input type="number" min="1" max={m.qty}
                                value={row?.qty || m.qty}
                                onChange={e => setChecked(prev => ({ ...prev, [m.id]: { on: true, qty: Number(e.target.value) } }))}
                                disabled={!row?.on}
                                style={{ width: '80px', padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', textAlign: 'center', fontSize: '0.875rem', opacity: !row?.on ? 0.4 : 1 }} />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>{m.unit}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit"
              disabled={saving || !projectId || Object.values(checked).filter(r => r.on).length === 0}
              className="btn btn-primary" style={{ background: '#ef4444' }}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              تأكيد الصرف ({Object.values(checked).filter(r => r.on).length} مادة)
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
