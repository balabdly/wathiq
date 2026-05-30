'use client'
import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, daysUntil } from '@/lib/utils'
import {
  BarChart3, FolderOpen, ClipboardCheck, Package,
  ShoppingCart, Shield, Users, Download, Search,
  ChevronUp, ChevronDown, Eye, EyeOff
} from 'lucide-react'

// ── تصدير Excel حقيقي ──────────────────────────────────────────────
function exportToExcel(filename: string, reportTitle: string, companyName: string, headers: string[], rows: (string|number)[][]) {
  // بناء XML لـ Excel مع تنسيق كامل
  const esc = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  let xml = '<?xml version="1.0" encoding="UTF-8"?>'
  xml += '<?mso-application progid="Excel.Sheet"?>'
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
  xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"'
  xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
  // الأنماط
  xml += '<Styles>'
  xml += '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="14" ss:Color="#1a56db"/></Style>'
  xml += '<Style ss:ID="subtitle"><Font ss:Italic="1" ss:Color="#6b7280"/></Style>'
  xml += '<Style ss:ID="header"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a56db" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1349b8"/></Borders></Style>'
  xml += '<Style ss:ID="even"><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/></Style>'
  xml += '<Style ss:ID="odd"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>'
  xml += '<Style ss:ID="total"><Font ss:Bold="1"/><Interior ss:Color="#eff6ff" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1a56db"/></Borders></Style>'
  xml += '</Styles>'
  xml += `<Worksheet ss:Name="${esc(reportTitle.substring(0,31))}">`
  xml += '<Table>'
  // عنوان الشركة
  xml += `<Row><Cell ss:StyleID="title"><Data ss:Type="String">${esc(companyName)}</Data></Cell></Row>`
  xml += `<Row><Cell ss:StyleID="subtitle"><Data ss:Type="String">التقرير: ${esc(reportTitle)}</Data></Cell></Row>`
  xml += `<Row><Cell ss:StyleID="subtitle"><Data ss:Type="String">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — عدد السجلات: ${rows.length}</Data></Cell></Row>`
  xml += '<Row/>'
  // رؤوس الأعمدة
  xml += '<Row>' + headers.map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('') + '</Row>'
  // البيانات
  rows.forEach((row, i) => {
    const style = i % 2 === 0 ? 'even' : 'odd'
    xml += '<Row>' + row.map(c => {
      const val = c ?? ''
      const isNum = typeof val === 'number' || (!isNaN(Number(val)) && val !== '' && !String(val).includes('%') && !String(val).includes('ر.س'))
      return `<Cell ss:StyleID="${style}"><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(val)}</Data></Cell>`
    }).join('') + '</Row>'
  })
  xml += '</Table></Worksheet></Workbook>'

  const blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}.xls`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

// ── تصدير PDF (طباعة) ─────────────────────────────────────────────
function exportToPDF(filename: string, reportTitle: string, companyName: string, headers: string[], rows: (string|number)[][]) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) { alert('يرجى السماح بفتح نوافذ منبثقة'); return }
  const tableRows = rows.map((row, i) =>
    `<tr style="background:${i%2===0?'#f8fafc':'white'}">${row.map(c => `<td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:12px">${c ?? ''}</td>`).join('')}</tr>`
  ).join('')
  printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head>
    <meta charset="UTF-8">
    <title>${reportTitle}</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 20px; direction: rtl; }
      .header { border-bottom: 3px solid #1a56db; padding-bottom: 12px; margin-bottom: 20px; }
      .company { font-size: 18px; font-weight: bold; color: #1a56db; }
      .report-title { font-size: 14px; color: #374151; margin-top: 4px; }
      .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #1a56db; color: white; padding: 8px 10px; text-align: right; font-size: 12px; border: 1px solid #1349b8; }
      td { padding: 6px 10px; border: 1px solid #e5e7eb; font-size: 12px; }
      .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
      @media print { body { margin: 0; } }
    </style>
  </head><body>
    <div class="header">
      <div class="company">${companyName}</div>
      <div class="report-title">${reportTitle}</div>
      <div class="meta">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} &nbsp;|&nbsp; عدد السجلات: ${rows.length}</div>
    </div>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">
      <span>وثيق ERP — نظام إدارة مقاولي الكهرباء</span>
      <span>${filename}</span>
    </div>
    <script>window.onload = function() { window.print(); }</script>
  </body></html>`)
  printWindow.document.close()
}

// ── جدول تقرير مع زر عرض ──────────────────────────────────────────
function ReportTable({ title, headers, rows, exportName, loading, emptyMsg, companyName }: {
  title: string
  headers: { key: string; label: string; sortable?: boolean }[]
  rows: Record<string, any>[]
  exportName: string
  loading?: boolean
  emptyMsg?: string
  companyName?: string
}) {
  const [visible, setVisible] = useState(false)
  const [sort, setSort]       = useState<{ key: string; dir: 'asc'|'desc' } | null>(null)
  const [search, setSearch]   = useState('')

  const filtered = rows.filter(row =>
    !search || Object.values(row).some(v => String(v||'').toLowerCase().includes(search.toLowerCase()))
  )

  const sorted = sort ? [...filtered].sort((a, b) => {
    const av = a[sort.key]; const bv = b[sort.key]
    if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av
    return sort.dir === 'asc' ? String(av||'').localeCompare(String(bv||''), 'ar') : String(bv||'').localeCompare(String(av||''), 'ar')
  }) : filtered

  function doExport() {
    exportToExcel(exportName, title, companyName || 'وثيق ERP', headers.map(h => h.label), sorted.map(row => headers.map(h => row[h.key] ?? '')))
  }

  function doPDF() {
    exportToPDF(exportName, title, companyName || 'وثيق ERP', headers.map(h => h.label), sorted.map(row => headers.map(h => row[h.key] ?? '')))
  }

  return (
    <div className="card overflow-hidden">
      {/* رأس الجدول — دائماً ظاهر */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-1">
          <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
          <span className="badge badge-gray text-xs">{rows.length} سجل</span>
        </div>
        <div className="flex items-center gap-2">
          {visible && (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="input pr-8 py-1.5 text-xs w-40" placeholder="بحث..." />
              </div>
              <button onClick={doExport}
                className="btn btn-ghost btn-sm gap-1.5 border border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={doPDF}
                className="btn btn-ghost btn-sm gap-1.5 border border-red-200 text-red-500 hover:bg-red-50">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          <button onClick={() => setVisible(!visible)}
            className={`btn btn-sm gap-1.5 ${visible ? 'btn-primary' : 'btn-ghost border border-primary-200 text-primary-600 hover:bg-primary-50'}`}>
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {visible ? 'إخفاء' : 'عرض التقرير'}
          </button>
        </div>
      </div>

      {/* الجدول — يظهر فقط عند الضغط */}
      {visible && (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">{emptyMsg || 'لا توجد بيانات'}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {headers.map(h => (
                    <th key={h.key}
                      onClick={() => h.sortable && setSort(s => s?.key === h.key
                        ? { key: h.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                        : { key: h.key, dir: 'asc' })}
                      className={`text-right px-4 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap ${h.sortable ? 'cursor-pointer hover:text-primary-600 select-none' : ''}`}>
                      <span className="flex items-center gap-1">
                        {h.label}
                        {h.sortable && sort?.key === h.key && (sort.dir === 'asc'
                          ? <ChevronUp className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />)}
                        {h.sortable && sort?.key !== h.key && <span className="text-gray-300 text-xs">↕</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    {headers.map(h => (
                      <td key={h.key} className="px-4 py-2.5 text-gray-700 text-sm whitespace-nowrap">
                        {row[h.key] ?? '—'}
                      </td>
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

// ── الصفحة الرئيسية ───────────────────────────────────────────────
export default function ReportsPage() {
  const { tenant, activeBranch } = useStore()
  const [activeTab, setTab] = useState<'projects'|'visits'|'inventory'|'purchases'|'qhse'|'employees'>('projects')

  const [projects,   setProjects]  = useState<any[]>([])
  const [visits,     setVisits]    = useState<any[]>([])
  const [materials,  setMaterials] = useState<any[]>([])
  const [ledger,     setLedger]    = useState<any[]>([])
  const [purchases,  setPurchases] = useState<any[]>([])
  const [employees,  setEmployees] = useState<any[]>([])
  const [loaded,     setLoaded]    = useState<Record<string, boolean>>({})
  const [loadingTab, setLoadingTab] = useState<string|null>(null)

  const [projTypeFilter,   setProjType]   = useState('')
  const [projStatusFilter, setProjStatus] = useState('')
  const [visitTypeFilter,  setVisitType]  = useState('')
  const [visitSpecFilter,  setVisitSpec]  = useState('')
  const [matSourceFilter,  setMatSource]  = useState('')
  const [selectedMat,      setSelectedMat] = useState('')
  const [poStatusFilter,   setPoStatus]   = useState('')

  const companyName = (tenant as any)?.name || 'وثيق ERP'

  const loadTab = useCallback(async (tab: string) => {
    if (!tenant || !activeBranch || loaded[tab]) return
    setLoadingTab(tab)
    const tid = tenant.id; const bid = activeBranch.id

    if (tab === 'projects') {
      const { data } = await supabase.from('projects').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('created_at', { ascending: false })
      setProjects(data || [])
    } else if (tab === 'visits') {
      const { data } = await supabase.from('visits').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('date', { ascending: false })
      setVisits(data || [])
    } else if (tab === 'inventory') {
      const [m, l] = await Promise.all([
        supabase.from('materials').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('name'),
        supabase.from('stock_ledger').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('created_at', { ascending: false }).limit(1000),
      ])
      setMaterials(m.data || [])
      setLedger(l.data || [])
    } else if (tab === 'purchases') {
      const { data } = await supabase.from('purchases').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('date', { ascending: false })
      setPurchases(data || [])
    } else if (tab === 'qhse') {
      if (visits.length === 0) {
        const { data } = await supabase.from('visits').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('date', { ascending: false })
        setVisits(data || [])
      }
    } else if (tab === 'employees') {
      const { data } = await supabase.from('employees').select('*').eq('tenant_id', tid).order('name')
      setEmployees(data || [])
    }

    setLoaded(prev => ({ ...prev, [tab]: true }))
    setLoadingTab(null)
  }, [tenant, activeBranch, loaded, visits.length])

  useEffect(() => {
    setLoaded({})
    setProjects([]); setVisits([]); setMaterials([])
    setLedger([]); setPurchases([]); setEmployees([])
  }, [tenant?.id, activeBranch?.id])

  useEffect(() => { loadTab(activeTab) }, [activeTab, tenant?.id, activeBranch?.id])

  const now = new Date(); now.setHours(0,0,0,0)
  const isLoading = loadingTab === activeTab

  // ── بيانات المشاريع ──
  const projFiltered = projects.filter(p =>
    (!projTypeFilter   || p.type === projTypeFilter) &&
    (!projStatusFilter || (projStatusFilter === 'متأخر'
      ? (p.progress < 100 && p.end_date && new Date(p.end_date) < now)
      : p.status === projStatusFilter))
  )
  const projTypes = Array.from(new Set(projects.map(p => p.type).filter(Boolean))) as string[]

  const byType = projTypes.map(type => ({
    'النوع': type,
    'العدد': projects.filter(p => p.type === type).length,
    'قيد التنفيذ': projects.filter(p => p.type === type && p.status === 'قيد التنفيذ').length,
    'مكتمل': projects.filter(p => p.type === type && p.progress >= 100).length,
    'متأخر': projects.filter(p => p.type === type && p.progress < 100 && p.end_date && new Date(p.end_date) < now).length,
    'متوسط الإنجاز': projects.filter(p => p.type === type).length
      ? Math.round(projects.filter(p => p.type === type).reduce((s, p) => s + p.progress, 0) / projects.filter(p => p.type === type).length) + '%'
      : '—',
  }))

  const byStatus = ['تحت التخطيط','قيد التنفيذ','متأخر','مكتمل','موقوف'].map(status => {
    const f = status === 'متأخر'
      ? projects.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now)
      : projects.filter(p => status === 'مكتمل' ? p.progress >= 100 : p.status === status)
    return { 'الحالة': status, 'العدد': f.length, 'إجمالي القيمة': formatCurrency(f.reduce((s, p) => s + (p.value || 0), 0)), 'متوسط الإنجاز': f.length ? Math.round(f.reduce((s, p) => s + p.progress, 0) / f.length) + '%' : '—' }
  }).filter(r => r['العدد'] > 0)

  const lateProjects = projects.filter(p => p.progress < 100 && p.end_date && new Date(p.end_date) < now)

  // ── بيانات الزيارات ──
  const visitsFiltered = visits.filter(v =>
    (!visitTypeFilter || v.type === visitTypeFilter) &&
    (!visitSpecFilter || v.specs === visitSpecFilter)
  )
  const engineers = Array.from(new Set(visits.map(v => v.engineer).filter(Boolean))) as string[]
  const engPerf = engineers.map(eng => {
    const ev = visits.filter(v => v.engineer === eng)
    const ok = ev.filter(v => v.specs === 'مطابق').length
    return {
      'المهندس': eng,
      'عدد الزيارات': ev.length,
      'مطابق': ok,
      'غير مطابق': ev.length - ok,
      'نسبة المطابقة': ev.length ? Math.round(ok / ev.length * 100) + '%' : '—',
      'NCR معلقة': ev.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length,
    }
  })

  // ── بيانات المخزون ──
  const matsFiltered = materials.filter(m => !matSourceFilter || m.source === matSourceFilter)

  // مواد كل مشروع — من سجل الحركات
  const projectMap: Record<string, { matName: string; unit: string; in: number; out: number; net: number }[]> = {}
  ledger.forEach((l: any) => {
    if (!l.project_name) return
    if (!projectMap[l.project_name]) projectMap[l.project_name] = []
    const ex = projectMap[l.project_name].find(m => m.matName === l.mat_name)
    const isIn = l.type === 'توريد'
    if (ex) {
      if (isIn) ex.in += l.qty; else ex.out += l.qty
      ex.net = ex.in - ex.out
    } else {
      projectMap[l.project_name].push({
        matName: l.mat_name, unit: l.unit || '—',
        in: isIn ? l.qty : 0, out: isIn ? 0 : l.qty, net: isIn ? l.qty : -l.qty
      })
    }
  })

  // مادة محددة — المشاريع المرتبطة بها
  const matNames = Array.from(new Set(ledger.map((l: any) => l.mat_name).filter(Boolean))) as string[]
  const matProjectsData = selectedMat ? (() => {
    const projMap: Record<string, { in: number; out: number; unit: string }> = {}
    ledger.filter((l: any) => l.mat_name === selectedMat && l.project_name).forEach((l: any) => {
      if (!projMap[l.project_name]) projMap[l.project_name] = { in: 0, out: 0, unit: l.unit || '—' }
      if (l.type === 'توريد') projMap[l.project_name].in += l.qty
      else projMap[l.project_name].out += l.qty
    })
    return Object.entries(projMap).map(([proj, d]) => ({
      'المشروع': proj, 'الوارد': d.in, 'الصادر': d.out,
      'الرصيد': d.in - d.out, 'الوحدة': d.unit,
    }))
  })() : []

  const TABS = [
    { id: 'projects',  label: 'المشاريع',        icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'visits',    label: 'الزيارات',         icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'inventory', label: 'المخزون',          icon: <Package className="w-4 h-4" /> },
    { id: 'purchases', label: 'المشتريات',        icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'qhse',      label: 'السلامة والجودة', icon: <Shield className="w-4 h-4" /> },
    { id: 'employees', label: 'الموظفين',         icon: <Users className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-500" />
          التقارير التفصيلية
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">اضغط "عرض التقرير" على أي جدول لعرضه وتصديره</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === t.id ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon}{t.label}
            {loadingTab === t.id && <span className="w-3 h-3 border border-primary-400/30 border-t-primary-500 rounded-full animate-spin" />}
          </button>
        ))}
      </div>

      {/* ══ المشاريع ══ */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="card p-3 flex flex-wrap gap-2 items-center">
            <select value={projTypeFilter} onChange={e => setProjType(e.target.value)} className="select w-auto text-sm">
              <option value="">كل الأنواع</option>
              {projTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={projStatusFilter} onChange={e => setProjStatus(e.target.value)} className="select w-auto text-sm">
              <option value="">كل الحالات</option>
              {['تحت التخطيط','قيد التنفيذ','متأخر','مكتمل','موقوف'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(projTypeFilter || projStatusFilter) && (
              <button onClick={() => { setProjType(''); setProjStatus('') }} className="btn btn-ghost btn-sm text-gray-400">مسح</button>
            )}
          </div>

          <ReportTable title="📋 قائمة المشاريع" loading={isLoading} exportName="تقرير-المشاريع" companyName={companyName}
            headers={[
              { key: 'code',     label: 'الرقم',          sortable: true  },
              { key: 'name',     label: 'اسم المشروع',    sortable: true  },
              { key: 'type',     label: 'النوع',          sortable: true  },
              { key: 'engineer', label: 'المهندس',        sortable: true  },
              { key: 'status',   label: 'الحالة',         sortable: true  },
              { key: 'progress', label: 'الإنجاز',        sortable: true  },
              { key: 'end_date', label: 'تاريخ التسليم',  sortable: true  },
              { key: 'value',    label: 'القيمة',         sortable: true  },
              { key: 'days',     label: 'المتبقي',        sortable: true  },
            ]}
            rows={projFiltered.map(p => {
              const days = daysUntil(p.end_date)
              const isLate = days !== null && days < 0 && p.progress < 100
              return {
                code:     p.code || `#${p.id}`,
                name:     p.name,
                type:     p.type || '—',
                engineer: p.engineer || '—',
                status:   p.progress >= 100 ? 'مكتمل' : isLate ? 'متأخر' : p.status,
                progress: p.progress + '%',
                end_date: formatDate(p.end_date),
                value:    p.value ? formatCurrency(p.value) : '—',
                days:     days !== null && p.progress < 100 ? (isLate ? `متأخر ${Math.abs(days)} يوم` : `${days} يوم`) : '—',
              }
            })}
          />

          <ReportTable title="📊 ملخص حسب النوع" exportName="مشاريع-حسب-النوع" companyName={companyName}
            headers={[
              { key: 'النوع',          label: 'النوع',          sortable: true },
              { key: 'العدد',          label: 'العدد',          sortable: true },
              { key: 'قيد التنفيذ',   label: 'قيد التنفيذ',   sortable: true },
              { key: 'مكتمل',         label: 'مكتمل',         sortable: true },
              { key: 'متأخر',         label: 'متأخر',         sortable: true },
              { key: 'متوسط الإنجاز', label: 'متوسط الإنجاز', sortable: false },
            ]}
            rows={byType}
          />

          <ReportTable title="📊 ملخص حسب الحالة" exportName="مشاريع-حسب-الحالة" companyName={companyName}
            headers={[
              { key: 'الحالة',         label: 'الحالة',         sortable: true },
              { key: 'العدد',          label: 'العدد',          sortable: true },
              { key: 'إجمالي القيمة', label: 'إجمالي القيمة', sortable: false },
              { key: 'متوسط الإنجاز', label: 'متوسط الإنجاز', sortable: false },
            ]}
            rows={byStatus}
          />

          <ReportTable title={`⚠ المشاريع المتأخرة (${lateProjects.length})`} exportName="مشاريع-متأخرة" companyName={companyName}
            emptyMsg="✅ لا توجد مشاريع متأخرة"
            headers={[
              { key: 'code',     label: 'الرقم',         sortable: true },
              { key: 'name',     label: 'اسم المشروع',   sortable: true },
              { key: 'type',     label: 'النوع',         sortable: true },
              { key: 'engineer', label: 'المهندس',       sortable: true },
              { key: 'progress', label: 'الإنجاز',       sortable: true },
              { key: 'end_date', label: 'تاريخ التسليم', sortable: true },
              { key: 'delay',    label: 'أيام التأخير',  sortable: true },
            ]}
            rows={lateProjects.map(p => ({
              code:     p.code || `#${p.id}`,
              name:     p.name,
              type:     p.type || '—',
              engineer: p.engineer || '—',
              progress: p.progress + '%',
              end_date: formatDate(p.end_date),
              delay:    Math.abs(daysUntil(p.end_date) || 0),
            }))}
          />
        </div>
      )}

      {/* ══ الزيارات ══ */}
      {activeTab === 'visits' && (
        <div className="space-y-4">
          <div className="card p-3 flex flex-wrap gap-2 items-center">
            <select value={visitTypeFilter} onChange={e => setVisitType(e.target.value)} className="select w-auto text-sm">
              <option value="">كل الأنواع</option>
              {['جودة','سلامة','كهربائية','ميدانية'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={visitSpecFilter} onChange={e => setVisitSpec(e.target.value)} className="select w-auto text-sm">
              <option value="">كل النتائج</option>
              <option value="مطابق">مطابق</option>
              <option value="غير مطابق">غير مطابق</option>
            </select>
            {(visitTypeFilter || visitSpecFilter) && (
              <button onClick={() => { setVisitType(''); setVisitSpec('') }} className="btn btn-ghost btn-sm text-gray-400">مسح</button>
            )}
          </div>

          <ReportTable title="📋 قائمة الزيارات" loading={isLoading} exportName="تقرير-الزيارات" companyName={companyName}
            headers={[
              { key: 'type',     label: 'النوع',         sortable: true  },
              { key: 'date',     label: 'التاريخ',       sortable: true  },
              { key: 'engineer', label: 'المهندس',       sortable: true  },
              { key: 'location', label: 'الموقع',        sortable: false },
              { key: 'specs',    label: 'النتيجة',       sortable: true  },
              { key: 'ncr',      label: 'حالة NCR',      sortable: true  },
              { key: 'resolved', label: 'تاريخ الإغلاق', sortable: true  },
            ]}
            rows={visitsFiltered.map(v => ({
              type:     v.type,
              date:     formatDate(v.date),
              engineer: v.engineer,
              location: v.location || '—',
              specs:    v.specs,
              ncr:      v.specs === 'غير مطابق' ? (v.resolved_report ? 'مغلقة' : 'معلقة') : '—',
              resolved: v.resolved_date ? formatDate(v.resolved_date) : '—',
            }))}
          />

          <ReportTable title={`⚠ NCR المعلقة (${visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length})`}
            exportName="NCR-معلقة" companyName={companyName} emptyMsg="✅ لا توجد NCR معلقة"
            headers={[
              { key: 'type',       label: 'نوع الزيارة',      sortable: true  },
              { key: 'date',       label: 'التاريخ',           sortable: true  },
              { key: 'engineer',   label: 'المهندس',           sortable: true  },
              { key: 'location',   label: 'الموقع',            sortable: false },
              { key: 'corrective', label: 'الإجراء التصحيحي', sortable: false },
            ]}
            rows={visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).map(v => ({
              type: v.type, date: formatDate(v.date), engineer: v.engineer,
              location: v.location || '—', corrective: v.corrective || '—',
            }))}
          />

          <ReportTable title="👷 أداء المهندسين" exportName="أداء-المهندسين" companyName={companyName}
            headers={[
              { key: 'المهندس',       label: 'المهندس',       sortable: true  },
              { key: 'عدد الزيارات',  label: 'عدد الزيارات', sortable: true  },
              { key: 'مطابق',         label: 'مطابق',         sortable: true  },
              { key: 'غير مطابق',     label: 'غير مطابق',     sortable: true  },
              { key: 'نسبة المطابقة', label: 'نسبة المطابقة', sortable: false },
              { key: 'NCR معلقة',     label: 'NCR معلقة',     sortable: true  },
            ]}
            rows={engPerf}
          />
        </div>
      )}

      {/* ══ المخزون ══ */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="card p-3 flex flex-wrap gap-2 items-center">
            <select value={matSourceFilter} onChange={e => setMatSource(e.target.value)} className="select w-auto text-sm">
              <option value="">كل المصادر</option>
              <option value="كهرباء">⚡ مواد SEC</option>
              <option value="خاص">🏢 مواد خاصة</option>
            </select>
            {matSourceFilter && <button onClick={() => setMatSource('')} className="btn btn-ghost btn-sm text-gray-400">مسح</button>}
          </div>

          <ReportTable title="📦 قائمة المواد" loading={isLoading} exportName="تقرير-المواد" companyName={companyName}
            headers={[
              { key: 'source',     label: 'المصدر',         sortable: true  },
              { key: 'sec_number', label: 'SEC Number',      sortable: true  },
              { key: 'catalog_no', label: 'رقم الكتالوج',   sortable: true  },
              { key: 'name',       label: 'اسم المادة',     sortable: true  },
              { key: 'qty',        label: 'الكمية',         sortable: true  },
              { key: 'reorder',    label: 'حد الأمان',      sortable: true  },
              { key: 'unit',       label: 'الوحدة',         sortable: false },
              { key: 'status',     label: 'الحالة',         sortable: true  },
              { key: 'location',   label: 'الموقع الداخلي', sortable: false },
            ]}
            rows={matsFiltered.map(m => ({
              source:     m.source || '—',
              sec_number: m.sec_number || '—',
              catalog_no: m.catalog_no,
              name:       m.name,
              qty:        m.qty,
              reorder:    m.reorder,
              unit:       m.unit,
              status:     m.qty <= 0 ? 'نفدت' : m.qty <= m.reorder ? 'منخفض' : 'طبيعي',
              location:   (m as any).location || '—',
            }))}
          />

          <ReportTable title={`⚠ المواد الخاصة تحت حد الأمان (${materials.filter(m => m.qty <= m.reorder && m.source !== 'كهرباء').length})`}
            exportName="مواد-تحت-الحد" companyName={companyName} emptyMsg="✅ كل المواد فوق حد الأمان"
            headers={[
              { key: 'source',     label: 'المصدر',          sortable: true },
              { key: 'sec_number', label: 'SEC Number',       sortable: true },
              { key: 'name',       label: 'المادة',           sortable: true },
              { key: 'qty',        label: 'الكمية الحالية',  sortable: true },
              { key: 'reorder',    label: 'حد الأمان',       sortable: true },
              { key: 'unit',       label: 'الوحدة',          sortable: false },
              { key: 'status',     label: 'الحالة',          sortable: true },
            ]}
            rows={materials.filter(m => m.qty <= m.reorder && m.source !== 'كهرباء').map(m => ({
              source: m.source || '—', sec_number: m.sec_number || '—',
              name: m.name, qty: m.qty, reorder: m.reorder, unit: m.unit,
              status: m.qty <= 0 ? '⛔ نفدت' : '⚠ منخفض',
            }))}
          />

          {/* عهدة المشاريع */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-primary-500" />
                عهدة المشاريع
              </h3>
              <span className="text-xs text-gray-400">
                {isLoading ? 'جارٍ التحميل...' : `${Object.keys(projectMap).length} مشروع`}
              </span>
            </div>
            {isLoading ? (
              <div className="card p-8 flex justify-center">
                <div className="w-7 h-7 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : Object.keys(projectMap).length === 0 ? (
              <div className="card p-8 text-center text-gray-400 text-sm">
                لا توجد حركات مخزون مرتبطة بمشاريع
              </div>
            ) : (
              Object.entries(projectMap).map(([proj, mats]) => (
                <ReportTable
                  key={proj}
                  title={`📁 ${proj} — ${mats.length} مادة`}
                  exportName={`عهدة-${proj}`}
                  companyName={companyName}
                  headers={[
                    { key: 'matName', label: 'المادة',        sortable: true  },
                    { key: 'in',      label: 'إجمالي الوارد', sortable: true  },
                    { key: 'out',     label: 'إجمالي الصادر', sortable: true  },
                    { key: 'net',     label: 'الرصيد المتبقي',sortable: true  },
                    { key: 'unit',    label: 'الوحدة',        sortable: false },
                  ]}
                  rows={mats.map(m => ({ ...m }))}
                />
              ))
            )}
          </div>

          {/* مادة محددة — المشاريع المرتبطة */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-primary-500" />
                مشاريع مادة محددة
              </h3>
              <select value={selectedMat} onChange={e => setSelectedMat(e.target.value)} className="select text-sm">
                <option value="">— اختر مادة لرؤية مشاريعها —</option>
                {matNames.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {selectedMat && (
              matProjectsData.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">لا توجد مشاريع مرتبطة بهذه المادة في سجل الحركات</div>
              ) : (
                <ReportTable
                  title={`🔍 ${selectedMat} — ${matProjectsData.length} مشروع مرتبط`}
                  exportName={`مشاريع-${selectedMat}`}
                  companyName={companyName}
                  headers={[
                    { key: 'المشروع', label: 'المشروع',       sortable: true },
                    { key: 'الوارد',  label: 'إجمالي الوارد', sortable: true },
                    { key: 'الصادر', label: 'إجمالي الصادر', sortable: true },
                    { key: 'الرصيد', label: 'الرصيد',         sortable: true },
                    { key: 'الوحدة', label: 'الوحدة',         sortable: false },
                  ]}
                  rows={matProjectsData}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* ══ المشتريات ══ */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="card p-3 flex flex-wrap gap-2 items-center">
            <select value={poStatusFilter} onChange={e => setPoStatus(e.target.value)} className="select w-auto text-sm">
              <option value="">كل الحالات</option>
              {['طلب شراء','بانتظار الموافقة','موافق عليه','مرفوض','مكتمل'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {poStatusFilter && <button onClick={() => setPoStatus('')} className="btn btn-ghost btn-sm text-gray-400">مسح</button>}
          </div>
          <ReportTable title="🛒 قائمة طلبات الشراء" loading={isLoading} exportName="تقرير-المشتريات" companyName={companyName}
            headers={[
              { key: 'code',    label: 'رقم الطلب', sortable: true  },
              { key: 'date',    label: 'التاريخ',   sortable: true  },
              { key: 'vendor',  label: 'المورد',    sortable: true  },
              { key: 'project', label: 'المشروع',   sortable: true  },
              { key: 'status',  label: 'الحالة',    sortable: true  },
              { key: 'notes',   label: 'الملاحظات', sortable: false },
            ]}
            rows={purchases.filter(p => !poStatusFilter || p.status === poStatusFilter).map(p => ({
              code:    p.code || `#${p.id}`,
              date:    formatDate(p.date),
              vendor:  p.vendor || '—',
              project: p.project_name || '—',
              status:  p.status,
              notes:   p.notes || '—',
            }))}
          />
        </div>
      )}

      {/* ══ السلامة والجودة ══ */}
      {activeTab === 'qhse' && (
        <div className="space-y-4">
          <ReportTable title="🛡️ تقرير الزيارات والسلامة" loading={isLoading} exportName="تقرير-السلامة" companyName={companyName}
            headers={[
              { key: 'type',         label: 'نوع الزيارة',     sortable: true  },
              { key: 'date',         label: 'التاريخ',          sortable: true  },
              { key: 'engineer',     label: 'المهندس',          sortable: true  },
              { key: 'location',     label: 'الموقع',           sortable: false },
              { key: 'specs',        label: 'النتيجة',          sortable: true  },
              { key: 'ncr_status',   label: 'حالة NCR',         sortable: true  },
              { key: 'corrective',   label: 'الإجراء التصحيحي', sortable: false },
              { key: 'resolved_by',  label: 'أُغلق بواسطة',    sortable: false },
              { key: 'resolved_date',label: 'تاريخ الإغلاق',   sortable: true  },
            ]}
            rows={visits.map(v => ({
              type:          v.type,
              date:          formatDate(v.date),
              engineer:      v.engineer,
              location:      v.location || '—',
              specs:         v.specs,
              ncr_status:    v.specs === 'غير مطابق' ? (v.resolved_report ? '✓ مغلقة' : '⚠ معلقة') : '—',
              corrective:    v.corrective || '—',
              resolved_by:   v.resolved_by || '—',
              resolved_date: v.resolved_date ? formatDate(v.resolved_date) : '—',
            }))}
          />

          <ReportTable title="📋 تقرير NCR الكامل" exportName="تقرير-NCR" companyName={companyName}
            headers={[
              { key: 'type',         label: 'النوع',            sortable: true  },
              { key: 'date',         label: 'تاريخ الزيارة',   sortable: true  },
              { key: 'engineer',     label: 'المهندس',          sortable: true  },
              { key: 'location',     label: 'الموقع',           sortable: false },
              { key: 'corrective',   label: 'المخالفة',         sortable: false },
              { key: 'status',       label: 'الحالة',           sortable: true  },
              { key: 'resolved_by',  label: 'أُغلق بواسطة',    sortable: false },
              { key: 'resolved_date',label: 'تاريخ الإغلاق',   sortable: true  },
            ]}
            rows={visits.filter(v => v.specs === 'غير مطابق').map(v => ({
              type:          v.type,
              date:          formatDate(v.date),
              engineer:      v.engineer,
              location:      v.location || '—',
              corrective:    v.corrective || '—',
              status:        v.resolved_report ? '✓ مغلقة' : '⚠ معلقة',
              resolved_by:   v.resolved_by || '—',
              resolved_date: v.resolved_date ? formatDate(v.resolved_date) : '—',
            }))}
          />
        </div>
      )}

      {/* ══ الموظفين ══ */}
      {activeTab === 'employees' && (
        <ReportTable title="👥 قائمة الموظفين" loading={isLoading} exportName="تقرير-الموظفين" companyName={companyName}
          headers={[
            { key: 'name',   label: 'الاسم',          sortable: true  },
            { key: 'role',   label: 'الدور الوظيفي', sortable: true  },
            { key: 'phone',  label: 'الجوال',         sortable: false },
            { key: 'email',  label: 'البريد',         sortable: false },
            { key: 'status', label: 'الحالة',         sortable: true  },
          ]}
          rows={employees.map(e => ({
            name:   e.name,
            role:   e.role,
            phone:  e.phone  || '—',
            email:  e.email  || '—',
            status: e.is_active ? 'نشط' : 'غير نشط',
          }))}
        />
      )}
    </div>
  )
}
