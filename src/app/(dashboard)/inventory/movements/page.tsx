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
  txn_number?: string; movement_category?: string
  is_loan?: boolean; loan_from_project?: string; loan_to_project?: string
}

const MOVEMENT_META: Record<string, { color: string; bg: string; border: string; icon: any; sign: string; label: string }> = {
  // بالنوع الأصلي
  'استلام':        { color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', icon: ArrowDownToLine, sign: '+', label: 'استلام'         },
  'صرف':           { color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', icon: ArrowUpFromLine, sign: '-', label: 'صرف'             },
  'إرجاع للعميل':  { color: '#e6820a', bg: '#fffbeb', border: '#fde68a', icon: RotateCcw,       sign: '-', label: 'إرجاع للعميل'   },
  'تحويل':         { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', icon: ArrowLeftRight,  sign: '±', label: 'تحويل'          },
  'تسوية جرد':     { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', icon: Package,         sign: '~', label: 'تسوية جرد'      },
  // بفئة الحركة (movement_category) — الأولوية لها
  'استلام_عهدة':   { color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', icon: ArrowDownToLine, sign: '+', label: 'استلام عهدة'    },
  'صرف_عهدة':      { color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', icon: ArrowUpFromLine, sign: '-', label: 'صرف عهدة'       },
  'ارجاع_عميل':    { color: '#e6820a', bg: '#fffbeb', border: '#fde68a', icon: RotateCcw,       sign: '-', label: 'إرجاع للعميل'   },
  'استلام_مقايسة': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: ArrowDownToLine, sign: '+', label: 'استلام مقايسة'  },
  'استلام_عام':    { color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', icon: ArrowDownToLine, sign: '+', label: 'استلام عام'     },
  'صرف_عام':       { color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', icon: ArrowUpFromLine, sign: '-', label: 'صرف عام'        },
  'ارجاع_مستودع':  { color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', icon: RotateCcw,       sign: '+', label: 'إرجاع للمستودع' },
  'مرتجع_موقع':    { color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', icon: RotateCcw,       sign: '+', label: 'مرتجع موقع'     },
  'مزال_موقع':     { color: '#374151', bg: '#f3f4f6', border: '#d1d5db', icon: Package,         sign: '+', label: 'مزال (سكراب)'   },
}

// دالة مساعدة تختار الميتاداتا الصحيحة
function getMovementMeta(entry: LedgerEntry) {
  if (entry.movement_category && MOVEMENT_META[entry.movement_category]) {
    return MOVEMENT_META[entry.movement_category]
  }
  return MOVEMENT_META[entry.type] || { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: Package, sign: '', label: entry.type }
}

const PAGE_SIZE = 50
const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ar-SA') + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
}

// ══════════════════════════════════════════
// الصفحة الرئيسية — دفتر الحركات (الطبقة التدقيقية: كشف حركة الصنف)
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
  const [fMaterial, setFMaterial] = useState('')
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo,   setFDateTo]   = useState('')

  // قائمة المواد للفلتر
  const [materials, setMaterials] = useState<any[]>([])
  const [fVoucher,  setFVoucher]  = useState('')

  // KPIs
  const [kpis, setKpis] = useState({ todayMoves: 0, todayVouchers: 0, monthMoves: 0, openLoans: 0 })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id])

  async function loadBase() {
    if (!tenant) return
    const [whRes, projRes, matRes] = await Promise.all([
      supabase.from('warehouses').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('materials').select('id, name, unit').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ])
    setWarehouses(whRes.data || [])
    setProjects(projRes.data || [])
    setMaterials(matRes.data || [])
    loadMovements(1)
    loadKPIs()
  }

  async function loadKPIs() {
    if (!tenant) return
    const today      = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 8) + '01'
    // عدّادات خفيفة — لا جمع كميات مختلطة الوحدات (متر + قطعة = رقم بلا معنى)
    const [todayRes, todayTxns, monthRes, loansRes] = await Promise.all([
      supabase.from('stock_ledger').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).gte('created_at', today),
      supabase.from('stock_ledger').select('txn_number')
        .eq('tenant_id', tenant.id).gte('created_at', today).not('txn_number', 'is', null),
      supabase.from('stock_ledger').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).gte('created_at', monthStart),
      supabase.from('project_material_loans').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).neq('status', 'مُعاد كلياً'),
    ])
    const todayVouchers = new Set((todayTxns.data || []).map(r => r.txn_number)).size
    setKpis({ todayMoves: todayRes.count || 0, todayVouchers, monthMoves: monthRes.count || 0, openLoans: loansRes.count || 0 })
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

    if (fType === '__استلام__')
      q = q.in('movement_category', ['استلام_عهدة', 'استلام_عام', 'استلام_مقايسة'])
    else if (fType === '__صرف__')
      q = q.in('movement_category', ['صرف_عهدة', 'صرف_عام'])
    else if (fType === '__استعارة__')
      q = q.eq('is_loan', true)
    else if (fType)
      q = q.eq('movement_category', fType)
    if (fVoucher)  q = q.eq('txn_number', fVoucher)
    if (fWh)       q = q.eq('wh_name', fWh)
    if (fProject)  q = q.eq('project_name', fProject)
    if (fMaterial) q = q.ilike('mat_name', `%${fMaterial}%`)
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
    const headers = ['رقم الإذن', 'النوع', 'المادة', 'الكمية', 'الوحدة', 'قبل', 'بعد', 'المستودع', 'المشروع', 'المورد', 'المستند', 'التاريخ']
    const rows = entries.map(e => [e.txn_number || '', getMovementMeta(e).label, e.mat_name, e.qty, e.unit, e.qty_before, e.qty_after, e.wh_name, e.project_name || '', e.vendor_name || '', e.doc_code || '', formatDateTime(e.created_at)])
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'الحركات.xls'; a.click()
  }

  // ══ طباعة كشف حركة رسمي للنتيجة المفلترة الحالية (بديل سند السطر المحذوف) ══
  async function printLedgerReport() {
    if (!tenant) return
    let q = supabase.from('stock_ledger').select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }).limit(1000)
    if (fType === '__استلام__')       q = q.in('movement_category', ['استلام_عهدة', 'استلام_عام', 'استلام_مقايسة'])
    else if (fType === '__صرف__')     q = q.in('movement_category', ['صرف_عهدة', 'صرف_عام'])
    else if (fType === '__استعارة__') q = q.eq('is_loan', true)
    else if (fType)                    q = q.eq('movement_category', fType)
    if (fVoucher)  q = q.eq('txn_number', fVoucher)
    if (fWh)       q = q.eq('wh_name', fWh)
    if (fProject)  q = q.eq('project_name', fProject)
    if (fMaterial) q = q.ilike('mat_name', `%${fMaterial}%`)
    if (fDateFrom) q = q.gte('created_at', fDateFrom)
    if (fDateTo)   q = q.lte('created_at', fDateTo + 'T23:59:59')
    if (fSearch)   q = q.ilike('mat_name', `%${fSearch}%`)
    const { data } = await q
    const rows = (data || []) as LedgerEntry[]

    const criteria = [
      fVoucher  && `الإذن: ${fVoucher}`,
      fMaterial && `المادة: ${fMaterial}`,
      fSearch   && `بحث: ${fSearch}`,
      fWh       && `المستودع: ${fWh}`,
      fProject  && `المشروع: ${fProject}`,
      fType     && `النوع: ${fType.replace(/_/g, ' ').replace(/__/g, '')}`,
      (fDateFrom || fDateTo) && `الفترة: ${fDateFrom || 'البداية'} ← ${fDateTo || 'اليوم'}`,
    ].filter(Boolean).join(' — ') || 'كل الحركات'

    const w = window.open('', '_blank', 'width=1000,height=720')
    if (!w) return
    const body = rows.map(e => {
      const mv = getMovementMeta(e)
      return `<tr>
        <td class="mono">${e.txn_number || '—'}</td>
        <td><span class="tag" style="color:${mv.color};border-color:${mv.color}">${mv.label}${e.is_loan ? ' 🔁' : ''}</span></td>
        <td>${e.mat_name}</td>
        <td>${e.unit}</td>
        <td class="mono b" style="color:${mv.color}">${mv.sign}${fmt(Number(e.qty))}</td>
        <td class="mono">${fmt(Number(e.qty_before))}</td>
        <td class="mono">${fmt(Number(e.qty_after))}</td>
        <td>${e.wh_name || '—'}</td>
        <td>${e.project_name || '—'}</td>
        <td class="note">${e.dispatch_note || e.doc_code || '—'}</td>
        <td class="mono sm">${formatDateTime(e.created_at)}</td>
      </tr>`
    }).join('')
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حركة المخزون</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #111827; }
        h1 { font-size: 18px; margin: 0 0 4px; } .sub { color: #6b7280; font-size: 12px; margin-bottom: 4px; }
        .criteria { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 12px; margin: 10px 0 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f1f5f9; padding: 7px 8px; text-align: right; border: 1px solid #e2e8f0; white-space: nowrap; }
        td { padding: 6px 8px; border: 1px solid #e5e7eb; }
        .mono { font-family: monospace; } .b { font-weight: 700; } .sm { font-size: 10px; color: #6b7280; }
        .tag { border: 1px solid; border-radius: 12px; padding: 1px 7px; font-size: 10px; font-weight: 700; white-space: nowrap; }
        .note { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #6b7280; }
        .footer { margin-top: 14px; font-size: 11px; color: #6b7280; display: flex; justify-content: space-between; }
        @media print { body { padding: 8px; } }
      </style></head><body>
      <h1>📒 كشف حركة المخزون</h1>
      <div class="sub">تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</div>
      <div class="criteria"><strong>معايير الكشف:</strong> ${criteria} — <strong>${rows.length}</strong> حركة${rows.length === 1000 ? ' (الحد الأقصى للكشف)' : ''}</div>
      <table><thead><tr>
        <th>رقم الإذن</th><th>النوع</th><th>المادة</th><th>الوحدة</th><th>الكمية</th><th>قبل</th><th>بعد</th><th>المستودع</th><th>المشروع</th><th>البيان</th><th>التاريخ</th>
      </tr></thead><tbody>${body}</tbody></table>
      <div class="footer"><span>نظام وثيق — دفتر الحركات</span><span>التوقيع: ______________</span></div>
      <script>window.onload = () => window.print()</` + `script></body></html>`)
    w.document.close()
  }

  const todayStr = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* العنوان */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeftRight style={{ width: '22px', height: '22px', color: '#0891b2' }} /> دفتر الحركات
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>{todayStr} — كشف حركة الصنف على مستوى السطر (الأذون تُدار من صفحة المواد)</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={printLedgerReport} className="btn btn-primary" style={{ fontSize: '0.82rem', background: '#0891b2' }}>
            <Printer style={{ width: '15px', height: '15px' }} /> طباعة كشف
          </button>
          <button onClick={exportExcel} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            <Download style={{ width: '15px', height: '15px' }} /> تصدير Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'حركات اليوم',        value: fmt(kpis.todayMoves),    color: '#0891b2', bg: '#ecfeff', icon: ArrowLeftRight   },
          { label: 'أذون اليوم',          value: fmt(kpis.todayVouchers), color: '#0ea77b', bg: '#ecfdf5', icon: ArrowDownToLine  },
          { label: 'حركات الشهر',        value: fmt(kpis.monthMoves),    color: '#1a56db', bg: '#eff6ff', icon: Package          },
          { label: 'ذمم استعارة مفتوحة', value: fmt(kpis.openLoans),     color: '#7c3aed', bg: '#f5f3ff', icon: ArrowUpFromLine  },
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

      {/* فلاتر سريعة — مبسطة */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { val: '',              label: 'الكل',             color: '#6b7280', bg: '#f9fafb' },
          { val: '__استلام__',   label: '📥 استلام',         color: '#0ea77b', bg: '#ecfdf5' },
          { val: '__صرف__',      label: '📤 صرف',            color: '#c81e1e', bg: '#fef2f2' },
          { val: 'ارجاع_عميل',  label: '↩️ إرجاع للعميل',  color: '#e6820a', bg: '#fffbeb' },
          { val: 'مرتجع_موقع',  label: '📦 مرتجع موقع',    color: '#1a56db', bg: '#eff6ff' },
          { val: 'مزال_موقع',   label: '🔩 مزال',           color: '#374151', bg: '#f3f4f6' },
          { val: '__استعارة__', label: '🔁 استعارات',       color: '#7c3aed', bg: '#f5f3ff' },
        ].map(opt => (
          <button key={opt.val} onClick={() => { setFType(opt.val); setTimeout(() => loadMovements(1), 0) }}
            style={{
              padding: '7px 16px', borderRadius: '20px', border: '2px solid', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
              borderColor: fType === opt.val ? opt.color : 'var(--border)',
              background:  fType === opt.val ? opt.bg : 'transparent',
              color:       fType === opt.val ? opt.color : 'var(--text3)',
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
        <select value={fMaterial} onChange={e => setFMaterial(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '160px' }}>
          <option value="">كل المواد</option>
          {materials.map((m: any) => <option key={m.id} value={m.name}>{m.name} ({m.unit})</option>)}
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
        {(fSearch || fWh || fProject || fMaterial || fDateFrom || fDateTo || fType || fVoucher) && (
          <button onClick={() => { setFSearch(''); setFType(''); setFWh(''); setFProject(''); setFMaterial(''); setFDateFrom(''); setFDateTo(''); setFVoucher(''); setTimeout(() => loadMovements(1), 0) }}
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
            {fVoucher && (
              <span onClick={() => { setFVoucher(''); setTimeout(() => loadMovements(1), 0) }}
                style={{ marginRight: '8px', background: '#eff6ff', color: '#1a56db', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', cursor: 'pointer' }}>
                إذن: {fVoucher} ✕
              </span>
            )}
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
                    {['رقم الإذن', 'النوع', 'المادة', 'الكمية', 'قبل / بعد', 'المستودع', 'المشروع', 'المورد / المستند', 'التاريخ', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const mv = getMovementMeta(e)
                    const MvIcon = mv.icon
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)', transition: 'background 0.1s' }}
                        onMouseEnter={ex => (ex.currentTarget as HTMLElement).style.background = 'var(--bg2, #f8fafc)'}
                        onMouseLeave={ex => (ex.currentTarget as HTMLElement).style.background = 'transparent'}>

                        {/* رقم الإذن — الضغط يفلتر الدفتر على سطور الإذن */}
                        <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                          {e.txn_number ? (
                            <span onClick={() => { setFVoucher(e.txn_number!); setTimeout(() => loadMovements(1), 0) }}
                              title="عرض كل سطور هذا الإذن"
                              style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: '#1a56db', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                              {e.txn_number}
                            </span>
                          ) : <span style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>(قديم)</span>}
                          {e.is_loan && (
                            <div style={{ fontSize: '0.62rem', color: '#7c3aed', fontWeight: 700, marginTop: '2px' }}>
                              🔁 {(e.dispatch_note || '').startsWith('تسوية') ? 'تسوية' : 'استعارة'}{e.loan_from_project ? `: ${e.loan_from_project} ← ${e.loan_to_project}` : ''}
                            </div>
                          )}
                        </td>

                        {/* النوع */}
                        <td style={{ padding: '11px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: mv.bg, color: mv.color, border: `1px solid ${mv.border}`, borderRadius: '20px', padding: '3px 10px', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            <MvIcon style={{ width: '12px', height: '12px' }} />
                            {mv.label}
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
