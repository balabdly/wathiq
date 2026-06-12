'use client'
import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Users, Search, X } from 'lucide-react'

const REPORTS = [
  { id: 'headcount',   title: 'تقرير الكوادر البشرية',    icon: '👥', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', desc: 'إجمالي الموظفين مصنفين حسب القسم والوظيفة', filters: [] },
  { id: 'attendance',  title: 'تقرير الحضور والغياب',     icon: '📅', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', desc: 'سجل الحضور والغياب خلال فترة زمنية', filters: ['date_range', 'employee'] },
  { id: 'leaves',      title: 'تقرير الإجازات',           icon: '🏖️', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d', desc: 'الإجازات المستخدمة والمتبقية لكل موظف', filters: ['date_range'] },
  { id: 'payroll',     title: 'تقرير الرواتب',            icon: '💵', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', desc: 'إجمالي الرواتب والاستقطاعات والصافي', filters: ['date_range'] },
  { id: 'gosi',        title: 'تقرير التأمينات الاجتماعية', icon: '🏥', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', desc: 'اشتراكات GOSI لكل موظف (حصة الشركة والموظف)', filters: ['date_range'] },
]

export default function ReportsHRPage() {
  const { tenant } = useStore()
  const [selected,   setSelected]   = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [results,    setResults]    = useState<any[]>([])
  const [employees,  setEmployees]  = useState<any[]>([])
  const [loaded,     setLoaded]     = useState(false)
  const [fDateFrom,  setFDateFrom]  = useState('')
  const [fDateTo,    setFDateTo]    = useState('')
  const [fEmployee,  setFEmployee]  = useState('')

  const report = REPORTS.find(r => r.id === selected)

  async function loadEmp() {
    if (loaded || !tenant) return
    const { data } = await supabase.from('hr_employees').select('id, name').eq('tenant_id', tenant.id).eq('is_active', true).order('name')
    setEmployees(data || []); setLoaded(true)
  }

  async function runReport() {
    if (!tenant || !selected) return
    setLoading(true); setResults([])

    if (selected === 'headcount') {
      const { data } = await supabase.from('hr_employees').select('id, name, job_title, department, nationality, hire_date').eq('tenant_id', tenant.id).eq('is_active', true).order('department')
      const grouped: Record<string, any[]> = {}
      ;(data || []).forEach((e: any) => { const d = e.department || 'غير محدد'; if (!grouped[d]) grouped[d] = []; grouped[d].push(e) })
      setResults(Object.entries(grouped).map(([dept, emps]) => ({ dept, count: emps.length, employees: emps })))

    } else if (selected === 'attendance') {
      let q = supabase.from('hr_attendance').select('*, employee:hr_employees(name)').eq('tenant_id', tenant.id)
      if (fDateFrom) q = q.gte('date', fDateFrom)
      if (fDateTo)   q = q.lte('date', fDateTo)
      if (fEmployee) q = q.eq('employee_id', Number(fEmployee))
      const { data } = await q.order('date', { ascending: false }).limit(500)
      setResults(data || [])

    } else if (selected === 'leaves') {
      let q = supabase.from('hr_leaves').select('*, employee:hr_employees(name)').eq('tenant_id', tenant.id)
      if (fDateFrom) q = q.gte('start_date', fDateFrom)
      if (fDateTo)   q = q.lte('end_date', fDateTo)
      const { data } = await q.order('start_date', { ascending: false })
      setResults(data || [])

    } else if (selected === 'payroll') {
      let q = supabase.from('hr_payroll').select('*, employee:hr_employees(name)').eq('tenant_id', tenant.id)
      if (fDateFrom) q = q.gte('period_start', fDateFrom)
      if (fDateTo)   q = q.lte('period_end', fDateTo)
      const { data } = await q.order('period_start', { ascending: false })
      setResults(data || [])

    } else if (selected === 'gosi') {
      const { data } = await supabase.from('hr_employees').select('id, name, basic_salary, gosi_employee, gosi_employer').eq('tenant_id', tenant.id).eq('is_active', true).order('name')
      setResults(data || [])
    }
    setLoading(false)
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users style={{ width: '22px', height: '22px', color: '#1a56db' }} /> تقارير الموارد البشرية
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>اختر التقرير لعرض محددات البحث</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
        {REPORTS.map(r => (
          <button key={r.id} onClick={() => { setSelected(r.id); setResults([]); loadEmp() }}
            style={{ textAlign: 'right', padding: '14px', borderRadius: '12px', border: `2px solid ${selected === r.id ? r.color : r.border}`, background: selected === r.id ? r.bg : 'white', cursor: 'pointer' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '5px' }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: selected === r.id ? r.color : '#1a1a2e', marginBottom: '3px' }}>{r.title}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.desc}</div>
          </button>
        ))}
      </div>
      {selected && report && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: report.bg, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, color: report.color }}>{report.icon} {report.title}</div>
            <button onClick={() => { setSelected(null); setResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X style={{ width: '16px', height: '16px' }} /></button>
          </div>
          {report.filters.length > 0 && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {report.filters.includes('date_range') && (<>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>من</label><input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>إلى</label><input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} /></div>
              </>)}
              {report.filters.includes('employee') && (
                <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>الموظف</label>
                  <select value={fEmployee} onChange={e => setFEmployee(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '160px' }}>
                    <option value="">كل الموظفين</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}
              <button onClick={runReport} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                {loading ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Search style={{ width: '14px', height: '14px' }} />} عرض
              </button>
            </div>
          )}
          {report.filters.length === 0 && results.length === 0 && !loading && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <button onClick={runReport} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                <Search style={{ width: '14px', height: '14px' }} /> عرض التقرير
              </button>
            </div>
          )}
          {results.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              {selected === 'headcount' && (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {results.map((r: any, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>{r.dept}</span><span style={{ color: '#1a56db' }}>{r.count} موظف</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead><tr>{['الاسم', 'الوظيفة', 'الجنسية', 'تاريخ التعيين'].map(h => <th key={h} style={{ padding: '8px 14px', textAlign: 'right', color: '#9ca3af', fontWeight: 500, borderBottom: '1px solid #f1f5f9' }}>{h}</th>)}</tr></thead>
                        <tbody>{r.employees.map((e: any, j: number) => (
                          <tr key={j} style={{ borderBottom: '1px solid #f9fafb' }}>
                            <td style={{ padding: '8px 14px', fontWeight: 600 }}>{e.name}</td>
                            <td style={{ padding: '8px 14px', color: '#6b7280' }}>{e.job_title || '—'}</td>
                            <td style={{ padding: '8px 14px', color: '#6b7280' }}>{e.nationality || '—'}</td>
                            <td style={{ padding: '8px 14px', color: '#6b7280' }}>{e.hire_date || '—'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
              {selected === 'gosi' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#ecfeff' }}>{['الموظف', 'الراتب الأساسي', 'حصة الموظف', 'حصة الشركة', 'الإجمالي'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #a5f3fc' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{fmt(r.basic_salary)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{fmt(r.gosi_employee)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db' }}>{fmt(r.gosi_employer)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt((r.gosi_employee || 0) + (r.gosi_employer || 0))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td style={{ padding: '10px 14px' }}>الإجمالي</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{fmt(results.reduce((s, r) => s + Number(r.basic_salary || 0), 0))}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{fmt(results.reduce((s, r) => s + Number(r.gosi_employee || 0), 0))}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db' }}>{fmt(results.reduce((s, r) => s + Number(r.gosi_employer || 0), 0))}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{fmt(results.reduce((s, r) => s + Number(r.gosi_employee || 0) + Number(r.gosi_employer || 0), 0))}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {(selected === 'attendance' || selected === 'leaves' || selected === 'payroll') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {selected === 'attendance' && ['التاريخ', 'الموظف', 'وقت الدخول', 'وقت الخروج', 'الحالة'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>)}
                    {selected === 'leaves' && ['الموظف', 'نوع الإجازة', 'من', 'إلى', 'الأيام', 'الحالة'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>)}
                    {selected === 'payroll' && ['الموظف', 'الفترة', 'الراتب الأساسي', 'الاستقطاعات', 'الصافي', 'الحالة'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>{results.map((r: any, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {selected === 'attendance' && <>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.date}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.employee?.name}</td>
                        <td style={{ padding: '10px 14px' }}>{r.check_in || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{r.check_out || '—'}</td>
                        <td style={{ padding: '10px 14px' }}><span className={`badge ${r.status === 'حاضر' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                      </>}
                      {selected === 'leaves' && <>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.employee?.name}</td>
                        <td style={{ padding: '10px 14px' }}>{r.leave_type}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.start_date}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.end_date}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.days_count || '—'}</td>
                        <td style={{ padding: '10px 14px' }}><span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                      </>}
                      {selected === 'payroll' && <>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.employee?.name}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.period_start} — {r.period_end}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{fmt(r.basic_salary)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{fmt(r.total_deductions)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{fmt(r.net_salary)}</td>
                        <td style={{ padding: '10px 14px' }}><span className="badge badge-green" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                      </>}
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
          {results.length === 0 && !loading && report.filters.length > 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '2rem' }}>👥</div>اضغط "عرض" لتحميل البيانات</div>}
        </div>
      )}
    </div>
  )
}
