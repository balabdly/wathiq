'use client'

import { useState, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowRight, Shield, ClipboardCheck, ChevronDown, ChevronUp, Download, Search, Eye, EyeOff, Printer } from 'lucide-react'

// ── Shared helpers ──────────────────────────────────────────────────
function exportExcel(filename: string, title: string, company: string, headers: string[], rows: (string|number)[][]) {
  const esc=(s:any)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  let xml='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a56db" ss:Pattern="Solid"/></Style><Style ss:ID="e"><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/></Style></Styles>'
  xml+=`<Worksheet ss:Name="${esc(title.substring(0,31))}"><Table><Row><Cell><Data ss:Type="String">${esc(company)} — ${esc(title)}</Data></Cell></Row><Row/>`
  xml+='<Row>'+headers.map(h=>`<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')+'</Row>'
  rows.forEach((row,i)=>{xml+='<Row>'+row.map(c=>{const v=c??'';return `<Cell ss:StyleID="${i%2===0?'e':''}"><Data ss:Type="${typeof v==='number'?'Number':'String'}">${esc(v)}</Data></Cell>`}).join('')+'</Row>'})
  xml+='</Table></Worksheet></Workbook>'
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+xml],{type:'application/vnd.ms-excel;charset=utf-8'}));a.download=`${filename}.xls`;document.body.appendChild(a);a.click();document.body.removeChild(a)
}

function exportPDF(title: string, company: string, headers: string[], rows: (string|number)[][]) {
  const w=window.open('','_blank');if(!w)return
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:20px;direction:rtl;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#1a56db;color:white;padding:7px 10px;text-align:right}td{padding:6px 10px;border:1px solid #e5e7eb}tr:nth-child(even){background:#f8fafc}@media print{body{margin:0}}</style></head><body><h2 style="color:#1a56db">${company} — ${title}</h2><p style="font-size:10px;color:#6b7280">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

function ReportTable({ title, headers, rows, exportName, loading, emptyMsg, company }: {
  title:string; headers:{key:string;label:string;sortable?:boolean}[]; rows:Record<string,any>[]
  exportName:string; loading?:boolean; emptyMsg?:string; company?:string
}) {
  const [visible,setVisible]=useState(false)
  const [sort,setSort]=useState<{key:string;dir:'asc'|'desc'}|null>(null)
  const [search,setSearch]=useState('')
  const filtered=rows.filter(r=>!search||Object.values(r).some(v=>String(v||'').toLowerCase().includes(search.toLowerCase())))
  const sorted=sort?[...filtered].sort((a,b)=>{const av=a[sort.key],bv=b[sort.key];if(typeof av==='number'&&typeof bv==='number')return sort.dir==='asc'?av-bv:bv-av;return sort.dir==='asc'?String(av||'').localeCompare(String(bv||''),'ar'):String(bv||'').localeCompare(String(av||''),'ar')}):filtered
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3"><h3 className="font-semibold text-gray-700 text-sm">{title}</h3><span className="badge badge-gray text-xs">{rows.length} سجل</span></div>
        <div className="flex items-center gap-2">
          {visible&&(<><div className="relative"><Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2"/><input value={search} onChange={e=>setSearch(e.target.value)} className="input pr-8 py-1.5 text-xs w-36" placeholder="بحث..."/></div>
          <button onClick={()=>exportExcel(exportName,title,company||'وثيق ERP',headers.map(h=>h.label),sorted.map(r=>headers.map(h=>r[h.key]??'')))} className="btn btn-ghost btn-sm gap-1 border border-emerald-200 text-emerald-600 hover:bg-emerald-50"><Download className="w-3.5 h-3.5"/> Excel</button>
          <button onClick={()=>exportPDF(title,company||'وثيق ERP',headers.map(h=>h.label),sorted.map(r=>headers.map(h=>r[h.key]??'')))} className="btn btn-ghost btn-sm gap-1 border border-red-200 text-red-500 hover:bg-red-50"><Printer className="w-3.5 h-3.5"/> PDF</button></>)}
          <button onClick={()=>setVisible(!visible)} className={`btn btn-sm gap-1.5 ${visible?'btn-primary':'btn-ghost border border-primary-200 text-primary-600 hover:bg-primary-50'}`}>{visible?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}{visible?'إخفاء':'عرض'}</button>
        </div>
      </div>
      {visible&&<div className="overflow-x-auto">{loading?<div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/></div>:sorted.length===0?<div className="text-center py-10 text-gray-400 text-sm">{emptyMsg||'لا توجد بيانات'}</div>:
        <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b border-gray-100">{headers.map(h=><th key={h.key} onClick={()=>h.sortable&&setSort(s=>s?.key===h.key?{key:h.key,dir:s.dir==='asc'?'desc':'asc'}:{key:h.key,dir:'asc'})} className={`text-right px-4 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap ${h.sortable?'cursor-pointer hover:text-primary-600':''}`}><span className="flex items-center gap-1">{h.label}{h.sortable&&sort?.key===h.key&&(sort.dir==='asc'?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>)}</span></th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">{sorted.map((row,i)=><tr key={i} className="hover:bg-gray-50/50">{headers.map(h=><td key={h.key} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{row[h.key]??'—'}</td>)}</tr>)}</tbody></table>}
      </div>}
    </div>
  )
}

function ReportGroup({ title, icon: Icon, color, children, defaultOpen=false }: { title:string; icon:any; color:string; children:React.ReactNode; defaultOpen?:boolean }) {
  const [open,setOpen]=useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button onClick={()=>setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:color+'18'}}><Icon className="w-4 h-4" style={{color}}/></div><span className="font-bold text-gray-800 text-sm">{title}</span></div>
        {open?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}
      </button>
      {open&&<div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  )
}

// ══════════════════════════════════════════════
// صفحة QHSE
// ══════════════════════════════════════════════
export function QHSEReportsPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const company = (tenant as any)?.name || 'وثيق ERP'
  const tid = tenant?.id; const bid = activeBranch?.id

  const [audits,setAudits]=useState<any[]>([])
  const [certs,setCerts]=useState<any[]>([])
  const [incidents,setIncidents]=useState<any[]>([])
  const [loaded,setLoaded]=useState(false)
  const [isLoading,setIsLoading]=useState(false)

  const loadData = useCallback(async () => {
    if (!tid||loaded) return
    setIsLoading(true)
    try {
      const [a,c,i] = await Promise.all([
        supabase.from('qhse_audits').select('*').eq('tenant_id',tid).order('created_at',{ascending:false}),
        supabase.from('qhse_certs').select('*').eq('tenant_id',tid).order('expiry_date',{ascending:true}),
        supabase.from('qhse_incidents').select('*').eq('tenant_id',tid).order('incident_date',{ascending:false}),
      ])
      setAudits(a.data||[]); setCerts(c.data||[]); setIncidents(i.data||[])
      setLoaded(true)
    } catch(e){console.error(e)}
    setIsLoading(false)
  }, [tid,loaded])

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString('ar-SA'):'—'
  const now=new Date()

  // شهادات قاربت على الانتهاء (خلال 30 يوم)
  const expiringSoon = certs.filter((c:any)=>{
    if (!c.expiry_date) return false
    const days = Math.ceil((new Date(c.expiry_date).getTime()-now.getTime())/86400000)
    return days >= 0 && days <= 30
  })

  const expiredCerts = certs.filter((c:any)=>c.expiry_date && new Date(c.expiry_date) < now)

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center gap-3">
        <button onClick={()=>router.push('/reports')} className="btn btn-ghost btn-sm gap-1.5 text-gray-500 hover:text-gray-700"><ArrowRight className="w-4 h-4"/> التقارير</button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Shield className="w-5 h-5 text-primary-500"/> تقارير السلامة والجودة</h1>
      </div>

      <ReportGroup title="🔍 التدقيق والمراجعة" icon={Shield} color="#dc2626" defaultOpen>
        <div onMouseEnter={loadData}>
          <ReportTable title="سجل التدقيق" exportName="سجل-التدقيق" company={company} loading={isLoading}
            headers={[
              {key:'audit_number',label:'رقم التدقيق',sortable:true},{key:'audit_date',label:'التاريخ',sortable:true},
              {key:'auditor',label:'المدقق',sortable:true},{key:'audit_type',label:'نوع التدقيق',sortable:true},
              {key:'location',label:'الموقع',sortable:false},{key:'result',label:'النتيجة',sortable:true},
              {key:'findings',label:'الملاحظات',sortable:false},{key:'status',label:'الحالة',sortable:true},
            ]}
            rows={audits.map((a:any)=>({...a,audit_date:fmtDate(a.audit_date||a.created_at)}))}
          />
          <ReportTable title="ملخص التدقيق حسب النوع" exportName="ملخص-التدقيق" company={company} loading={isLoading}
            headers={[{key:'النوع',label:'النوع',sortable:true},{key:'العدد',label:'العدد',sortable:true},{key:'ناجح',label:'ناجح',sortable:true},{key:'يحتاج متابعة',label:'يحتاج متابعة',sortable:true}]}
            rows={(() => {
              const map:Record<string,{count:number;pass:number;follow:number}>={};
              audits.forEach((a:any)=>{const t=a.audit_type||'غير محدد';if(!map[t])map[t]={count:0,pass:0,follow:0};map[t].count++;if(a.result==='ناجح'||a.result==='مطابق')map[t].pass++;else map[t].follow++})
              return Object.entries(map).map(([t,v])=>({'النوع':t,'العدد':v.count,'ناجح':v.pass,'يحتاج متابعة':v.follow}))
            })()}
          />
        </div>
      </ReportGroup>

      <ReportGroup title="📜 الشهادات والتراخيص" icon={Shield} color="#059669">
        <div onMouseEnter={loadData}>
          <ReportTable title="جميع الشهادات" exportName="الشهادات" company={company} loading={isLoading}
            headers={[
              {key:'cert_name',label:'اسم الشهادة',sortable:true},{key:'cert_number',label:'رقم الشهادة',sortable:true},
              {key:'issuer',label:'الجهة المصدرة',sortable:true},{key:'issue_date',label:'تاريخ الإصدار',sortable:true},
              {key:'expiry_date',label:'تاريخ الانتهاء',sortable:true},{key:'days_left',label:'الأيام المتبقية',sortable:true},
              {key:'status',label:'الحالة',sortable:true},
            ]}
            rows={certs.map((c:any)=>{
              const days=c.expiry_date?Math.ceil((new Date(c.expiry_date).getTime()-now.getTime())/86400000):null
              return {...c,issue_date:fmtDate(c.issue_date),expiry_date:fmtDate(c.expiry_date),
                days_left:days!==null?(days<0?`منتهية منذ ${Math.abs(days)} يوم`:days===0?'تنتهي اليوم':`${days} يوم`):('—'),
                status:days!==null?(days<0?'⛔ منتهية':days<=30?'⚠️ قاربت على الانتهاء':'✅ سارية'):'—'}
            })}
          />
          <ReportTable title={`⚠️ شهادات تنتهي خلال 30 يوم (${expiringSoon.length})`} exportName="شهادات-قاربت-انتهاء" company={company} loading={isLoading}
            emptyMsg="✅ لا توجد شهادات قاربت على الانتهاء"
            headers={[{key:'cert_name',label:'اسم الشهادة',sortable:true},{key:'expiry_date',label:'تاريخ الانتهاء',sortable:true},{key:'days_left',label:'الأيام المتبقية',sortable:true},{key:'issuer',label:'الجهة المصدرة',sortable:false}]}
            rows={expiringSoon.map((c:any)=>{const days=Math.ceil((new Date(c.expiry_date).getTime()-now.getTime())/86400000);return{...c,expiry_date:fmtDate(c.expiry_date),days_left:`${days} يوم`}})}
          />
          <ReportTable title={`⛔ الشهادات المنتهية (${expiredCerts.length})`} exportName="شهادات-منتهية" company={company} loading={isLoading}
            emptyMsg="✅ لا توجد شهادات منتهية"
            headers={[{key:'cert_name',label:'اسم الشهادة',sortable:true},{key:'cert_number',label:'رقم الشهادة',sortable:false},{key:'expiry_date',label:'تاريخ الانتهاء',sortable:true},{key:'issuer',label:'الجهة المصدرة',sortable:false}]}
            rows={expiredCerts.map((c:any)=>({...c,expiry_date:fmtDate(c.expiry_date)}))}
          />
        </div>
      </ReportGroup>

      <ReportGroup title="⚠️ الحوادث والمخالفات" icon={Shield} color="#d97706">
        <div onMouseEnter={loadData}>
          <ReportTable title="سجل الحوادث" exportName="سجل-الحوادث" company={company} loading={isLoading}
            emptyMsg="لا توجد حوادث مسجلة"
            headers={[
              {key:'incident_number',label:'رقم الحادث',sortable:true},{key:'incident_date',label:'التاريخ',sortable:true},
              {key:'incident_type',label:'النوع',sortable:true},{key:'location',label:'الموقع',sortable:false},
              {key:'severity',label:'الخطورة',sortable:true},{key:'description',label:'الوصف',sortable:false},
              {key:'corrective_action',label:'الإجراء التصحيحي',sortable:false},{key:'status',label:'الحالة',sortable:true},
            ]}
            rows={incidents.map((i:any)=>({...i,incident_date:fmtDate(i.incident_date)}))}
          />
          <ReportTable title="الحوادث حسب النوع" exportName="حوادث-حسب-النوع" company={company} loading={isLoading}
            headers={[{key:'النوع',label:'النوع',sortable:true},{key:'العدد',label:'العدد',sortable:true},{key:'مغلق',label:'مغلق',sortable:true},{key:'مفتوح',label:'مفتوح',sortable:true}]}
            rows={(() => {
              const map:Record<string,{count:number;closed:number;open:number}>={};
              incidents.forEach((i:any)=>{const t=i.incident_type||'غير محدد';if(!map[t])map[t]={count:0,closed:0,open:0};map[t].count++;if(i.status==='مغلق'||i.status==='closed')map[t].closed++;else map[t].open++})
              return Object.entries(map).map(([t,v])=>({'النوع':t,'العدد':v.count,'مغلق':v.closed,'مفتوح':v.open}))
            })()}
          />
        </div>
      </ReportGroup>
    </div>
  )
}

// ══════════════════════════════════════════════
// صفحة الزيارات
// ══════════════════════════════════════════════
export function VisitsReportsPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const company = (tenant as any)?.name || 'وثيق ERP'
  const tid = tenant?.id; const bid = activeBranch?.id

  const [visits,setVisits]=useState<any[]>([])
  const [loaded,setLoaded]=useState(false)
  const [isLoading,setIsLoading]=useState(false)

  const loadData = useCallback(async () => {
    if (!tid||loaded) return
    setIsLoading(true)
    try {
      const {data} = await supabase.from('visits').select('*').eq('tenant_id',tid).eq('branch_id',bid).order('date',{ascending:false})
      setVisits(data||[]); setLoaded(true)
    } catch(e){console.error(e)}
    setIsLoading(false)
  }, [tid,bid,loaded])

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString('ar-SA'):'—'

  const pendingNCR = visits.filter(v=>v.specs==='غير مطابق'&&!v.resolved_report)

  const engineerPerf = (() => {
    const engineers=Array.from(new Set(visits.map(v=>v.engineer).filter(Boolean))) as string[]
    return engineers.map(eng=>{
      const ev=visits.filter(v=>v.engineer===eng)
      const ok=ev.filter(v=>v.specs==='مطابق').length
      return {'المهندس':eng,'عدد الزيارات':ev.length,'مطابق':ok,'غير مطابق':ev.length-ok,'نسبة المطابقة':ev.length?Math.round(ok/ev.length*100)+'%':'—','NCR معلقة':ev.filter(v=>v.specs==='غير مطابق'&&!v.resolved_report).length}
    }).sort((a,b)=>b['عدد الزيارات']-a['عدد الزيارات'])
  })()

  const byType = (() => {
    const map:Record<string,{count:number;ok:number;nok:number}>={};
    visits.forEach(v=>{const t=v.type||'غير محدد';if(!map[t])map[t]={count:0,ok:0,nok:0};map[t].count++;if(v.specs==='مطابق')map[t].ok++;else map[t].nok++})
    return Object.entries(map).map(([t,v])=>({'نوع الزيارة':t,'العدد':v.count,'مطابق':v.ok,'غير مطابق':v.nok,'نسبة المطابقة':v.count?Math.round(v.ok/v.count*100)+'%':'—'}))
  })()

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center gap-3">
        <button onClick={()=>router.push('/reports')} className="btn btn-ghost btn-sm gap-1.5 text-gray-500 hover:text-gray-700"><ArrowRight className="w-4 h-4"/> التقارير</button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-primary-500"/> تقارير الزيارات الميدانية</h1>
      </div>

      <ReportGroup title="📋 قائمة الزيارات" icon={ClipboardCheck} color="#0f766e" defaultOpen>
        <div onMouseEnter={loadData}>
          <ReportTable title="جميع الزيارات" exportName="الزيارات" company={company} loading={isLoading}
            headers={[
              {key:'type',label:'النوع',sortable:true},{key:'date',label:'التاريخ',sortable:true},
              {key:'engineer',label:'المهندس',sortable:true},{key:'location',label:'الموقع',sortable:false},
              {key:'specs',label:'النتيجة',sortable:true},{key:'ncr',label:'حالة NCR',sortable:true},
              {key:'corrective',label:'الإجراء التصحيحي',sortable:false},{key:'resolved_date',label:'تاريخ الإغلاق',sortable:true},
            ]}
            rows={visits.map(v=>({...v,date:fmtDate(v.date),ncr:v.specs==='غير مطابق'?(v.resolved_report?'✅ مغلقة':'⚠️ معلقة'):'—',corrective:v.corrective||'—',resolved_date:fmtDate(v.resolved_date)}))}
          />
        </div>
      </ReportGroup>

      <ReportGroup title={`⚠️ NCR المعلقة (${pendingNCR.length})`} icon={ClipboardCheck} color="#dc2626">
        <div onMouseEnter={loadData}>
          <ReportTable title="NCR المعلقة" exportName="NCR-معلقة" company={company} loading={isLoading}
            emptyMsg="✅ لا توجد NCR معلقة"
            headers={[
              {key:'type',label:'نوع الزيارة',sortable:true},{key:'date',label:'التاريخ',sortable:true},
              {key:'engineer',label:'المهندس',sortable:true},{key:'location',label:'الموقع',sortable:false},
              {key:'corrective',label:'المخالفة',sortable:false},
            ]}
            rows={pendingNCR.map(v=>({...v,date:fmtDate(v.date),corrective:v.corrective||'—'}))}
          />
        </div>
      </ReportGroup>

      <ReportGroup title="👷 أداء المهندسين" icon={ClipboardCheck} color="#7c3aed">
        <div onMouseEnter={loadData}>
          <ReportTable title="أداء المهندسين في الزيارات" exportName="أداء-مهندسين-زيارات" company={company} loading={isLoading}
            headers={[
              {key:'المهندس',label:'المهندس',sortable:true},{key:'عدد الزيارات',label:'عدد الزيارات',sortable:true},
              {key:'مطابق',label:'مطابق',sortable:true},{key:'غير مطابق',label:'غير مطابق',sortable:true},
              {key:'نسبة المطابقة',label:'نسبة المطابقة',sortable:false},{key:'NCR معلقة',label:'NCR معلقة',sortable:true},
            ]}
            rows={engineerPerf}
          />
        </div>
      </ReportGroup>

      <ReportGroup title="📊 ملخص حسب النوع" icon={ClipboardCheck} color="#d97706">
        <div onMouseEnter={loadData}>
          <ReportTable title="الزيارات حسب النوع" exportName="زيارات-حسب-النوع" company={company} loading={isLoading}
            headers={[
              {key:'نوع الزيارة',label:'نوع الزيارة',sortable:true},{key:'العدد',label:'العدد',sortable:true},
              {key:'مطابق',label:'مطابق',sortable:true},{key:'غير مطابق',label:'غير مطابق',sortable:true},
              {key:'نسبة المطابقة',label:'نسبة المطابقة',sortable:false},
            ]}
            rows={byType}
          />
        </div>
      </ReportGroup>
    </div>
  )
}
