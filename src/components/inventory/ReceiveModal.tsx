// src/components/inventory/ReceiveModal.tsx
'use client'
import { useEffect, useState } from 'react'
import { ArrowDownToLine, X, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'
import toast from 'react-hot-toast'
import MaterialSearchInput from './MaterialSearchInput'
import type { InventoryMaterial, InventoryWarehouse } from './types'
import { WH_TYPES } from './types'

export default function ReceiveModal({ warehouses, projects, onClose, onSave }: {
  warehouses: InventoryWarehouse[]
  projects: { id: number; name: string }[]
  onClose: () => void
  onSave: (
    rows: { mat: InventoryMaterial; qty: number; projectId: number | '' }[],
    vendor: string, reservationNo: string, exitPermitNo: string,
    warehouseId: number
  ) => Promise<void>
}) {
  const { tenant, activeBranch } = useStore()
  const [saving, setSaving]     = useState(false)
  const [vendor, setVendor]     = useState('السعودية للطاقة')
  const [reservationNo, setRes] = useState('')
  const [exitPermitNo, setExit] = useState('')
  const defaultWh = warehouses.find(w => w.wh_type === 'projects') || warehouses[0]
  const [selectedWhId, setWhId] = useState<number>(defaultWh?.id || 0)
  const [materials, setMaterials] = useState<InventoryMaterial[]>([])
  const [rows, setRows] = useState<{ id: number; mat: InventoryMaterial | null; qty: number; projectId: number | '' }[]>([
    { id: 1, mat: null, qty: 1, projectId: '' }
  ])

  const selectedWh = warehouses.find(w => w.id === selectedWhId)

  // جلب المواد من قاعدة البيانات
  useEffect(() => {
    if (!tenant || !activeBranch) return
    supabase.from('materials').select('*')
      .eq('tenant_id', tenant.id)
      .eq('branch_id', activeBranch.id)
      .order('name')
      .then(({ data }) => setMaterials((data || []) as any))
  }, [tenant?.id, activeBranch?.id])

  function updateRow(id: number, k: string, v: any) {
    setRows(r => r.map(x => x.id === id ? { ...x, [k]: v } : x))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedWhId) { toast.error('اختر المستودع'); return }
    const valid = rows.filter(r => r.mat && r.qty > 0)
    if (valid.length === 0) { toast.error('أضف مادة واحدة على الأقل'); return }
    // رقم المشروع إلزامي لكل عملية استلام
    const noProject = valid.filter(r => !r.projectId)
    if (noProject.length > 0) {
      toast.error('يجب تحديد مشروع لكل مادة: ' + noProject.map(r => r.mat!.name).join('، '))
      return
    }
    setSaving(true)
    await onSave(valid as any, vendor, reservationNo, exitPermitNo, selectedWhId)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '740px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-emerald-500" /> استلام مواد
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">رقم المشروع إلزامي لكل مادة</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* اختيار المستودع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                المستودع المستلِم <span className="text-red-500">*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {WH_TYPES.map(wt => {
                  const wh = warehouses.find(w => w.wh_type === wt.type)
                  if (!wh) return null
                  const selected = selectedWhId === wh.id
                  return (
                    <button key={wt.type} type="button" onClick={() => setWhId(wh.id)}
                      style={{ padding: '10px 12px', borderRadius: '10px', border: '2px solid', cursor: 'pointer', textAlign: 'right',
                        borderColor: selected ? wt.color : 'var(--border)',
                        background: selected ? wt.color + '15' : 'white' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selected ? wt.color : 'var(--text2)' }}>
                        {wt.icon} {wt.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '2px' }}>{wt.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* الجهة والمراجع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الجهة المورِّدة</label>
              <input value={vendor} onChange={e => setVendor(e.target.value)} className="input" placeholder="السعودية للطاقة / اسم المورد" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الحجز</label>
                <input value={reservationNo} onChange={e => setRes(e.target.value)} className="input" dir="ltr" placeholder="RSV-2024-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم إذن الخروج</label>
                <input value={exitPermitNo} onChange={e => setExit(e.target.value)} className="input" dir="ltr" placeholder="EXP-2024-001" />
              </div>
            </div>

            {/* المواد */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="block text-sm font-medium text-gray-700">المواد المستلمة</label>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  {materials.length === 0 ? 'جاري تحميل المواد...' : materials.length + ' مادة متاحة'}
                </span>
              </div>

              {/* رأس الأعمدة */}
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 60px 160px 36px', gap: '6px', marginBottom: '4px', padding: '0 2px' }}>
                <div />
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>المادة</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textAlign: 'center' }}>الكمية</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textAlign: 'center' }}>الوحدة</div>
                <div style={{ fontSize: '0.72rem', color: '#e6820a', fontWeight: 600 }}>المشروع *</div>
                <div />
              </div>

              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 60px 160px 36px', gap: '6px', alignItems: 'start' }}>
                    {/* رقم الصف */}
                    <div style={{ height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>
                      {i + 1}
                    </div>
                    {/* المادة */}
                    <MaterialSearchInput
                      materials={materials}
                      value={row.mat?.name || ''}
                      onChange={(name, unit, matId) => {
                        const m = materials.find(x => x.id === matId)
                        updateRow(row.id, 'mat', m || null)
                      }} />
                    {/* الكمية */}
                    <input type="number" value={row.qty} min="1"
                      onChange={e => updateRow(row.id, 'qty', Number(e.target.value))}
                      className="input text-sm text-center" />
                    {/* الوحدة */}
                    <div style={{ height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', color: '#9ca3af' }}>
                      {row.mat?.unit || '—'}
                    </div>
                    {/* المشروع — إلزامي */}
                    <select value={row.projectId}
                      onChange={e => updateRow(row.id, 'projectId', e.target.value ? Number(e.target.value) : '')}
                      className={`select text-xs py-1.5 ${!row.projectId ? 'border-orange-300 bg-orange-50' : 'border-green-300'}`}>
                      <option value="">— اختر المشروع —</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name.length > 22 ? p.name.substring(0, 22) + '…' : p.name}
                        </option>
                      ))}
                    </select>
                    {/* حذف الصف */}
                    {rows.length > 1 && (
                      <button type="button" onClick={() => setRows(r => r.filter(x => x.id !== row.id))}
                        style={{ width: '36px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', borderRadius: '8px' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <X style={{ width: '15px', height: '15px' }} />
                      </button>
                    )}
                    {rows.length === 1 && <div />}
                  </div>
                ))}
              </div>

              <button type="button"
                onClick={() => setRows(r => [...r, { id: Date.now(), mat: null, qty: 1, projectId: '' }])}
                className="mt-2 btn btn-ghost btn-sm w-full border border-dashed border-gray-300">
                <Plus className="w-3.5 h-3.5" /> إضافة مادة أخرى
              </button>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <ArrowDownToLine className="w-4 h-4" />}
              تسجيل الاستلام
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
