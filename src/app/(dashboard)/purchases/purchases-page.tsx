'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { purchasesApi } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { ShoppingCart, Plus, Search, Pencil, Trash2, X, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { Purchase } from '@/types'
import toast from 'react-hot-toast'

const STATUSES = ['طلب شراء','بانتظار الموافقة','موافق عليه','مرفوض','مكتمل']
const STATUS_COLORS: Record<string, string> = {
  'طلب شراء':        'badge-gray',
  'بانتظار الموافقة': 'badge-amber',
  'موافق عليه':      'badge-blue',
  'مرفوض':           'badge-red',
  'مكتمل':           'badge-green',
}

function PurchaseModal({ purchase, onClose, onSave }: {
  purchase: Purchase | null
  onClose: () => void
  onSave: (d: Partial<Purchase>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code:   purchase?.code   || '',
    vendor: purchase?.vendor || '',
    items:  purchase?.items  || '',
    date:   purchase?.date   || new Date().toISOString().split('T')[0],
    status: purchase?.status || 'طلب شراء',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.items.trim()) return
    setSaving(true)
    await onSave({
      ...(purchase ? { id: purchase.id } : {}),
      code:   form.code   || undefined,
      vendor: form.vendor || undefined,
      items:  form.items,
      date:   form.date   || undefined,
      status: form.status,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{purchase ? 'تعديل طلب' : 'طلب شراء جديد'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الطلب</label>
                <input value={form.code} onChange={e => set('code', e.target.value)} className="input" placeholder="PO-2024-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الطلب</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المورد</label>
              <input value={form.vendor} onChange={e => set('vendor', e.target.value)} className="input" placeholder="اسم المورد" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المواد والكميات <span className="text-red-500">*</span></label>
              <textarea value={form.items} onChange={e => set('items', e.target.value)}
                className="input min-h-[100px] resize-none"
                placeholder="مثال:&#10;كابل 16mm × 100م&#10;قاطع 100A × 5 قطع" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {purchase ? 'حفظ' : 'إرسال الطلب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PurchasesPage() {
  const { tenant, activeBranch, purchases, setPurchases, currentUser } = useStore()
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [showModal, setModal]     = useState(false)
  const [editPO, setEditPO]       = useState<Purchase | null>(null)

  const canEdit = currentUser?.permissions?.includes('purchases')

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const { data } = await purchasesApi.getAll(tenant.id, activeBranch.id)
    setPurchases(data || [])
    setLoading(false)
  }

  async function handleSave(data: Partial<Purchase>) {
    if (!tenant || !activeBranch) return
    const { error } = await purchasesApi.upsert({ ...data, tenant_id: tenant.id, branch_id: activeBranch.id })
    if (error) { toast.error('حدث خطأ'); return }
    await loadData()
    setModal(false)
    setEditPO(null)
    toast.success(editPO ? 'تم التعديل' : 'تم إرسال طلب الشراء')
  }

  async function handleDelete(p: Purchase) {
    if (!confirm('حذف هذا الطلب؟')) return
    await purchasesApi.upsert({ ...p, status: 'مرفوض' })
    await loadData()
    toast.success('تم الحذف')
  }

  async function quickStatus(p: Purchase, status: string) {
    await purchasesApi.upsert({ id: p.id, tenant_id: p.tenant_id, status })
    await loadData()
    toast.success(`تم تغيير الحالة إلى: ${status}`)
  }

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase()
    const matchS = !q || (p.vendor||'').toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q) || (p.items||'').toLowerCase().includes(q)
    const matchSt = !statusFilter || p.status === statusFilter
    return matchS && matchSt
  })

  const pending   = purchases.filter(p => p.status === 'بانتظار الموافقة').length
  const completed = purchases.filter(p => p.status === 'مكتمل').length

  return (
    <div className="space-y-5 fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary-500" />
            طلبات الشراء
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{filtered.length} طلب</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditPO(null); setModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> طلب جديد
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{purchases.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">إجمالي الطلبات</div>
        </div>
        <div className={`card p-4 text-center ${pending > 0 ? 'border-amber-200 bg-amber-50/50' : ''}`}>
          <div className={`text-2xl font-bold ${pending > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{pending}</div>
          <div className="text-xs text-gray-400 mt-0.5">بانتظار الموافقة</div>
        </div>
        <div className="card p-4 text-center border-emerald-100">
          <div className="text-2xl font-bold text-emerald-600">{completed}</div>
          <div className="text-xs text-gray-400 mt-0.5">مكتمل</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pr-9 text-sm" placeholder="بحث بالمورد أو المواد..." />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="select w-auto text-sm">
          <option value="">كل الحالات</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">لا توجد طلبات شراء</p>
          {canEdit && (
            <button onClick={() => { setEditPO(null); setModal(true) }} className="btn btn-primary mt-4 mx-auto">
              <Plus className="w-4 h-4" /> إنشاء طلب
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>المورد</th>
                <th>المواد</th>
                <th>التاريخ</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-gray-500">{p.code || `#${p.id}`}</td>
                  <td className="font-medium text-gray-800 text-sm">{p.vendor || '—'}</td>
                  <td className="text-gray-600 text-sm max-w-xs">
                    <div className="line-clamp-2">{p.items || '—'}</div>
                  </td>
                  <td className="text-gray-400 text-sm">{formatDate(p.date)}</td>
                  <td><span className={`badge ${STATUS_COLORS[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit && p.status === 'بانتظار الموافقة' && (
                        <>
                          <button onClick={() => quickStatus(p, 'موافق عليه')} title="موافقة" className="btn btn-ghost btn-xs text-emerald-600 hover:bg-emerald-50">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => quickStatus(p, 'مرفوض')} title="رفض" className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {canEdit && <>
                        <button onClick={() => { setEditPO(p); setModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(p)} className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <PurchaseModal purchase={editPO} onClose={() => { setModal(false); setEditPO(null) }} onSave={handleSave} />
      )}
    </div>
  )
}
