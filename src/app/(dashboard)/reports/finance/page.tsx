'use client'

import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, DollarSign, BookOpen, FileText,
  CreditCard, Wallet, TrendingUp, ChevronDown,
  ChevronUp, Download, Search, Eye, EyeOff, Printer
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
  <tbody>${rows.map((r, i) => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <div class="ft"><span>وثيق ERP</span><span>${title}</span></div>
  <script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

// ── مكوّن جدول التقرير ─────────────────────────────────────────────
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

// ── مجموعة تقارير (Accordion) ──────────────────────────────────────
function ReportGroup({ title, icon: Icon, color, children, defaultOpen = false }: {
  title: string
  icon: any
  color: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
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
export default function FinanceReportsPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const company = (tenant as any)?.name || 'وثيق ERP'
  const tid = tenant?.id
  const bid = activeBranch?.id

  // States لكل مجموعة
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  // البيانات
  const [journalEntries, setJournalEntries] = useState<any[]>([])
  const [journalLines, setJournalLines] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [treasury, setTreasury] = useState<any[]>([])
  const [vendorInvoices, setVendorInvoices] = useState<any[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [creditNotes, setCreditNotes] = useState<any[]>([])
  const [custody, setCustody] = useState<any[]>([])

  const fmt = (n: number) => (n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'

  // تحميل البيانات حسب المجموعة
  const loadGroup = useCallback(async (group: string) => {
    if (!tid) return
    setLoading(p => ({ ...p, [group]: true }))

    try {
      if (group === 'general' || group === 'journal') {
        if (!loaded['accounts']) {
          const { data } = await supabase.from('finance_accounts').select('*').eq('tenant_id', tid).order('code')
          setAccounts(data || [])
        }
        const { data: entries } = await supabase.from('finance_journal_entries').select('*').eq('tenant_id', tid).order('entry_date', { ascending: false })
        setJournalEntries(entries || [])
        const { data: lines } = await supabase.from('finance_journal_lines').select('*, finance_accounts(code,name), finance_journal_entries!inner(tenant_id)').eq('finance_journal_entries.tenant_id', tid)
        setJournalLines(lines || [])
      }
      if (group === 'invoices') {
        const [inv, cn] = await Promise.all([
          supabase.from('finance_invoices').select('*').eq('tenant_id', tid).order('invoice_date', { ascending: false }),
          supabase.from('finance_credit_notes').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }),
        ])
        setInvoices(inv.data || [])
        setCreditNotes(cn.data || [])
      }
      if (group === 'expenses') {
        const { data } = await supabase.from('finance_expenses').select('*').eq('tenant_id', tid).order('expense_date', { ascending: false })
        setExpenses(data || [])
      }
      if (group === 'treasury') {
        const [tr, cu] = await Promise.all([
          supabase.from('finance_treasury').select('*').eq('tenant_id', tid).order('transaction_date', { ascending: false }),
          supabase.from('finance_employee_custody').select('*, hr_employees(name)').eq('tenant_id', tid),
        ])
        setTreasury(tr.data || [])
        setCustody(cu.data || [])
      }
      if (group === 'purchases') {
        const [po, vi] = await Promise.all([
          supabase.from('finance_purchase_orders').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }),
          supabase.from('finance_vendor_invoices').select('*').eq('tenant_id', tid).order('invoice_date', { ascending: false }),
        ])
        setPurchaseOrders(po.data || [])
        setVendorInvoices(vi.data || [])
      }
    } catch (e) { console.error(e) }

    setLoaded(p => ({ ...p, [group]: true }))
    setLoading(p => ({ ...p, [group]: false }))
  }, [tid])

  // تحميل كل المجموعات تلقائياً عند فتح الصفحة
  useEffect(() => {
    if (!tid) return
    loadGroup('general')
    loadGroup('invoices')
    loadGroup('expenses')
    loadGroup('treasury')
    loadGroup('purchases')
  }, [tid, loadGroup])

  // ── حسابات ميزان المراجعة ──
  const trialBalance = (() => {
    const balMap: Record<number, { debit: number; credit: number }> = {}
    journalLines.forEach((l: any) => {
      if (!balMap[l.account_id]) balMap[l.account_id] = { debit: 0, credit: 0 }
      balMap[l.account_id].debit += Number(l.debit || 0)
      balMap[l.account_id].credit += Number(l.credit || 0)
    })
    return accounts
      .filter(a => !a.is_parent && balMap[a.id])
      .map(a => {
        const b = balMap[a.id] || { debit: 0, credit: 0 }
        return {
          'الكود': a.code,
          'اسم الحساب': a.name,
          'النوع': a.account_type,
          'مدين': fmt(b.debit),
          'دائن': fmt(b.credit),
          'الرصيد': fmt(Math.abs(b.debit - b.credit)),
          'طبيعة الرصيد': b.debit >= b.credit ? 'مدين' : 'دائن',
        }
      })
  })()

  // ── قائمة الدخل ──
  const incomeStatement = (() => {
    const balMap: Record<number, number> = {}
    journalLines.forEach((l: any) => {
      if (!balMap[l.account_id]) balMap[l.account_id] = 0
      balMap[l.account_id] += Number(l.credit || 0) - Number(l.debit || 0)
    })
    return accounts
      .filter(a => !a.is_parent && (a.account_type === 'إيرادات' || a.account_type === 'مصروفات'))
      .map(a => ({
        'الكود': a.code,
        'اسم الحساب': a.name,
        'التصنيف': a.account_type,
        'المبلغ': fmt(Math.abs(balMap[a.id] || 0)),
      }))
  })()

  // ── الميزانية العمومية ──
  const balanceSheet = (() => {
    const balMap: Record<number, number> = {}
    journalLines.forEach((l: any) => {
      if (!balMap[l.account_id]) balMap[l.account_id] = 0
      balMap[l.account_id] += Number(l.debit || 0) - Number(l.credit || 0)
    })
    return accounts
      .filter(a => !a.is_parent && (a.account_type === 'أصول' || a.account_type === 'خصوم' || a.account_type === 'حقوق ملكية'))
      .map(a => ({
        'الكود': a.code,
        'اسم الحساب': a.name,
        'التصنيف': a.account_type,
        'الرصيد': fmt(Math.abs(balMap[a.id] || 0)),
        'طبيعة الرصيد': (balMap[a.id] || 0) >= 0 ? 'مدين' : 'دائن',
      }))
  })()

  // ── المصروفات حسب التصنيف ──
  const expByCategory = (() => {
    const map: Record<string, number> = {}
    expenses.forEach((e: any) => {
      const cat = e.category || 'غير مصنف'
      map[cat] = (map[cat] || 0) + Number(e.amount || 0)
    })
    return Object.entries(map).map(([cat, total]) => ({
      'التصنيف': cat,
      'عدد السجلات': expenses.filter((e: any) => (e.category || 'غير مصنف') === cat).length,
      'الإجمالي': fmt(total),
    }))
  })()

  // ── المصروفات حسب الشهر ──
  const expByMonth = (() => {
    const map: Record<string, number> = {}
    expenses.forEach((e: any) => {
      if (!e.expense_date) return
      const m = e.expense_date.substring(0, 7)
      map[m] = (map[m] || 0) + Number(e.amount || 0)
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([month, total]) => ({
      'الشهر': month,
      'الإجمالي': fmt(total),
    }))
  })()

  // ── الفواتير حسب الحالة ──
  const invByStatus = (() => {
    const map: Record<string, { count: number; total: number }> = {}
    invoices.forEach((inv: any) => {
      const s = inv.status || 'غير محدد'
      if (!map[s]) map[s] = { count: 0, total: 0 }
      map[s].count++; map[s].total += Number(inv.total_amount || 0)
    })
    return Object.entries(map).map(([status, v]) => ({
      'الحالة': status, 'العدد': v.count, 'الإجمالي': fmt(v.total),
    }))
  })()

  // ── سندات القبض (خزينة - وارد) ──
  const receipts = treasury.filter((t: any) => t.type === 'قبض' || t.transaction_type === 'in' || t.direction === 'in')
  const payments = treasury.filter((t: any) => t.type === 'صرف' || t.transaction_type === 'out' || t.direction === 'out')

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
          <DollarSign className="w-5 h-5 text-primary-500" />
          تقارير المالية والمحاسبة
        </h1>
      </div>

      {/* ══ 1. الحسابات العامة ══ */}
      <ReportGroup title="📊 الحسابات العامة" icon={BookOpen} color="#1a56db" defaultOpen={true}>
        <div>
          <ReportTable title="ميزان المراجعة" exportName="ميزان-المراجعة" company={company}
            loading={loading['general']}
            headers={[
              { key: 'الكود', label: 'الكود', sortable: true },
              { key: 'اسم الحساب', label: 'اسم الحساب', sortable: true },
              { key: 'النوع', label: 'النوع', sortable: true },
              { key: 'مدين', label: 'مدين', sortable: false },
              { key: 'دائن', label: 'دائن', sortable: false },
              { key: 'الرصيد', label: 'الرصيد', sortable: false },
              { key: 'طبيعة الرصيد', label: 'طبيعة الرصيد', sortable: true },
            ]}
            rows={trialBalance}
          />
          <ReportTable title="قائمة الدخل" exportName="قائمة-الدخل" company={company}
            loading={loading['general']}
            headers={[
              { key: 'الكود', label: 'الكود', sortable: true },
              { key: 'اسم الحساب', label: 'اسم الحساب', sortable: true },
              { key: 'التصنيف', label: 'التصنيف', sortable: true },
              { key: 'المبلغ', label: 'المبلغ (ر.س)', sortable: false },
            ]}
            rows={incomeStatement}
          />
          <ReportTable title="الميزانية العمومية" exportName="الميزانية-العمومية" company={company}
            loading={loading['general']}
            headers={[
              { key: 'الكود', label: 'الكود', sortable: true },
              { key: 'اسم الحساب', label: 'اسم الحساب', sortable: true },
              { key: 'التصنيف', label: 'التصنيف', sortable: true },
              { key: 'الرصيد', label: 'الرصيد (ر.س)', sortable: false },
              { key: 'طبيعة الرصيد', label: 'طبيعة الرصيد', sortable: true },
            ]}
            rows={balanceSheet}
          />
          <ReportTable title="دليل الحسابات" exportName="دليل-الحسابات" company={company}
            loading={loading['general']}
            headers={[
              { key: 'code', label: 'الكود', sortable: true },
              { key: 'name', label: 'اسم الحساب', sortable: true },
              { key: 'account_type', label: 'النوع', sortable: true },
              { key: 'account_class', label: 'التصنيف', sortable: true },
              { key: 'normal_balance', label: 'الرصيد الطبيعي', sortable: true },
              { key: 'level', label: 'المستوى', sortable: true },
              { key: 'is_active', label: 'نشط', sortable: false },
            ]}
            rows={accounts.map(a => ({ ...a, is_active: a.is_active ? 'نعم' : 'لا' }))}
          />
        </div>
      </ReportGroup>

      {/* ══ 2. القيود اليومية ══ */}
      <ReportGroup title="📒 القيود اليومية" icon={FileText} color="#7c3aed">
        <div>
          <ReportTable title="سجل القيود اليومية" exportName="القيود-اليومية" company={company}
            loading={loading['journal']}
            headers={[
              { key: 'entry_number', label: 'رقم القيد', sortable: true },
              { key: 'entry_date', label: 'التاريخ', sortable: true },
              { key: 'description', label: 'البيان', sortable: false },
              { key: 'reference_type', label: 'نوع المرجع', sortable: true },
              { key: 'total_debit', label: 'إجمالي المدين', sortable: true },
              { key: 'total_credit', label: 'إجمالي الدائن', sortable: true },
              { key: 'status', label: 'الحالة', sortable: true },
            ]}
            rows={journalEntries.map(e => ({
              ...e,
              entry_date: fmtDate(e.entry_date),
              total_debit: fmt(e.total_debit),
              total_credit: fmt(e.total_credit),
            }))}
          />
          <ReportTable title="تفاصيل سطور القيود" exportName="سطور-القيود" company={company}
            loading={loading['journal']}
            headers={[
              { key: 'entry_id', label: 'رقم القيد', sortable: true },
              { key: 'account_code', label: 'كود الحساب', sortable: true },
              { key: 'account_name', label: 'اسم الحساب', sortable: true },
              { key: 'debit', label: 'مدين', sortable: true },
              { key: 'credit', label: 'دائن', sortable: true },
              { key: 'description', label: 'البيان', sortable: false },
            ]}
            rows={journalLines.map((l: any) => ({
              ...l,
              account_code: l.finance_accounts?.code || '—',
              account_name: l.finance_accounts?.name || '—',
              debit: fmt(l.debit),
              credit: fmt(l.credit),
            }))}
          />
          <ReportTable title="ملخص القيود حسب النوع" exportName="ملخص-القيود" company={company}
            loading={loading['journal']}
            headers={[
              { key: 'نوع المرجع', label: 'نوع المرجع', sortable: true },
              { key: 'العدد', label: 'العدد', sortable: true },
              { key: 'إجمالي المدين', label: 'إجمالي المدين', sortable: false },
              { key: 'إجمالي الدائن', label: 'إجمالي الدائن', sortable: false },
            ]}
            rows={(() => {
              const map: Record<string, { count: number; debit: number; credit: number }> = {}
              journalEntries.forEach((e: any) => {
                const t = e.reference_type || 'يدوي'
                if (!map[t]) map[t] = { count: 0, debit: 0, credit: 0 }
                map[t].count++
                map[t].debit += Number(e.total_debit || 0)
                map[t].credit += Number(e.total_credit || 0)
              })
              return Object.entries(map).map(([t, v]) => ({
                'نوع المرجع': t, 'العدد': v.count,
                'إجمالي المدين': fmt(v.debit), 'إجمالي الدائن': fmt(v.credit),
              }))
            })()}
          />
        </div>
      </ReportGroup>

      {/* ══ 3. الفواتير ══ */}
      <ReportGroup title="🧾 فواتير المبيعات والإشعارات" icon={FileText} color="#059669">
        <div>
          <ReportTable title="قائمة الفواتير" exportName="الفواتير" company={company}
            loading={loading['invoices']}
            headers={[
              { key: 'invoice_number', label: 'رقم الفاتورة', sortable: true },
              { key: 'invoice_date', label: 'التاريخ', sortable: true },
              { key: 'due_date', label: 'تاريخ الاستحقاق', sortable: true },
              { key: 'client_name', label: 'العميل', sortable: true },
              { key: 'subtotal', label: 'المجموع قبل الضريبة', sortable: true },
              { key: 'vat_amount', label: 'الضريبة', sortable: true },
              { key: 'total_amount', label: 'الإجمالي', sortable: true },
              { key: 'status', label: 'الحالة', sortable: true },
            ]}
            rows={invoices.map(inv => ({
              ...inv,
              client_name: inv.finance_clients?.name || inv.client_name || '—',
              invoice_date: fmtDate(inv.invoice_date),
              due_date: fmtDate(inv.due_date),
              subtotal: fmt(inv.subtotal),
              vat_amount: fmt(inv.vat_amount),
              total_amount: fmt(inv.total_amount),
            }))}
          />
          <ReportTable title="ملخص الفواتير حسب الحالة" exportName="ملخص-الفواتير" company={company}
            loading={loading['invoices']}
            headers={[
              { key: 'الحالة', label: 'الحالة', sortable: true },
              { key: 'العدد', label: 'العدد', sortable: true },
              { key: 'الإجمالي', label: 'الإجمالي (ر.س)', sortable: false },
            ]}
            rows={invByStatus}
          />
          <ReportTable title="الفواتير المتأخرة" exportName="فواتير-متأخرة" company={company}
            loading={loading['invoices']}
            emptyMsg="✅ لا توجد فواتير متأخرة"
            headers={[
              { key: 'invoice_number', label: 'رقم الفاتورة', sortable: true },
              { key: 'invoice_date', label: 'التاريخ', sortable: true },
              { key: 'due_date', label: 'تاريخ الاستحقاق', sortable: true },
              { key: 'client_name', label: 'العميل', sortable: true },
              { key: 'total_amount', label: 'الإجمالي', sortable: true },
              { key: 'days_overdue', label: 'أيام التأخير', sortable: true },
            ]}
            rows={invoices
              .filter(inv => inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'مدفوعة' && inv.status !== 'paid')
              .map(inv => ({
                ...inv,
                invoice_date: fmtDate(inv.invoice_date),
                due_date: fmtDate(inv.due_date),
                total_amount: fmt(inv.total_amount),
                days_overdue: Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / 86400000),
              }))}
          />
          <ReportTable title="إشعارات الدائن (المرتجعات)" exportName="اشعارات-دائن" company={company}
            loading={loading['invoices']}
            headers={[
              { key: 'credit_number', label: 'رقم الإشعار', sortable: true },
              { key: 'date', label: 'التاريخ', sortable: true },
              { key: 'client_name', label: 'العميل', sortable: true },
              { key: 'amount', label: 'المبلغ', sortable: true },
              { key: 'reason', label: 'السبب', sortable: false },
            ]}
            rows={creditNotes.map(cn => ({
              ...cn,
              date: fmtDate(cn.date || cn.created_at),
              amount: fmt(cn.amount || cn.total_amount),
            }))}
          />
        </div>
      </ReportGroup>

      {/* ══ 4. المصروفات ══ */}
      <ReportGroup title="💸 تقارير المصروفات" icon={TrendingUp} color="#dc2626">
        <div>
          <ReportTable title="قائمة المصروفات" exportName="المصروفات" company={company}
            loading={loading['expenses']}
            headers={[
              { key: 'expense_date', label: 'التاريخ', sortable: true },
              { key: 'description', label: 'البيان', sortable: false },
              { key: 'category', label: 'التصنيف', sortable: true },
              { key: 'amount', label: 'المبلغ', sortable: true },
              { key: 'vendor', label: 'المورد/الجهة', sortable: true },
              { key: 'project_name', label: 'المشروع', sortable: true },
              { key: 'status', label: 'الحالة', sortable: true },
            ]}
            rows={expenses.map(e => ({
              ...e,
              expense_date: fmtDate(e.expense_date),
              amount: fmt(e.amount),
            }))}
          />
          <ReportTable title="المصروفات حسب التصنيف" exportName="مصروفات-تصنيف" company={company}
            loading={loading['expenses']}
            headers={[
              { key: 'التصنيف', label: 'التصنيف', sortable: true },
              { key: 'عدد السجلات', label: 'عدد السجلات', sortable: true },
              { key: 'الإجمالي', label: 'الإجمالي (ر.س)', sortable: false },
            ]}
            rows={expByCategory}
          />
          <ReportTable title="المصروفات حسب الشهر" exportName="مصروفات-شهرية" company={company}
            loading={loading['expenses']}
            headers={[
              { key: 'الشهر', label: 'الشهر', sortable: true },
              { key: 'الإجمالي', label: 'الإجمالي (ر.س)', sortable: false },
            ]}
            rows={expByMonth}
          />
          <ReportTable title="المصروفات حسب المشروع" exportName="مصروفات-مشاريع" company={company}
            loading={loading['expenses']}
            headers={[
              { key: 'المشروع', label: 'المشروع', sortable: true },
              { key: 'عدد السجلات', label: 'عدد السجلات', sortable: true },
              { key: 'الإجمالي', label: 'الإجمالي (ر.س)', sortable: false },
            ]}
            rows={(() => {
              const map: Record<string, { count: number; total: number }> = {}
              expenses.forEach((e: any) => {
                const p = e.project_name || 'غير مرتبط'
                if (!map[p]) map[p] = { count: 0, total: 0 }
                map[p].count++; map[p].total += Number(e.amount || 0)
              })
              return Object.entries(map).map(([p, v]) => ({ 'المشروع': p, 'عدد السجلات': v.count, 'الإجمالي': fmt(v.total) }))
            })()}
          />
        </div>
      </ReportGroup>

      {/* ══ 5. سندات القبض والصرف ══ */}
      <ReportGroup title="🏦 الخزينة وسندات القبض والصرف" icon={Wallet} color="#0891b2">
        <div>
          <ReportTable title="سندات القبض" exportName="سندات-القبض" company={company}
            loading={loading['treasury']}
            headers={[
              { key: 'transaction_date', label: 'التاريخ', sortable: true },
              { key: 'reference_number', label: 'رقم السند', sortable: true },
              { key: 'description', label: 'البيان', sortable: false },
              { key: 'party_name', label: 'الجهة', sortable: true },
              { key: 'amount', label: 'المبلغ', sortable: true },
              { key: 'payment_method', label: 'طريقة الدفع', sortable: true },
            ]}
            rows={receipts.map((t: any) => ({
              ...t,
              transaction_date: fmtDate(t.transaction_date),
              amount: fmt(t.amount),
            }))}
          />
          <ReportTable title="سندات الصرف" exportName="سندات-الصرف" company={company}
            loading={loading['treasury']}
            headers={[
              { key: 'transaction_date', label: 'التاريخ', sortable: true },
              { key: 'reference_number', label: 'رقم السند', sortable: true },
              { key: 'description', label: 'البيان', sortable: false },
              { key: 'party_name', label: 'الجهة', sortable: true },
              { key: 'amount', label: 'المبلغ', sortable: true },
              { key: 'payment_method', label: 'طريقة الدفع', sortable: true },
            ]}
            rows={payments.map((t: any) => ({
              ...t,
              transaction_date: fmtDate(t.transaction_date),
              amount: fmt(t.amount),
            }))}
          />
          <ReportTable title="سندات القبض حسب الشهر" exportName="قبض-شهري" company={company}
            loading={loading['treasury']}
            headers={[
              { key: 'الشهر', label: 'الشهر', sortable: true },
              { key: 'العدد', label: 'العدد', sortable: true },
              { key: 'الإجمالي', label: 'الإجمالي (ر.س)', sortable: false },
            ]}
            rows={(() => {
              const map: Record<string, { count: number; total: number }> = {}
              receipts.forEach((t: any) => {
                if (!t.transaction_date) return
                const m = t.transaction_date.substring(0, 7)
                if (!map[m]) map[m] = { count: 0, total: 0 }
                map[m].count++; map[m].total += Number(t.amount || 0)
              })
              return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([m, v]) => ({ 'الشهر': m, 'العدد': v.count, 'الإجمالي': fmt(v.total) }))
            })()}
          />
          <ReportTable title="عهد الموظفين" exportName="عهد-موظفين" company={company}
            loading={loading['treasury']}
            headers={[
              { key: 'employee_name', label: 'الموظف', sortable: true },
              { key: 'amount', label: 'المبلغ', sortable: true },
              { key: 'issue_date', label: 'تاريخ الصرف', sortable: true },
              { key: 'due_date', label: 'تاريخ الاسترداد', sortable: true },
              { key: 'purpose', label: 'الغرض', sortable: false },
              { key: 'status', label: 'الحالة', sortable: true },
            ]}
            rows={custody.map((c: any) => ({
              ...c,
              employee_name: c.hr_employees?.name || '—',
              amount: fmt(c.amount),
              issue_date: fmtDate(c.issue_date),
              due_date: fmtDate(c.due_date),
            }))}
          />
        </div>
      </ReportGroup>

      {/* ══ 6. المشتريات والموردون ══ */}
      <ReportGroup title="🛒 تقارير المشتريات والموردين" icon={CreditCard} color="#d97706">
        <div>
          <ReportTable title="أوامر الشراء" exportName="أوامر-الشراء" company={company}
            loading={loading['purchases']}
            headers={[
              { key: 'order_number', label: 'رقم الأمر', sortable: true },
              { key: 'order_date', label: 'التاريخ', sortable: true },
              { key: 'vendor_name', label: 'المورد', sortable: true },
              { key: 'total_amount', label: 'الإجمالي', sortable: true },
              { key: 'status', label: 'الحالة', sortable: true },
            ]}
            rows={purchaseOrders.map((po: any) => ({
              ...po,
              order_date: fmtDate(po.order_date || po.created_at),
              total_amount: fmt(po.total_amount),
            }))}
          />
          <ReportTable title="فواتير الموردين" exportName="فواتير-موردين" company={company}
            loading={loading['purchases']}
            headers={[
              { key: 'invoice_number', label: 'رقم الفاتورة', sortable: true },
              { key: 'invoice_date', label: 'التاريخ', sortable: true },
              { key: 'vendor_name', label: 'المورد', sortable: true },
              { key: 'subtotal', label: 'المجموع', sortable: true },
              { key: 'vat_amount', label: 'الضريبة', sortable: true },
              { key: 'total_amount', label: 'الإجمالي', sortable: true },
              { key: 'status', label: 'الحالة', sortable: true },
            ]}
            rows={vendorInvoices.map((vi: any) => ({
              ...vi,
              invoice_date: fmtDate(vi.invoice_date),
              subtotal: fmt(vi.subtotal),
              vat_amount: fmt(vi.vat_amount),
              total_amount: fmt(vi.total_amount),
            }))}
          />
          <ReportTable title="ملخص الموردين" exportName="ملخص-موردين" company={company}
            loading={loading['purchases']}
            headers={[
              { key: 'المورد', label: 'المورد', sortable: true },
              { key: 'عدد الفواتير', label: 'عدد الفواتير', sortable: true },
              { key: 'الإجمالي', label: 'الإجمالي (ر.س)', sortable: false },
            ]}
            rows={(() => {
              const map: Record<string, { count: number; total: number }> = {}
              vendorInvoices.forEach((vi: any) => {
                const v = vi.vendor_name || 'غير محدد'
                if (!map[v]) map[v] = { count: 0, total: 0 }
                map[v].count++; map[v].total += Number(vi.total_amount || 0)
              })
              return Object.entries(map).sort((a, b) => b[1].total - a[1].total).map(([v, d]) => ({ 'المورد': v, 'عدد الفواتير': d.count, 'الإجمالي': fmt(d.total) }))
            })()}
          />
          <ReportTable title="مرتجعات المشتريات" exportName="مرتجعات-مشتريات" company={company}
            loading={loading['purchases']}
            headers={[
              { key: 'return_number', label: 'رقم المرتجع', sortable: true },
              { key: 'return_date', label: 'التاريخ', sortable: true },
              { key: 'vendor_name', label: 'المورد', sortable: true },
              { key: 'total_amount', label: 'المبلغ', sortable: true },
              { key: 'reason', label: 'السبب', sortable: false },
            ]}
            rows={([] as any[]).map((r: any) => ({
              ...r,
              return_date: fmtDate(r.return_date),
              total_amount: fmt(r.total_amount),
            }))}
          />
        </div>
      </ReportGroup>

    </div>
  )
}
