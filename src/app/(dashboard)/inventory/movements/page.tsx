'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  ArrowDownToLine, ArrowUpFromLine, RotateCcw, ArrowLeftRight,
  Search, Filter, Download, Printer, X, Package, ChevronLeft, ChevronRight
} from 'lucide-react'

// ══════════════════════════════════════════
// Types & Constants
// ══════════════════════════════════════════
type LedgerEntry = {
  id: number; type: string; mat_name: string; mat_code?: string
  unit: string; qty: number; qty_before: number; qty_after: number
  wh_name: string; project_name?: string; dispatch_note?: string
  vendor_name?: string; doc_code?: string; booking_no?: string
  client_name?: string; created_at: string; attachment_url?: string
  txn_number?: string
}

const MOVEMENT_META: Record<string, { color: string; bg: string; border: string; icon: any; sign: string }> = {
  'استلام':        { color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', icon: ArrowDownToLine, sign: '+' },
  'صرف':           { color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', icon: ArrowUpFromLine, sign: '-' },
  'إرجاع':         { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: RotateCcw,       sign: '+' },
  'إرجاع للعميل':  { color: '#e6820a', bg: '#fffbeb', border: '#fde68a', icon: RotateCcw,       sign: '-' },
  'تحويل':         { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', icon: ArrowLeftRight,  sign: '±' },
  'تسوية جرد':     { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', icon: Package,         sign: '~' },
}

const PAGE_SIZE = 50
const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ar-SA') + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
}

// ══════════════════════════════════════════
// طباعة سند الحركة
// ══════════════════════════════════════════
function printMovement(entry: LedgerEntry) {
  const mv = MOVEMENT_META[entry.type] || { color: '#6b7280', sign: '' }
  const win = window.open('', '_blank', 'width=700,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body { font-family: 'Arial', sans-serif; font-size: 13px; color: #111; padding: 30px; direction: rtl }
    .header { border-bottom: 3px solid ${mv.color}; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start }
    .title { font-size: 20px; font-weight: 700; color: ${mv.color} }
    .badge { background: ${mv.color}18; color: ${mv.color}; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px }
    .field { background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e5e7eb }
    .field-label { font-size: 11px; color: #9ca3af; margin-bottom: 3px }
    .field-value { font-weight: 600; font-size: 14px }
    .qty-box { background: ${mv.color}10; border: 2px solid ${mv.color}33; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px }
    .qty-num { font-size: 2.5rem; font-weight: 800; color: ${mv.color} }
    .footer { margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 16px; display: flex; justify-content: space-around; font-size: 12px; color: #9ca3af }
    @media print { .noprint { display: none } body { padding: 15px } }
  </style></head><body>
  <div class="header">
    <div>
      <div class="title">سند ${entry.type}</div>
      <div style="color:#9ca3af;font-size:12px;margin-top:4px">${formatDateTime(entry.created_at)}</div>
    </div>
    <span class="badge">${entry.type}</span>
  </div>
  <div class="qty-box">
    <div style="color:#9ca3af;font-size:12px;margin-bottom:6px">المادة</div>
    <div style="font-size:1.2rem;font-weight:700;margin-bottom:10px">${entry.mat_name}</div>
    <div class="qty-num">${mv.sign}${fmt(Number(entry.qty))} ${entry.unit}</div>
    <div style="color:#9ca3af;font-size:12px;margin-top:6px">${fmt(Number(entry.qty_before))} ← ${fmt(Number(entry.qty_after))} ${entry.unit}</div>
  </div>
  <div class="grid">
    <div class="field"><div class="field-label">المستودع</div><div class="field-value">${entry.wh_name || '—'}</div></div>
    ${entry.project_name ? `<div class="field"><div class="field-label">المشروع</div><div class="field-value">${entry.project_name}</div></div>` : ''}
    ${entry.vendor_name  ? `<div class="field"><div class="field-label">المورد</div><div class="field-value">${entry.vendor_name}</div></div>` : ''}
    ${entry.doc_code     ? `<div class="field"><div class="field-label">رقم المستند</div><div class="field-value">${entry.doc_code}</div></div>` : ''}
    ${entry.client_name  ? `<div class="field"><div class="field-label">العميل</div><div class="field-value">${entry.client_name}</div></div>` : ''}
    ${entry.dispatch_note? `<div class="field"><div class="field-label">البيان</div><div class="field-value">${entry.dispatch_note}</div></div>` : ''}
  </div>
  <div class="footer">
    <div>توقيع المستلم: _______________</div>
    <div>توقيع المسلّم: _______________</div>
  </div>
  <div class="noprint" style="text-align:center;padding:16px;margin-top:16px;border-top:1px solid #e5e7eb">
    <button onclick="window.print()" style="padding:10px 28px;background:${mv.color};color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;margin-left:10px">🖨️ طباعة</button>
    <button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">إغلاق</button>
  </div>
  </body></html>`)
  win.document.close()
}

// ══════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════
export default function InventoryMovementsPage() {
  const { tenant } = useStore()

  const [entries,    setEntries]    = useState<LedgerEntry[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [projects,   setProjects]   = useState<any[]>([])

  // فلاتر
  const [fSearch,   setFSearch]   = useState('')
  const [fType,     setFType]     = useState('')
  const [fWh,       setFWh]       = useState('')
  const [fProject,  setFProject]  = useState('')
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo,   setFDateTo]   = useState('')

  // KPIs
  const [kpis, setKpis] = useState({ totalIn: 0, totalOut: 0, totalMoves: 0, todayMoves: 0 })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id])

  async function loadBase() {
    if (!tenant) return
    const [whRes, projRes] = await Promise.all([
      supabase.from('warehouses').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ])
    setWarehouses(whRes.data || [])
    setProjects(projRes.data || [])
    loadMovements(1)
    loadKPIs()
  }

  async function loadKPIs() {
    if (!tenant) return
    const today = new Date().toISOString().split('T')[0]
    const [inRes, outRes, todayRes] = await Promise.all([
      supabase.from('stock_ledger').select('qty').eq('tenant_id', tenant.id).eq('type', 'استلام'),
      supabase.from('stock_ledger').select('qty').eq('tenant_id', tenant.id).eq('type', 'صرف'),
      supabase.from('stock_ledger').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).gte('created_at', today),
    ])
    const totalIn  = (inRes.data  || []).reduce((s, r) => s + Number(r.qty), 0)
    const totalOut = (outRes.data || []).reduce((s, r) => s + Number(r.qty), 0)
    setKpis({ totalIn, totalOut, totalMoves: (inRes.data?.length || 0) + (outRes.data?.length || 0), todayMoves: todayRes.count || 0 })
  }

  async function loadMovements(p = 1) {
    if (!tenant) return
    setLoading(true)
    const from = (p - 1) * PAGE_SIZE

    let q = supabase.from('stock_ledger')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (fType)     q = q.eq('type', fType)
    if (fWh)       q = q.eq('wh_name', fWh)
    if (fProject)  q = q.eq('project_name', fProject)
    if (fDateFrom) q = q.gte('created_at', fDateFrom)
    if (fDateTo)   q = q.lte('created_at', fDateTo + 'T23:59:59')
    if (fSearch)   q = q.ilike('mat_name', `%${fSearch}%`)

    const { data, count } = await q
    setEntries(data || [])
    setTotal(count || 0)
    setPage(p)
    setLoading(false)
  }

  function exportExcel() {
    const headers = ['النوع', 'المادة', 'الكمية', 'الوحدة', 'قبل', 'بعد', 'المستودع', 'المشروع', 'المورد', 'المستند', 'التاريخ']
    const rows = entries.map(e => [e.type, e.mat_name, e.qty, e.unit, e.qty_before, e.qty_after, e.wh_name, e.project_name || '', e.vendor_name || '', e.doc_code || '', formatDateTime(e.created_at)])
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'الحركات.xls'; a.click()
  }

  const todayStr = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* العنوان */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeftRight style={{ width: '22px', height: '22px', color: '#0891b2' }} /> سجل الحركات
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>{todayStr}</p>
        </div>
        <button onClick={exportExcel} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
          <Download style={{ width: '15px', height: '15px' }} /> تصدير Excel
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الاستلام',    value: fmt(kpis.totalIn),    color: '#0ea77b', bg: '#ecfdf5', icon: ArrowDownToLine },
          { label: 'إجمالي الصرف',       value: fmt(kpis.totalOut),   color: '#c81e1e', bg: '#fef2f2', icon: ArrowUpFromLine },
          { label: 'إجمالي الحركات',     value: fmt(kpis.totalMoves), color: '#0891b2', bg: '#ecfeff', icon: ArrowLeftRight  },
          { label: 'حركات اليوم',         value: fmt(kpis.todayMoves), color: '#7c3aed', bg: '#f5f3ff', icon: Package         },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <kpi.icon style={{ width: '18px', height: '18px', color: kpi.color }} />
              </div>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* أنواع الحركات — فلاتر سريعة */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { val: '', label: 'الكل' },
          ...Object.entries(MOVEMENT_META).map(([val, meta]) => ({ val, label: val, color: meta.color, bg: meta.bg })),
        ].map(opt => (
          <button key={opt.val} onClick={() => { setFType(opt.val); setTimeout(() => loadMovements(1), 0) }}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
              borderColor: fType === opt.val ? ((opt as any).color || '#1a56db') : 'var(--border)',
              background: fType === opt.val ? ((opt as any).bg || '#eff6ff') : 'transparent',
              color: fType === opt.val ? ((opt as any).color || '#1a56db') : 'var(--text3)',
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* الفلاتر التفصيلية */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
          <input value={fSearch} onChange={e => setFSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadMovements(1)}
            placeholder="بحث باسم المادة..." className="input" style={{ paddingRight: '32px', width: '180px', fontSize: '0.82rem' }} />
        </div>
        <select value={fWh} onChange={e => setFWh(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
          <option value="">كل المستودعات</option>
          {warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
        </select>
        <select value={fProject} onChange={e => setFProject(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
          <option value="">كل المشاريع</option>
          {projects.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>من تاريخ</label>
          <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>إلى تاريخ</label>
          <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
        </div>
        <button onClick={() => loadMovements(1)} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
          <Filter style={{ width: '13px', height: '13px' }} /> بحث
        </button>
        {(fSearch || fWh || fProject || fDateFrom || fDateTo || fType) && (
          <button onClick={() => { setFSearch(''); setFType(''); setFWh(''); setFProject(''); setFDateFrom(''); setFDateTo(''); setTimeout(() => loadMovements(1), 0) }}
            className="btn btn-ghost" style={{ fontSize: '0.82rem', color: '#c81e1e' }}>
            <X style={{ width: '13px', height: '13px' }} /> مسح
          </button>
        )}
      </div>

      {/* الجدول */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        {/* رأس الجدول مع العداد */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2, #f8fafc)' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text3)' }}>
            {total.toLocaleString()} حركة
            {(fSearch || fWh || fProject || fDateFrom || fDateTo || fType) && ' (مفلترة)'}
          </span>
          {totalPages > 1 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>صفحة {page} / {totalPages}</span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#0891b2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>لا توجد حركات بهذه الفلاتر</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2, #f8fafc)' }}>
                    {['النوع', 'المادة', 'الكمية', 'قبل / بعد', 'المستودع', 'المشروع', 'المورد / المستند', 'التاريخ', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const mv = MOVEMENT_META[e.type] || { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: Package, sign: '' }
                    const MvIcon = mv.icon
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)', transition: 'background 0.1s' }}
                        onMouseEnter={ex => (ex.currentTarget as HTMLElement).style.background = 'var(--bg2, #f8fafc)'}
                        onMouseLeave={ex => (ex.currentTarget as HTMLElement).style.background = 'transparent'}>

                        {/* النوع */}
                        <td style={{ padding: '11px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: mv.bg, color: mv.color, border: `1px solid ${mv.border}`, borderRadius: '20px', padding: '3px 10px', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            <MvIcon style={{ width: '12px', height: '12px' }} />
                            {e.type}
                          </span>
                        </td>

                        {/* المادة */}
                        <td style={{ padding: '11px 12px' }}>
                          <div style={{ fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.mat_name}</div>
                          {e.mat_code && <div style={{ fontSize: '0.68rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{e.mat_code}</div>}
                        </td>

                        {/* الكمية */}
                        <td style={{ padding: '11px 12px', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: mv.color, whiteSpace: 'nowrap' }}>
                          {mv.sign}{fmt(Number(e.qty))} {e.unit}
                        </td>

                        {/* قبل / بعد */}
                        <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text3)' }}>{fmt(Number(e.qty_before))}</span>
                            <span style={{ color: 'var(--text3)' }}>→</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: Number(e.qty_after) > Number(e.qty_before) ? '#0ea77b' : Number(e.qty_after) < Number(e.qty_before) ? '#c81e1e' : 'var(--text3)' }}>
                              {fmt(Number(e.qty_after))}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{e.unit}</span>
                          </div>
                        </td>

                        {/* المستودع */}
                        <td style={{ padding: '11px 12px', color: 'var(--text3)', fontSize: '0.78rem', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.wh_name || '—'}
                        </td>

                        {/* المشروع */}
                        <td style={{ padding: '11px 12px', fontSize: '0.78rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.project_name ? (
                            <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '6px', padding: '2px 8px', fontWeight: 600, fontSize: '0.72rem' }}>
                              {e.project_name}
                            </span>
                          ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>

                        {/* المورد / المستند */}
                        <td style={{ padding: '11px 12px', fontSize: '0.75rem' }}>
                          {e.vendor_name && <div style={{ color: 'var(--text)', fontWeight: 500 }}>{e.vendor_name}</div>}
                          {e.doc_code    && <div style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{e.doc_code}</div>}
                          {e.dispatch_note && <div style={{ color: 'var(--text3)', fontSize: '0.68rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.dispatch_note}</div>}
                          {!e.vendor_name && !e.doc_code && !e.dispatch_note && <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>

                        {/* التاريخ */}
                        <td style={{ padding: '11px 12px', color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          {formatDateTime(e.created_at)}
                        </td>

                        {/* الأزرار */}
                        <td style={{ padding: '11px 8px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => printMovement(e)} title="طباعة السند"
                              style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                              <Printer style={{ width: '12px', height: '12px' }} />
                            </button>
                            {e.attachment_url && (
                              <a href={e.attachment_url} target="_blank" rel="noopener noreferrer"
                                style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', display: 'flex', alignItems: 'center' }}>
                                <Download style={{ width: '12px', height: '12px' }} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2, #f8fafc)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                  {((page - 1) * PAGE_SIZE) + 1} — {Math.min(page * PAGE_SIZE, total)} من {total.toLocaleString()} حركة
                </span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button onClick={() => loadMovements(1)} disabled={page === 1}
                    style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: '0.75rem' }}>«</button>
                  <button onClick={() => loadMovements(page - 1)} disabled={page === 1}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                  <span style={{ padding: '5px 12px', fontSize: '0.78rem', color: 'var(--text3)', background: 'white', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    {page} / {totalPages}
                  </span>
                  <button onClick={() => loadMovements(page + 1)} disabled={page === totalPages}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button onClick={() => loadMovements(totalPages)} disabled={page === totalPages}
                    style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontSize: '0.75rem' }}>»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
