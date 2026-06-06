// src/components/inventory/ReturnModal.tsx
'use client'
import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import MaterialSearchInput from './MaterialSearchInput'
import type { InventoryMaterial } from './types'

export default function ReturnModal({ materials, projects, onClose, onSave }: {
  materials: InventoryMaterial[]
  projects: { id: number; name: string }[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving]     = useState(false)
  const [returnType, setType]   = useState<'إرجاع للكهرباء' | 'تحويل لمشروع'>('إرجاع للكهرباء')
  const [fromProject, setFrom]  = useState<number | ''>('')
  const [toProject, setTo]      = useState<number | ''>('')
  const [returnDate, setDate]   = useState(new Date().toISOString().split('T')[0])
  const [referenceNo, setRef]   = useState('')
  const [notes, setNotes]       = useState('')
  const [rows, setRows] = useState<{ id: number; mat: InventoryMaterial | null; qty: number }[]>([
    { id: 1, mat: null, qty: 1 }
  ])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fromProject) { toast.error('يجب تحديد المشروع المصدر'); return }
    if (returnType === 'تحويل لمشروع' && !toProject) { toast.error('يجب تحديد المشروع المستقبل'); return }
    if (Number(fromProject) === Number(toProject) && returnType === 'تحويل لمشروع') {
      toast.error('لا يمكن التحويل لنفس المشروع'); return
    }
    const valid = rows.filter(r => r.mat && r.qty > 0)
    if (valid.length === 0) { toast.error('أضف مادة واحدة على الأقل'); return }
    setSaving(true)
    await onSave({
      returnType,
      fromProjectName: projects.find(p => p.id === Number(fromProject))?.name || '',
      toProjectName:   projects.find(p => p.id === Number(toProject))?.name || '',
      returnDate, referenceNo, notes, rows: valid,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">↩️ إرجاع مواد فائضة</h3>
            <p className="text-xs text-gray-400 mt-0.5">إرجاع للكهرباء أو تحويل لمشروع آخر</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* نوع الإرجاع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الإرجاع</label>
              <div className="grid grid-cols-2 gap-3">
                {(['إرجاع للكهرباء', 'تحويل لمشروع'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    style={{ padding: '10px', borderRadius: '10px', border: '2px solid', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.875rem',
                      borderColor: returnType === t ? (t === 'إرجاع للكهرباء' ? '#1a56db' : '#0ea77b') : 'var(--border)',
                      background:  returnType === t ? (t === 'إرجاع للكهرباء' ? '#eff6ff' : '#ecfdf5') : 'white',
                      color:       returnType === t ? (t === 'إرجاع للكهرباء' ? '#1a56db' : '#0ea77b') : 'var(--text3)' }}>
                    {t === 'إرجاع للكهرباء' ? '⚡ إرجاع للكهرباء' : '🔄 تحويل لمشروع'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">من مشروع <span className="text-red-500">*</span></label>
                <select value={fromProject} onChange={e => setFrom(e.target.value ? Number(e.target.value) : '')} className="select" required>
                  <option value="">— اختر المشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {returnType === 'تحويل لمشروع' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">إلى مشروع <span className="text-red-500">*</span></label>
                  <select value={toProject} onChange={e => setTo(e.target.value ? Number(e.target.value) : '')} className="select" required>
                    <option value="">— اختر المشروع —</option>
                    {projects.filter(p => p.id !== Number(fromProject)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإرجاع</label>
                <input type="date" value={returnDate} onChange={e => setDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم محضر الإرجاع</label>
                <input value={referenceNo} onChange={e => setRef(e.target.value)} className="input" dir="ltr" placeholder="RET-2024-001" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المواد المرجعة</label>
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
                    <input type="number" value={row.qty} min="1"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="اختياري" />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary"
              style={{ background: returnType === 'إرجاع للكهرباء' ? '#1a56db' : '#0ea77b' }}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {returnType === 'إرجاع للكهرباء' ? '⚡ تأكيد الإرجاع' : '🔄 تأكيد التحويل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
