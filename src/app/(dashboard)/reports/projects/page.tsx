'use client'

import { useState, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, FolderOpen, ChevronDown, ChevronUp,
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
function ReportGroup({ title, icon: Icon, color, children, defaultOpen = false }: {
  title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '18' }}>
            <Icon className="w-4 h-4" style={{ color }} />
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
export default function ProjectReportsPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const company = (tenant as any)?.name || 'وثيق ERP'
  const tid = tenant?.id
  const bid = activeBranch?.id

  const [projects, setProjects] = useState<any[]>([])
  const [projectCosts, setProjectCosts] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!tid || loaded) return
    setIsLoading(true)
    try {
      const [p, pc, e] = await Promise.all([
        supabase.from('projects').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('created_at', { ascending: false }),
        supabase.from('hr_project_cost').select('*, hr_employees(name)').eq('tenant_id', tid),
        supabase.from('hr_employees').select('id, name').eq('tenant_id', tid),
      ])
      setProjects(p.data || [])
      setProjectCosts(pc.data || [])
      setEmployees(e.data || [])
      setLoaded(true)
    } catch (e) { console.error(e) }
    setIsLoading(false)
  }, [tid, bid, loaded])

  const fmt = (n: number) => (n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'
  const now = new Date(); now.setHours(0, 0, 0, 0)

  const daysUntil = (d: string) => {
    if (!d) return null
    return Math.ceil((new Date(d).getTime() - now.getTime()) / 86400000)
  }

  // ── 1. قائمة المشاريع الكاملة ──
  const allProjects = projects.map(p => {
    const days = daysUntil(p.end_date)
    const isLate = days !== null && days < 0 && p.progress < 100
    return {
      'الرقم': p.code || `#${p.id}`,
      'اسم المشروع': p.name,
      'النوع': p.type || '—',
      'الحالة': p.progress >= 100 ? 'مكتمل' : isLate ? 'متأخر' : p.status || '—',
      'الإنجاز': p.progress + '%',
      'المهندس': p.engineer || '—',
      'القيمة': p.value ? fmt(p.value) : '—',
      'تاريخ البدء': fmtDate(p.start_date),
      'تاريخ التسليم': fmtDate(p.end_date),
      'المتبقي': days !== null && p.progress < 100
        ? (days < 0 ? `متأخر ${Math.abs(days)} يوم` : `${days} يوم`)
        : '—',
    }
  })

  // ── 2. المشاريع المتأخرة ──
  const lateProjects = projects
    .filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now)
    .map(p => ({
      'الرقم': p.code || `#${p.id}`,
      'اسم المشروع': p.name,
      'النوع': p.type || '—',
      'المهندس': p.engineer || '—',
      'الإنجاز': p.progress + '%',
      'تاريخ التسليم': fmtDate(p.end_date),
      'أيام التأخير': Math.abs(daysUntil(p.end_date) || 0),
      'القيمة': p.value ? fmt(p.value) : '—',
    }))

  // ── 3. ملخص حسب الحالة ──
  const byStatus = (() => {
    const statuses = ['تحت التخطيط', 'قيد التنفيذ', 'متأخر', 'مكتمل', 'موقوف']
    return statuses.map(s => {
      const filtered = s === 'متأخر'
        ? projects.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now)
        : s === 'مكتمل'
          ? projects.filter(p => p.progress >= 100)
          : projects.filter(p => p.status === s)
      if (filtered.length === 0) return null
      return {
        'الحالة': s,
        'العدد': filtered.length,
        'إجمالي القيمة': fmt(filtered.reduce((sum, p) => sum + Number(p.value || 0), 0)),
        'متوسط الإنجاز': filtered.length
          ? Math.round(filtered.reduce((sum, p) => sum + p.progress, 0) / filtered.length) + '%'
          : '—',
      }
    }).filter(Boolean) as Record<string, any>[]
  })()

  // ── 4. ملخص حسب النوع ──
  const byType = (() => {
    const types = Array.from(new Set(projects.map(p => p.type).filter(Boolean))) as string[]
    return types.map(t => {
      const filtered = projects.filter(p => p.type === t)
      return {
        'النوع': t,
        'العدد': filtered.length,
        'قيد التنفيذ': filtered.filter(p => p.status === 'قيد التنفيذ').length,
        'مكتمل': filtered.filter(p => p.progress >= 100).length,
        'متأخر': filtered.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now).length,
        'إجمالي القيمة': fmt(filtered.reduce((sum, p) => sum + Number(p.value || 0), 0)),
        'متوسط الإنجاز': Math.round(filtered.reduce((sum, p) => sum + p.progress, 0) / filtered.length) + '%',
      }
    })
  })()

  // ── 5. أداء المهندسين ──
  const engineerPerf = (() => {
    const engineers = Array.from(new Set(projects.map(p => p.engineer).filter(Boolean))) as string[]
    return engineers.map(eng => {
      const ep = projects.filter(p => p.engineer === eng)
      const late = ep.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now)
      const done = ep.filter(p => p.progress >= 100)
      return {
        'المهندس': eng,
        'إجمالي المشاريع': ep.length,
        'قيد التنفيذ': ep.filter(p => p.status === 'قيد التنفيذ' && p.progress < 100 && !(p.end_date && new Date(p.end_date) < now)).length,
        'مكتملة': done.length,
        'متأخرة': late.length,
        'متوسط الإنجاز': Math.round(ep.reduce((s, p) => s + p.progress, 0) / ep.length) + '%',
        'إجمالي القيمة': fmt(ep.reduce((s, p) => s + Number(p.value || 0), 0)),
      }
    }).sort((a, b) => b['إجمالي المشاريع'] - a['إجمالي المشاريع'])
  })()

  // ── 6. تكاليف المشاريع ──
  const projectCostSummary = (() => {
    const map: Record<number, { days: number; cost: number }> = {}
    projectCosts.forEach((pc: any) => {
      if (!map[pc.project_id]) map[pc.project_id] = { days: 0, cost: 0 }
      map[pc.project_id].days += Number(pc.days_on_project || 0)
      map[pc.project_id].cost += Number(pc.cost_amount || 0)
    })
    return projects
      .filter(p => map[p.id])
      .map(p => ({
        'المشروع': p.name,
        'الرقم': p.code || `#${p.id}`,
        'إجمالي أيام العمل': map[p.id].days,
        'إجمالي التكلفة': fmt(map[p.id].cost),
        'قيمة المشروع': p.value ? fmt(p.value) : '—',
        'نسبة التكلفة': p.value
          ? Math.round((map[p.id].cost / p.value) * 100) + '%'
          : '—',
      }))
  })()

  // ── 7. تفاصيل تكاليف الموظفين بالمشاريع ──
  const empProjectCosts = projectCosts.map((pc: any) => {
    const proj = projects.find(p => p.id === pc.project_id)
    return {
      'الموظف': pc.hr_employees?.name || '—',
      'المشروع': proj?.name || `#${pc.project_id}`,
      'الشهر': pc.month,
      'السنة': pc.year,
      'أيام العمل': pc.days_on_project,
      'التكلفة': fmt(pc.cost_amount),
    }
  })

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
          <FolderOpen className="w-5 h-5 text-primary-500" />
          تقارير المشاريع
        </h1>
      </div>

      {/* ══ 1. قائمة المشاريع ══ */}
      <ReportGroup title="📋 قائمة المشاريع الكاملة" icon={FolderOpen} color="#0891b2" defaultOpen>
        <div onMouseEnter={loadData}>
          <ReportTable
            title="جميع المشاريع"
            exportName="قائمة-المشاريع"
            company={company}
            loading={isLoading}
            headers={[
              { key: 'الرقم', label: 'الرقم', sortable: true },
              { key: 'اسم المشروع', label: 'اسم المشروع', sortable: true },
              { key: 'النوع', label: 'النوع', sortable: true },
              { key: 'الحالة', label: 'الحالة', sortable: true },
              { key: 'الإنجاز', label: 'الإنجاز', sortable: true },
              { key: 'المهندس', label: 'المهندس', sortable: true },
              { key: 'القيمة', label: 'القيمة (ر.س)', sortable: false },
              { key: 'تاريخ البدء', label: 'تاريخ البدء', sortable: true },
              { key: 'تاريخ التسليم', label: 'تاريخ التسليم', sortable: true },
              { key: 'المتبقي', label: 'المتبقي', sortable: false },
            ]}
            rows={allProjects}
          />
        </div>
      </ReportGroup>

      {/* ══ 2. المشاريع المتأخرة ══ */}
      <ReportGroup title="⚠️ المشاريع المتأخرة" icon={FolderOpen} color="#dc2626">
        <div onMouseEnter={loadData}>
          <ReportTable
            title={`المشاريع المتأخرة (${lateProjects.length})`}
            exportName="مشاريع-متأخرة"
            company={company}
            loading={isLoading}
            emptyMsg="✅ لا توجد مشاريع متأخرة"
            headers={[
              { key: 'الرقم', label: 'الرقم', sortable: true },
              { key: 'اسم المشروع', label: 'اسم المشروع', sortable: true },
              { key: 'النوع', label: 'النوع', sortable: true },
              { key: 'المهندس', label: 'المهندس', sortable: true },
              { key: 'الإنجاز', label: 'الإنجاز', sortable: true },
              { key: 'تاريخ التسليم', label: 'تاريخ التسليم', sortable: true },
              { key: 'أيام التأخير', label: 'أيام التأخير', sortable: true },
              { key: 'القيمة', label: 'القيمة (ر.س)', sortable: false },
            ]}
            rows={lateProjects}
          />
        </div>
      </ReportGroup>

      {/* ══ 3. الملخصات ══ */}
      <ReportGroup title="📊 ملخصات وإحصاءات" icon={FolderOpen} color="#7c3aed">
        <div onMouseEnter={loadData}>
          <ReportTable
            title="ملخص حسب الحالة"
            exportName="مشاريع-حسب-الحالة"
            company={company}
            loading={isLoading}
            headers={[
              { key: 'الحالة', label: 'الحالة', sortable: true },
              { key: 'العدد', label: 'العدد', sortable: true },
              { key: 'إجمالي القيمة', label: 'إجمالي القيمة (ر.س)', sortable: false },
              { key: 'متوسط الإنجاز', label: 'متوسط الإنجاز', sortable: false },
            ]}
            rows={byStatus}
          />
          <ReportTable
            title="ملخص حسب النوع"
            exportName="مشاريع-حسب-النوع"
            company={company}
            loading={isLoading}
            headers={[
              { key: 'النوع', label: 'النوع', sortable: true },
              { key: 'العدد', label: 'العدد', sortable: true },
              { key: 'قيد التنفيذ', label: 'قيد التنفيذ', sortable: true },
              { key: 'مكتمل', label: 'مكتمل', sortable: true },
              { key: 'متأخر', label: 'متأخر', sortable: true },
              { key: 'إجمالي القيمة', label: 'إجمالي القيمة (ر.س)', sortable: false },
              { key: 'متوسط الإنجاز', label: 'متوسط الإنجاز', sortable: false },
            ]}
            rows={byType}
          />
        </div>
      </ReportGroup>

      {/* ══ 4. أداء المهندسين ══ */}
      <ReportGroup title="👷 أداء المهندسين" icon={FolderOpen} color="#059669">
        <div onMouseEnter={loadData}>
          <ReportTable
            title="تقرير أداء المهندسين"
            exportName="أداء-المهندسين"
            company={company}
            loading={isLoading}
            emptyMsg="لا يوجد مهندسون مرتبطون بمشاريع"
            headers={[
              { key: 'المهندس', label: 'المهندس', sortable: true },
              { key: 'إجمالي المشاريع', label: 'إجمالي المشاريع', sortable: true },
              { key: 'قيد التنفيذ', label: 'قيد التنفيذ', sortable: true },
              { key: 'مكتملة', label: 'مكتملة', sortable: true },
              { key: 'متأخرة', label: 'متأخرة', sortable: true },
              { key: 'متوسط الإنجاز', label: 'متوسط الإنجاز', sortable: false },
              { key: 'إجمالي القيمة', label: 'إجمالي القيمة (ر.س)', sortable: false },
            ]}
            rows={engineerPerf}
          />
        </div>
      </ReportGroup>

      {/* ══ 5. تكاليف المشاريع ══ */}
      <ReportGroup title="💰 تكاليف المشاريع" icon={FolderOpen} color="#d97706">
        <div onMouseEnter={loadData}>
          <ReportTable
            title="ملخص تكاليف المشاريع"
            exportName="تكاليف-المشاريع"
            company={company}
            loading={isLoading}
            emptyMsg="لا توجد بيانات تكاليف"
            headers={[
              { key: 'المشروع', label: 'المشروع', sortable: true },
              { key: 'الرقم', label: 'الرقم', sortable: true },
              { key: 'إجمالي أيام العمل', label: 'إجمالي أيام العمل', sortable: true },
              { key: 'إجمالي التكلفة', label: 'إجمالي التكلفة (ر.س)', sortable: false },
              { key: 'قيمة المشروع', label: 'قيمة المشروع (ر.س)', sortable: false },
              { key: 'نسبة التكلفة', label: 'نسبة التكلفة', sortable: false },
            ]}
            rows={projectCostSummary}
          />
          <ReportTable
            title="تفاصيل تكاليف الموظفين بالمشاريع"
            exportName="تكاليف-موظفين-مشاريع"
            company={company}
            loading={isLoading}
            emptyMsg="لا توجد بيانات تكاليف"
            headers={[
              { key: 'الموظف', label: 'الموظف', sortable: true },
              { key: 'المشروع', label: 'المشروع', sortable: true },
              { key: 'الشهر', label: 'الشهر', sortable: true },
              { key: 'السنة', label: 'السنة', sortable: true },
              { key: 'أيام العمل', label: 'أيام العمل', sortable: true },
              { key: 'التكلفة', label: 'التكلفة (ر.س)', sortable: false },
            ]}
            rows={empProjectCosts}
          />
        </div>
      </ReportGroup>

    </div>
  )
}
