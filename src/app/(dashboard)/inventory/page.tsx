'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { materialsApi, ledgerApi, warehousesApi } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import {
  Package, Plus, Search, Pencil, Trash2, ArrowDownToLine,
  ArrowUpFromLine, ArrowLeftRight, AlertTriangle, X, ChevronDown
} from 'lucide-react'
import type { Material, StockLedger, Warehouse } from '@/types'
import toast from 'react-hot-toast'

// ── Material Modal ─────────────────────────────────────────────────
function MaterialModal({ mat, warehouses, onClose, onSave }: {
  mat: Material | null
  warehouses: Warehouse[]
  onClose: () => void
  onSave: (d: Partial<Material>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    catalog_no:   mat?.catalog_no   || '',
    sku:          mat?.sku          || '',
    name:         mat?.name         || '',
    unit:         mat?.unit         || 'قطعة',
    qty:          mat?.qty          ?? 0,
    reorder:      mat?.reorder      ?? 5,
    warehouse_id: mat?.warehouse_id || warehouses[0]?.id || 0,
    notes:        mat?.notes        || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.catalog_no.trim()) return
    setSaving(true)
    await onSave({
      ...(mat ? { id: mat.id } : {}),
      catalog_no:   form.catalog_no,
      sku:          form.sku   || undefined,
      name:         form.name,
      unit:         form.unit,
      qty:          Number(form.qty),
      reorder:      Number(form.reorder),
      warehouse_id: Number(form.warehouse_id),
      notes:        form.notes || undefined,
    })
    setSaving(false)
  }

  const UNITS = ['قطعة','متر','كجم','لتر','علبة','رول','طن','م²','م³']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{mat ? 'تعديل مادة' : 'إضافة مادة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الكتالوج <span className="text-red-500">*</span></label>
                <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)} className="input" placeholder="مثال: CAB-001" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم SKU</label>
                <input value={form.sku} onChange={e => set('sku', e.target.value)} className="input" placeholder="اختياري" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المادة <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: كابل كهربائي 16mm" required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الوحدة</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية</label>
                <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} className="input" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">حد الأمان</label>
                <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)} className="input" min="0" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المستودع</label>
              <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" placeholder="ملاحظات..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {mat ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Transaction Modal ──────────────────────────────────────────────
function TxModal({ mat, warehouses, onClose, onSave }: {
  mat: Material
  warehouses: Warehouse[]
  onClose: () => void
  onSave: (type: StockLedger['type'], qty: number, note: string, vendor?: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [type, setType]     = useState<StockLedger['type']>('توريد')
  const [qty, setQty]       = useState(1)
  const [note, setNote]     = useState('')
  const [vendor, setVendor] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (qty <= 0) return
    setSaving(true)
    await onSave(type, qty, note, vendor || undefined)
    setSaving(false)
  }

  const TX_TYPES: { value: StockLedger['type']; label: string; icon: any; color: string }[] = [
    { value: 'توريد',          label: 'توريد وارد',    icon: ArrowDownToLine, color: 'text-emerald-600 bg-emerald-50 border-emerald-300' },
    { value: 'صرف',            label: 'صرف للمشروع',  icon: ArrowUpFromLine, color: 'text-red-600 bg-red-50 border-red-300' },
    { value: 'إرجاع للكهرباء', label: 'إرجاع للكهرباء', icon: ArrowLeftRight, color: 'text-amber-600 bg-amber-50 border-amber-300' },
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800">حركة مخزنية</h3>
            <p className="text-xs text-gray-400 mt-0.5">{mat.name} · الرصيد الحالي: {mat.qty} {mat.unit}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="flex gap-2">
              {TX_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setType(t.value)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all flex items-center justify-center gap-1.5 ${type === t.value ? t.color : 'border-gray-200 text-gray-500'}`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية</label>
                <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} className="input" min="1" required />
              </div>
              {type === 'توريد' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">المورد</label>
                  <input value={vendor} onChange={e => setVendor(e.target.value)} className="input" placeholder="اسم المورد" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظة</label>
              <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="ملاحظة اختيارية..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              تسجيل الحركة
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── الصفحة ────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { tenant, activeBranch, materials, setMaterials, warehouses, setWarehouses, currentUser } = useStore()
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [whFilter, setWhFilter]       = useState<number | ''>('')
  const [lowOnly, setLowOnly]         = useState(false)
  const [showMatModal, setMatModal]   = useState(false)
  const [editMat, setEditMat]         = useState<Material | null>(null)
  const [txMat, setTxMat]             = useState<Material | null>(null)
  const [activeTab, setActiveTab]     = useState<'materials' | 'ledger'>('materials')
  const [ledger, setLedger]           = useState<StockLedger[]>([])

  const canEdit = currentUser?.permissions?.includes('inventory')

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const [m, w, l] = await Promise.all([
      materialsApi.getAll(tenant.id, activeBranch.id),
      warehousesApi.getAll(tenant.id, activeBranch.id),
      ledgerApi.getRecent(tenant.id, activeBranch.id),
    ])
    setMaterials(m.data || [])
    setWarehouses(w.data || [])
    setLedger(l.data || [])
    setLoading(false)
  }

  async function handleSaveMat(data: Partial<Material>) {
    if (!tenant || !activeBranch) return
    const { error } = await materialsApi.upsert({ ...data, tenant_id: tenant.id, branch_id: activeBranch.id })
    if (error) { toast.error('حدث خطأ'); return }
    await loadData()
    setMatModal(false)
    setEditMat(null)
    toast.success(editMat ? 'تم التعديل' : 'تمت الإضافة')
  }

  async function handleDelete(m: Material) {
    if (!confirm(`حذف "${m.name}"؟`)) return
    await materialsApi.delete(m.id)
    setMaterials(materials.filter(x => x.id !== m.id))
    toast.success('تم الحذف')
  }

  async function handleTransaction(type: StockLedger['type'], qty: number, note: string, vendor?: string) {
    if (!tenant || !activeBranch || !txMat) return
    const mat = txMat
    const isIn = type === 'توريد'
    const newQty = isIn ? mat.qty + qty : mat.qty - qty
    if (!isIn && newQty < 0) { toast.error('الكمية المطلوبة أكبر من الرصيد الحالي!'); return }
    const wh = warehouses.find(w => w.id === mat.warehouse_id)
    await ledgerApi.insert({
      tenant_id: tenant.id, branch_id: activeBranch.id,
      type, mat_name: mat.name, unit: mat.unit,
      qty, qty_before: mat.qty, qty_after: newQty,
      wh_name: wh?.name || '',
      vendor_name: vendor,
      dispatch_note: note || undefined,
    })
    await materialsApi.upsert({ ...mat, qty: newQty })
    await loadData()
    setTxMat(null)
    toast.success('تم تسجيل الحركة')
  }

  const filtered = materials.filter(m => {
    const q = search.toLowerCase()
    const matchS  = !q || m.name.toLowerCase().includes(q) || m.catalog_no.toLowerCase().includes(q) || (m.sku||'').toLowerCase().includes(q)
    const matchW  = !whFilter || m.warehouse_id === whFilter
    const matchL  = !lowOnly || m.qty <= m.reorder
    return matchS && matchW && matchL
  })

  const lowCount = materials.filter(m => m.qty <= m.reorder).length

  const TX_COLORS: Record<string, string> = {
    'توريد':          'badge-green',
    'صرف':            'badge-red',
    'إرجاع للكهرباء': 'badge-amber',
    'نقل مخزني':      'badge-blue',
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500" />
            إدارة المخزون
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{materials.length} مادة</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditMat(null); setMatModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> إضافة مادة
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{materials.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">إجمالي المواد</div>
        </div>
        <div className={`card p-4 text-center ${lowCount > 0 ? 'border-amber-200 bg-amber-50/50' : ''}`}>
          <div className={`text-2xl font-bold ${lowCount > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{lowCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">تحت حد الأمان</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{warehouses.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">المستودعات</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ id: 'materials', label: 'المواد' }, { id: 'ledger', label: 'سجل الحركات' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'materials' && (
        <>
          {/* Filters */}
          <div className="card p-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="input pr-9 text-sm" placeholder="بحث بالاسم أو الكود..." />
            </div>
            <select value={whFilter} onChange={e => setWhFilter(e.target.value ? Number(e.target.value) : '')} className="select w-auto text-sm">
              <option value="">كل المستودعات</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button onClick={() => setLowOnly(!lowOnly)}
              className={`btn btn-sm gap-2 ${lowOnly ? 'btn-warning' : 'btn-ghost'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowOnly ? 'عرض الكل' : 'تحت الحد فقط'}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="card p-16 text-center">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">لا توجد مواد</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الكود</th>
                    <th>المادة</th>
                    <th>الكمية</th>
                    <th>الوحدة</th>
                    <th>المستودع</th>
                    <th>الحالة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const isLow  = m.qty <= m.reorder
                    const isEmpty = m.qty <= 0
                    const wh = warehouses.find(w => w.id === m.warehouse_id)
                    return (
                      <tr key={m.id}>
                        <td className="font-mono text-xs text-gray-500">{m.catalog_no}</td>
                        <td>
                          <div className="font-medium text-gray-800 text-sm">{m.name}</div>
                          {m.sku && <div className="text-xs text-gray-400">{m.sku}</div>}
                        </td>
                        <td className={`font-bold text-sm ${isEmpty ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                          {m.qty}
                          {isLow && !isEmpty && <span className="text-xs text-amber-500 mr-1">/ {m.reorder}</span>}
                        </td>
                        <td className="text-gray-500 text-sm">{m.unit}</td>
                        <td className="text-gray-500 text-sm">{wh?.name || '—'}</td>
                        <td>
                          <span className={`badge ${isEmpty ? 'badge-red' : isLow ? 'badge-amber' : 'badge-green'}`}>
                            {isEmpty ? '⛔ نفدت' : isLow ? '⚠ منخفض' : '✓ طبيعي'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 justify-end">
                            {canEdit && (
                              <button onClick={() => setTxMat(m)} className="btn btn-ghost btn-xs" title="تسجيل حركة">
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canEdit && <>
                              <button onClick={() => { setEditMat(m); setMatModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(m)} className="btn btn-ghost btn-xs text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'ledger' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>المادة</th>
                <th>الكمية</th>
                <th>المستودع</th>
                <th>المورد/الملاحظة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">لا توجد حركات مسجلة</td></tr>
              ) : ledger.map(l => (
                <tr key={l.id}>
                  <td><span className={`badge ${TX_COLORS[l.type] || 'badge-gray'}`}>{l.type}</span></td>
                  <td className="font-medium text-gray-800 text-sm">{l.mat_name}</td>
                  <td className="font-bold text-sm">{l.qty} {l.unit}</td>
                  <td className="text-gray-500 text-sm">{l.wh_name}</td>
                  <td className="text-gray-500 text-sm">{l.vendor_name || l.dispatch_note || '—'}</td>
                  <td className="text-gray-400 text-xs">{formatDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showMatModal && (
        <MaterialModal
          mat={editMat}
          warehouses={warehouses}
          onClose={() => { setMatModal(false); setEditMat(null) }}
          onSave={handleSaveMat}
        />
      )}
      {txMat && (
        <TxModal
          mat={txMat}
          warehouses={warehouses}
          onClose={() => setTxMat(null)}
          onSave={handleTransaction}
        />
      )}
    </div>
  )
}
