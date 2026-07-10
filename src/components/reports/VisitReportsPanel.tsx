'use client'
import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Search, X, Download } from 'lucide-react'
import { VISIT_REPORTS, VISIT_TYPES } from '@/lib/reports-config'

type Props = {
  title?: string
  subtitle?: string
}

export function VisitReportsPanel({
  title = 'تقارير الزيارات الميدانية',
  subtitle = 'ملخص الزيارات، NCR، وأداء المهندسين والمشاريع',
}: Props) {
  const { tenant, activeBranch } = useStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo, setFDateTo] = useState('')
  const [fType, setFType] = useState('')

  const report = VISIT_REPORTS.find(r => r.id === selected)

  async function runReport() {
    if (!tenant || !selected) return
    setLoading(true)
    setResults([])
    let q = supabase.from('visits').select('*').eq('tenant_id', tenant.id)
    if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id)
    if (fDateFrom) q = q.gte('date', fDateFrom)
    if (fDateTo) q = q.lte('date', fDateTo)
    if (fType) q = q.eq('type', fType)
    const { data } = await q.order('date', { ascending: false })
    const visits = data || []

    if (selected === 'visits_summary') {
      const grouped: Record<string, any> = {}
      visits.forEach(v => {
        const k = v.type || 'أخرى'
        if (!grouped[k]) grouped[k] = { type: k, total: 0, ok: 0, ncr: 0, closed_ncr: 0 }
        grouped[k].total++
        v.specs === 'مطابق' ? grouped[k].ok++ : grouped[k].ncr++
        if (v.resolved_report) grouped[k].closed_ncr++
      })
      setResults(Object.values(grouped))
    } else if (selected === 'ncr_open') {
      setResults(visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).sort((a, b) => (a.date > b.date ? 1 : -1)))
    } else if (selected === 'ncr_closed') {
      setResults(visits.filter(v => v.resolved_report))
    } else if (selected === 'by_engineer') {
      const grouped: Record<string, any> = {}
      visits.forEach(v => {
        const k = v.engineer || 'غير محدد'
        if (!grouped[k]) grouped[k] = { engineer: k, total: 0, ok: 0, ncr: 0 }
        grouped[k].total++
        v.specs === 'مطابق' ? grouped[k].ok++ : grouped[k].ncr++
      })
      setResults(Object.values(grouped).sort((a, b) => b.total - a.total))
    } else if (selected === 'by_project') {
      const grouped: Record<string, any> = {}
      visits.forEach(v => {
        const k = v.project_id || 'بدون مشروع'
        if (!grouped[k]) grouped[k] = { project_id: k, total: 0, ok: 0, ncr: 0 }
        grouped[k].total++
        v.specs === 'مطابق' ? grouped[k].ok++ : grouped[k].ncr++
      })
      setResults(Object.values(grouped).sort((a, b) => b.ncr - a.ncr))
    }
    setLoading(false)
  }

  function exportCSV() {
    if (!results.length || !report) return
    const flat = results.map(r => {
      if (selected === 'visits_summary') {
        return { نوع: r.type, الإجمالي: r.total, مطابق: r.ok, 'غير مطابق': r.ncr, 'NCR مغلقة': r.closed_ncr }
      }
      if (selected === 'by_engineer') {
        return { المهندس: r.engineer, الإجمالي: r.total, مطابق: r.ok, 'غير مطابق': r.ncr }
      }
      if (selected === 'by_project') {
        return { المشروع: r.project_id, الإجمالي: r.total, مطابق: r.ok, 'غير مطابق': r.ncr }
      }
      return r
    })
    const headers = Object.keys(flat[0])
    const rows = flat.map(r => headers.map(h => String((r as any)[h] ?? '')).join(','))
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${report.title}.csv`
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e' }}>{title}</h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>{subtitle}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
        {VISIT_REPORTS.map(r => (
          <button key={r.id} onClick={() => { setSelected(r.id); setResults([]) }}
            style={{ textAlign: 'right', padding: '14px', borderRadius: '12px', border: `2px solid ${selected === r.id ? r.color : r.border}`, background: selected === r.id ? r.bg : 'white', cursor: 'pointer' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '5px' }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: selected === r.id ? r.color : '#1a1a2e', marginBottom: '3px' }}>{r.title}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.desc}</div>
          </button>
        ))}
      </div>

      {selected && report && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: report.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: report.color }}>{report.icon} {report.title}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {results.length > 0 && (
                <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '6px 10px' }}>
                  <Download style={{ width: '13px', height: '13px' }} /> CSV
                </button>
              )}
              <button onClick={() => { setSelected(null); setResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {report.filters.includes('date_range') && (<>
              <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>من تاريخ</label><input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>إلى تاريخ</label><input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} /></div>
            </>)}
            {report.filters.includes('type') && (
              <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>نوع الزيارة</label>
                <select value={fType} onChange={e => setFType(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
                  <option value="">كل الأنواع</option>
                  {VISIT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
            <button onClick={runReport} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
              {loading ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Search style={{ width: '14px', height: '14px' }} />}
              {' '}عرض التقرير
            </button>
          </div>
          {results.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              {selected === 'visits_summary' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>{['نوع الزيارة', 'الإجمالي', 'مطابق', 'غير مطابق (NCR)', 'NCR مغلقة', 'نسبة المطابقة'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
                  <tbody>{results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.type}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.total}</td>
                      <td style={{ padding: '10px 14px', color: '#0ea77b', fontWeight: 700 }}>{r.ok}</td>
                      <td style={{ padding: '10px 14px', color: '#c81e1e', fontWeight: 700 }}>{r.ncr}</td>
                      <td style={{ padding: '10px 14px', color: '#7c3aed' }}>{r.closed_ncr}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.total ? Math.round(r.ok / r.total * 100) : 0}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              {(selected === 'ncr_open' || selected === 'ncr_closed') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>{['التاريخ', 'النوع', 'المهندس', 'الموقع', 'المخالفة', selected === 'ncr_closed' ? 'تاريخ الإغلاق' : 'الأيام', selected === 'ncr_closed' ? 'أُغلق بواسطة' : ''].filter(Boolean).map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
                  <tbody>{results.map((r: any, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.date}</td>
                      <td style={{ padding: '10px 14px' }}><span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{r.type}</span></td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.engineer}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.location || '—'}</td>
                      <td style={{ padding: '10px 14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.corrective || '—'}</td>
                      {selected === 'ncr_open' && <td style={{ padding: '10px 14px', color: '#c81e1e', fontWeight: 700 }}>{Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000)} يوم</td>}
                      {selected === 'ncr_closed' && <td style={{ padding: '10px 14px', color: '#0ea77b' }}>{r.resolved_date}</td>}
                      {selected === 'ncr_closed' && <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.resolved_by}</td>}
                    </tr>
                  ))}</tbody>
                </table>
              )}
              {(selected === 'by_engineer' || selected === 'by_project') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>{[selected === 'by_engineer' ? 'المهندس' : 'رقم المشروع', 'الإجمالي', 'مطابق', 'غير مطابق', 'نسبة المطابقة'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
                  <tbody>{results.map((r: any, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.engineer || r.project_id}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.total}</td>
                      <td style={{ padding: '10px 14px', color: '#0ea77b', fontWeight: 700 }}>{r.ok}</td>
                      <td style={{ padding: '10px 14px', color: '#c81e1e', fontWeight: 700 }}>{r.ncr}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.total ? Math.round(r.ok / r.total * 100) : 0}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
          {results.length === 0 && !loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem' }}>📋</div>
              اضغط «عرض التقرير»
            </div>
          )}
        </div>
      )}
    </div>
  )
}
