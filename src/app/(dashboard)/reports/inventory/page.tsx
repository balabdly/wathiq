'use client'

import { useState, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowRight, Package, ChevronDown, ChevronUp, Download, Search, Eye, EyeOff, Printer } from 'lucide-react'

function exportExcel(filename: string, title: string, company: string, headers: string[], rows: (string | number)[][]) {
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>'
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles>'
  xml += '<Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a56db" ss:Pattern="Solid"/></Style>'
  xml += '<Style ss:ID="t"><Font ss:Bold="1" ss:Size="13" ss:Color="#1a56db"/></Style>'
  xml += '<Style ss:ID="e"><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/></Style></Styles>'
  xml += `<Worksheet ss:Name="${esc(title.substring(0,31))}"><Table>`
  xml += `<Row><Cell ss:StyleID="t"><Data ss:Type="String">${esc(company)} — ${esc(title)}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} | عدد السجلات: ${rows.length}</Data></Cell></Row><Row/>`
  xml += '<Row>' + headers.map(h => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('') + '</Row>'
  rows.forEach((row, i) => { xml += '<Row>' + row.map(c => { const v = c ?? ''; return `<Cell ss:StyleID="${i%2===0?'e':''}"><Data ss:Type="${typeof v==='number'?'Number':'String'}">${esc(v)}</Data></Cell>` }).join('') + '</Row>' })
  xml += '</Table></Worksheet></Workbook>'
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿'+xml],{type:'application/vnd.ms-excel;charset=utf-8'})); a.download = `${filename}.xls`; document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

function exportPDF(title: string, company: string, headers: string[], rows: (string|number)[][]) {
  const w = window.open('','_blank'); if(!w) return
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:20px;direction:rtl;font-size:12px}.hdr{border-bottom:3px solid #1a56db;padding-bottom:10px;margin-bottom:16px}.co{font-size:17px;font-weight:bold;color:#1a56db}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#1a56db;color:white;padding:7px 10px;text-align:right;border:1px solid #1349b8}td{padding:6px 10px;border:1px solid #e5e7eb}tr:nth-child(even){background:#f8fafc}@media print{body{margin:0}}</style></head><body><div class="hdr"><div class="co">${company}</div><div>${title}</div><div style="font-size:10px;color:#6b7280">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} | عدد السجلات: ${rows.length}</div></div><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

function ReportTable({ title, headers, rows, exportName, loading, emptyMsg, company }: {
  title: string; headers: {key:string;label:string;sortable?:boolean}[]; rows: Record<string,any>[]
  exportName: string; loading?: boolean; emptyMsg?: string; company?: string
}) {
  const [visible, setVisible] = useState(false)
  const [sort, setSort] = useState<{key:string;dir:'asc'|'desc'}|null>(null)
  const [search, setSearch] = useState('')
  const filtered = rows.filter(r => !search || Object.values(r).some(v => String(v||'').toLowerCase().includes(search.toLowerCase())))
  const sorted = sort ? [...filtered].sort((a,b) => {
    const av=a[sort.key],bv=b[sort.key]
    if(typeof av==='number'&&typeof bv==='number') return sort.dir==='asc'?av-bv:bv-av
    return sort.dir==='asc'?String(av||'').localeCompare(String(bv||''),'ar'):String(bv||'').localeCompare(String(av||''),'ar')
  }) : filtered
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
          <span className="badge badge-gray text-xs">{rows.length} سجل</span>
        </div>
        <div className="flex items-center gap-2">
          {visible && (<>
            <div className="relative"><Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2"/><input value={search} onChange={e=>setSearch(e.target.value)} className="input pr-8 py-1.5 text-xs w-36" placeholder="بحث..."/></div>
            <button onClick={()=>exportExcel(exportName,title,company||'وثيق ERP',headers.map(h=>h.label),sorted.map(r=>headers.map(h=>r[h.key]??'')))} className="btn btn-ghost btn-sm gap-1 border border-emerald-200 text-emerald-600 hover:bg-emerald-50"><Download className="w-3.5 h-3.5"/> Excel</button>
            <button onClick={()=>exportPDF(title,company||'وثيق ERP',headers.map(h=>h.label),sorted.map(r=>headers.map(h=>r[h.key]??'')))} className="btn btn-ghost btn-sm gap-1 border border-red-200 text-red-500 hover:bg-red-50"><Printer className="w-3.5 h-3.5"/> PDF</button>
          </>)}
          <button onClick={()=>setVisible(!visible)} className={`btn btn-sm gap-1.5 ${visible?'btn-primary':'btn-ghost border border-primary-200 text-primary-600 hover:bg-primary-50'}`}>
            {visible?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}{visible?'إخفاء':'عرض'}
          </button>
        </div>
      </div>
      {visible && <div className="overflow-x-auto">
        {loading ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/></div>
        : sorted.length===0 ? <div className="text-center py-10 text-gray-400 text-sm">{emptyMsg||'لا توجد بيانات'}</div>
        : <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {headers.map(h=><th key={h.key} onClick={()=>h.sortable&&setSort(s=>s?.key===h.key?{key:h.key,dir:s.dir==='asc'?'desc':'asc'}:{key:h.key,dir:'asc'})} className={`text-right px-4 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap ${h.sortable?'cursor-pointer hover:text-primary-600 select-none':''}`}>
                <span className="flex items-center gap-1">{h.label}{h.sortable&&sort?.key===h.key&&(sort.dir==='asc'?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>)}</span>
              </th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((row,i)=><tr key={i} className="hover:bg-gray-50/50">{headers.map(h=><td key={h.key} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{row[h.key]??'—'}</td>)}</tr>)}
            </tbody>
          </table>}
      </div>}
    </div>
  )
}

function ReportGroup({ title, color, children, defaultOpen=false }: { title:string; color:string; children:React.ReactNode; defaultOpen?:boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button onClick={()=>setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:color+'18'}}><Package className="w-4 h-4" style={{color}}/></div>
          <span className="font-bold text-gray-800 text-sm">{title}</span>
        </div>
        {open?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}
      </button>
      {open && <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  )
}

export default function InventoryReportsPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const company = (tenant as any)?.name || 'وثيق ERP'
  const tid = tenant?.id; const bid = activeBranch?.id

  const [materials, setMaterials] = useState<any[]>([])
  const [ledger, setLedger] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!tid || loaded) return
    setIsLoading(true)
    try {
      const [m, l, w] = await Promise.all([
        supabase.from('materials').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('name'),
        supabase.from('stock_ledger').select('*').eq('tenant_id', tid).eq('branch_id', bid).order('created_at', { ascending: false }).limit(2000),
        supabase.from('warehouses').select('*').eq('tenant_id', tid).eq('branch_id', bid),
      ])
      setMaterials(m.data || []); setLedger(l.data || []); setWarehouses(w.data || [])
      setLoaded(true)
    } catch(e){ console.error(e) }
    setIsLoading(false)
  }, [tid, bid, loaded])

  const fmt = (n: number) => (n||0).toLocaleString('ar-SA', {minimumFractionDigits:2})
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'

  // 1. قائمة المواد الكاملة
  const matList = materials.map(m => ({
    'اسم المادة': m.name,
    'المصدر': m.source || '—',
    'SEC Number': m.sec_number || '—',
    'رقم الكتالوج': m.catalog_no || '—',
    'الكمية الحالية': m.qty,
    'حد الأمان': m.reorder,
    'الوحدة': m.unit,
    'الحالة': m.qty <= 0 ? '⛔ نفدت' : m.qty <= m.reorder ? '⚠️ منخفض' : '✅ طبيعي',
    'الموقع': m.location || '—',
    'المستودع': warehouses.find(w => w.id === m.warehouse_id)?.name || '—',
  }))

  // 2. المواد تحت حد الأمان
  const lowStock = materials.filter(m => m.qty <= m.reorder && m.source !== 'كهرباء').map(m => ({
    'اسم المادة': m.name,
    'المصدر': m.source || '—',
    'الكمية الحالية': m.qty,
    'حد الأمان': m.reorder,
    'النقص': Math.max(m.reorder - m.qty, 0),
    'الوحدة': m.unit,
    'الحالة': m.qty <= 0 ? '⛔ نفدت' : '⚠️ منخفض',
  }))

  // 3. حركة المخزون
  const ledgerList = ledger.map((l: any) => ({
    'اسم المادة': l.mat_name,
    'نوع الحركة': l.type,
    'الكمية': l.qty,
    'الوحدة': l.unit || '—',
    'المستودع': l.wh_name || '—',
    'المشروع': l.project_name || '—',
    'الكمية قبل': l.qty_before,
    'الكمية بعد': l.qty_after,
    'التاريخ': fmtDate(l.created_at),
  }))

  // 4. ملخص الحركة حسب المادة
  const ledgerByMat = (() => {
    const map: Record<string, { in: number; out: number; unit: string }> = {}
    ledger.forEach((l: any) => {
      if (!map[l.mat_name]) map[l.mat_name] = { in: 0, out: 0, unit: l.unit || '—' }
      if (l.type === 'توريد' || l.type === 'استلام') map[l.mat_name].in += Number(l.qty || 0)
      else map[l.mat_name].out += Number(l.qty || 0)
    })
    return Object.entries(map).map(([name, v]) => ({
      'المادة': name,
      'إجمالي الوارد': v.in,
      'إجمالي الصادر': v.out,
      'الرصيد': v.in - v.out,
      'الوحدة': v.unit,
    }))
  })()

  // 5. عهدة المشاريع
  const projectCustody = (() => {
    const map: Record<string, Record<string, { in: number; out: number; unit: string }>> = {}
    ledger.forEach((l: any) => {
      if (!l.project_name) return
      if (!map[l.project_name]) map[l.project_name] = {}
      if (!map[l.project_name][l.mat_name]) map[l.project_name][l.mat_name] = { in: 0, out: 0, unit: l.unit || '—' }
      if (l.type === 'توريد' || l.type === 'استلام') map[l.project_name][l.mat_name].in += Number(l.qty||0)
      else map[l.project_name][l.mat_name].out += Number(l.qty||0)
    })
    const rows: any[] = []
    Object.entries(map).forEach(([proj, mats]) => {
      Object.entries(mats).forEach(([mat, v]) => {
        rows.push({ 'المشروع': proj, 'المادة': mat, 'الوارد': v.in, 'الصادر': v.out, 'المتبقي': v.in - v.out, 'الوحدة': v.unit })
      })
    })
    return rows
  })()

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/reports')} className="btn btn-ghost btn-sm gap-1.5 text-gray-500 hover:text-gray-700">
          <ArrowRight className="w-4 h-4"/> التقارير
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-500"/> تقارير المخزون
        </h1>
      </div>

      <ReportGroup title="📦 قائمة المواد" color="#d97706" defaultOpen>
        <div onMouseEnter={loadData}>
          <ReportTable title="جميع المواد" exportName="قائمة-المواد" company={company} loading={isLoading}
            headers={[
              {key:'اسم المادة',label:'اسم المادة',sortable:true},
              {key:'المصدر',label:'المصدر',sortable:true},
              {key:'SEC Number',label:'SEC Number',sortable:true},
              {key:'رقم الكتالوج',label:'رقم الكتالوج',sortable:true},
              {key:'الكمية الحالية',label:'الكمية الحالية',sortable:true},
              {key:'حد الأمان',label:'حد الأمان',sortable:true},
              {key:'الوحدة',label:'الوحدة',sortable:false},
              {key:'الحالة',label:'الحالة',sortable:true},
              {key:'المستودع',label:'المستودع',sortable:true},
            ]}
            rows={matList}
          />
        </div>
      </ReportGroup>

      <ReportGroup title="⚠️ المواد تحت حد الأمان" color="#dc2626">
        <div onMouseEnter={loadData}>
          <ReportTable title={`المواد تحت حد الأمان (${lowStock.length})`} exportName="مواد-تحت-الحد" company={company} loading={isLoading}
            emptyMsg="✅ جميع المواد فوق حد الأمان"
            headers={[
              {key:'اسم المادة',label:'اسم المادة',sortable:true},
              {key:'المصدر',label:'المصدر',sortable:true},
              {key:'الكمية الحالية',label:'الكمية الحالية',sortable:true},
              {key:'حد الأمان',label:'حد الأمان',sortable:true},
              {key:'النقص',label:'النقص',sortable:true},
              {key:'الوحدة',label:'الوحدة',sortable:false},
              {key:'الحالة',label:'الحالة',sortable:true},
            ]}
            rows={lowStock}
          />
        </div>
      </ReportGroup>

      <ReportGroup title="🔄 حركة المخزون" color="#0891b2">
        <div onMouseEnter={loadData}>
          <ReportTable title="سجل حركة المخزون" exportName="حركة-المخزون" company={company} loading={isLoading}
            headers={[
              {key:'اسم المادة',label:'اسم المادة',sortable:true},
              {key:'نوع الحركة',label:'نوع الحركة',sortable:true},
              {key:'الكمية',label:'الكمية',sortable:true},
              {key:'الوحدة',label:'الوحدة',sortable:false},
              {key:'المستودع',label:'المستودع',sortable:true},
              {key:'المشروع',label:'المشروع',sortable:true},
              {key:'الكمية قبل',label:'الكمية قبل',sortable:false},
              {key:'الكمية بعد',label:'الكمية بعد',sortable:false},
              {key:'التاريخ',label:'التاريخ',sortable:true},
            ]}
            rows={ledgerList}
          />
          <ReportTable title="ملخص الحركة حسب المادة" exportName="ملخص-حركة-المواد" company={company} loading={isLoading}
            headers={[
              {key:'المادة',label:'المادة',sortable:true},
              {key:'إجمالي الوارد',label:'إجمالي الوارد',sortable:true},
              {key:'إجمالي الصادر',label:'إجمالي الصادر',sortable:true},
              {key:'الرصيد',label:'الرصيد',sortable:true},
              {key:'الوحدة',label:'الوحدة',sortable:false},
            ]}
            rows={ledgerByMat}
          />
        </div>
      </ReportGroup>

      <ReportGroup title="📁 عهدة المشاريع" color="#7c3aed">
        <div onMouseEnter={loadData}>
          <ReportTable title="المواد حسب المشروع" exportName="عهدة-المشاريع" company={company} loading={isLoading}
            emptyMsg="لا توجد حركات مرتبطة بمشاريع"
            headers={[
              {key:'المشروع',label:'المشروع',sortable:true},
              {key:'المادة',label:'المادة',sortable:true},
              {key:'الوارد',label:'الوارد',sortable:true},
              {key:'الصادر',label:'الصادر',sortable:true},
              {key:'المتبقي',label:'المتبقي',sortable:true},
              {key:'الوحدة',label:'الوحدة',sortable:false},
            ]}
            rows={projectCustody}
          />
        </div>
      </ReportGroup>
    </div>
  )
}
