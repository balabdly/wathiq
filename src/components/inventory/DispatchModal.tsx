// src/components/inventory/DispatchModal.tsx
'use client'
import { useEffect, useState } from 'react'
import { ArrowUpFromLine, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'
import toast from 'react-hot-toast'
import type { InventoryMaterial } from './types'

export default function DispatchModal({ materials, projects, warehouse, onClose, onSave }: {
  materials: InventoryMaterial[]
  projects: { id: number; name: string }[]
  warehouse: any
  onClose: () => void
  onSave: (rows: { mat: any; qty: number }[], projectName: string, note: string) => Promise<void>
}) {
  const { tenant, activeBranch } = useStore()
  const [saving, setSaving]       = useState(false)
  const [projectId, setProject]   = useState<number | ''>('')
  const [note, setNote]           = useState('')
  const [projMats, setProjMats]   = useState<{ mat: any; available: number }[]>([])
  const [loading, setLoading]     = useState(false)
  const [checked, setChecked]     = useState<Record<number, { on: boolean; qty: number }>>({})

  // عند اختيار مشروع — جلب مواده من stock_ledger
  useEffect(() => {
    if (!projectId || !tenant) { setProjMats([]); setChecked({}); return }
    const projectName = projects.find(p => p.id === Number(projectId))?.name || ''
    setLoading(true)
    setChecked({})

    supabase.from('stock_ledger')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('project_name', projectName)
      .then(async ({ data: ledgerRows }) => {
        // حساب رصيد كل مادة في المشروع
        const balanceMap: Record<string, number> = {}
        ;(ledgerRows || []).forEach((l: any) => {
          if (!balanceMap[l.mat_name]) balanceMap[l.mat_name] = 0
          if (l.type === 'توريد') balanceMap[l.mat_name] += l.qty
          if (l.type === 'صرف' && !l.is_loan) balanceMap[l.mat_name] -= l.qty
        })

        // جلب تفاصيل المواد من قاعدة البيانات
        const matNames = Object.keys(balanceMap).filter(n => balanceMap[n] > 0)
        if (matNames.length === 0) { setProjMats([]); setLoading(false); return }

        const { data: matsData } = await supabase
          .from('materials')
          .select('*')
          .eq('tenant_id', tenant.id)
          .in('name', matNames)

        const result = matNames.map(name => {
          const mat = (matsData || []).find((m: any) => m.name === name)
          return {
            mat: mat || { id: 0, name, qty: balanceMap[name], unit: '', sec_number: '' },
            available: balanceMap[name],
          }
        }).filter(r => r.available > 0)

        setProjMats(result)
        setLoading(false)
      })
  }, [projectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) { toast.error('يجب اختيار المشروع'); return }
    const selected = projMats.filter(pm => checked[pm.mat.id || pm.mat.name]?.on)
    if (selected.length === 0) { toast.error('حدد مادة واحدة على الأقل'); return }
    for (const pm of selected) {
      const key = pm.mat.id || pm.mat.name
      const qty = checked[key]?.qty || 0
      if (qty <= 0 || qty > pm.available) {
        toast.error('كمية غير صحيحة لـ "' + pm.mat.name + '"'); return
      }
    }
    setSaving(true)
    const projectName = projects.find(p => p.id === Number(projectId))?.name || ''
    await onSave(
      selected.map(pm => ({ mat: pm.mat, qty: checked[pm.mat.id || pm.mat.name]?.qty || pm.available })),
      projectName, note
    )
    setSaving(false)
  }

  const selectedCount = Object.values(checked).filter(r => r.on).length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <ArrowUpFromLine className="w-5 h-5 text-red-500" /> صرف مواد للمشروع
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">تظهر مواد المشروع المستلمة فقط</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* المشروع والملاحظة */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  المشروع <span className="text-red-500">*</span>
                </label>
                <select value={projectId}
                  onChange={e => setProject(e.target.value ? Number(e.target.value) : '')}
                  className="select">
                  <option value="">— اختر المشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظة</label>
                <input value={note} onChange={e => setNote(e.target.value)}
                  className="input" placeholder="اختياري" />
              </div>
            </div>

            {/* المواد */}
            {!projectId ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '10px', fontSize: '0.875rem' }}>
                اختر مشروعاً لعرض مواده
              </div>
            ) : loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : projMats.length === 0 ? (
              <div style={{ padding: '20px', background: '#fffbeb', borderRadius: '10px', textAlign: 'center', color: '#e6820a', fontSize: '0.875rem' }}>
                ⚠️ لا توجد مواد مستلمة لهذا المشروع في المخزون
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#6b7280' }}>
                    مواد المشروع — أشّر ما تريد صرفه
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{selectedCount} محدد</span>
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', maxHeight: '340px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ width: '44px', padding: '9px 12px' }}>
                          <input type="checkbox"
                            checked={projMats.length > 0 && projMats.every(pm => checked[pm.mat.id || pm.mat.name]?.on)}
                            onChange={e => {
                              const c: Record<any, { on: boolean; qty: number }> = {}
                              projMats.forEach(pm => { c[pm.mat.id || pm.mat.name] = { on: e.target.checked, qty: pm.available } })
                              setChecked(c)
                            }}
                            className="w-4 h-4 rounded cursor-pointer" />
                        </th>
                        <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>المادة</th>
                        <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#0ea77b' }}>المتاح</th>
                        <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>الكمية المصروفة</th>
                        <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>الوحدة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projMats.map(pm => {
                        const key = pm.mat.id || pm.mat.name
                        const row = checked[key]
                        return (
                          <tr key={key} style={{ borderTop: '1px solid #f3f4f6', background: row?.on ? '#fff5f5' : 'transparent' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <input type="checkbox" checked={row?.on || false}
                                onChange={() => setChecked(prev => ({
                                  ...prev,
                                  [key]: { on: !prev[key]?.on, qty: prev[key]?.qty || pm.available }
                                }))}
                                className="w-4 h-4 rounded cursor-pointer" />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{pm.mat.name}</div>
                              {pm.mat.sec_number && (
                                <div style={{ fontSize: '0.72rem', color: '#3b82f6' }}>SEC: {pm.mat.sec_number}</div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0ea77b' }}>
                              {pm.available}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <input type="number" min="1" max={pm.available}
                                value={row?.qty ?? pm.available}
                                onChange={e => setChecked(prev => ({
                                  ...prev,
                                  [key]: { on: true, qty: Number(e.target.value) }
                                }))}
                                disabled={!row?.on}
                                style={{ width: '80px', padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', textAlign: 'center', fontSize: '0.875rem', opacity: !row?.on ? 0.4 : 1 }} />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>
                              {pm.mat.unit}
                            </td>
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
              disabled={saving || !projectId || selectedCount === 0}
              className="btn btn-primary" style={{ background: '#ef4444' }}>
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <ArrowUpFromLine className="w-4 h-4" />}
              تأكيد الصرف {selectedCount > 0 ? `(${selectedCount} مادة)` : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
