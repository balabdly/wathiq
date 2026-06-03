// src/app/(dashboard)/inventory/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ledgerApi, warehousesApi } from '@/lib/db'
import {
  Package, Plus, Eye, Pencil, Trash2, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ShoppingCart, ClipboardCheck, List, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { WH_TYPES, TX_COLORS, type InventoryWarehouse, type InventoryMaterial } from '@/components/inventory/types'
import ReceiveModal from '@/components/inventory/ReceiveModal'
import ReturnModal from '@/components/inventory/ReturnModal'
import WarehouseModal from '@/components/inventory/WarehouseModal'
import { formatDate } from '@/lib/utils'

export default function InventoryPage() {
  const { tenant, activeBranch, warehouses, setWarehouses, projects, currentUser, materials } = useStore()
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [stats, setStats]       = useState({ total: 0, sec: 0, low: 0, empty: 0 })
  const [activeTab, setActiveTab] = useState<'warehouses' | 'ledger' | 'byproject' | 'returns'>('warehouses')
  const [ledger, setLedger]     = useState<any[]>([])
  const [returns, setReturns]   = useState<any[]>([])
  const [loadingReturns, setLoadingReturns] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')
  const [projectLedger, setProjectLedger]     = useState<any[]>([])
  const [loadingProject, setLoadingProject]   = useState(false)

  // modals
  const [showReceive, setReceive]   = useState(false)
  const [showReturn, setReturn]     = useState(false)
  const [showWhModal, setWhModal]   = useState(false)
  const [editWh, setEditWh]         = useState<InventoryWarehouse | null>(null)

  const canEdit = currentUser?.permissions?.includes('inventory')
  const projectsList = (projects || []).map(p => ({ id: p.id, name: p.name }))

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const { data: wData } = await supabase.from('warehouses')
      .select('*').eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).order('id')
    setWarehouses(wData || [])

    // إحصائيات
    const [total, sec, low, empty] = await Promise.all([
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id),
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('source', 'كهرباء'),
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('source', 'خاص').filter('qty', 'lte', 'reorder').gt('qty', 0),
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('source', 'خاص').lte('qty', 0),
    ])
    setStats({ total: total.count || 0, sec: sec.count || 0, low: low.count || 0, empty: empty.count || 0 })
    setLoading(false)
  }

  async function loadLedger() {
    if (!tenant || !activeBranch) return
    const { data } = await supabase.from('stock_ledger').select('*')
      .eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id)
      .order('created_at', { ascending: false }).limit(200)
    setLedger(data || [])
  }

  async function loadReturns() {
    if (!tenant) return
    setLoadingReturns(true)
    const { data } = await supabase.from('stock_returns')
      .select('*').eq('tenant_id', tenant.id)
      .order('return_date', { ascending: false })
    setReturns(data || [])
    setLoadingReturns(false)
  }

  async function loadProjectLedger(projectName: string) {
    if (!tenant || !projectName) { setProjectLedger([]); return }
    setLoadingProject(true)
    const { data } = await supabase.from('stock_ledger').select('*')
      .eq('tenant_id', tenant.id).eq('project_name', projectName)
      .order('created_at', { ascending: false })
    setProjectLedger(data || [])
    setLoadingProject(false)
  }

  async function handleSaveWarehouse(data: any) {
    if (!tenant || !activeBranch) return
    let error: any = null
    if (data.id) {
      const { error: err } = await supabase.from('warehouses')
        .update({ name: data.name, location: data.location, sections: data.sections })
        .eq('id', data.id)
      error = err
    } else {
      const { error: err } = await supabase.from('warehouses')
        .insert({ name: data.name, location: data.location, sections: data.sections, tenant_id: tenant.id, branch_id: activeBranch.id })
      error = err
    }
    if (error) { toast.error('خطأ: ' + error.message); return }
    await loadData(); setWhModal(false); setEditWh(null)
    toast.success(data.id ? 'تم التعديل ✅' : 'تمت الإضافة ✅')
  }

  async function handleReceive(
    rows: { mat: InventoryMaterial; qty: number; projectId: number | '' }[],
    vendor: string, reservationNo: string, exitPermitNo: string, warehouseId: number
  ) {
    if (!tenant || !activeBranch) return
    const wh = warehouses.find(w => w.id === warehouseId)
    for (const row of rows) {
      const newQty = row.mat.qty + row.qty
      const projectName = projectsList.find(p => p.id === Number(row.projectId))?.name
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'توريد', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name || '',
        vendor_name: vendor || undefined,
        project_name: projectName,
        clearance_no: exitPermitNo || undefined,
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
      const wh = warehouses.find(w => w.id === row.mat.warehouse_id)
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: (data.returnType === 'إرجاع للكهرباء' ? 'إرجاع للكهرباء' : 'تحويل لمشروع') as any,
        mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name || '',
        project_name: data.fromProjectName,
        dispatch_note: data.returnType === 'تحويل لمشروع'
          ? 'تحويل إلى مشروع: ' + data.toProjectName
          : 'إرجاع للكهرباء — محضر: ' + (data.referenceNo || '—'),
        doc_code: data.referenceNo || undefined,
      })
      await supabase.from('materials').update({ qty: newQty }).eq('id', row.mat.id)
    }
    await supabase.from('stock_returns').insert({
      tenant_id: tenant.id,
      return_type: data.returnType,
      from_project: data.fromProjectName,
      to_project: data.toProjectName || null,
      return_date: data.returnDate,
      reference_no: data.referenceNo || null,
      notes: data.notes || null,
      mat_name: data.rows.map((r: any) => r.mat?.name).filter(Boolean).join('، '),
      qty: data.rows.reduce((s: number, r: any) => s + r.qty, 0),
      unit: data.rows[0]?.mat?.unit || '',
      status: 'مكتمل',
    })
    await loadData(); setReturn(false)
    toast.success('✅ تم ' + data.returnType + ' بنجاح')
  }

  // حساب مواد المشروع
  const matMap: Record<string, any> = {}
  projectLedger.forEach(l => {
    if (!matMap[l.mat_name]) matMap[l.mat_name] = { matName: l.mat_name, unit: l.unit, totalIn: 0, totalOut: 0 }
    if (l.type === 'توريد') matMap[l.mat_name].totalIn += l.qty
    else matMap[l.mat_name].totalOut += l.qty
    matMap[l.mat_name].net = matMap[l.mat_name].totalIn - matMap[l.mat_name].totalOut
  })
  const projectMats = Object.values(matMap)

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
            {warehouses.length} مستودع · {stats.total} مادة
            {loading && <span className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block mr-1" />}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditWh(null); setWhModal(true) }} className="btn btn-ghost btn-sm border border-gray-200">
            <Plus style={{ width: '15px', height: '15px' }} /> مستودع جديد
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المواد',     value: stats.total, color: '#1a56db', bg: '#eff6ff' },
          { label: '⚡ مواد SEC',        value: stats.sec,   color: '#1a56db', bg: '#eff6ff' },
          { label: '⚠️ تحت حد الأمان', value: stats.low,   color: '#e6820a', bg: '#fffbeb' },
          { label: '⛔ نفدت',           value: stats.empty, color: '#c81e1e', bg: '#fef2f2' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* أزرار العمليات */}
      {canEdit && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <ArrowDownToLine className="w-6 h-6" />, label: 'استلام مواد',  sub: 'توريد جديد',          color: '#0ea77b', onClick: () => setReceive(true) },
            { icon: <ArrowUpFromLine className="w-6 h-6" />,  label: 'صرف مواد',   sub: 'للمشاريع',            color: '#ef4444', onClick: () => {} },
            { icon: <span style={{ fontSize: '1.3rem' }}>↩️</span>, label: 'إرجاع مواد', sub: 'للكهرباء أو مشروع', color: '#1a56db', onClick: () => setReturn(true) },
            { icon: <ClipboardCheck className="w-6 h-6" />,   label: 'جرد مستودع', sub: 'مطابقة الكميات',      color: '#e6820a', onClick: () => {} },
          ].map((op, i) => (
            <button key={i} onClick={op.onClick}
              style={{ background: op.color, color: 'white', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {op.icon}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{op.label}</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>{op.sub}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        {[
          { id: 'warehouses', label: '🏭 المستودعات' },
          { id: 'ledger',     label: '📋 سجل الحركات',   onSelect: loadLedger },
          { id: 'byproject',  label: '📊 مواد المشاريع' },
          { id: 'returns',    label: '↩️ الإرجاع',        onSelect: loadReturns },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any); (t as any).onSelect?.() }}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: activeTab === t.id ? 'white' : 'transparent',
              color: activeTab === t.id ? '#1a56db' : '#6b7280',
              boxShadow: activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ تاب المستودعات ══ */}
      {activeTab === 'warehouses' && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* المستودعات الأربعة الثابتة */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {WH_TYPES.map(wt => {
                const wh = warehouses.find(w => (w as any).wh_type === wt.type)
                return (
                  <div key={wt.type} className="card" style={{ padding: '20px', border: wh ? `2px solid ${wt.color}22` : '2px dashed #e5e7eb' }}>
                    {/* هيدر */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: wt.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                          {wt.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: wt.color }}>{wt.label}</div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>{wt.desc}</div>
                        </div>
                      </div>
                      {canEdit && wh && (
                        <button onClick={() => { setEditWh(wh as any); setWhModal(true) }}
                          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '7px', cursor: 'pointer', padding: '4px 6px', color: '#6b7280' }}>
                          <Pencil style={{ width: '13px', height: '13px' }} />
                        </button>
                      )}
                    </div>

                    {wh ? (
                      <>
                        {/* أقسام المستودع */}
                        {(wh as any).sections?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                            {(wh as any).sections.map((s: string, i: number) => (
                              <span key={i} style={{ background: wt.color + '12', border: `1px solid ${wt.color}33`, borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', color: wt.color, fontWeight: 600 }}>
                                📦 {s}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* زر الدخول */}
                        <button onClick={() => router.push('/inventory/' + wh.id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: wt.color, color: 'white', fontWeight: 700, fontSize: '0.875rem', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                          <Eye style={{ width: '15px', height: '15px' }} />
                          فتح المستودع
                          <ChevronRight style={{ width: '15px', height: '15px' }} />
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '12px 0' }}>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '10px' }}>لم يُنشأ بعد</div>
                        {canEdit && (
                          <button onClick={() => setWhModal(true)}
                            style={{ padding: '6px 16px', borderRadius: '8px', border: `1px dashed ${wt.color}`, background: 'transparent', cursor: 'pointer', color: wt.color, fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Plus style={{ width: '13px', height: '13px' }} /> إنشاء
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* مستودعات إضافية */}
            {warehouses.filter(w => !['projects','returns','scrap','private'].includes((w as any).wh_type || '')).length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#9ca3af', marginBottom: '8px' }}>مستودعات إضافية</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                  {warehouses.filter(w => !['projects','returns','scrap','private'].includes((w as any).wh_type || '')).map(wh => (
                    <div key={wh.id} className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 700 }}>{wh.name}</div>
                        {canEdit && (
                          <button onClick={() => { setEditWh(wh as any); setWhModal(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '13px', height: '13px' }} />
                          </button>
                        )}
                      </div>
                      <button onClick={() => router.push('/inventory/' + wh.id)} className="btn btn-primary w-full btn-sm" style={{ display: 'flex', justifyContent: 'center' }}>
                        <Eye style={{ width: '13px', height: '13px' }} /> فتح
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ══ تاب سجل الحركات ══ */}
      {activeTab === 'ledger' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['النوع','المادة','الكمية','المستودع','المشروع','رقم الحجز','إذن الخروج','المورد / الملاحظة','التاريخ'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>لا توجد حركات</td></tr>
                ) : ledger.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '11px 14px' }}>
                      <span className={`badge ${TX_COLORS[l.type] || 'badge-gray'}`}>{l.type}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 600 }}>{l.mat_name}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 700 }}>{l.qty} {l.unit}</td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: '0.82rem' }}>{l.wh_name}</td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: '0.82rem' }}>{l.project_name || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: '0.78rem', fontFamily: 'monospace' }}>{l.doc_code || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: '0.78rem', fontFamily: 'monospace' }}>{l.clearance_no || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: '0.82rem' }}>{l.vendor_name || l.dispatch_note || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#9ca3af', fontSize: '0.78rem' }}>{formatDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ تاب مواد المشاريع ══ */}
      {activeTab === 'byproject' && (
        <div className="space-y-4">
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>اختر مشروعاً:</label>
              <select value={selectedProject} onChange={e => { setSelectedProject(e.target.value); loadProjectLedger(e.target.value) }}
                className="select" style={{ flex: 1, minWidth: '200px' }}>
                <option value="">— اختر مشروعاً لعرض مواده —</option>
                {projectsList.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {selectedProject && (
                <button onClick={() => { setSelectedProject(''); setProjectLedger([]) }} className="btn btn-ghost btn-sm" style={{ color: '#9ca3af' }}>
                  <X style={{ width: '14px', height: '14px' }} />
                </button>
              )}
            </div>
          </div>

          {!selectedProject ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <Package style={{ width: '48px', height: '48px', margin: '0 auto 12px' }} />
              اختر مشروعاً لعرض مواده
            </div>
          ) : loadingProject ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : projectMats.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>لا توجد مواد لهذا المشروع</div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: '#1a56db' }}>📁 {selectedProject}</div>
                <span className="badge badge-blue">{projectMats.length} مادة</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {['المادة','وارد','صادر','الرصيد','الوحدة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectMats.map((m: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.matName}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#0ea77b', fontWeight: 700 }}>{m.totalIn}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#c81e1e', fontWeight: 700 }}>{m.totalOut}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: m.net < 0 ? '#c81e1e' : m.net === 0 ? '#9ca3af' : '#1a56db' }}>{m.net}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#9ca3af' }}>{m.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ تاب الإرجاع ══ */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          {loadingReturns ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : returns.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>↩️</div>
              <p style={{ color: '#9ca3af', marginBottom: '8px' }}>لا توجد إرجاعات بعد</p>
              {canEdit && (
                <button onClick={() => setReturn(true)} className="btn btn-primary btn-sm" style={{ margin: '0 auto' }}>
                  تسجيل إرجاع جديد
                </button>
              )}
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['النوع','من مشروع','إلى','المواد','الكمية','التاريخ','رقم المحضر','الحالة'].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 14px' }}>
                          <span className={`badge ${r.return_type === 'إرجاع للكهرباء' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.72rem' }}>
                            {r.return_type === 'إرجاع للكهرباء' ? '⚡ للكهرباء' : '🔄 لمشروع'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.from_project}</td>
                        <td style={{ padding: '12px 14px', color: '#6b7280' }}>{r.to_project || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#6b7280', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.mat_name}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>{r.qty} {r.unit}</td>
                        <td style={{ padding: '12px 14px' }}>{r.return_date}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#6b7280' }}>{r.reference_no || '—'}</td>
                        <td style={{ padding: '12px 14px' }}><span className="badge badge-green" style={{ fontSize: '0.72rem' }}>✅ مكتمل</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showWhModal  && <WarehouseModal warehouse={editWh || undefined} onClose={() => { setWhModal(false); setEditWh(null) }} onSave={handleSaveWarehouse} />}
      {showReceive  && <ReceiveModal materials={materials as any} warehouses={warehouses as any} projects={projectsList} onClose={() => setReceive(false)} onSave={handleReceive as any} />}
      {showReturn   && <ReturnModal  materials={materials as any} projects={projectsList} onClose={() => setReturn(false)} onSave={handleReturn} />}
    </div>
  )
}
