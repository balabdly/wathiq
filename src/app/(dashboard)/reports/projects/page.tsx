'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { BarChart2, FileText, DollarSign, Activity, ChevronDown, Search, X, Download } from 'lucide-react'
import toast from 'react-hot-toast'

// ════════════════════════════
// تعريف التقارير المتاحة
// ════════════════════════════
const REPORTS = [
  {
    id: 'by_type',
    title: 'تقرير المشاريع حسب النوع',
    icon: '📂',
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
    desc: 'عدد المشاريع وإجمالي قيمتها مصنفةً حسب نوع المشروع',
    filters: ['type'],
  },
  {
    id: 'by_value',
    title: 'تقرير قيمة المشاريع',
    icon: '💰',
    color: '#0ea77b',
    bg: '#ecfdf5',
    border: '#86efac',
    desc: 'تفاصيل القيمة التقديرية والفعلية لكل مشروع مع الفرق',
    filters: ['type', 'status', 'date_range'],
  },
  {
    id: 'by_status',
    title: 'تقرير حالة المشاريع',
    icon: '📊',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    desc: 'المشاريع مصنفةً حسب حالتها مع نسبة التقدم',
    filters: ['status', 'type'],
  },
  {
    id: 'progress',
    title: 'تقرير تقدم المشاريع',
    icon: '📈',
    color: '#e6820a',
    bg: '#fffbeb',
    border: '#fcd34d',
    desc: 'نسبة إنجاز كل مشروع مقارنةً بالجدول الزمني',
    filters: ['status', 'date_range'],
  },
  {
    id: 'delayed',
    title: 'تقرير المشاريع المتأخرة',
    icon: '⚠️',
    color: '#c81e1e',
    bg: '#fef2f2',
    border: '#fecaca',
    desc: 'المشاريع التي تجاوزت تاريخ الانتهاء المخطط',
    filters: ['type'],
  },
  {
    id: 'tasks',
    title: 'تقرير مهام المشاريع',
    icon: '✅',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    desc: 'إجمالي المهام المفتوحة والمغلقة لكل مشروع',
    filters: ['status', 'type'],
  },
]

const PROJECT_STATUSES = ['تحت التخطيط', 'تحت التنفيذ', 'متوقف', 'مكتمل', 'ملغى']
const PROJECT_TYPES_DEFAULT = ['إنشاء', 'صيانة', 'تطوير', 'استشارات', 'توريد']

// جلب أنواع المشاريع الفعلية من DB

export default function ReportsProjectsPage() {
  const { tenant, activeBranch } = useStore()
  const [selected,    setSelected]    = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [results,     setResults]     = useState<any[]>([])
  const [projectTypes, setProjectTypes] = useState<string[]>(PROJECT_TYPES_DEFAULT)

  // فلاتر
  const [fType,      setFType]      = useState('')
  const [projTypes,  setProjTypes]  = useState<string[]>(PROJECT_TYPES_DEFAULT)

  useEffect(() => {
    if (!tenant) return
    supabase.from('project_types').select('name').eq('tenant_id', tenant.id).then(({ data }) => {
      if (data && data.length > 0) setProjTypes(data.map((t: any) => t.name))
    })
  }, [tenant?.id])
  const [fStatus,    setFStatus]    = useState('')
  const [fDateFrom,  setFDateFrom]  = useState('')
  const [fDateTo,    setFDateTo]    = useState('')

  const report = REPORTS.find(r => r.id === selected)

  async function runReport() {
    if (!tenant || !selected) return
    setLoading(true)
    setResults([])

    let q = supabase.from('projects')
      .select('*')
      .eq('tenant_id', tenant.id)

    if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id)
    if (fType)   q = q.eq('type', fType)
    if (fStatus) q = q.eq('status', fStatus)
    if (fDateFrom) q = q.gte('start_date', fDateFrom)
    if (fDateTo)   q = q.lte('end_date', fDateTo)

    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) { toast.error('خطأ في جلب البيانات'); setLoading(false); return }

    const projects = data || []

    if (selected === 'by_type') {
      const grouped: Record<string, { count: number; value: number; projects: any[] }> = {}
      projects.forEach(p => {
        const t = p.type || 'غير محدد'
        if (!grouped[t]) grouped[t] = { count: 0, value: 0, projects: [] }
        grouped[t].count++
        grouped[t].value += Number(p.estimated_value || 0)
        grouped[t].projects.push(p)
      })
      setResults(Object.entries(grouped).map(([type, d]) => ({ type, ...d })))

    } else if (selected === 'by_value') {
      setResults(projects.map(p => ({
        name: p.name,
        type: p.type || '—',
        status: p.status,
        estimated: Number(p.estimated_value || 0),
        actual: Number(p.actual_value || 0),
        diff: Number(p.actual_value || 0) - Number(p.estimated_value || 0),
      })))

    } else if (selected === 'by_status') {
      const grouped: Record<string, any[]> = {}
      projects.forEach(p => {
        const s = p.status || 'غير محدد'
        if (!grouped[s]) grouped[s] = []
        grouped[s].push(p)
      })
      setResults(Object.entries(grouped).map(([status, list]) => ({
        status,
        count: list.length,
        avg_progress: Math.round(list.reduce((s, p) => s + (p.progress || 0), 0) / list.length),
        projects: list,
      })))

    } else if (selected === 'progress') {
      setResults(projects.map(p => ({
        name: p.name,
        status: p.status,
        progress: p.progress || 0,
        start_date: p.start_date,
        end_date: p.end_date,
        estimated_value: Number(p.estimated_value || 0),
      })))

    } else if (selected === 'delayed') {
      const today = new Date().toISOString().split('T')[0]
      const delayed = projects.filter(p =>
        p.end_date && p.end_date < today && p.status !== 'مكتمل' && p.status !== 'ملغى'
      )
      setResults(delayed.map(p => ({
        name: p.name,
        type: p.type || '—',
        status: p.status,
        end_date: p.end_date,
        days_late: Math.floor((new Date().getTime() - new Date(p.end_date).getTime()) / 86400000),
        progress: p.progress || 0,
      })))

    } else if (selected === 'tasks') {
      // جلب المهام لكل مشروع
      const { data: tasks } = await supabase.from('tasks')
        .select('project_id, status')
        .eq('tenant_id', tenant.id)
      const taskMap: Record<number, { open: number; closed: number }> = {}
      ;(tasks || []).forEach((t: any) => {
        if (!taskMap[t.project_id]) taskMap[t.project_id] = { open: 0, closed: 0 }
        t.status === 'مغلق' || t.status === 'مكتمل' ? taskMap[t.project_id].closed++ : taskMap[t.project_id].open++
      })
      setResults(projects.map(p => ({
        name: p.name,
        status: p.status,
        open_tasks: taskMap[p.id]?.open || 0,
        closed_tasks: taskMap[p.id]?.closed || 0,
        total_tasks: (taskMap[p.id]?.open || 0) + (taskMap[p.id]?.closed || 0),
      })))
    }

    setLoading(false)
  }

  function exportCSV() {
    if (!results.length) return
    const headers = Object.keys(results[0]).filter(k => k !== 'projects')
    const rows = results.map(r => headers.map(h => r[h] ?? '').join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${report?.title || 'تقرير'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 style={{ width: '22px', height: '22px', color: '#1a56db' }} />
          تقارير المشاريع
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>اختر التقرير المطلوب لعرض محددات البحث</p>
      </div>

      {/* بطاقات التقارير */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
        {REPORTS.map(r => (
          <button key={r.id} onClick={() => { setSelected(r.id); setResults([]) }}
            style={{ textAlign: 'right', padding: '16px', borderRadius: '12px', border: `2px solid ${selected === r.id ? r.color : r.border}`, background: selected === r.id ? r.bg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selected === r.id ? r.color : '#1a1a2e', marginBottom: '4px' }}>{r.title}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>{r.desc}</div>
          </button>
        ))}
      </div>

      {/* قسم الفلاتر والنتائج */}
      {selected && report && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>

          {/* رأس الفلاتر */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: report.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: report.color, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{report.icon}</span> {report.title}
            </div>
            <button onClick={() => { setSelected(null); setResults([]) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          {/* الفلاتر */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {report.filters.includes('type') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>نوع المشروع</label>
                <select value={fType} onChange={e => setFType(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '150px' }}>
                  <option value="">كل الأنواع</option>
                  {projTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
            {report.filters.includes('status') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>حالة المشروع</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '150px' }}>
                  <option value="">كل الحالات</option>
                  {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
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
              {loading ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Search style={{ width: '14px', height: '14px' }} />}
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
              {/* تقرير حسب النوع */}
              {selected === 'by_type' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['نوع المشروع', 'عدد المشاريع', 'إجمالي القيمة التقديرية', 'نسبة من الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r, i) => {
                      const total = results.reduce((s, x) => s + x.value, 0)
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.type}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <span style={{ background: report.bg, color: report.color, padding: '2px 10px', borderRadius: '20px', fontWeight: 700 }}>{r.count}</span>
                          </td>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: 700 }}>{fmt(r.value)} ر.س</td>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px' }}>
                                <div style={{ height: '100%', width: `${total ? (r.value / total * 100) : 0}%`, background: report.color, borderRadius: '3px' }} />
                              </div>
                              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{total ? Math.round(r.value / total * 100) : 0}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td style={{ padding: '10px 16px' }}>الإجمالي</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>{results.reduce((s, r) => s + r.count, 0)}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(results.reduce((s, r) => s + r.value, 0))} ر.س</td>
                      <td style={{ padding: '10px 16px' }}>100%</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* تقرير القيمة */}
              {selected === 'by_value' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['اسم المشروع', 'النوع', 'الحالة', 'القيمة التقديرية', 'القيمة الفعلية', 'الفرق'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{r.type}</td>
                        <td style={{ padding: '10px 16px' }}><span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{fmt(r.estimated)} ر.س</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{fmt(r.actual)} ر.س</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: r.diff >= 0 ? '#c81e1e' : '#0ea77b', fontWeight: 700 }}>
                          {r.diff >= 0 ? '+' : ''}{fmt(r.diff)} ر.س
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* تقرير الحالة */}
              {selected === 'by_status' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['الحالة', 'عدد المشاريع', 'متوسط التقدم'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.status}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span style={{ background: report.bg, color: report.color, padding: '2px 10px', borderRadius: '20px', fontWeight: 700 }}>{r.count}</span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px' }}>
                              <div style={{ height: '100%', width: `${r.avg_progress}%`, background: '#7c3aed', borderRadius: '4px' }} />
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed', minWidth: '35px' }}>{r.avg_progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* تقرير التقدم */}
              {selected === 'progress' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['اسم المشروع', 'الحالة', 'تاريخ البداية', 'تاريخ النهاية', 'نسبة الإنجاز', 'القيمة التقديرية'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 16px' }}><span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{r.start_date || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{r.end_date || '—'}</td>
                        <td style={{ padding: '10px 16px', minWidth: '160px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px' }}>
                              <div style={{ height: '100%', width: `${r.progress}%`, background: r.progress >= 100 ? '#0ea77b' : '#e6820a', borderRadius: '4px' }} />
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: '35px' }}>{r.progress}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{fmt(r.estimated_value)} ر.س</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* تقرير المتأخرة */}
              {selected === 'delayed' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#fef2f2' }}>
                    {['اسم المشروع', 'النوع', 'الحالة', 'تاريخ الانتهاء المخطط', 'أيام التأخر', 'نسبة الإنجاز'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #fecaca' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{r.type}</td>
                        <td style={{ padding: '10px 16px' }}><span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                        <td style={{ padding: '10px 16px', color: '#c81e1e' }}>{r.end_date}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ background: '#fef2f2', color: '#c81e1e', padding: '2px 10px', borderRadius: '20px', fontWeight: 700 }}>{r.days_late} يوم</span>
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#e6820a' }}>{r.progress}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* تقرير المهام */}
              {selected === 'tasks' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['اسم المشروع', 'الحالة', 'مهام مفتوحة', 'مهام مغلقة', 'الإجمالي', 'نسبة الإغلاق'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 16px' }}><span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                        <td style={{ padding: '10px 16px' }}><span style={{ color: '#c81e1e', fontWeight: 700 }}>{r.open_tasks}</span></td>
                        <td style={{ padding: '10px 16px' }}><span style={{ color: '#0ea77b', fontWeight: 700 }}>{r.closed_tasks}</span></td>
                        <td style={{ padding: '10px 16px', fontWeight: 700 }}>{r.total_tasks}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontWeight: 700, color: '#0891b2' }}>
                            {r.total_tasks ? Math.round(r.closed_tasks / r.total_tasks * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            </div>
          )}

          {results.length === 0 && !loading && selected && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
              اضغط "عرض التقرير" لتحميل البيانات
            </div>
          )}
        </div>
      )}
    </div>
  )
}
