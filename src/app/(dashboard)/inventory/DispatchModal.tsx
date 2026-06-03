// src/components/inventory/DispatchModal.tsx
'use client'
import { useEffect, useState } from 'react'
import { ArrowUpFromLine, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'
import toast from 'react-hot-toast'
import type { InventoryMaterial, InventoryWarehouse } from './types'

export default function DispatchModal({ materials, projects, warehouse, onClose, onSave }: {
  materials: InventoryMaterial[]
  projects: { id: number; name: string }[]
  warehouse: InventoryWarehouse
  onClose: () => void
  onSave: (rows: { mat: InventoryMaterial; qty: number }[], projectName: string, note: string) => Promise<void>
}) {
  const { tenant } = useStore()
  const [saving, setSaving]     = useState(false)
  const [projectId, setProject] = useState<number | ''>('')
  const [note, setNote]         = useState('')
  const [projMats, setProjMats] = useState<{ mat: InventoryMaterial; available: number }[]>([])
  const [loading, setLoading]   = useState(false)
  const [checked, setChecked]   = useState<Record<string, { on: boolean; qty: number }>>({})

  useEffect(() => {
    if (!projectId || !tenant) { setProjMats([]); return }
    const projectName = projects.find(p => p.id === Number(projectId))?.name || ''
    setLoading(true)
    supabase.from('stock_ledger').select('*').eq('project_name', projectName)
      .then(({ data }) => {
        const map: Record<string, number> = {}
        ;(data || []).forEach((l: any) => {
          if (!map[l.mat_name]) map[l.mat_name] = 0
          if (l.type === 'توريد') map[l.mat_name] += l.qty
          if (l.type === 'صرف')   map[l.mat_name] -= l.qty
        })
        const result = materials
          .filter(m => (map[m.name] || 0) > 0)
          .map(m => ({ mat: m, available: map[m.name] || 0 }))
        setProjMats(result)
        setLoading(false)
      })
  }, [projectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) { toast.error('يجب اختيار المشروع'); return }
    const selected = projMats.filter(pm => checked[pm.mat.name]?.on)
    if (selected.length === 0) { toast.error('حدد مادة واحدة على الأقل'); return }
    for (const pm of selected) {
      const qty = checked[pm.mat.name]?.qty || 0
      if (qty <= 0 || qty > pm.available) { toast.error('كمية غير صحيحة لـ "' + pm.mat.name + '"'); return }
    }
    setSaving(true)
    const projectName = projects.find(p => p.id === Number(projectId))?.name || ''
    await onSave(
      selected.map(pm => ({ mat: pm.mat, qty: checked[pm.mat.name]?.qty || pm.available })),
      projectName, note
    )
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
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
                <select value={projectId} onChange={e => { setProject(e.target.value ? Number(e.target.value) : ''); setChecked({}) }} className="select">
                  <option value="">— اختر المشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظة</label>
                <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="اختياري" />
              </div>
            </div>

            {projectId && (
              loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                  <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                </div>
              ) : projMats.length === 0 ? (
                <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '10px', textAlign: 'center', color: '#e6820a', fontSize: '0.875rem' }}>
                  ⚠️ لا توجد مواد مستلمة لهذا المشروع في هذا المستودع
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#6b7280', marginBottom: '8px' }}>
                    مواد المشروع — أشّر ما تريد صرفه
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ width: '40px', padding: '8px 12px' }}></th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>المادة</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#0ea77b' }}>المتاح</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>الكمية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projMats.map(pm => {
                          const row = checked[pm.mat.name]
                          return (
                            <tr key={pm.mat.id} style={{ borderTop: '1px solid #f3f4f6', background: row?.on ? '#fff5f5' : 'transparent' }}>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input type="checkbox" checked={row?.on || false}
                                  onChange={() => setChecked(prev => ({
                                    ...prev,
                                    [pm.mat.name]: { on: !prev[pm.mat.name]?.on, qty: prev[pm.mat.name]?.qty || pm.available }
                                  }))}
                                  className="w-4 h-4 rounded cursor-pointer" />
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 600 }}>{pm.mat.name}</div>
                                {pm.mat.sec_number && <div style={{ fontSize: '0.72rem', color: '#3b82f6' }}>SEC: {pm.mat.sec_number}</div>}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0ea77b' }}>{pm.available}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input type="number" min="1" max={pm.available}
                                  value={row?.qty || pm.available}
                                  onChange={e => setChecked(prev => ({ ...prev, [pm.mat.name]: { on: true, qty: Number(e.target.value) } }))}
                                  disabled={!row?.on}
                                  style={{ width: '70px', padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', textAlign: 'center', fontSize: '0.875rem', opacity: !row?.on ? 0.4 : 1 }} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving || Object.values(checked).filter(r => r.on).length === 0}
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
