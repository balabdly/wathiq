// src/app/(dashboard)/inventory/[warehouseId]/page.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { ledgerApi, materialsApi } from '@/lib/db'
import {
  Package, Plus, Search, Pencil, Trash2, ArrowRight,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ClipboardCheck, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { WH_TYPES, TX_COLORS, PAGE_SIZE, type InventoryMaterial, type InventoryWarehouse } from '@/components/inventory/types'
import MaterialModal from '@/components/inventory/MaterialModal'
import DispatchModal from '@/components/inventory/DispatchModal'
import TransferModal from '@/components/inventory/TransferModal'
import InventoryCheckModal from '@/components/inventory/InventoryCheckModal'
import { formatDate } from '@/lib/utils'

export default function WarehouseDetailPage() {
  const params    = useParams()
  const router    = useRouter()
  const whId      = Number(params.warehouseId)
  const { tenant, activeBranch, warehouses, projects, setMaterials, materials, currentUser } = useStore()

  const [warehouse, setWarehouse]   = useState<InventoryWarehouse | null>(null)
  const [whMaterials, setWhMaterials] = useState<InventoryMaterial[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [srcFilter, setSrc]         = useState<'الكل' | 'كهرباء' | 'خاص'>('الكل')
  const [statusFilter, setStatus]   = useState<'الكل' | 'طبيعي' | 'منخفض' | 'نفدت'>('الكل')
  const searchTimeout               = useRef<any>(null)

  // modals
  const [showMatModal, setMatModal]     = useState(false)
  const [editMat, setEditMat]           = useState<InventoryMaterial | null>(null)
  const [showDispatch, setDispatch]     = useState(false)
  const [showTransfer, setTransfer]     = useState(false)
  const [showCheck, setCheck]           = useState(false)

  const canEdit    = currentUser?.permissions?.includes('inventory')
  const projectsList = (projects || []).map(p => ({ id: p.id, name: p.name }))
  const whInfo     = WH_TYPES.find(w => w.type === (warehouse as any)?.wh_type)

  useEffect(() => {
    if (!whId || !warehouses.length) return
    const wh = warehouses.find(w => w.id === whId) as InventoryWarehouse
    if (wh) setWarehouse(wh)
  }, [whId, warehouses])

  useEffect(() => { loadMaterials(1) }, [whId, srcFilter, statusFilter])

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => loadMaterials(1), 400)
    return () => clearTimeout(searchTimeout.current)
  }, [search])

  async function loadMaterials(p: number) {
    if (!tenant || !activeBranch) return
    setLoading(true)
    let query = supabase.from('materials')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('branch_id', activeBranch.id)
      .eq('warehouse_id', whId)

    if (search) query = query.or(`name.ilike.%${search}%,catalog_no.ilike.%${search}%,sec_number.ilike.%${search}%`)
    if (srcFilter !== 'الكل') query = query.eq('source', srcFilter)
    if (statusFilter === 'نفدت')    query = query.lte('qty', 0)
    else if (statusFilter === 'منخفض') query = query.gt('qty', 0).lte('qty', 10)
    else if (statusFilter === 'طبيعي') query = query.gt('qty', 10)

    const from = (p - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1).order('name')

    const { data, count } = await query
    setWhMaterials((data || []) as any)
    setTotal(count || 0)
    setPage(p)
    setLoading(false)
  }

  async function handleSaveMat(data: Partial<InventoryMaterial>) {
    if (!tenant || !activeBranch) return
    const payload = { ...data, tenant_id: tenant.id, branch_id: activeBranch.id, warehouse_id: whId }
    if ((data as any).id) {
      await supabase.from('materials').update(payload).eq('id', (data as any).id)
    } else {
      await supabase.from('materials').insert(payload)
    }
    await loadMaterials(page)
    setMatModal(false); setEditMat(null)
    toast.success(editMat ? 'تم التعديل ✅' : 'تمت الإضافة ✅')
  }

  async function handleDelete(m: InventoryMaterial) {
    if (!confirm(`حذف "${m.name}"؟`)) return
    await supabase.from('materials').delete().eq('id', m.id)
    await loadMaterials(page)
    toast.success('تم الحذف')
  }

  async function handleDispatch(
    rows: { mat: InventoryMaterial; qty: number }[],
    projectName: string, note: string
  ) {
    if (!tenant || !activeBranch) return
    for (const row of rows) {
      const newQty = row.mat.qty - row.qty
      if (newQty < 0) { toast.error('رصيد "' + row.mat.name + '" غير كافٍ'); return }
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'صرف', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: warehouse?.name || '',
        project_name: projectName,
        dispatch_note: note || undefined,
      })
      await supabase.from('materials').update({ qty: newQty }).eq('id', row.mat.id)
    }
    await loadMaterials(page)
    setDispatch(false)
    toast.success('تم صرف ' + rows.length + ' مادة للمشروع "' + projectName + '" ✅')
  }

  async function handleTransfer(
    rows: { mat: InventoryMaterial; qty: number }[],
    toWhId: number, toWhName: string
  ) {
    if (!tenant || !activeBranch) return
    for (const row of rows) {
      const newQty = row.mat.qty - row.qty
      if (newQty < 0) { toast.error('رصيد "' + row.mat.name + '" غير كافٍ'); return }
      // خروج من المستودع الحالي
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'نقل مخزني', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: warehouse?.name || '',
        dispatch_note: 'تحويل إلى: ' + toWhName,
      })
      await supabase.from('materials').update({ qty: newQty }).eq('id', row.mat.id)
      // دخول للمستودع الثاني
      const { data: existMat } = await supabase.from('materials').select('*')
        .eq('tenant_id', tenant.id).eq('warehouse_id', toWhId).eq('name', row.mat.name).single()
      if (existMat) {
        await supabase.from('materials').update({ qty: existMat.qty + row.qty }).eq('id', existMat.id)
      } else {
        await supabase.from('materials').insert({
          ...row.mat, id: undefined, warehouse_id: toWhId, qty: row.qty
        })
      }
    }
    await loadMaterials(page)
    setTransfer(false)
    toast.success('تم تحويل ' + rows.length + ' مادة إلى "' + toWhName + '" ✅')
  }

  async function handleInventoryCheck(
    items: { matId: number; matName: string; systemQty: number; actualQty: number; unit: string }[]
  ) {
    if (!tenant || !activeBranch) return
    const changed = items.filter(i => i.actualQty !== i.systemQty)
    for (const item of changed) {
      const diff = item.actualQty - item.systemQty
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: diff > 0 ? 'توريد' : 'صرف',
        mat_name: item.matName, unit: item.unit,
        qty: Math.abs(diff), qty_before: item.systemQty, qty_after: item.actualQty,
        wh_name: warehouse?.name || '',
        dispatch_note: 'تسوية جرد',
      })
      await supabase.from('materials').update({ qty: item.actualQty }).eq('id', item.matId)
    }
    await loadMaterials(page)
    setCheck(false)
    toast.success('تم تأكيد الجرد — ' + changed.length + ' مادة تم تسويتها ✅')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const lowCount   = whMaterials.filter(m => m.qty <= m.reorder && m.qty > 0).length

  if (!warehouse) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">
          <ArrowRight style={{ width: '16px', height: '16px' }} /> العودة
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.3rem' }}>{whInfo?.icon || '🏭'}</span>
            {warehouse.name}
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '2px' }}>
            {total} مادة
            {warehouse.location && ` · 📍 ${warehouse.location}`}
            {lowCount > 0 && <span style={{ color: '#e6820a', marginRight: '8px' }}>· {lowCount} منخفض</span>}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditMat(null); setMatModal(true) }} className="btn btn-primary btn-sm">
            <Plus style={{ width: '15px', height: '15px' }} /> إضافة مادة
          </button>
        )}
      </div>

      {/* أقسام المستودع */}
      {(warehouse as any).sections?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(warehouse as any).sections.map((s: string, i: number) => (
            <span key={i} style={{
              background: (whInfo?.color || '#1a56db') + '12',
              border: `1px solid ${whInfo?.color || '#1a56db'}33`,
              borderRadius: '8px', padding: '4px 12px',
              fontSize: '0.8rem', color: whInfo?.color || '#1a56db', fontWeight: 600
            }}>
              📦 {s}
            </span>
          ))}
        </div>
      )}

      {/* أزرار العمليات */}
      {canEdit && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { icon: <ArrowUpFromLine style={{ width: '15px', height: '15px' }} />, label: 'صرف مواد',       color: '#ef4444', bg: '#fff5f5', onClick: () => setDispatch(true) },
            { icon: <ArrowLeftRight style={{ width: '15px', height: '15px' }} />,  label: 'تحويل لمستودع', color: '#1a56db', bg: '#eff6ff', onClick: () => setTransfer(true) },
            { icon: <ClipboardCheck style={{ width: '15px', height: '15px' }} />,  label: 'جرد المستودع',  color: '#e6820a', bg: '#fffbeb', onClick: () => setCheck(true) },
          ].map((op, i) => (
            <button key={i} onClick={op.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: `1px solid ${op.color}33`, background: op.bg, color: op.color, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              {op.icon} {op.label}
            </button>
          ))}
        </div>
      )}

      {/* فلاتر */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input" style={{ paddingRight: '32px', fontSize: '0.875rem' }}
            placeholder="بحث بالاسم أو الكود أو SEC..." />
        </div>
        <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', padding: '3px', borderRadius: '8px' }}>
          {(['الكل', 'كهرباء', 'خاص'] as const).map(s => (
            <button key={s} onClick={() => setSrc(s)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                background: srcFilter === s ? 'white' : 'transparent',
                color: srcFilter === s ? '#1a56db' : '#9ca3af',
                boxShadow: srcFilter === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {s === 'كهرباء' ? '⚡ SEC' : s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', padding: '3px', borderRadius: '8px' }}>
          {(['الكل', 'طبيعي', 'منخفض', 'نفدت'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                background: statusFilter === s ? 'white' : 'transparent',
                color: statusFilter === s ? '#1a56db' : '#9ca3af',
                boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {s === 'طبيعي' ? '✓ طبيعي' : s === 'منخفض' ? '⚠ منخفض' : s === 'نفدت' ? '⛔ نفدت' : s}
            </button>
          ))}
        </div>
      </div>

      {/* الجدول */}
      {loading && whMaterials.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : whMaterials.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Package style={{ width: '48px', height: '48px', color: '#e5e7eb', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', marginBottom: '16px' }}>لا توجد مواد في هذا المستودع</p>
          {canEdit && (
            <button onClick={() => setMatModal(true)} className="btn btn-primary" style={{ margin: '0 auto' }}>
              <Plus style={{ width: '15px', height: '15px' }} /> إضافة أول مادة
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['المصدر','الكود / SEC','المادة','الموقع','الكمية','الحالة',''].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {whMaterials.map(m => {
                    const isLow   = m.qty <= m.reorder && m.qty > 0
                    const isEmpty = m.qty <= 0
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--bg2)', background: isEmpty ? '#fff5f5' : isLow ? '#fffbeb' : 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = isEmpty ? '#fff5f5' : isLow ? '#fffbeb' : 'transparent')}>
                        <td style={{ padding: '12px 14px' }}>
                          <span className={`badge text-xs ${m.source === 'كهرباء' ? 'badge-blue' : 'badge-green'}`}>
                            {m.source === 'كهرباء' ? '⚡ SEC' : '🏢 خاص'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>{m.catalog_no}</div>
                          {m.sec_number && <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#3b82f6' }}>{m.sec_number}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, color: '#1a1a2e' }}>{m.name}</div>
                          {m.sku && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{m.sku}</div>}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: '0.8rem' }}>{(m as any).location || '—'}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: isEmpty ? '#c81e1e' : isLow ? '#e6820a' : '#1a1a2e' }}>
                          {m.qty} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.78rem' }}>{m.unit}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className={`badge ${isEmpty ? 'badge-red' : isLow ? 'badge-amber' : 'badge-green'}`}>
                            {isEmpty ? '⛔ نفدت' : isLow ? '⚠ منخفض' : '✓ طبيعي'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {canEdit && (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button onClick={() => { setEditMat(m); setMatModal(true) }} className="btn btn-ghost btn-xs">
                                <Pencil style={{ width: '13px', height: '13px' }} />
                              </button>
                              <button onClick={() => handleDelete(m)} className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }}>
                                <Trash2 style={{ width: '13px', height: '13px' }} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} من {total} مادة
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => loadMaterials(page - 1)} disabled={page === 1} className="btn btn-ghost btn-xs" style={{ opacity: page === 1 ? 0.4 : 1 }}>
                    <ChevronRight style={{ width: '15px', height: '15px' }} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                    return (
                      <button key={p} onClick={() => loadMaterials(p)}
                        className={`btn btn-xs ${p === page ? 'btn-primary' : 'btn-ghost'}`}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => loadMaterials(page + 1)} disabled={page === totalPages} className="btn btn-ghost btn-xs" style={{ opacity: page === totalPages ? 0.4 : 1 }}>
                    <ChevronLeft style={{ width: '15px', height: '15px' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showMatModal && (
        <MaterialModal
          mat={editMat}
          warehouses={[warehouse] as any}
          onClose={() => { setMatModal(false); setEditMat(null) }}
          onSave={handleSaveMat as any} />
      )}
      {showDispatch && (
        <DispatchModal
          materials={whMaterials}
          projects={projectsList}
          warehouse={warehouse}
          onClose={() => setDispatch(false)}
          onSave={handleDispatch as any} />
      )}
      {showTransfer && (
        <TransferModal
          materials={whMaterials}
          warehouses={warehouses.filter(w => w.id !== whId) as any}
          onClose={() => setTransfer(false)}
          onSave={handleTransfer as any} />
      )}
      {showCheck && (
        <InventoryCheckModal
          materials={whMaterials}
          onClose={() => setCheck(false)}
          onSave={handleInventoryCheck} />
      )}
    </div>
  )
}
