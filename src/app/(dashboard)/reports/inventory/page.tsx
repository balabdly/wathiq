'use client'
import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Package, Search, X, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const REPORTS = [
  { id: 'movements',   title: 'تقرير حركة المواد',              icon: '🔄', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', desc: 'جميع حركات المواد (استلام، صرف، إرجاع، تحويل) مع فلترة متقدمة', filters: ['material', 'wh', 'type', 'date_range', 'project'] },
  { id: 'balance',     title: 'تقرير أرصدة المستودعات',         icon: '🏪', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', desc: 'الكمية الحالية لكل مادة في كل مستودع', filters: ['wh', 'material'] },
  { id: 'project_mat', title: 'تقرير مواد المشاريع',            icon: '🏗️', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', desc: 'المواد المستلمة والمصروفة والمتبقية لكل مشروع', filters: ['project', 'material'] },
  { id: 'bookings',    title: 'تقرير أرقام الحجوزات',           icon: '📋', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', desc: 'جميع الاستلامات مع أرقام الحجوزات وأسماء العملاء', filters: ['date_range', 'project'] },
  { id: 'docs',        title: 'تقرير أرقام الوثائق',            icon: '📄', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d', desc: 'سجل الوثائق المرتبطة بحركات المواد', filters: ['date_range', 'wh'] },
  { id: 'returns',     title: 'تقرير إرجاعات المشاريع',         icon: '↩️', color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', desc: 'جميع إرجاعات المواد للعميل (فائض وسكراب) مع التفاصيل', filters: ['project', 'date_range'] },
  { id: 'transfers',   title: 'تقرير التحويلات بين المستودعات', icon: '🔃', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', desc: 'حركات نقل المواد بين المستودعات', filters: ['wh', 'date_range'] },
]

export default function ReportsInventoryPage() {
  const { tenant, activeBranch } = useStore()
  const [selected,   setSelected]   = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [results,    setResults]    = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [materials,  setMaterials]  = useState<any[]>([])
  const [projects,   setProjects]   = useState<any[]>([])
  const [loaded,     setLoaded]     = useState(false)

  const [fMat,      setFMat]      = useState('')
  const [fWh,       setFWh]       = useState('')
  const [fType,     setFType]     = useState('')
  const [fProject,  setFProject]  = useState('')
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo,   setFDateTo]   = useState('')

  const report = REPORTS.find(r => r.id === selected)

  async function loadFiltersData() {
    if (loaded || !tenant) return
    const [whRes, matRes, projRes] = await Promise.all([
      supabase.from('warehouses').select('id, name').eq('tenant_id', tenant.id),
      supabase.from('materials').select('id, name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ])
    setWarehouses(whRes.data || [])
    setMaterials(matRes.data || [])
    setProjects(projRes.data || [])
    setLoaded(true)
  }

  async function selectReport(id: string) {
    setSelected(id); setResults([])
    await loadFiltersData()
  }

  async function runReport() {
    if (!tenant || !selected) return
    setLoading(true); setResults([])

    let q = supabase.from('stock_ledger')
      .select('*, material:materials(name, unit)')
      .eq('tenant_id', tenant.id)

    if (fWh)       q = q.eq('wh_name', warehouses.find(w => w.id === Number(fWh))?.name || fWh)
    if (fDateFrom) q = q.gte('created_at', fDateFrom)
    if (fDateTo)   q = q.lte('created_at', fDateTo + 'T23:59:59')
    if (fProject)  q = q.eq('project_id', Number(fProject))
    if (fMat)      q = q.eq('mat_name', materials.find(m => m.id === Number(fMat))?.name || fMat)

    if (selected === 'movements') {
      if (fType) q = q.eq('type', fType)
      const { data } = await q.order('created_at', { ascending: false }).limit(500)
      setResults(data || [])

    } else if (selected === 'balance') {
      const { data: mats } = await supabase.from('materials')
        .select('id, name, unit, qty, warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('is_active', true)
        .order('name')
      let filtered = mats || []
      if (fWh) filtered = filtered.filter((m: any) => m.warehouse?.name === warehouses.find(w => w.id === Number(fWh))?.name)
      if (fMat) filtered = filtered.filter((m: any) => m.id === Number(fMat))
      setResults(filtered)

    } else if (selected === 'project_mat') {
      let pmQ = supabase.from('project_materials')
        .select('*, material:materials(name, unit), project:projects(name), warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id)
      if (fProject) pmQ = pmQ.eq('project_id', Number(fProject))
      const { data } = await pmQ
      setResults(data || [])

    } else if (selected === 'bookings') {
      const { data } = await q.eq('type', 'استلام').not('booking_no', 'is', null).order('created_at', { ascending: false }).limit(500)
      setResults((data || []).filter((r: any) => r.booking_no))

    } else if (selected === 'docs') {
      const { data } = await q.not('doc_code', 'is', null).order('created_at', { ascending: false }).limit(500)
      setResults((data || []).filter((r: any) => r.doc_code))

    } else if (selected === 'returns') {
      const { data } = await q.eq('type', 'إرجاع للعميل').order('created_at', { ascending: false }).limit(500)
      setResults(data || [])

    } else if (selected === 'transfers') {
      const { data } = await q.eq('type', 'نقل مخزني').order('created_at', { ascending: false }).limit(500)
      setResults(data || [])
    }

    setLoading(false)
  }

  function exportCSV() {
    if (!results.length) return
    const skip = ['material', 'project', 'warehouse', 'id', 'tenant_id', 'branch_id']
    const headers = Object.keys(results[0]).filter(k => !skip.includes(k))
    const rows = results.map(r => headers.map(h => String(r[h] ?? '')).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${report?.title}.csv`; a.click()
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA')
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'

  const TYPE_COLOR: Record<string, string> = {
    'استلام': '#0ea77b', 'صرف': '#c81e1e', 'إرجاع للعميل': '#e6820a',
    'نقل مخزني': '#1a56db', 'إرجاع': '#e6820a',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package style={{ width: '22px', height: '22px', color: '#0ea77b' }} /> تقارير المخزون
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>اختر التقرير لعرض محددات البحث</p>
      </div>

      {/* البطاقات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
        {REPORTS.map(r => (
          <button key={r.id} onClick={() => selectReport(r.id)}
            style={{ textAlign: 'right', padding: '16px', borderRadius: '12px', border: `2px solid ${selected === r.id ? r.color : r.border}`, background: selected === r.id ? r.bg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selected === r.id ? r.color : '#1a1a2e', marginBottom: '4px' }}>{r.title}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>{r.desc}</div>
          </button>
        ))}
      </div>

      {/* الفلاتر والنتائج */}
      {selected && report && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: report.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: report.color }}>{report.icon} {report.title}</div>
            <button onClick={() => { setSelected(null); setResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          {/* الفلاتر */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {report.filters.includes('material') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>المادة</label>
                <select value={fMat} onChange={e => setFMat(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '160px' }}>
                  <option value="">كل المواد</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            {report.filters.includes('wh') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>المستودع</label>
                <select value={fWh} onChange={e => setFWh(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '150px' }}>
                  <option value="">كل المستودعات</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            {report.filters.includes('type') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>نوع الحركة</label>
                <select value={fType} onChange={e => setFType(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
                  <option value="">كل الحركات</option>
                  {['استلام', 'صرف', 'إرجاع للعميل', 'نقل مخزني'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
            {report.filters.includes('project') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>المشروع</label>
                <select value={fProject} onChange={e => setFProject(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '160px' }}>
                  <option value="">كل المشاريع</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {report.filters.includes('date_range') && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>من تاريخ</label>
                  <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>إلى تاريخ</label>
                  <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
                </div>
              </>
            )}
            <button onClick={runReport} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
              {loading ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Search style={{ width: '14px', height: '14px' }} />}
              عرض التقرير
            </button>
            {results.length > 0 && (
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '8px 12px' }}>
                <Download style={{ width: '14px', height: '14px' }} /> تصدير CSV
              </button>
            )}
          </div>

          {/* النتائج */}
          {results.length > 0 && (
            <div style={{ overflowX: 'auto' }}>

              {/* حركة المواد + إرجاعات + تحويلات */}
              {(selected === 'movements' || selected === 'returns' || selected === 'transfers') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['الرقم', 'التاريخ', 'النوع', 'المادة', 'الكمية', 'المستودع', 'المشروع', 'العميل', 'الحجز', 'الوثيقة', 'ملاحظة'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#7c3aed' }}>{r.txn_number || '—'}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#6b7280' }}>{fmtDate(r.created_at)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: TYPE_COLOR[r.type] + '20', color: TYPE_COLOR[r.type] || '#6b7280', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, fontSize: '0.72rem' }}>{r.type}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.mat_name}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: TYPE_COLOR[r.type] || '#374151' }}>{r.qty} {r.unit}</td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.wh_name}</td>
                        <td style={{ padding: '8px 12px', color: '#1a56db' }}>{r.project_name || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#374151' }}>{r.client_name || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.booking_no || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.doc_code || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#9ca3af', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.dispatch_note || r.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '10px 12px' }}>الإجمالي: {results.length} حركة</td>
                    <td colSpan={7} />
                  </tr></tfoot>
                </table>
              )}

              {/* الأرصدة */}
              {selected === 'balance' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['اسم المادة', 'المستودع', 'الوحدة', 'الكمية الحالية', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{r.warehouse?.name || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#9ca3af' }}>{r.unit}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, fontFamily: 'monospace', color: r.qty <= 0 ? '#c81e1e' : '#0ea77b' }}>{fmt(r.qty)}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span className={`badge ${r.qty <= 0 ? 'badge-red' : r.qty <= r.reorder ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '0.68rem' }}>
                            {r.qty <= 0 ? 'نفدت' : r.qty <= r.reorder ? 'منخفض' : 'طبيعي'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* مواد المشاريع */}
              {selected === 'project_mat' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['المشروع', 'المادة', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'المتبقي', 'نسبة الصرف'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => {
                      const pct = r.qty_received > 0 ? Math.round(r.qty_issued / r.qty_received * 100) : 0
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a56db' }}>{r.project?.name || '—'}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.material?.name || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.warehouse?.name || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{r.material?.unit || '—'}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: 700 }}>{fmt(r.qty_received)}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e', fontWeight: 700 }}>{fmt(r.qty_issued)}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.qty_balance)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px', minWidth: '60px' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#c81e1e' : '#1a56db', borderRadius: '3px' }} />
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* الحجوزات والوثائق */}
              {(selected === 'bookings' || selected === 'docs') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['الرقم المسلسل', 'التاريخ', selected === 'bookings' ? 'رقم الحجز' : 'رقم الوثيقة', 'العميل', 'المادة', 'الكمية', 'المستودع', 'المشروع'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700 }}>{r.txn_number || '—'}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: report.color }}>{selected === 'bookings' ? r.booking_no : r.doc_code}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.client_name || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{r.mat_name}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.qty} {r.unit}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.wh_name}</td>
                        <td style={{ padding: '10px 14px', color: '#1a56db' }}>{r.project_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {results.length === 0 && !loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📦</div>
              اضغط "عرض التقرير" لتحميل البيانات
            </div>
          )}
        </div>
      )}
    </div>
  )
}
