// src/app/(dashboard)/inventory/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { ledgerApi } from '@/lib/db'
import {
  Package, Warehouse as WarehouseIcon, ChevronLeft
} from 'lucide-react'
import toast from 'react-hot-toast'
import { TX_COLORS, type InventoryWarehouse } from '@/components/inventory/types'
import ReceiveModal from '@/components/inventory/ReceiveModal'
import ReturnModal from '@/components/inventory/ReturnModal'
import DispatchModal from '@/components/inventory/DispatchModal'
import TransferModal from '@/components/inventory/TransferModal'
import InventoryCheckModal from '@/components/inventory/InventoryCheckModal'
import { formatDate } from '@/lib/utils'

export default function InventoryPage() {
  const router = useRouter()
  const { tenant, activeBranch, warehouses, setWarehouses, projects, currentUser } = useStore()
  const [loading, setLoading]   = useState(true)
  const [stats, setStats]       = useState({ total: 0, sec: 0, low: 0, empty: 0 })

  const [showReceive, setReceive]   = useState(false)
  const [showReturn, setReturn]     = useState(false)
  const [showDispatch, setDispatch] = useState(false)
  const [showTransfer, setTransfer] = useState(false)
  const [showCheck, setCheck]       = useState(false)

  const canEdit    = currentUser?.permissions?.includes('inventory')
  const projectsList = (projects || []).map(p => ({ id: p.id, name: p.name }))

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const { data: wData } = await supabase.from('warehouses')
      .select('*').eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).order('id')
    setWarehouses(wData || [])

    const [total, sec, low, empty] = await Promise.all([
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id),
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('source', 'كهرباء'),
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('source', 'خاص').filter('qty', 'lte', 'reorder').gt('qty', 0),
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).lte('qty', 0),
    ])
    setStats({ total: total.count || 0, sec: sec.count || 0, low: low.count || 0, empty: empty.count || 0 })
    setLoading(false)

  }


    setLoadingProject(true)
    const { data } = await supabase.from('stock_ledger').select('*')
      .eq('tenant_id', tenant.id).eq('project_name', projectName)
      .order('created_at', { ascending: false })
    setProjectLedger(data || [])
    setLoadingProject(false)
  }

  async function handleReceive(rows: any[], vendor: string, reservationNo: string, exitPermitNo: string, warehouseId: number) {
    if (!tenant || !activeBranch) return
    const wh = warehouses.find(w => w.id === warehouseId)
    for (const row of rows) {
      const newQty = row.mat.qty + row.qty
      const projectName = projectsList.find(p => p.id === Number(row.projectId))?.name
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'توريد', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name || '', vendor_name: vendor || undefined,
        project_name: projectName, clearance_no: exitPermitNo || undefined,
        doc_code: reservationNo || undefined,
      })
      await supabase.from('materials').update({ qty: newQty }).eq('id', row.mat.id)
    }
    await loadData(); setReceive(false)
    toast.success('تم تسجيل استلام ' + rows.length + ' مادة ✅')
  }

  async function handleReturn(data: any) {
    if (!tenant || !activeBranch) return
    for (const row of data.rows) {
      if (!row.mat) continue
      const newQty = row.mat.qty - row.qty
      if (newQty < 0) { toast.error('رصيد "' + row.mat.name + '" غير كافٍ'); return }
      const wh = warehouses.find((w: any) => w.id === row.mat.warehouse_id)
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: (data.returnType === 'إرجاع للكهرباء' ? 'إرجاع للكهرباء' : 'تحويل لمشروع') as any,
        mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name || '', project_name: data.fromProjectName,
        dispatch_note: data.returnType === 'تحويل لمشروع'
          ? 'تحويل إلى مشروع: ' + data.toProjectName
          : 'إرجاع للكهرباء — محضر: ' + (data.referenceNo || '—'),
        doc_code: data.referenceNo || undefined,
      })
      await supabase.from('materials').update({ qty: newQty }).eq('id', row.mat.id)
    }
    await supabase.from('stock_returns').insert({
      tenant_id: tenant.id, return_type: data.returnType,
      from_project: data.fromProjectName, to_project: data.toProjectName || null,
      return_date: data.returnDate, reference_no: data.referenceNo || null,
      notes: data.notes || null,
      mat_name: data.rows.map((r: any) => r.mat?.name).filter(Boolean).join('، '),
      qty: data.rows.reduce((s: number, r: any) => s + r.qty, 0),
      unit: data.rows[0]?.mat?.unit || '', status: 'مكتمل',
    })
    await loadData(); setReturn(false)
    toast.success('✅ تم ' + data.returnType + ' بنجاح')
  }

  async function handleDispatch(rows: any[], projectName: string, note: string) {
    if (!tenant || !activeBranch) return
    for (const row of rows) {
      const newQty = row.mat.qty - row.qty
      if (newQty < 0) { toast.error('رصيد "' + row.mat.name + '" غير كافٍ'); return }
      const wh = warehouses.find((w: any) => w.id === row.mat.warehouse_id)
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'صرف', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name || '', project_name: projectName,
        dispatch_note: note || undefined,
      })
      await supabase.from('materials').update({ qty: newQty }).eq('id', row.mat.id)
    }
    await loadData(); setDispatch(false)
    toast.success('تم صرف ' + rows.length + ' مادة للمشروع "' + projectName + '" ✅')
  }

  async function handleTransfer(rows: any[], toWhId: number, toWhName: string) {
    if (!tenant || !activeBranch) return
    for (const row of rows) {
      const newQty = row.mat.qty - row.qty
      if (newQty < 0) { toast.error('رصيد "' + row.mat.name + '" غير كافٍ'); return }
      const wh = warehouses.find((w: any) => w.id === row.mat.warehouse_id)
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'نقل مخزني', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name || '', dispatch_note: 'تحويل إلى: ' + toWhName,
      })
      await supabase.from('materials').update({ qty: newQty }).eq('id', row.mat.id)
      const { data: existMat } = await supabase.from('materials').select('*')
        .eq('tenant_id', tenant.id).eq('warehouse_id', toWhId).eq('name', row.mat.name).single()
      if (existMat) {
        await supabase.from('materials').update({ qty: existMat.qty + row.qty }).eq('id', existMat.id)
      } else {
        const { id, ...matWithoutId } = row.mat
        await supabase.from('materials').insert({ ...matWithoutId, warehouse_id: toWhId, qty: row.qty })
      }
    }
    await loadData(); setTransfer(false)
    toast.success('تم تحويل ' + rows.length + ' مادة إلى "' + toWhName + '" ✅')
  }

  async function handleCheck(items: any[]) {
    if (!tenant || !activeBranch) return
    const changed = items.filter(i => i.actualQty !== i.systemQty)
    for (const item of changed) {
      const diff = item.actualQty - item.systemQty
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: diff > 0 ? 'توريد' : 'صرف',
        mat_name: item.matName, unit: item.unit,
        qty: Math.abs(diff), qty_before: item.systemQty, qty_after: item.actualQty,
        wh_name: '', dispatch_note: 'تسوية جرد',
      })
      await supabase.from('materials').update({ qty: item.actualQty }).eq('id', item.matId)
    }
    await loadData(); setCheck(false)
    toast.success('تم تأكيد الجرد — ' + changed.length + ' مادة تم تسويتها ✅')
  }


  // إحصائيات المستودعات
  const whByType: Record<string, InventoryWarehouse> = {}
  warehouses.forEach((w: any) => { if (w.wh_type) whByType[w.wh_type] = w })
  const activeWarehouses = WH_TYPES.filter(wt => whByType[wt.type]).length

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package style={{ width: '22px', height: '22px', color: '#1a56db' }} />
            إدارة المخزون
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '2px' }}>
            {activeWarehouses} مستودع نشط · {stats.total} مادة
            {loading && <span className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block mr-2" />}
          </p>
        </div>

      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المواد',     value: stats.total, color: '#1a56db', bg: '#eff6ff' },
          { label: '⚡ مواد SEC',       value: stats.sec,   color: '#1a56db', bg: '#eff6ff' },
          { label: '⚠️ تحت حد الأمان', value: stats.low,   color: '#e6820a', bg: '#fffbeb' },
          { label: '⛔ نفدت',          value: stats.empty, color: '#c81e1e', bg: '#fef2f2' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* بطاقة المستودع الرئيسي */}
      <div className="card" style={{ padding: '24px', cursor: 'pointer', transition: 'all 0.2s', border: '2px solid #e5e7eb' }}
        onClick={() => router.push('/inventory/warehouses')}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(26,86,219,0.1)'; e.currentTarget.style.borderColor = '#bfdbfe' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = '#e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WarehouseIcon style={{ width: '28px', height: '28px', color: '#1a56db' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1a1a2e' }}>المستودع الرئيسي</div>
              <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '4px' }}>
                {activeBranch?.name || 'الفرع الرئيسي'} · {activeWarehouses} أقسام
              </div>
              {/* المستودعات الأربعة كـ pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {WH_TYPES.map(wt => {
                  const exists = !!whByType[wt.type]
                  return (
                    <span key={wt.type} style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600,
                      background: exists ? wt.color + '15' : '#f3f4f6',
                      color: exists ? wt.color : '#9ca3af',
                      border: `1px solid ${exists ? wt.color + '33' : '#e5e7eb'}`,
                    }}>
                      {wt.icon} {wt.label.replace(' (SEC)', '')}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1a56db', fontWeight: 600, fontSize: '0.875rem' }}>
            فتح المستودعات
            <ChevronLeft style={{ width: '18px', height: '18px' }} />
          </div>
        </div>
      </div>

      {/* أزرار العمليات */}
      {canEdit && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {[
            { icon: '📥', label: 'استلام مواد',   sub: 'توريد جديد',          color: '#0ea77b', bg: '#ecfdf5', border: '#bbf7d0', onClick: () => setReceive(true) },
            { icon: '📤', label: 'صرف مواد',      sub: 'للمشاريع',            color: '#ef4444', bg: '#fff5f5', border: '#fecaca', onClick: () => setDispatch(true) },
            { icon: '↩️', label: 'إرجاع مواد',   sub: 'للكهرباء أو مشروع',  color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', onClick: () => setReturn(true) },
            { icon: '🔄', label: 'تحويل مواد',   sub: 'بين المستودعات',      color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', onClick: () => setTransfer(true) },
            { icon: '📋', label: 'جرد المستودع', sub: 'مطابقة الكميات',      color: '#e6820a', bg: '#fffbeb', border: '#fde68a', onClick: () => setCheck(true) },
          ].map((op, i) => (
            <button key={i} onClick={op.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${op.border}`, background: op.bg, color: op.color, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'right' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}>
              <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{op.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{op.label}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: '1px' }}>{op.sub}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modals */}
      {showReceive  && <ReceiveModal   warehouses={warehouses as any} projects={projectsList} onClose={() => setReceive(false)} onSave={handleReceive as any} />}
      {showReturn   && <ReturnModal    materials={[]} projects={projectsList} onClose={() => setReturn(false)} onSave={handleReturn} />}
      {showDispatch && <DispatchModal  materials={[]} projects={projectsList} warehouse={warehouses[0] as any} onClose={() => setDispatch(false)} onSave={handleDispatch} />}
      {showTransfer && <TransferModal  materials={[]} warehouses={warehouses as any} onClose={() => setTransfer(false)} onSave={handleTransfer as any} />}
      {showCheck    && <InventoryCheckModal materials={[]} onClose={() => setCheck(false)} onSave={handleCheck} />}
    </div>
  )
}
