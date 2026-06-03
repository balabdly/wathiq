// src/app/(dashboard)/inventory/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { ledgerApi } from '@/lib/db'
import {
  Package, Warehouse as WarehouseIcon, ChevronLeft,
  ArrowDownToLine, TrendingDown, TrendingUp, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { WH_TYPES, TX_COLORS, type InventoryWarehouse } from '@/components/inventory/types'
import ReceiveModal from '@/components/inventory/ReceiveModal'
import ReturnModal from '@/components/inventory/ReturnModal'
import { formatDate } from '@/lib/utils'

export default function InventoryPage() {
  const router = useRouter()
  const { tenant, activeBranch, warehouses, setWarehouses, projects, materials, currentUser } = useStore()
  const [loading, setLoading]   = useState(true)
  const [stats, setStats]       = useState({ total: 0, sec: 0, low: 0, empty: 0 })
  const [activeTab, setActiveTab] = useState<'ledger' | 'byproject' | 'returns'>('ledger')
  const [ledger, setLedger]     = useState<any[]>([])
  const [ledgerLoaded, setLedgerLoaded] = useState(false)
  const [returns, setReturns]   = useState<any[]>([])
  const [loadingReturns, setLoadingReturns] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')
  const [projectLedger, setProjectLedger]     = useState<any[]>([])
  const [loadingProject, setLoadingProject]   = useState(false)
  const [showReceive, setReceive] = useState(false)
  const [showReturn, setReturn]   = useState(false)

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

    // جلب سجل الحركات تلقائياً
    const { data: lData } = await supabase.from('stock_ledger').select('*')
      .eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id)
      .order('created_at', { ascending: false }).limit(100)
    setLedger(lData || [])
    setLedgerLoaded(true)
  }

  async function loadReturns() {
    if (!tenant || loadingReturns) return
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

  // مواد المشروع
  const matMap: Record<string, any> = {}
  projectLedger.forEach(l => {
    if (!matMap[l.mat_name]) matMap[l.mat_name] = { matName: l.mat_name, unit: l.unit, totalIn: 0, totalOut: 0 }
    if (l.type === 'توريد') matMap[l.mat_name].totalIn += l.qty
    else matMap[l.mat_name].totalOut += l.qty
    matMap[l.mat_name].net = matMap[l.mat_name].totalIn - matMap[l.mat_name].totalOut
  })
  const projectMats = Object.values(matMap)

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
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setReceive(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <ArrowDownToLine style={{ width: '15px', height: '15px' }} /> استلام مواد
            </button>
            <button onClick={() => setReturn(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <span>↩️</span> إرجاع مواد
            </button>
          </div>
        )}
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        {[
          { id: 'ledger',    label: '📋 سجل الحركات' },
          { id: 'byproject', label: '📊 مواد المشاريع' },
          { id: 'returns',   label: '↩️ الإرجاع', onSelect: loadReturns },
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

      {/* ══ سجل الحركات ══ */}
      {activeTab === 'ledger' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {!ledgerLoaded ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : ledger.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>لا توجد حركات بعد</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['النوع','المادة','الكمية','المستودع','المشروع','المرجع','التاريخ'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${TX_COLORS[l.type] || 'badge-gray'}`} style={{ fontSize: '0.72rem' }}>{l.type}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{l.mat_name}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{l.qty} <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.78rem' }}>{l.unit}</span></td>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: '0.82rem' }}>{l.wh_name}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: '0.82rem' }}>{l.project_name || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: '0.78rem', fontFamily: 'monospace' }}>{l.doc_code || l.clearance_no || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: '0.78rem' }}>{formatDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ مواد المشاريع ══ */}
      {activeTab === 'byproject' && (
        <div className="space-y-4">
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}>اختر مشروعاً:</label>
              <select value={selectedProject}
                onChange={e => { setSelectedProject(e.target.value); loadProjectLedger(e.target.value) }}
                className="select" style={{ flex: 1, minWidth: '200px' }}>
                <option value="">— اختر مشروعاً لعرض مواده —</option>
                {projectsList.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {selectedProject && (
                <button onClick={() => { setSelectedProject(''); setProjectLedger([]) }}
                  className="btn btn-ghost btn-sm" style={{ color: '#9ca3af' }}>
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
              <div style={{ padding: '12px 18px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, color: '#1a56db' }}>📁 {selectedProject}</div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem' }}>
                  <span style={{ color: '#0ea77b' }}>وارد: <b>{projectMats.reduce((s: any, m: any) => s + m.totalIn, 0)}</b></span>
                  <span style={{ color: '#c81e1e' }}>صادر: <b>{projectMats.reduce((s: any, m: any) => s + m.totalOut, 0)}</b></span>
                  <span style={{ color: '#1a56db' }}>الرصيد: <b>{projectMats.reduce((s: any, m: any) => s + m.net, 0)}</b></span>
                </div>
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

      {/* ══ الإرجاع ══ */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          {loadingReturns ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : returns.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>↩️</div>
              <p style={{ color: '#9ca3af' }}>لا توجد إرجاعات بعد</p>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['النوع','من مشروع','إلى','المواد','الكمية','التاريخ','المحضر','الحالة'].map(h => (
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
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>{r.reference_no || '—'}</td>
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
      {showReceive && <ReceiveModal materials={materials as any} warehouses={warehouses as any} projects={projectsList} onClose={() => setReceive(false)} onSave={handleReceive as any} />}
      {showReturn  && <ReturnModal  materials={materials as any} projects={projectsList} onClose={() => setReturn(false)} onSave={handleReturn} />}
    </div>
  )
}
