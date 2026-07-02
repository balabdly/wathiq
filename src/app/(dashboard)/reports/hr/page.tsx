'use client'
import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Users, Search, X, Printer } from 'lucide-react'

// ══════════════════════════════════════
// التقارير
// ══════════════════════════════════════
const REPORTS = [
  {
    id: 'headcount',
    title: 'تقرير الكوادر البشرية',
    icon: '👥',
    color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe',
    desc: 'إجمالي الموظفين مصنفين حسب القسم والجنسية',
    filters: [],
  },
  {
    id: 'payroll',
    title: 'تقرير الرواتب',
    icon: '💵',
    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    desc: 'إجمالي الرواتب والاستقطاعات والصافي لكل موظف',
    filters: ['month_year'],
  },
  {
    id: 'gosi',
    title: 'تقرير التأمينات الاجتماعية',
    icon: '🏥',
    color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc',
    desc: 'اشتراكات GOSI — حصة الشركة (12%) وحصة الموظف (10%)',
    filters: [],
  },
  {
    id: 'leaves',
    title: 'تقرير الإجازات',
    icon: '🏖️',
    color: '#e6820a', bg: '#fffbeb', border: '#fcd34d',
    desc: 'الإجازات المستخدمة والمتبقية لكل موظف',
    filters: ['date_range'],
  },
  {
    id: 'attendance',
    title: 'تقرير الحضور والغياب',
    icon: '📅',
    color: '#0ea77b', bg: '#ecfdf5', border: '#86efac',
    desc: 'سجل الحضور والغياب وساعات العمل',
    filters: ['date_range', 'employee'],
  },
  {
    id: 'expiry',
    title: 'تقرير منتهيات الوثائق والإقامات',
    icon: '⚠️',
    color: '#c81e1e', bg: '#fef2f2', border: '#fecaca',
    desc: 'الإقامات والجوازات والوثائق المنتهية أو القريبة من الانتهاء',
    filters: ['expiry_days'],
  },
]

const MONTHS = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

// ══════════════════════════════════════
// دالة الطباعة
// ══════════════════════════════════════
function printTable(title: string, html: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body { font-family: 'Arial', sans-serif; font-size: 13px; color: #111; padding: 30px; direction: rtl }
    h2 { margin-bottom: 16px; font-size: 16px; color: #1a56db }
    table { width: 100%; border-collapse: collapse; font-size: 12px }
    th { background: #f3f4f6; padding: 8px 12px; text-align: right; font-weight: 600; border: 1px solid #e5e7eb }
    td { padding: 7px 12px; border: 1px solid #e5e7eb }
    tr:nth-child(even) { background: #f9fafb }
    .total-row { background: #eff6ff !important; font-weight: 700 }
    .footer { margin-top: 20px; font-size: 11px; color: #9ca3af; text-align: center }
    @media print { body { padding: 15px } }
  </style></head><body>
  <h2>${title}</h2>
  <p style="font-size:11px;color:#9ca3af;margin-bottom:12px">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</p>
  ${html}
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function ReportsHRPage() {
  const { tenant } = useStore()
  const [selected,  setSelected]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [results,   setResults]   = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [empLoaded, setEmpLoaded] = useState(false)

  // فلاتر
  const [fDateFrom,   setFDateFrom]   = useState('')
  const [fDateTo,     setFDateTo]     = useState('')
  const [fEmployee,   setFEmployee]   = useState('')
  const [fMonth,      setFMonth]      = useState(String(new Date().getMonth() + 1))
  const [fYear,       setFYear]       = useState(String(new Date().getFullYear()))
  const [fExpiryDays, setFExpiryDays] = useState('60')

  // ملخص للطباعة
  const [summary, setSummary] = useState<Record<string, number>>({})

  const report = REPORTS.find(r => r.id === selected)
  const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  async function loadEmployees() {
    if (empLoaded || !tenant) return
    const { data } = await supabase
      .from('hr_employees')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name')
    setEmployees(data || [])
    setEmpLoaded(true)
  }

  function selectReport(id: string) {
    setSelected(id)
    setResults([])
    setSummary({})
    if (id === 'attendance') loadEmployees()
  }

  // ══════════════════════════════════════
  // تشغيل التقارير
  // ══════════════════════════════════════
  async function runReport() {
    if (!tenant || !selected) return
    setLoading(true)
    setResults([])
    setSummary({})

    // ── تقرير الكوادر ──
    if (selected === 'headcount') {
      const { data } = await supabase
        .from('hr_employees')
        .select('id, name, employee_number, job_title, department, nationality, hire_date, gender, contract_type, is_active')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('department')

      const byDept: Record<string, any[]> = {}
      ;(data || []).forEach(e => {
        const d = e.department || 'غير محدد'
        if (!byDept[d]) byDept[d] = []
        byDept[d].push(e)
      })

      // إحصائيات
      const total = data?.length || 0
      const saudis = data?.filter(e => e.nationality === 'سعودي').length || 0
      setSummary({ 'إجمالي الموظفين': total, 'سعوديون': saudis, 'غير سعوديين': total - saudis, 'نسبة السعودة': Math.round(saudis / total * 100) })
      setResults(Object.entries(byDept).map(([dept, emps]) => ({ dept, count: emps.length, employees: emps })))
    }

    // ── تقرير الرواتب ──
    else if (selected === 'payroll') {
      const { data } = await supabase
        .from('hr_payroll')
        .select('*, employee:hr_employees!hr_payroll_employee_id_fkey(name, employee_number, job_title, department)')
        .eq('tenant_id', tenant.id)
        .eq('month', Number(fMonth))
        .eq('year', Number(fYear))
        .order('created_at')

      const rows = data || []
      const totalGross  = rows.reduce((s: number, r: any) => s + Number(r.gross_salary || 0), 0)
      const totalDeduct = rows.reduce((s: number, r: any) => s + Number(r.gosi_deduction || 0) + Number(r.absence_deduct || 0) + Number(r.other_deduct || 0), 0)
      const totalNet    = rows.reduce((s: number, r: any) => s + Number(r.net_salary || 0), 0)
      setSummary({ 'إجمالي الرواتب': totalGross, 'إجمالي الاستقطاعات': totalDeduct, 'صافي الرواتب': totalNet, 'عدد الموظفين': rows.length })
      setResults(rows)
    }

    // ── تقرير GOSI ──
    else if (selected === 'gosi') {
      const { data } = await supabase
        .from('hr_employees')
        .select('id, name, employee_number, department, job_title, basic_salary, housing_allow, gosi_enrolled, gosi_pct')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .eq('gosi_enrolled', true)
        .order('name')

      const rows = (data || []).map(e => {
        // GOSI يحسب على الأساسي + السكن
        const base = Number(e.basic_salary || 0) + Number(e.housing_allow || 0)
        const empShare  = Math.round(base * 0.10 * 100) / 100   // 10% موظف
        const compShare = Math.round(base * 0.12 * 100) / 100   // 12% شركة
        return { ...e, gosi_base: base, emp_share: empShare, comp_share: compShare, total: empShare + compShare }
      })

      const totalBase  = rows.reduce((s, r) => s + r.gosi_base, 0)
      const totalEmp   = rows.reduce((s, r) => s + r.emp_share, 0)
      const totalComp  = rows.reduce((s, r) => s + r.comp_share, 0)
      const totalAll   = rows.reduce((s, r) => s + r.total, 0)
      setSummary({ 'وعاء GOSI': totalBase, 'حصة الموظفين': totalEmp, 'حصة الشركة': totalComp, 'الإجمالي': totalAll })
      setResults(rows)
    }

    // ── تقرير الإجازات ──
    else if (selected === 'leaves') {
      let q = supabase
        .from('hr_leaves')
        .select('*, employee:hr_employees!hr_leaves_employee_id_fkey(name, employee_number, department)')
        .eq('tenant_id', tenant.id)
      if (fDateFrom) q = q.gte('start_date', fDateFrom)
      if (fDateTo)   q = q.lte('end_date', fDateTo)
      const { data } = await q.order('start_date', { ascending: false })

      const rows = data || []
      const totalDays    = rows.reduce((s: number, r: any) => s + Number(r.days || 0), 0)
      const approvedDays = rows.filter((r: any) => r.status === 'موافق').reduce((s: number, r: any) => s + Number(r.days || 0), 0)
      setSummary({ 'إجمالي الطلبات': rows.length, 'إجمالي الأيام': totalDays, 'أيام موافق عليها': approvedDays })
      setResults(rows)
    }

    // ── تقرير الحضور ──
    else if (selected === 'attendance') {
      let q = supabase
        .from('hr_attendance')
        .select('*, employee:hr_employees!hr_attendance_employee_id_fkey(name, employee_number)')
        .eq('tenant_id', tenant.id)
      if (fDateFrom)  q = q.gte('date', fDateFrom)
      if (fDateTo)    q = q.lte('date', fDateTo)
      if (fEmployee)  q = q.eq('employee_id', Number(fEmployee))
      const { data } = await q.order('date', { ascending: false }).limit(500)

      const rows    = data || []
      const present = rows.filter((r: any) => r.status === 'حاضر' || r.status === 'حضور').length
      const absent  = rows.filter((r: any) => r.status === 'غائب' || r.status === 'غياب').length
      setSummary({ 'إجمالي السجلات': rows.length, 'حاضر': present, 'غائب': absent })
      setResults(rows)
    }

    // ── تقرير المنتهيات ──
    else if (selected === 'expiry') {
      const days = Number(fExpiryDays)
      const today = new Date()
      const limitDate = new Date(today)
      limitDate.setDate(limitDate.getDate() + days)
      const todayStr = today.toISOString().split('T')[0]
      const limitStr = limitDate.toISOString().split('T')[0]

      // إقامات + جوازات
      const { data: empData } = await supabase
        .from('hr_employees')
        .select('id, name, employee_number, nationality, iqama_number, iqama_expiry, passport_number, passport_expiry')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)

      // وثائق
      const { data: docData } = await supabase
        .from('hr_documents')
        .select('*, employee:employees(name)')
        .eq('tenant_id', tenant.id)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', limitStr)
        .gte('expiry_date', todayStr)
        .order('expiry_date')

      const rows: any[] = []

      // معالجة الإقامات والجوازات
      ;(empData || []).forEach(e => {
        if (e.iqama_expiry) {
          const daysLeft = Math.ceil((new Date(e.iqama_expiry).getTime() - today.getTime()) / 86400000)
          if (daysLeft <= days) {
            rows.push({
              name: e.name,
              employee_number: e.employee_number,
              doc_type: 'إقامة',
              doc_number: e.iqama_number,
              expiry_date: e.iqama_expiry,
              days_left: daysLeft,
            })
          }
        }
        if (e.passport_expiry && e.nationality !== 'سعودي') {
          const daysLeft = Math.ceil((new Date(e.passport_expiry).getTime() - today.getTime()) / 86400000)
          if (daysLeft <= days) {
            rows.push({
              name: e.name,
              employee_number: e.employee_number,
              doc_type: 'جواز سفر',
              doc_number: e.passport_number,
              expiry_date: e.passport_expiry,
              days_left: daysLeft,
            })
          }
        }
      })

      // وثائق HR
      ;(docData || []).forEach(d => {
        const daysLeft = Math.ceil((new Date(d.expiry_date).getTime() - today.getTime()) / 86400000)
        rows.push({
          name: d.employee?.name,
          employee_number: d.employee?.employee_number,
          doc_type: d.doc_type,
          doc_number: d.doc_number,
          expiry_date: d.expiry_date,
          days_left: daysLeft,
        })
      })

      // ترتيب حسب الأقرب للانتهاء
      rows.sort((a, b) => a.days_left - b.days_left)

      const expired  = rows.filter(r => r.days_left <= 0).length
      const critical = rows.filter(r => r.days_left > 0 && r.days_left <= 30).length
      const warning  = rows.filter(r => r.days_left > 30).length
      setSummary({ 'منتهية': expired, 'حرجة (30 يوم)': critical, 'تحذير': warning })
      setResults(rows)
    }

    setLoading(false)
  }

  // ══════════════════════════════════════
  // بناء HTML للطباعة
  // ══════════════════════════════════════
  function buildPrintHTML(): string {
    if (selected === 'headcount') {
      return results.map(g => `
        <h3 style="margin:16px 0 8px;font-size:13px">${g.dept} — ${g.count} موظف</h3>
        <table><thead><tr><th>الرقم</th><th>الاسم</th><th>الوظيفة</th><th>الجنسية</th><th>تاريخ التعيين</th></tr></thead>
        <tbody>${g.employees.map((e: any) => `<tr><td>${e.employee_number || '—'}</td><td>${e.name}</td><td>${e.job_title || '—'}</td><td>${e.nationality || '—'}</td><td>${e.hire_date || '—'}</td></tr>`).join('')}</tbody></table>
      `).join('')
    }
    if (selected === 'payroll') {
      return `<table><thead><tr><th>الموظف</th><th>القسم</th><th>الإجمالي</th><th>GOSI</th><th>غياب</th><th>خصومات أخرى</th><th>الصافي</th><th>الحالة</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.employee?.name || '—'}</td><td>${r.employee?.department || '—'}</td><td>${fmt(r.gross_salary)}</td><td>${fmt(r.gosi_deduction)}</td><td>${fmt(r.absence_deduct)}</td><td>${fmt(r.other_deduct)}</td><td>${fmt(r.net_salary)}</td><td>${r.status}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="2">الإجمالي</td><td>${fmt(summary['إجمالي الرواتب'])}</td><td colspan="3">${fmt(summary['إجمالي الاستقطاعات'])}</td><td>${fmt(summary['صافي الرواتب'])}</td><td></td></tr></tbody></table>`
    }
    if (selected === 'gosi') {
      return `<table><thead><tr><th>الرقم</th><th>الموظف</th><th>القسم</th><th>وعاء GOSI</th><th>حصة الموظف 10%</th><th>حصة الشركة 12%</th><th>الإجمالي</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.employee_number || '—'}</td><td>${r.name}</td><td>${r.department || '—'}</td><td>${fmt(r.gosi_base)}</td><td>${fmt(r.emp_share)}</td><td>${fmt(r.comp_share)}</td><td>${fmt(r.total)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="3">الإجمالي</td><td>${fmt(summary['وعاء GOSI'])}</td><td>${fmt(summary['حصة الموظفين'])}</td><td>${fmt(summary['حصة الشركة'])}</td><td>${fmt(summary['الإجمالي'])}</td></tr></tbody></table>`
    }
    if (selected === 'leaves') {
      return `<table><thead><tr><th>الموظف</th><th>القسم</th><th>نوع الإجازة</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.employee?.name || '—'}</td><td>${r.employee?.department || '—'}</td><td>${r.leave_type}</td><td>${r.start_date}</td><td>${r.end_date}</td><td>${r.days}</td><td>${r.status}</td></tr>`).join('')}</tbody></table>`
    }
    if (selected === 'attendance') {
      return `<table><thead><tr><th>التاريخ</th><th>الموظف</th><th>دخول</th><th>خروج</th><th>ساعات</th><th>الحالة</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.date}</td><td>${r.employee?.name || '—'}</td><td>${r.check_in || '—'}</td><td>${r.check_out || '—'}</td><td>${r.hours_worked || '—'}</td><td>${r.status}</td></tr>`).join('')}</tbody></table>`
    }
    if (selected === 'expiry') {
      return `<table><thead><tr><th>الموظف</th><th>الرقم الوظيفي</th><th>نوع الوثيقة</th><th>رقم الوثيقة</th><th>تاريخ الانتهاء</th><th>الأيام المتبقية</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.name || '—'}</td><td>${r.employee_number || '—'}</td><td>${r.doc_type}</td><td>${r.doc_number || '—'}</td><td>${r.expiry_date}</td><td style="color:${r.days_left <= 0 ? '#c81e1e' : r.days_left <= 30 ? '#e6820a' : '#1a56db'};font-weight:700">${r.days_left <= 0 ? 'منتهية' : r.days_left + ' يوم'}</td></tr>`).join('')}</tbody></table>`
    }
    return ''
  }

  // ══════════════════════════════════════
  // Render
  // ══════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* العنوان */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users style={{ width: '22px', height: '22px', color: '#7c3aed' }} />
          تقارير الموارد البشرية
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>اختر التقرير لعرض محددات البحث</p>
      </div>

      {/* بطاقات التقارير */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
        {REPORTS.map(r => (
          <button
            key={r.id}
            onClick={() => selectReport(r.id)}
            style={{
              textAlign: 'right', padding: '14px', borderRadius: '12px', cursor: 'pointer',
              border: `2px solid ${selected === r.id ? r.color : r.border}`,
              background: selected === r.id ? r.bg : 'var(--card-bg, white)',
              transition: 'all 0.15s',
            }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: selected === r.id ? r.color : 'var(--text)', marginBottom: '3px' }}>{r.title}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{r.desc}</div>
          </button>
        ))}
      </div>

      {/* لوحة التقرير */}
      {selected && report && (
        <div style={{ background: 'var(--card-bg, white)', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>

          {/* رأس التقرير */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: report.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: report.color, fontSize: '0.95rem' }}>{report.icon} {report.title}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {results.length > 0 && (
                <button
                  onClick={() => printTable(report.title, buildPrintHTML())}
                  style={{ background: 'none', border: `1px solid ${report.color}`, color: report.color, borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 600 }}>
                  <Printer style={{ width: '13px', height: '13px' }} /> طباعة
                </button>
              )}
              <button onClick={() => { setSelected(null); setResults([]); setSummary({}) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>

          {/* الفلاتر */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg2, #f8fafc)' }}>

            {report.filters.includes('month_year') && (<>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>الشهر</label>
                <select value={fMonth} onChange={e => setFMonth(e.target.value)} className="input" style={{ fontSize: '0.82rem' }}>
                  {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>السنة</label>
                <select value={fYear} onChange={e => setFYear(e.target.value)} className="input" style={{ fontSize: '0.82rem' }}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>)}

            {report.filters.includes('date_range') && (<>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>من تاريخ</label>
                <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>إلى تاريخ</label>
                <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
              </div>
            </>)}

            {report.filters.includes('employee') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>الموظف</label>
                <select value={fEmployee} onChange={e => setFEmployee(e.target.value)} className="input" style={{ fontSize: '0.82rem' }}>
                  <option value="">كل الموظفين</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}

            {report.filters.includes('expiry_days') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>عرض المنتهية خلال</label>
                <select value={fExpiryDays} onChange={e => setFExpiryDays(e.target.value)} className="input" style={{ fontSize: '0.82rem' }}>
                  <option value="30">30 يوم</option>
                  <option value="60">60 يوم</option>
                  <option value="90">90 يوم</option>
                  <option value="180">180 يوم</option>
                </select>
              </div>
            )}

            <button
              onClick={runReport}
              disabled={loading}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Search style={{ width: '14px', height: '14px' }} />}
              عرض التقرير
            </button>
          </div>

          {/* بطاقات الملخص */}
          {Object.keys(summary).length > 0 && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {Object.entries(summary).map(([k, v]) => (
                <div key={k} style={{ background: report.bg, border: `1px solid ${report.border}`, borderRadius: '10px', padding: '10px 16px', minWidth: '120px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: report.color }}>
                    {typeof v === 'number' && k.includes('نسبة') ? `${v}%` : typeof v === 'number' && v > 100 ? fmt(v) : v}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{k}</div>
                </div>
              ))}
            </div>
          )}

          {/* النتائج */}
          {results.length > 0 && (
            <div style={{ overflowX: 'auto' }}>

              {/* ── الكوادر ── */}
              {selected === 'headcount' && (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {results.map((g, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 16px', background: 'var(--bg2, #f8fafc)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{g.dept}</span>
                        <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '20px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{g.count} موظف</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            {['الرقم', 'الاسم', 'الوظيفة', 'الجنسية', 'تاريخ التعيين', 'نوع العقد'].map(h => (
                              <th key={h} style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: '0.75rem' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.employees.map((e: any, j: number) => (
                            <tr key={j} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)' }}>
                              <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#1a56db', fontSize: '0.8rem' }}>{e.employee_number || '—'}</td>
                              <td style={{ padding: '8px 14px', fontWeight: 600 }}>{e.name}</td>
                              <td style={{ padding: '8px 14px', color: 'var(--text3)' }}>{e.job_title || '—'}</td>
                              <td style={{ padding: '8px 14px' }}>
                                <span style={{ background: e.nationality === 'سعودي' ? '#eff6ff' : '#fffbeb', color: e.nationality === 'سعودي' ? '#1a56db' : '#e6820a', borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                                  {e.nationality || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 14px', color: 'var(--text3)' }}>{e.hire_date || '—'}</td>
                              <td style={{ padding: '8px 14px', color: 'var(--text3)' }}>{e.contract_type || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {/* ── الرواتب ── */}
              {selected === 'payroll' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f5f3ff' }}>
                      {['الموظف', 'القسم', 'إجمالي الراتب', 'خصم GOSI', 'خصم غياب', 'خصومات أخرى', 'الصافي', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#7c3aed', borderBottom: '2px solid #ddd6fe', fontSize: '0.78rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const totalDeduct = Number(r.gosi_deduction || 0) + Number(r.absence_deduct || 0) + Number(r.other_deduct || 0)
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.employee?.name || '—'}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>{r.employee?.department || '—'}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db', fontWeight: 700 }}>{fmt(r.gross_salary)}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{r.gosi_deduction > 0 ? fmt(r.gosi_deduction) : '—'}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{r.absence_deduct > 0 ? fmt(r.absence_deduct) : '—'}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{r.other_deduct > 0 ? fmt(r.other_deduct) : '—'}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{fmt(r.net_salary)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span className={`badge ${r.status === 'مدفوع' ? 'badge-green' : r.status === 'معتمد' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '0.68rem' }}>{r.status}</span>
                          </td>
                        </tr>
                      )
                    })}
                    {/* سطر الإجمالي */}
                    <tr style={{ background: '#f5f3ff', fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: '10px 14px', color: '#7c3aed' }}>الإجمالي — {results.length} موظف</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db' }}>{fmt(summary['إجمالي الرواتب'])}</td>
                      <td colSpan={3} style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{fmt(summary['إجمالي الاستقطاعات'])}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(summary['صافي الرواتب'])}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )}

              {/* ── GOSI ── */}
              {selected === 'gosi' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#ecfeff' }}>
                      {['الرقم الوظيفي', 'الموظف', 'القسم', 'الأساسي', 'السكن', 'وعاء GOSI', 'حصة الموظف 10%', 'حصة الشركة 12%', 'الإجمالي'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0891b2', borderBottom: '2px solid #a5f3fc', fontSize: '0.75rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)' }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#0891b2', fontSize: '0.78rem' }}>{r.employee_number || '—'}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--text3)', fontSize: '0.78rem' }}>{r.department || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{fmt(r.basic_salary)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{fmt(r.housing_allow)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0891b2' }}>{fmt(r.gosi_base)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#c81e1e', fontWeight: 600 }}>{fmt(r.emp_share)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#1a56db', fontWeight: 600 }}>{fmt(r.comp_share)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.total)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#ecfeff', fontWeight: 700 }}>
                      <td colSpan={5} style={{ padding: '10px 12px', color: '#0891b2' }}>الإجمالي — {results.length} موظف</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#0891b2' }}>{fmt(summary['وعاء GOSI'])}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#c81e1e' }}>{fmt(summary['حصة الموظفين'])}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#1a56db' }}>{fmt(summary['حصة الشركة'])}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(summary['الإجمالي'])}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* ── الإجازات ── */}
              {selected === 'leaves' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#fffbeb' }}>
                      {['الموظف', 'القسم', 'نوع الإجازة', 'من', 'إلى', 'الأيام', 'الحالة', 'السبب'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#e6820a', borderBottom: '2px solid #fcd34d', fontSize: '0.78rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.employee?.name || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>{r.employee?.department || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>{r.leave_type}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{r.start_date}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{r.end_date}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#e6820a' }}>{r.days} يوم</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className={`badge ${r.status === 'موافق' ? 'badge-green' : r.status === 'مرفوض' ? 'badge-red' : 'badge-gray'}`} style={{ fontSize: '0.68rem' }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.78rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ── الحضور ── */}
              {selected === 'attendance' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#ecfdf5' }}>
                      {['التاريخ', 'الموظف', 'وقت الدخول', 'وقت الخروج', 'ساعات العمل', 'ساعات إضافية', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#0ea77b', borderBottom: '2px solid #86efac', fontSize: '0.78rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)', background: (r.status === 'غائب' || r.status === 'غياب') ? '#fff5f5' : 'transparent' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.date}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.employee?.name || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.check_in || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.check_out || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: 600 }}>{r.hours_worked ? `${r.hours_worked} س` : '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#7c3aed' }}>{r.overtime_hours > 0 ? `${r.overtime_hours} س` : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className={`badge ${(r.status === 'حاضر' || r.status === 'حضور') ? 'badge-green' : (r.status === 'غائب' || r.status === 'غياب') ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '0.68rem' }}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ── المنتهيات ── */}
              {selected === 'expiry' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#fef2f2' }}>
                      {['الموظف', 'الرقم الوظيفي', 'نوع الوثيقة', 'رقم الوثيقة', 'تاريخ الانتهاء', 'الأيام المتبقية'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#c81e1e', borderBottom: '2px solid #fecaca', fontSize: '0.78rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const isExpired  = r.days_left <= 0
                      const isCritical = r.days_left > 0 && r.days_left <= 30
                      const isWarning  = r.days_left > 30 && r.days_left <= 60
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--bg2)', background: isExpired ? '#fff0f0' : isCritical ? '#fffbeb' : 'transparent' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.name || '—'}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db', fontSize: '0.8rem' }}>{r.employee_number || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span className={`badge ${r.doc_type === 'إقامة' ? 'badge-blue' : r.doc_type === 'جواز سفر' ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: '0.68rem' }}>{r.doc_type}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text3)' }}>{r.doc_number || '—'}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{r.expiry_date}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {isExpired
                              ? <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>منتهية منذ {Math.abs(r.days_left)} يوم</span>
                              : isCritical
                              ? <span style={{ background: '#fff7ed', color: '#c2410c', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>⚠ {r.days_left} يوم</span>
                              : <span style={{ background: '#fefce8', color: '#a16207', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600 }}>{r.days_left} يوم</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

            </div>
          )}

          {/* حالة فارغة */}
          {results.length === 0 && !loading && (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>{report.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>اضغط "عرض التقرير" لتحميل البيانات</div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
