'use client'

import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Users, ChevronDown, ChevronUp,
  Download, Search, Eye, EyeOff, Printer
} from 'lucide-react'

// ── تصدير Excel ────────────────────────────────────────────────────
function exportExcel(filename: string, title: string, company: string, headers: string[], rows: (string | number)[][]) {
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>'
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
  xml += '<Styles>'
  xml += '<Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a56db" ss:Pattern="Solid"/></Style>'
  xml += '<Style ss:ID="t"><Font ss:Bold="1" ss:Size="13" ss:Color="#1a56db"/></Style>'
  xml += '<Style ss:ID="e"><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/></Style>'
  xml += '</Styles>'
  xml += `<Worksheet ss:Name="${esc(title.substring(0, 31))}"><Table>`
  xml += `<Row><Cell ss:StyleID="t"><Data ss:Type="String">${esc(company)} — ${esc(title)}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} | عدد السجلات: ${rows.length}</Data></Cell></Row><Row/>`
  xml += '<Row>' + headers.map(h => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('') + '</Row>'
  rows.forEach((row, i) => {
    xml += '<Row>' + row.map(c => {
      const v = c ?? ''; const isNum = typeof v === 'number'
      return `<Cell ss:StyleID="${i % 2 === 0 ? 'e' : ''}"><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(v)}</Data></Cell>`
    }).join('') + '</Row>'
  })
  xml += '</Table></Worksheet></Workbook>'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' }))
  a.download = `${filename}.xls`; document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

// ── تصدير PDF ──────────────────────────────────────────────────────
function exportPDF(title: string, company: string, headers: string[], rows: (string | number)[][]) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title>
  <style>body{font-family:Tahoma,Arial,sans-serif;margin:20px;direction:rtl;font-size:12px}
  .hdr{border-bottom:3px solid #1a56db;padding-bottom:10px;margin-bottom:16px}
  .co{font-size:17px;font-weight:bold;color:#1a56db}.rpt{font-size:13px;color:#374151;margin-top:3px}
  .meta{font-size:10px;color:#6b7280;margin-top:3px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th{background:#1a56db;color:white;padding:7px 10px;text-align:right;border:1px solid #1349b8}
  td{padding:6px 10px;border:1px solid #e5e7eb}tr:nth-child(even){background:#f8fafc}
  .ft{margin-top:24px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{margin:0}}</style></head><body>
  <div class="hdr"><div class="co">${company}</div><div class="rpt">${title}</div>
  <div class="meta">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} | عدد السجلات: ${rows.length}</div></div>
  <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <div class="ft"><span>وثيق ERP</span><span>${title}</span></div>
  <script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

// ── جدول التقرير ───────────────────────────────────────────────────
function ReportTable({ title, headers, rows, exportName, loading, emptyMsg, company }: {
  title: string
  headers: { key: string; label: string; sortable?: boolean }[]
  rows: Record<string, any>[]
  exportName: string
  loading?: boolean
  emptyMsg?: string
  company?: string
}) {
  const [visible, setVisible] = useState(false)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [search, setSearch] = useState('')

  const filtered = rows.filter(row =>
    !search || Object.values(row).some(v => String(v || '').toLowerCase().includes(search.toLowerCase()))
  )
  const sorted = sort ? [...filtered].sort((a, b) => {
    const av = a[sort.key]; const bv = b[sort.key]
    if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av
    return sort.dir === 'asc' ? String(av || '').localeCompare(String(bv || ''), 'ar') : String(bv || '').localeCompare(String(av || ''), 'ar')
  }) : filtered

  const doExcel = () => exportExcel(exportName, title, company || 'وثيق ERP', headers.map(h => h.label), sorted.map(r => headers.map(h => r[h.key] ?? '')))
  const doPDF = () => exportPDF(title, company || 'وثيق ERP', headers.map(h => h.label), sorted.map(r => headers.map(h => r[h.key] ?? '')))

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
          <span className="badge badge-gray text-xs">{rows.length} سجل</span>
        </div>
        <div className="flex items-center gap-2">
          {visible && (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="input pr-8 py-1.5 text-xs w-36" placeholder="بحث..." />
              </div>
              <button onClick={doExcel} className="btn btn-ghost btn-sm gap-1 border border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={doPDF} className="btn btn-ghost btn-sm gap-1 border border-red-200 text-red-500 hover:bg-red-50">
                <Printer className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          <button onClick={() => setVisible(!visible)}
            className={`btn btn-sm gap-1.5 ${visible ? 'btn-primary' : 'btn-ghost border border-primary-200 text-primary-600 hover:bg-primary-50'}`}>
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {visible ? 'إخفاء' : 'عرض'}
          </button>
        </div>
      </div>
      {visible && (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">{emptyMsg || 'لا توجد بيانات'}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {headers.map(h => (
                    <th key={h.key}
                      onClick={() => h.sortable && setSort(s => s?.key === h.key ? { key: h.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: h.key, dir: 'asc' })}
                      className={`text-right px-4 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap ${h.sortable ? 'cursor-pointer hover:text-primary-600 select-none' : ''}`}>
                      <span className="flex items-center gap-1">
                        {h.label}
                        {h.sortable && sort?.key === h.key && (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    {headers.map(h => (
                      <td key={h.key} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{row[h.key] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── مجموعة تقارير ──────────────────────────────────────────────────
function ReportGroup({ title, color, children, defaultOpen = false }: {
  title: string; color: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '18' }}>
            <Users className="w-4 h-4" style={{ color }} />
          </div>
          <span className="font-bold text-gray-800 text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── الصفحة الرئيسية ────────────────────────────────────────────────
export default function HRReportsPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const company = (tenant as any)?.name || 'وثيق ERP'
  const tid = tenant?.id

  const [employees, setEmployees] = useState<any[]>([])
  const [payroll, setPayroll] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [terminations, setTerminations] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!tid) return
    setIsLoading(true)
    try {
      const [e, p, l, t, a] = await Promise.all([
        supabase.from('hr_employees').select('*').eq('tenant_id', tid).order('name'),
        supabase.from('hr_payroll').select('*, hr_employees(name, department, job_title)').eq('tenant_id', tid).order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('hr_leaves').select('*, hr_employees(name, department)').eq('tenant_id', tid).order('start_date', { ascending: false }),
        supabase.from('hr_terminations').select('*, hr_employees(name, department, job_title)').eq('tenant_id', tid).order('created_at', { ascending: false }),
        supabase.from('hr_attendance').select('*, hr_employees(name, department)').eq('tenant_id', tid).order('created_at', { ascending: false }).limit(500),
      ])
      setEmployees(e.data || [])
      setPayroll(p.data || [])
      setLeaves(l.data || [])
      setTerminations(t.data || [])
      setAttendance(a.data || [])
      setLoaded(true)
    } catch (err) { console.error(err) }
    setIsLoading(false)
  }, [tid])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (n: number) => (n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'

  // ── 1. قائمة الموظفين ──
  const empList = employees.map(e => ({
    'الاسم': e.name,
    'المسمى الوظيفي': e.job_title || '—',
    'القسم': e.department || '—',
    'الراتب الأساسي': fmt(e.basic_salary),
    'بدل سكن': fmt(e.housing_allow),
    'بدل نقل': fmt(e.transport_allow),
    'إجمالي الراتب': fmt((e.basic_salary || 0) + (e.housing_allow || 0) + (e.transport_allow || 0) + (e.other_allow || 0)),
    'نوع العقد': e.id_type || '—',
    'الحالة': e.is_active ? 'نشط' : 'غير نشط',
  }))

  // ── 2. ملخص الموظفين حسب القسم ──
  const empByDept = (() => {
    const map: Record<string, { count: number; totalSalary: number; active: number }> = {}
    employees.forEach(e => {
      const d = e.department || 'غير محدد'
      if (!map[d]) map[d] = { count: 0, totalSalary: 0, active: 0 }
      map[d].count++
      map[d].totalSalary += (e.basic_salary || 0) + (e.housing_allow || 0) + (e.transport_allow || 0) + (e.other_allow || 0)
      if (e.is_active) map[d].active++
    })
    return Object.entries(map).map(([dept, v]) => ({
      'القسم': dept,
      'إجمالي الموظفين': v.count,
      'نشط': v.active,
      'غير نشط': v.count - v.active,
      'إجمالي الرواتب': fmt(v.totalSalary),
    }))
  })()

  // ── 3. مسير الرواتب ──
  const payrollList = payroll.map((p: any) => ({
    'الموظف': p.hr_employees?.name || '—',
    'القسم': p.hr_employees?.department || '—',
    'الشهر': p.month,
    'السنة': p.year,
    'الراتب الأساسي': fmt(p.basic_salary),
    'بدل السكن': fmt(p.housing_allow),
    'بدل النقل': fmt(p.transport_allow),
    'العمل الإضافي': fmt(p.overtime_pay),
    'المكافآت': fmt(p.bonuses),
    'الإجمالي': fmt(p.gross_salary),
    'الاستقطاعات': fmt(p.gosi_deduction),
    'الغياب': fmt(p.absence_deduct),
    'صافي الراتب': fmt(p.net_salary),
    'أيام العمل': p.working_days,
    'الحالة': p.status || '—',
    'تاريخ الدفع': fmtDate(p.payment_date),
  }))

  // ── 4. ملخص الرواتب الشهري ──
  const payrollMonthly = (() => {
    const map: Record<string, { count: number; gross: number; net: number; deductions: number }> = {}
    payroll.forEach((p: any) => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`
      if (!map[key]) map[key] = { count: 0, gross: 0, net: 0, deductions: 0 }
      map[key].count++
      map[key].gross += Number(p.gross_salary || 0)
      map[key].net += Number(p.net_salary || 0)
      map[key].deductions += Number(p.gosi_deduction || 0) + Number(p.absence_deduct || 0) + Number(p.other_deduct || 0)
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({
      'الشهر': month,
      'عدد الموظفين': v.count,
      'إجمالي الرواتب': fmt(v.gross),
      'إجمالي الاستقطاعات': fmt(v.deductions),
      'صافي المدفوع': fmt(v.net),
    }))
  })()

  // ── 5. الإجازات ──
  const leaveList = leaves.map((l: any) => ({
    'الموظف': l.hr_employees?.name || '—',
    'القسم': l.hr_employees?.department || '—',
    'نوع الإجازة': l.leave_type || '—',
    'تاريخ البدء': fmtDate(l.start_date),
    'تاريخ الانتهاء': fmtDate(l.end_date),
    'عدد الأيام': l.days,
    'الحالة': l.status || '—',
    'اعتمد بواسطة': l.approved_by || '—',
    'السبب': l.reason || '—',
  }))

  // ── 6. ملخص الإجازات حسب النوع ──
  const leaveByType = (() => {
    const map: Record<string, { count: number; days: number }> = {}
    leaves.forEach((l: any) => {
      const t = l.leave_type || 'غير محدد'
      if (!map[t]) map[t] = { count: 0, days: 0 }
      map[t].count++
      map[t].days += Number(l.days || 0)
    })
    return Object.entries(map).map(([type, v]) => ({
      'نوع الإجازة': type,
      'عدد الطلبات': v.count,
      'إجمالي الأيام': v.days,
      'معتمد': leaves.filter((l: any) => l.leave_type === type && l.status === 'موافق').length,
      'معلق': leaves.filter((l: any) => l.leave_type === type && l.status === 'معلق').length,
    }))
  })()

  // ── 7. نهايات الخدمة ──
  const terminationList = terminations.map((t: any) => ({
    'الموظف': t.hr_employees?.name || '—',
    'القسم': t.hr_employees?.department || '—',
    'المسمى الوظيفي': t.hr_employees?.job_title || '—',
    'تاريخ الإنهاء': fmtDate(t.termination_date || t.created_at),
    'سبب الإنهاء': t.reason || '—',
    'مكافأة نهاية الخدمة': fmt(t.gratuity_amount || t.end_of_service_amount || 0),
    'إجمالي المستحقات': fmt(t.total_amount || 0),
    'الحالة': t.status || '—',
  }))

  // ── 8. الحضور والغياب ──
  const attendanceList = attendance.map((a: any) => ({
    'الموظف': a.hr_employees?.name || '—',
    'القسم': a.hr_employees?.department || '—',
    'التاريخ': fmtDate(a.date || a.created_at),
    'وقت الدخول': a.check_in || '—',
    'وقت الخروج': a.check_out || '—',
    'الحالة': a.status || '—',
    'ملاحظات': a.notes || '—',
  }))

  // ── 9. ملخص الحضور حسب الموظف ──
  const attendanceSummary = (() => {
    const map: Record<string, { present: number; absent: number; late: number }> = {}
    attendance.forEach((a: any) => {
      const name = a.hr_employees?.name || '—'
      if (!map[name]) map[name] = { present: 0, absent: 0, late: 0 }
      if (a.status === 'حاضر') map[name].present++
      else if (a.status === 'غائب') map[name].absent++
      else if (a.status === 'متأخر') map[name].late++
    })
    return Object.entries(map).map(([name, v]) => ({
      'الموظف': name,
      'أيام الحضور': v.present,
      'أيام الغياب': v.absent,
      'أيام التأخير': v.late,
      'إجمالي الأيام': v.present + v.absent + v.late,
      'نسبة الحضور': v.present + v.absent + v.late > 0
        ? Math.round((v.present / (v.present + v.absent + v.late)) * 100) + '%'
        : '—',
    }))
  })()

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/reports')}
          className="btn btn-ghost btn-sm gap-1.5 text-gray-500 hover:text-gray-700">
          <ArrowRight className="w-4 h-4" /> التقارير
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-500" />
          تقارير الموارد البشرية
        </h1>
      </div>

      {/* ══ 1. الموظفون ══ */}
      <ReportGroup title="👥 بيانات الموظفين" color="#7c3aed" defaultOpen>
        <div>
          <ReportTable title="قائمة الموظفين الكاملة" exportName="قائمة-الموظفين" company={company}
            loading={isLoading}
            headers={[
              { key: 'الاسم', label: 'الاسم', sortable: true },
              { key: 'المسمى الوظيفي', label: 'المسمى الوظيفي', sortable: true },
              { key: 'القسم', label: 'القسم', sortable: true },
              { key: 'الراتب الأساسي', label: 'الراتب الأساسي', sortable: false },
              { key: 'بدل سكن', label: 'بدل سكن', sortable: false },
              { key: 'بدل نقل', label: 'بدل نقل', sortable: false },
              { key: 'إجمالي الراتب', label: 'إجمالي الراتب', sortable: false },
              { key: 'نوع العقد', label: 'نوع العقد', sortable: true },
              { key: 'الحالة', label: 'الحالة', sortable: true },
            ]}
            rows={empList}
          />
          <ReportTable title="توزيع الموظفين حسب القسم" exportName="موظفين-حسب-القسم" company={company}
            loading={isLoading}
            headers={[
              { key: 'القسم', label: 'القسم', sortable: true },
              { key: 'إجمالي الموظفين', label: 'إجمالي الموظفين', sortable: true },
              { key: 'نشط', label: 'نشط', sortable: true },
              { key: 'غير نشط', label: 'غير نشط', sortable: true },
              { key: 'إجمالي الرواتب', label: 'إجمالي الرواتب (ر.س)', sortable: false },
            ]}
            rows={empByDept}
          />
        </div>
      </ReportGroup>

      {/* ══ 2. الرواتب ══ */}
      <ReportGroup title="💰 مسير الرواتب" color="#059669">
        <div>
          <ReportTable title="تفاصيل الرواتب" exportName="مسير-الرواتب" company={company}
            loading={isLoading}
            headers={[
              { key: 'الموظف', label: 'الموظف', sortable: true },
              { key: 'القسم', label: 'القسم', sortable: true },
              { key: 'الشهر', label: 'الشهر', sortable: true },
              { key: 'السنة', label: 'السنة', sortable: true },
              { key: 'الراتب الأساسي', label: 'الراتب الأساسي', sortable: false },
              { key: 'بدل السكن', label: 'بدل السكن', sortable: false },
              { key: 'بدل النقل', label: 'بدل النقل', sortable: false },
              { key: 'العمل الإضافي', label: 'العمل الإضافي', sortable: false },
              { key: 'المكافآت', label: 'المكافآت', sortable: false },
              { key: 'الإجمالي', label: 'الإجمالي', sortable: false },
              { key: 'الاستقطاعات', label: 'الاستقطاعات', sortable: false },
              { key: 'صافي الراتب', label: 'صافي الراتب', sortable: false },
              { key: 'الحالة', label: 'الحالة', sortable: true },
            ]}
            rows={payrollList}
          />
          <ReportTable title="ملخص الرواتب الشهري" exportName="ملخص-رواتب-شهري" company={company}
            loading={isLoading}
            headers={[
              { key: 'الشهر', label: 'الشهر', sortable: true },
              { key: 'عدد الموظفين', label: 'عدد الموظفين', sortable: true },
              { key: 'إجمالي الرواتب', label: 'إجمالي الرواتب', sortable: false },
              { key: 'إجمالي الاستقطاعات', label: 'إجمالي الاستقطاعات', sortable: false },
              { key: 'صافي المدفوع', label: 'صافي المدفوع', sortable: false },
            ]}
            rows={payrollMonthly}
          />
        </div>
      </ReportGroup>

      {/* ══ 3. الإجازات ══ */}
      <ReportGroup title="🏖️ الإجازات" color="#0891b2">
        <div>
          <ReportTable title="قائمة الإجازات" exportName="الإجازات" company={company}
            loading={isLoading}
            headers={[
              { key: 'الموظف', label: 'الموظف', sortable: true },
              { key: 'القسم', label: 'القسم', sortable: true },
              { key: 'نوع الإجازة', label: 'نوع الإجازة', sortable: true },
              { key: 'تاريخ البدء', label: 'تاريخ البدء', sortable: true },
              { key: 'تاريخ الانتهاء', label: 'تاريخ الانتهاء', sortable: true },
              { key: 'عدد الأيام', label: 'عدد الأيام', sortable: true },
              { key: 'الحالة', label: 'الحالة', sortable: true },
              { key: 'اعتمد بواسطة', label: 'اعتمد بواسطة', sortable: false },
            ]}
            rows={leaveList}
          />
          <ReportTable title="ملخص الإجازات حسب النوع" exportName="إجازات-حسب-النوع" company={company}
            loading={isLoading}
            headers={[
              { key: 'نوع الإجازة', label: 'نوع الإجازة', sortable: true },
              { key: 'عدد الطلبات', label: 'عدد الطلبات', sortable: true },
              { key: 'إجمالي الأيام', label: 'إجمالي الأيام', sortable: true },
              { key: 'معتمد', label: 'معتمد', sortable: true },
              { key: 'معلق', label: 'معلق', sortable: true },
            ]}
            rows={leaveByType}
          />
        </div>
      </ReportGroup>

      {/* ══ 4. الحضور والغياب ══ */}
      <ReportGroup title="📅 الحضور والغياب" color="#d97706">
        <div>
          <ReportTable title="سجل الحضور والغياب" exportName="سجل-الحضور" company={company}
            loading={isLoading}
            headers={[
              { key: 'الموظف', label: 'الموظف', sortable: true },
              { key: 'القسم', label: 'القسم', sortable: true },
              { key: 'التاريخ', label: 'التاريخ', sortable: true },
              { key: 'وقت الدخول', label: 'وقت الدخول', sortable: false },
              { key: 'وقت الخروج', label: 'وقت الخروج', sortable: false },
              { key: 'الحالة', label: 'الحالة', sortable: true },
              { key: 'ملاحظات', label: 'ملاحظات', sortable: false },
            ]}
            rows={attendanceList}
          />
          <ReportTable title="ملخص الحضور حسب الموظف" exportName="ملخص-الحضور" company={company}
            loading={isLoading}
            headers={[
              { key: 'الموظف', label: 'الموظف', sortable: true },
              { key: 'أيام الحضور', label: 'أيام الحضور', sortable: true },
              { key: 'أيام الغياب', label: 'أيام الغياب', sortable: true },
              { key: 'أيام التأخير', label: 'أيام التأخير', sortable: true },
              { key: 'إجمالي الأيام', label: 'إجمالي الأيام', sortable: true },
              { key: 'نسبة الحضور', label: 'نسبة الحضور', sortable: false },
            ]}
            rows={attendanceSummary}
          />
        </div>
      </ReportGroup>

      {/* ══ 5. نهايات الخدمة ══ */}
      <ReportGroup title="📋 نهايات الخدمة" color="#dc2626">
        <div>
          <ReportTable title="تقرير نهايات الخدمة" exportName="نهايات-الخدمة" company={company}
            loading={isLoading}
            emptyMsg="لا توجد سجلات نهاية خدمة"
            headers={[
              { key: 'الموظف', label: 'الموظف', sortable: true },
              { key: 'القسم', label: 'القسم', sortable: true },
              { key: 'المسمى الوظيفي', label: 'المسمى الوظيفي', sortable: true },
              { key: 'تاريخ الإنهاء', label: 'تاريخ الإنهاء', sortable: true },
              { key: 'سبب الإنهاء', label: 'سبب الإنهاء', sortable: true },
              { key: 'مكافأة نهاية الخدمة', label: 'مكافأة نهاية الخدمة', sortable: false },
              { key: 'إجمالي المستحقات', label: 'إجمالي المستحقات', sortable: false },
              { key: 'الحالة', label: 'الحالة', sortable: true },
            ]}
            rows={terminationList}
          />
        </div>
      </ReportGroup>

    </div>
  )
}
