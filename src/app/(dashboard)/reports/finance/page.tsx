'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { DollarSign, Search, X, Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════
// قواعد المحاسبة حسب IFRS
// الرصيد الطبيعي لكل نوع حساب
// ═══════════════════════════════════════════════════
const DEBIT_NORMAL  = ['أصول', 'مصروفات']   // رصيد = debit - credit
const CREDIT_NORMAL = ['خصوم', 'حقوق ملكية', 'إيرادات'] // رصيد = credit - debit

function calcBalance(accountType: string, debit: number, credit: number): number {
  if (DEBIT_NORMAL.includes(accountType))  return debit - credit
  if (CREDIT_NORMAL.includes(accountType)) return credit - debit
  return debit - credit
}

// ═══════════════════════════════════════════════════
// دالة جلب أرصدة الحسابات — العمود الفقري لكل التقارير
// cumulative: true = تراكمي حتى التاريخ | false = حركة الفترة فقط
// ═══════════════════════════════════════════════════
async function fetchAccountBalances(
  tenantId: string,
  dateTo: string,
  dateFrom?: string,
  accountTypes?: string[]
) {
  // جلب القيود ضمن النطاق
  let q = supabase.from('finance_journal_entries')
    .select('id').eq('tenant_id', tenantId).lte('entry_date', dateTo)
  if (dateFrom) q = q.gte('entry_date', dateFrom)
  const { data: entries } = await q
  if (!entries?.length) return []

  const entryIds = entries.map((e: any) => e.id)

  // جلب سطور القيود
  const { data: lines } = await supabase.from('finance_journal_lines')
    .select('account_id, debit, credit')
    .in('entry_id', entryIds)
  if (!lines?.length) return []

  // تجميع على مستوى الحساب
  const map: Record<number, { debit: number; credit: number }> = {}
  lines.forEach((l: any) => {
    if (!map[l.account_id]) map[l.account_id] = { debit: 0, credit: 0 }
    map[l.account_id].debit  += Number(l.debit  || 0)
    map[l.account_id].credit += Number(l.credit || 0)
  })

  // جلب الحسابات
  let accQ = supabase.from('finance_accounts')
    .select('id, code, name, account_type, account_class, normal_balance, is_parent, parent_id')
    .eq('tenant_id', tenantId).eq('is_active', true).order('code')
  if (accountTypes?.length) accQ = accQ.in('account_type', accountTypes)
  const { data: accounts } = await accQ

  return (accounts || []).map((a: any) => ({
    ...a,
    debit:   map[a.id]?.debit  || 0,
    credit:  map[a.id]?.credit || 0,
    balance: calcBalance(a.account_type, map[a.id]?.debit || 0, map[a.id]?.credit || 0),
  }))
}

// ═══════════════════════════════════════════════════
// مجموعات التقارير
// ═══════════════════════════════════════════════════
const REPORT_GROUPS = [
  {
    id: 'statements', label: 'القوائم المالية', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe',
    reports: [
      { id: 'income',        title: 'قائمة الدخل',                   icon: '📈', desc: 'الإيرادات والمصروفات وصافي الربح / الخسارة' },
      { id: 'balance_sheet', title: 'قائمة المركز المالي',           icon: '🏦', desc: 'الأصول = الخصوم + حقوق الملكية' },
      { id: 'cashflow',      title: 'قائمة التدفقات النقدية',        icon: '💧', desc: 'التدفقات التشغيلية والاستثمارية والتمويلية' },
      { id: 'equity',        title: 'التغير في حقوق الملكية',        icon: '📊', desc: 'رأس المال والأرباح المحتجزة والتوزيعات' },
    ]
  },
  {
    id: 'sales', label: 'المبيعات والذمم', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac',
    reports: [
      { id: 'sales_detail',  title: 'تقرير المبيعات التفصيلي',       icon: '🧾', desc: 'الفواتير مفصلة بالعميل والمبلغ' },
      { id: 'sales_summary', title: 'ملخص المبيعات حسب العميل',      icon: '👤', desc: 'إجمالي مبيعات كل عميل' },
      { id: 'aging',         title: 'تقرير أعمار الديون',            icon: '⏳', desc: '0-30 / 31-60 / 61-90 / +90 يوم' },
      { id: 'statement',     title: 'كشف حساب عميل',                 icon: '📋', desc: 'الفواتير والمدفوعات والرصيد' },
    ]
  },
  {
    id: 'purchases', label: 'المشتريات والموردون', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    reports: [
      { id: 'purchases_detail',  title: 'تقرير المشتريات التفصيلي', icon: '🛒', desc: 'أوامر الشراء مفصلة' },
      { id: 'purchases_summary', title: 'ملخص المشتريات حسب المورد', icon: '🏭', desc: 'إجمالي مشتريات كل مورد' },
    ]
  },
  {
    id: 'tax', label: 'الضريبة', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe',
    reports: [
      { id: 'tax_sales',     title: 'تقرير ضريبة المبيعات',          icon: '🧾', desc: 'الوعاء الضريبي وضريبة المبيعات' },
      { id: 'tax_purchases', title: 'تقرير ضريبة المشتريات',         icon: '📋', desc: 'ضريبة المدخلات القابلة للاسترداد' },
      { id: 'tax_net',       title: 'صافي الضريبة المستحقة',         icon: '⚖️', desc: 'ضريبة المبيعات - ضريبة المشتريات' },
    ]
  },
  {
    id: 'accounting', label: 'الحسابات والقيود', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc',
    reports: [
      { id: 'trial',   title: 'ميزان المراجعة',    icon: '⚖️', desc: 'أرصدة أول المدة + الحركة + آخر المدة' },
      { id: 'ledger',  title: 'دفتر الأستاذ',      icon: '📒', desc: 'حركة حساب محدد مع رصيد متراكم' },
      { id: 'journal', title: 'دفتر اليومية',      icon: '📗', desc: 'القيود اليومية مرتبة بالتاريخ' },
    ]
  },
]

// ══════════════════════════════════════════════════
// تصنيف التدفقات النقدية حسب IAS 7
// ══════════════════════════════════════════════════
const OPERATING_TYPES = ['تحصيل فاتورة', 'دفع مورد', 'مصروف', 'رواتب', 'إشعار دائن', 'مرتجع مشتريات', 'ضريبة']
const INVESTING_TYPES = ['شراء أصل', 'بيع أصل', 'استثمار']
const FINANCING_TYPES = ['قرض', 'سداد قرض', 'توزيعات', 'رأس مال', 'رصيد افتتاحي']

function classifyFlow(refType: string | null): string {
  const t = refType || ''
  if (OPERATING_TYPES.some(x => t.includes(x))) return 'تشغيلية'
  if (INVESTING_TYPES.some(x => t.includes(x))) return 'استثمارية'
  if (FINANCING_TYPES.some(x => t.includes(x))) return 'تمويلية'
  return 'تشغيلية'
}

const thisYear = new Date().getFullYear()
const firstOfYear = `${thisYear}-01-01`
const today = new Date().toISOString().split('T')[0]
const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ReportsFinancePage() {
  const { tenant, activeBranch } = useStore()
  const [selected,  setSelected]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [results,   setResults]   = useState<any[]>([])
  const [accounts,  setAccounts]  = useState<any[]>([])
  const [clients,   setClients]   = useState<any[]>([])
  const [loaded,    setLoaded]    = useState(false)
  const [fDateFrom, setFDateFrom] = useState(firstOfYear)
  const [fDateTo,   setFDateTo]   = useState(today)
  const [fAccount,  setFAccount]  = useState('')
  const [fClient,   setFClient]   = useState('')
  const [summary,   setSummary]   = useState<any>(null)
  const [extra,     setExtra]     = useState<any>(null) // بيانات إضافية (مثل رصيد أول المدة في ميزان المراجعة)

  const allReports = REPORT_GROUPS.flatMap(g => g.reports.map(r => ({ ...r, groupColor: g.color, groupBg: g.bg, groupLabel: g.label })))
  const report = allReports.find(r => r.id === selected)

  useEffect(() => {
    if (!tenant || loaded) return
    Promise.all([
      supabase.from('finance_accounts').select('id, code, name, account_type').eq('tenant_id', tenant.id).eq('is_active', true).eq('is_parent', false).order('code'),
      supabase.from('finance_clients').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ]).then(([a, c]) => { setAccounts(a.data || []); setClients(c.data || []); setLoaded(true) })
  }, [tenant?.id])

  async function runReport() {
    if (!tenant || !selected) return
    setLoading(true); setResults([]); setSummary(null); setExtra(null)

    // ══════════════════════════════════════════
    // القوائم المالية
    // ══════════════════════════════════════════
    if (selected === 'income') {
      // قائمة الدخل — حركة الفترة فقط
      const data = await fetchAccountBalances(tenant.id, fDateTo, fDateFrom, ['إيرادات', 'مصروفات'])
      const revenues = data.filter(a => a.account_type === 'إيرادات' && a.balance !== 0)
      const expenses = data.filter(a => a.account_type === 'مصروفات' && a.balance !== 0)
      const totRev = revenues.reduce((s, a) => s + a.balance, 0)
      const totExp = expenses.reduce((s, a) => s + a.balance, 0)
      setResults([
        ...revenues.map(a => ({ ...a, section: 'إيرادات' })),
        ...expenses.map(a => ({ ...a, section: 'مصروفات' })),
      ])
      setSummary({ revenues: totRev, expenses: totExp, net: totRev - totExp })

    } else if (selected === 'balance_sheet') {
      // المركز المالي — تراكمي حتى fDateTo (بدون dateFrom)
      // صافي الربح للفترة من بداية السنة حتى fDateTo
      const [bsData, incomeData] = await Promise.all([
        fetchAccountBalances(tenant.id, fDateTo, undefined, ['أصول', 'خصوم', 'حقوق ملكية']),
        fetchAccountBalances(tenant.id, fDateTo, firstOfYear, ['إيرادات', 'مصروفات']),
      ])
      const netIncome = incomeData.filter(a => a.account_type === 'إيرادات').reduce((s, a) => s + a.balance, 0)
                      - incomeData.filter(a => a.account_type === 'مصروفات').reduce((s, a) => s + a.balance, 0)
      const assets      = bsData.filter(a => a.account_type === 'أصول'         && a.balance !== 0)
      const liabilities = bsData.filter(a => a.account_type === 'خصوم'         && a.balance !== 0)
      const equity      = bsData.filter(a => a.account_type === 'حقوق ملكية'   && a.balance !== 0)
      setResults([
        ...assets.map(a      => ({ ...a, section: 'أصول' })),
        ...liabilities.map(a => ({ ...a, section: 'خصوم' })),
        ...equity.map(a      => ({ ...a, section: 'حقوق الملكية' })),
      ])
      const totAssets = assets.reduce((s, a) => s + a.balance, 0)
      const totLiab   = liabilities.reduce((s, a) => s + a.balance, 0)
      const totEquity = equity.reduce((s, a) => s + a.balance, 0)
      setSummary({ totalAssets: totAssets, totalLiabilities: totLiab, totalEquity: totEquity, netIncome })
      setExtra({ balanced: Math.abs(totAssets - (totLiab + totEquity + netIncome)) < 1 })

    } else if (selected === 'cashflow') {
      // ══════════════════════════════════════════════════════
      // قائمة التدفقات النقدية حسب IAS 7
      // الحسابات النقدية: الصندوق والبنوك (1111-1115 تحت 1110)
      // التصنيف حسب reference_type:
      //   تشغيلية: تحصيل فواتير، دفع موردين، مصروفات، رواتب
      //   استثمارية: شراء/بيع أصول ثابتة
      //   تمويلية: قروض، توزيعات، رأس مال
      // ══════════════════════════════════════════════════════

      // جلب الحسابات النقدية — الصندوق والبنوك تحت حساب 1110
      // نجلب الحسابات غير الأب تحت نوع أصول بكود يبدأ بـ 111
      const { data: allCashAccs } = await supabase.from('finance_accounts')
        .select('id, code, name')
        .eq('tenant_id', tenant.id)
        .eq('account_type', 'أصول')
        .eq('is_parent', false)
        .like('code', '111%')
      const cashAccs = (allCashAccs || []).filter((a: any) => {
        const c = Number(a.code)
        return c >= 1111 && c <= 1119
      })

      if (!cashAccs?.length) {
        toast.error('لم يتم العثور على حسابات نقدية — تأكد من وجود حسابات ضمن 1111-1119')
        setLoading(false); return
      }

      const cashIds = new Set(cashAccs.map((a: any) => a.id))

      // جلب القيود في الفترة
      const { data: entries } = await supabase.from('finance_journal_entries')
        .select('id, entry_date, description, reference_type')
        .eq('tenant_id', tenant.id).gte('entry_date', fDateFrom).lte('entry_date', fDateTo)
        .order('entry_date')

      if (!entries?.length) { setResults([]); setLoading(false); return }

      const entryIds = entries.map((e: any) => e.id)
      const entryMap: Record<number, any> = {}
      entries.forEach((e: any) => { entryMap[e.id] = e })

      // جلب السطور المتعلقة بالحسابات النقدية
      const { data: lines } = await supabase.from('finance_journal_lines')
        .select('entry_id, account_id, debit, credit')
        .in('entry_id', entryIds)
        .in('account_id', Array.from(cashIds))

      // رصيد أول المدة النقدي
      const openCashData = await fetchAccountBalances(tenant.id, fDateFrom, undefined, ['أصول'])
      const openCash = openCashData
        .filter(a => cashIds.has(a.id))
        .reduce((s, a) => s + a.balance, 0)

      // تجميع التدفقات حسب الفئة والنوع
      const flowMap: Record<string, Record<string, { inflow: number; outflow: number; items: any[] }>> = {
        'تشغيلية':   {},
        'استثمارية': {},
        'تمويلية':   {},
      }

      ;(lines || []).forEach((l: any) => {
        const e = entryMap[l.entry_id]
        if (!e) return
        const category = classifyFlow(e.reference_type)
        const refType  = e.reference_type || 'أخرى'
        if (!flowMap[category][refType]) flowMap[category][refType] = { inflow: 0, outflow: 0, items: [] }
        flowMap[category][refType].inflow  += Number(l.debit  || 0)
        flowMap[category][refType].outflow += Number(l.credit || 0)
        flowMap[category][refType].items.push({ date: e.entry_date, desc: e.description, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })
      })

      // بناء النتائج
      const flowRows: any[] = []
      const totals = { operating: 0, investing: 0, financing: 0 }

      for (const [category, types] of Object.entries(flowMap)) {
        let catTotal = 0
        for (const [refType, data] of Object.entries(types)) {
          const net = data.inflow - data.outflow
          catTotal += net
          flowRows.push({ category, refType, inflow: data.inflow, outflow: data.outflow, net, isTotal: false })
        }
        if (Object.keys(types).length > 0) {
          flowRows.push({ category, refType: `إجمالي ${category}`, inflow: 0, outflow: 0, net: catTotal, isTotal: true })
          if (category === 'تشغيلية')   totals.operating  = catTotal
          if (category === 'استثمارية') totals.investing  = catTotal
          if (category === 'تمويلية')   totals.financing  = catTotal
        }
      }

      const netCash    = totals.operating + totals.investing + totals.financing
      const closeCash  = openCash + netCash

      setResults(flowRows)
      setExtra({ openCash, netCash, closeCash, cashAccounts: cashAccs.map((a: any) => a.name).join('، ') })
      setSummary({
        'رصيد النقد أول المدة':        openCash,
        'صافي تدفق تشغيلي':           totals.operating,
        'صافي تدفق استثماري':          totals.investing,
        'صافي تدفق تمويلي':            totals.financing,
        'صافي التغير في النقد':        netCash,
        'رصيد النقد آخر المدة':        closeCash,
      })

    } else if (selected === 'equity') {
      // ══════════════════════════════════════════════
      // قائمة التغير في حقوق الملكية حسب IAS 1
      // تعرض كل مكوّن على حدة مع التغيرات
      // ══════════════════════════════════════════════
      const [openData, periodData] = await Promise.all([
        fetchAccountBalances(tenant.id, fDateFrom, undefined, ['حقوق ملكية', 'إيرادات', 'مصروفات']),
        fetchAccountBalances(tenant.id, fDateTo,   fDateFrom,  ['حقوق ملكية', 'إيرادات', 'مصروفات']),
      ])
      // مكوّنات حقوق الملكية (كل حساب بمفرده)
      const equityAccs = openData.filter(a => a.account_type === 'حقوق ملكية')
      // صافي ربح الفترة السابقة (الأرباح المحتجزة)
      const prevNetIncome = openData.filter(a => a.account_type === 'إيرادات').reduce((s,a) => s+a.balance,0)
                          - openData.filter(a => a.account_type === 'مصروفات').reduce((s,a) => s+a.balance,0)
      // صافي ربح الفترة الحالية
      const currNetIncome = periodData.filter(a => a.account_type === 'إيرادات').reduce((s,a) => s+a.balance,0)
                           - periodData.filter(a => a.account_type === 'مصروفات').reduce((s,a) => s+a.balance,0)
      // تغيرات حقوق الملكية في الفترة
      const periodEquityMap: Record<number, number> = {}
      periodData.filter(a => a.account_type === 'حقوق ملكية').forEach(a => { periodEquityMap[a.id] = a.balance })

      const rows: any[] = []
      let totalOpen = 0, totalChange = 0, totalClose = 0

      // إضافة كل مكوّن
      equityAccs.forEach(a => {
        const open   = a.balance
        const change = periodEquityMap[a.id] || 0
        const close  = open + change
        totalOpen   += open; totalChange += change; totalClose += close
        rows.push({ component: a.name, code: a.code, open, change, close, isTotal: false })
      })

      // الأرباح المحتجزة (صافي الأرباح التراكمية السابقة)
      if (prevNetIncome !== 0) {
        const closeRetained = prevNetIncome + currNetIncome
        totalOpen   += prevNetIncome; totalChange += currNetIncome; totalClose += closeRetained
        rows.push({ component: 'الأرباح المحتجزة', code: '', open: prevNetIncome, change: currNetIncome, close: closeRetained, isTotal: false, isRetained: true })
      } else if (currNetIncome !== 0) {
        totalChange += currNetIncome; totalClose += currNetIncome
        rows.push({ component: 'صافي ربح الفترة', code: '', open: 0, change: currNetIncome, close: currNetIncome, isTotal: false, isRetained: true })
      }

      // سطر الإجمالي
      rows.push({ component: 'إجمالي حقوق الملكية', code: '', open: totalOpen, change: totalChange, close: totalClose, isTotal: true })

      setResults(rows)
      setSummary({
        'إجمالي أول المدة': totalOpen,
        'صافي ربح الفترة':  currNetIncome,
        'إجمالي آخر المدة': totalClose,
      })

    // ══════════════════════════════════════════
    // المبيعات
    // ══════════════════════════════════════════
    } else if (selected === 'sales_detail' || selected === 'statement') {
      let q = supabase.from('finance_invoices').select('*')
        .eq('tenant_id', tenant.id).gte('invoice_date', fDateFrom).lte('invoice_date', fDateTo)
      if (fClient) q = q.eq('client_id', Number(fClient))
      const { data, error } = await q.order('invoice_date', { ascending: false })
      if (error) { toast.error('خطأ: ' + error.message); setLoading(false); return }
      setResults(data || [])
      setSummary({
        'عدد الفواتير': (data || []).length,
        'إجمالي قبل الضريبة': (data || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0),
        'ضريبة القيمة المضافة': (data || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0),
        'الإجمالي شامل الضريبة': (data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
      })

    } else if (selected === 'sales_summary') {
      const { data, error } = await supabase.from('finance_invoices').select('client_name, subtotal, vat_amount, total_amount, status')
        .eq('tenant_id', tenant.id).gte('invoice_date', fDateFrom).lte('invoice_date', fDateTo)
      if (error) { toast.error('خطأ'); setLoading(false); return }
      const grouped: Record<string, any> = {}
      ;(data || []).forEach((r: any) => {
        const k = r.client_name || 'غير محدد'
        if (!grouped[k]) grouped[k] = { client: k, count: 0, subtotal: 0, vat: 0, total: 0, paid: 0, due: 0 }
        grouped[k].count++
        grouped[k].subtotal += Number(r.subtotal || 0)
        grouped[k].vat      += Number(r.vat_amount || 0)
        grouped[k].total    += Number(r.total_amount || 0)
        r.status === 'مدفوعة' ? grouped[k].paid += Number(r.total_amount || 0) : grouped[k].due += Number(r.total_amount || 0)
      })
      setResults(Object.values(grouped).sort((a, b) => b.total - a.total))
      setSummary({
        'إجمالي المبيعات': Object.values(grouped).reduce((s: number, r: any) => s + r.total, 0),
        'المحصّل': Object.values(grouped).reduce((s: number, r: any) => s + r.paid, 0),
        'المستحق': Object.values(grouped).reduce((s: number, r: any) => s + r.due, 0),
      })

    } else if (selected === 'aging') {
      const { data, error } = await supabase.from('finance_invoices').select('*')
        .eq('tenant_id', tenant.id).neq('status', 'مدفوعة').order('invoice_date')
      if (error) { toast.error('خطأ'); setLoading(false); return }
      const now = new Date()
      const aged = (data || []).map((inv: any) => {
        const days = Math.floor((now.getTime() - new Date(inv.invoice_date).getTime()) / 86400000)
        return {
          ...inv, days,
          bucket: days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '+90'
        }
      })
      setResults(aged)
      const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '+90': 0 }
      aged.forEach(r => { buckets[r.bucket] = (buckets[r.bucket] || 0) + Number(r.total_amount || 0) })
      setSummary({ ...buckets, 'الإجمالي': aged.reduce((s, r) => s + Number(r.total_amount || 0), 0) })

    // ══════════════════════════════════════════
    // المشتريات
    // ══════════════════════════════════════════
    } else if (selected === 'purchases_detail') {
      const { data, error } = await supabase.from('finance_purchase_orders').select('*')
        .eq('tenant_id', tenant.id).gte('po_date', fDateFrom).lte('po_date', fDateTo)
        .order('po_date', { ascending: false })
      if (error) { toast.error('خطأ'); setLoading(false); return }
      setResults(data || [])
      setSummary({
        'عدد أوامر الشراء': (data || []).length,
        'إجمالي قبل الضريبة': (data || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0),
        'ضريبة القيمة المضافة': (data || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0),
        'الإجمالي': (data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
      })

    } else if (selected === 'purchases_summary') {
      const { data, error } = await supabase.from('finance_purchase_orders').select('vendor_name, subtotal, vat_amount, total_amount')
        .eq('tenant_id', tenant.id).gte('po_date', fDateFrom).lte('po_date', fDateTo)
      if (error) { toast.error('خطأ'); setLoading(false); return }
      const grouped: Record<string, any> = {}
      ;(data || []).forEach((r: any) => {
        const k = r.vendor_name || 'غير محدد'
        if (!grouped[k]) grouped[k] = { vendor: k, count: 0, subtotal: 0, vat: 0, total: 0 }
        grouped[k].count++; grouped[k].subtotal += Number(r.subtotal || 0)
        grouped[k].vat += Number(r.vat_amount || 0); grouped[k].total += Number(r.total_amount || 0)
      })
      setResults(Object.values(grouped).sort((a, b) => b.total - a.total))

    // ══════════════════════════════════════════
    // الضريبة
    // ══════════════════════════════════════════
    } else if (selected === 'tax_sales' || selected === 'tax_purchases' || selected === 'tax_net') {
      const isPurch = selected === 'tax_purchases'
      const table   = isPurch ? 'finance_purchase_orders' : 'finance_invoices'
      const dateCol = isPurch ? 'po_date' : 'invoice_date'
      const { data: salesData } = await supabase.from(table).select('*')
        .eq('tenant_id', tenant.id).gte(dateCol, fDateFrom).lte(dateCol, fDateTo).gt('vat_amount', 0).order(dateCol)

      if (selected === 'tax_net') {
        // صافي الضريبة
        const { data: purchData } = await supabase.from('finance_purchase_orders').select('vat_amount, subtotal, total_amount')
          .eq('tenant_id', tenant.id).gte('po_date', fDateFrom).lte('po_date', fDateTo).gt('vat_amount', 0)
        const salesVat = (salesData || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0)
        const purchVat = (purchData || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0)
        setResults([
          { item: 'ضريبة المبيعات (مخرجات)',     amount: salesVat,           type: 'credit' },
          { item: 'ضريبة المشتريات (مدخلات)',     amount: purchVat,           type: 'debit'  },
          { item: 'صافي الضريبة المستحقة للدفع', amount: salesVat - purchVat, type: 'net'    },
        ])
        setSummary({ 'ضريبة المبيعات': salesVat, 'ضريبة المشتريات': purchVat, 'الصافي المستحق': salesVat - purchVat })
      } else {
        setResults(salesData || [])
        setSummary({
          'الوعاء الضريبي': (salesData || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0),
          'الضريبة 15%': (salesData || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0),
          'الإجمالي': (salesData || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
        })
      }

    // ══════════════════════════════════════════
    // الحسابات والقيود
    // ══════════════════════════════════════════
    } else if (selected === 'trial') {
      // ميزان المراجعة: أول المدة (تراكمي قبل fDateFrom) + الحركة + آخر المدة
      const [openData, periodData] = await Promise.all([
        fetchAccountBalances(tenant.id, fDateFrom, undefined),
        fetchAccountBalances(tenant.id, fDateTo, fDateFrom),
      ])
      const openMap: Record<number, number> = {}
      openData.forEach(a => { openMap[a.id] = a.balance })

      const periodMap: Record<string, any> = {}
      periodData.forEach(a => { periodMap[a.id] = a })

      // جمع كل الحسابات
      const allIds = new Set([...openData.map(a => a.id), ...periodData.map(a => a.id)])
      const { data: allAccs } = await supabase.from('finance_accounts')
        .select('id, code, name, account_type').eq('tenant_id', tenant.id).eq('is_active', true).order('code')

      const rows = (allAccs || []).map((a: any) => {
        const open   = openMap[a.id] || 0
        const debit  = periodMap[a.id]?.debit  || 0
        const credit = periodMap[a.id]?.credit || 0
        const close  = open + calcBalance(a.account_type, debit, credit)
        return { ...a, open, debit, credit, close }
      }).filter(a => a.open !== 0 || a.debit !== 0 || a.credit !== 0)

      setResults(rows)
      setSummary({
        'إجمالي أول المدة مدين': rows.filter(r => r.open > 0).reduce((s, r) => s + r.open, 0),
        'إجمالي أول المدة دائن': rows.filter(r => r.open < 0).reduce((s, r) => s + Math.abs(r.open), 0),
        'إجمالي مدين الفترة':    rows.reduce((s, r) => s + r.debit,  0),
        'إجمالي دائن الفترة':    rows.reduce((s, r) => s + r.credit, 0),
        'إجمالي آخر المدة مدين': rows.filter(r => r.close > 0).reduce((s, r) => s + r.close, 0),
        'إجمالي آخر المدة دائن': rows.filter(r => r.close < 0).reduce((s, r) => s + Math.abs(r.close), 0),
      })

    } else if (selected === 'ledger') {
      if (!fAccount) { toast.error('اختر حساباً'); setLoading(false); return }
      const acc = accounts.find(a => a.id === Number(fAccount))
      // رصيد أول المدة
      const openData = await fetchAccountBalances(tenant.id, fDateFrom, undefined, undefined)
      const openBalance = openData.find(a => a.id === Number(fAccount))?.balance || 0
      // سطور الفترة
      const { data: entries } = await supabase.from('finance_journal_entries')
        .select('id, entry_number, entry_date, description, reference_type')
        .eq('tenant_id', tenant.id).gte('entry_date', fDateFrom).lte('entry_date', fDateTo).order('entry_date')
      if (!entries?.length) { setResults([]); setLoading(false); return }
      const entryIds = entries.map((e: any) => e.id)
      const { data: lines } = await supabase.from('finance_journal_lines')
        .select('entry_id, debit, credit, description').eq('account_id', Number(fAccount)).in('entry_id', entryIds)
      const entryMap: Record<number, any> = {}
      entries.forEach((e: any) => { entryMap[e.id] = e })
      // بناء الأستاذ مع رصيد متراكم
      let runningBalance = openBalance
      const ledgerRows = (lines || []).map((l: any) => {
        const e = entryMap[l.entry_id]
        const lineBalance = calcBalance(acc?.account_type || 'أصول', Number(l.debit || 0), Number(l.credit || 0))
        runningBalance += lineBalance
        return {
          date:        e?.entry_date,
          entry_no:    e?.entry_number,
          description: l.description || e?.description,
          ref_type:    e?.reference_type,
          debit:       Number(l.debit  || 0),
          credit:      Number(l.credit || 0),
          balance:     runningBalance,
        }
      })
      setResults(ledgerRows)
      setSummary({
        'رصيد أول المدة':   openBalance,
        'إجمالي المدين':   ledgerRows.reduce((s, r) => s + r.debit,  0),
        'إجمالي الدائن':   ledgerRows.reduce((s, r) => s + r.credit, 0),
        'رصيد آخر المدة':  runningBalance,
      })
      setExtra({ accountName: acc?.name || '' })

    } else if (selected === 'journal') {
      const { data: entries, error } = await supabase.from('finance_journal_entries')
        .select('id, entry_number, entry_date, description, reference_type, total_debit, total_credit, status')
        .eq('tenant_id', tenant.id).gte('entry_date', fDateFrom).lte('entry_date', fDateTo).order('entry_date')
      if (error) { toast.error('خطأ'); setLoading(false); return }
      // جلب سطور كل قيد
      const entryIds = (entries || []).map((e: any) => e.id)
      const { data: lines } = entryIds.length
        ? await supabase.from('finance_journal_lines').select('entry_id, account_id, debit, credit, description').in('entry_id', entryIds)
        : { data: [] }
      const { data: accsMap } = await supabase.from('finance_accounts').select('id, code, name').eq('tenant_id', tenant.id)
      const accById: Record<number, any> = {}
      ;(accsMap || []).forEach((a: any) => { accById[a.id] = a })
      const linesByEntry: Record<number, any[]> = {}
      ;(lines || []).forEach((l: any) => {
        if (!linesByEntry[l.entry_id]) linesByEntry[l.entry_id] = []
        linesByEntry[l.entry_id].push({ ...l, account: accById[l.account_id] })
      })
      setResults((entries || []).map((e: any) => ({ ...e, lines: linesByEntry[e.id] || [] })))
      setSummary({
        'عدد القيود': (entries || []).length,
        'إجمالي المدين': (entries || []).reduce((s: number, e: any) => s + Number(e.total_debit || 0), 0),
        'إجمالي الدائن': (entries || []).reduce((s: number, e: any) => s + Number(e.total_credit || 0), 0),
      })
    }

    setLoading(false)
  }

  function exportExcel() {
    if (!results.length) return
    const skip = ['tenant_id', 'branch_id', 'lines', 'isTotal', 'isRetained', 'section', 'items']
    const headers = Object.keys(results[0]).filter((k: string) => !skip.includes(k))
    const labelMap: Record<string, string> = {
      code:'الكود',name:'الاسم',account_type:'النوع',debit:'مدين',credit:'دائن',balance:'الرصيد',
      open:'أول المدة',close:'آخر المدة',change:'التغير',component:'المكوّن',
      invoice_number:'رقم الفاتورة',invoice_date:'التاريخ',client_name:'العميل',
      subtotal:'قبل الضريبة',vat_amount:'الضريبة',total_amount:'الإجمالي',status:'الحالة',
      vendor_name:'المورد',po_number:'رقم الأمر',po_date:'تاريخ الأمر',
      entry_number:'رقم القيد',entry_date:'تاريخ القيد',description:'البيان',
      total_debit:'إجمالي مدين',total_credit:'إجمالي دائن',
      category:'الفئة',refType:'نوع التدفق',inflow:'تدفق داخل',outflow:'تدفق خارج',net:'الصافي',
      client:'العميل',vendor:'المورد',count:'العدد',total:'الإجمالي',paid:'مدفوع',due:'مستحق',
      days:'الأيام',bucket:'الفئة',
    }
    const arabicHeaders = headers.map((h: string) => labelMap[h] || h)
    const rows = results.map((r: any) => headers.map((h: string) => {
      const v = r[h]
      return typeof v === 'number' ? v : String(v ?? '')
    }))
    const csvContent = [arabicHeaders.join('	'), ...rows.map((r: any[]) => r.join('	'))].join('
')
    const blob = new Blob(['﻿' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = (report?.title || 'تقرير') + '.xls'
    a.click()
  }

  function exportPDF() {
    if (!results.length) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    const skip = ['tenant_id', 'branch_id', 'lines', 'isTotal', 'isRetained', 'section', 'items']
    const headers = Object.keys(results[0]).filter((k: string) => !skip.includes(k))
    const labelMap: Record<string, string> = {
      code:'الكود',name:'الاسم',account_type:'النوع',debit:'مدين',credit:'دائن',balance:'الرصيد',
      open:'أول المدة',close:'آخر المدة',change:'التغير',component:'المكوّن',
      invoice_number:'رقم الفاتورة',invoice_date:'التاريخ',client_name:'العميل',
      subtotal:'قبل الضريبة',vat_amount:'الضريبة',total_amount:'الإجمالي',status:'الحالة',
      vendor_name:'المورد',po_number:'رقم الأمر',po_date:'تاريخ الأمر',
      entry_number:'رقم القيد',entry_date:'تاريخ القيد',description:'البيان',
      total_debit:'إجمالي مدين',total_credit:'إجمالي دائن',
      category:'الفئة',refType:'نوع التدفق',inflow:'تدفق داخل',outflow:'تدفق خارج',net:'الصافي',
    }
    const arabicHeaders = headers.map((h: string) => labelMap[h] || h)
    const rowsHtml = results.map((r: any, i: number) => {
      const cells = headers.map((h: string) => {
        const v = r[h]
        const isNum = typeof v === 'number' && h !== 'count'
        const val = isNum ? Number(v).toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : String(v ?? '—')
        return '<td style="padding:6px 10px;border:1px solid #e5e7eb' + (isNum ? ';text-align:center;font-family:monospace' : '') + '">' + val + '</td>'
      }).join('')
      return '<tr style="background:' + (i % 2 === 0 ? 'white' : '#f8fafc') + '">' + cells + '</tr>'
    }).join('')
    const headersHtml = arabicHeaders.map((h: string) =>
      '<th style="padding:8px 10px;background:#1a56db;color:white;border:1px solid #1a56db;font-weight:600">' + h + '</th>'
    ).join('')
    const sumHtml = summary ? Object.entries(summary).map(([k, v]) =>
      '<div><div style="color:#9ca3af;font-size:11px">' + k + '</div><div style="font-weight:700">' +
      (typeof v === 'number' ? Number(v).toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س' : String(v)) +
      '</div></div>'
    ).join('') : ''
    const summaryBlock = summary ? '<div style="margin-bottom:16px;display:flex;gap:20px;flex-wrap:wrap;background:#f8fafc;padding:12px;border-radius:8px">' + sumHtml + '</div>' : ''
    const html = '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>' + (report?.title || '') + '</title>'
      + '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Tahoma,sans-serif;padding:24px;color:#1a1a2e;direction:rtl;font-size:13px}'
      + 'h1{font-size:18px;margin-bottom:4px;color:#1a56db}h2{font-size:12px;color:#9ca3af;margin-bottom:16px;font-weight:400}'
      + 'table{width:100%;border-collapse:collapse}'
      + '@media print{.noprint{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>'
      + '<h1>' + (report?.title || 'تقرير') + '</h1>'
      + '<h2>الفترة: ' + fDateFrom + ' — ' + fDateTo + '</h2>'
      + summaryBlock
      + '<table><thead><tr>' + headersHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>'
      + '<div class="noprint" style="text-align:center;padding:16px;margin-top:16px;border-top:1px solid #e5e7eb">'
      + '<button onclick="window.print()" style="padding:10px 28px;background:#1a56db;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;margin-left:10px">طباعة / PDF</button>'
      + '<button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px">اغلاق</button>'
      + '</div></body></html>'
    win.document.write(html)
    win.document.close()
  }

    function exportCSV() {
    if (!results.length) return
    const skip = ['tenant_id', 'branch_id', 'lines']
    const headers = Object.keys(results[0]).filter(k => !skip.includes(k))
    const rows = results.map(r => headers.map(h => String((r as any)[h] ?? '')).join(','))
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${report?.title || 'تقرير'}.csv`; a.click()
  }

  const showClientFilter  = ['sales_detail', 'statement', 'sales_summary', 'aging'].includes(selected || '')
  const showAccountFilter = ['ledger'].includes(selected || '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign style={{ width: '22px', height: '22px', color: '#0ea77b' }} /> التقارير المالية
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>مبنية وفق معايير IFRS</p>
      </div>

      {/* المجموعات */}
      {REPORT_GROUPS.map(group => (
        <div key={group.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: group.color }} />
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: group.color }}>{group.label}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
            {group.reports.map(r => (
              <button key={r.id} onClick={() => { setSelected(r.id); setResults([]); setSummary(null); setExtra(null) }}
                style={{ textAlign: 'right', padding: '14px', borderRadius: '10px', border: `2px solid ${selected === r.id ? group.color : group.border}`, background: selected === r.id ? group.bg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{r.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selected === r.id ? group.color : '#1a1a2e', marginBottom: '3px' }}>{r.title}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', lineHeight: 1.4 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* منطقة الفلاتر والنتائج */}
      {selected && report && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>

          {/* رأس */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: (report as any).groupBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: (report as any).groupColor, fontSize: '0.9rem' }}>
              {report.icon} {report.title}
              {extra?.accountName && <span style={{ fontWeight: 400, color: '#6b7280', marginRight: '8px' }}>— {extra.accountName}</span>}
            </div>
            <button onClick={() => { setSelected(null); setResults([]); setSummary(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          {/* الفلاتر */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', background: '#fafafa' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>من تاريخ</label>
              <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>إلى تاريخ</label>
              <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
            </div>
            {showClientFilter && (
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>العميل</label>
                <select value={fClient} onChange={e => setFClient(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '160px' }}>
                  <option value="">كل العملاء</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {showAccountFilter && (
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>الحساب <span style={{ color: '#c81e1e' }}>*</span></label>
                <select value={fAccount} onChange={e => setFAccount(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '200px' }}>
                  <option value="">— اختر حساباً —</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={runReport} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 18px' }}>
              {loading
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Search style={{ width: '14px', height: '14px' }} />}
              عرض التقرير
            </button>
            {results.length > 0 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={exportExcel} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '7px 10px', color: '#0ea77b', borderColor: '#86efac' }}>
                  <Download style={{ width: '13px', height: '13px' }} /> Excel
                </button>
                <button onClick={exportPDF} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '7px 10px', color: '#c81e1e', borderColor: '#fecaca' }}>
                  <Printer style={{ width: '13px', height: '13px' }} /> PDF
                </button>
              </div>
            )}
          </div>

          {/* ملخص الأرقام الرئيسية */}
          {summary && (
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {Object.entries(summary).map(([k, v]) => {
                const isNeg = typeof v === 'number' && v < 0
                const isNet = k.includes('صافي') || k.includes('الصافي')
                return (
                  <div key={k}>
                    <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.875rem', color: isNet ? (isNeg ? '#c81e1e' : '#0ea77b') : '#1a1a2e' }}>
                      {typeof v === 'number' ? fmt(v) + ' ر.س' : String(v)}
                    </div>
                  </div>
                )
              })}
              {extra?.balanced !== undefined && (
                <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: extra.balanced ? '#0ea77b' : '#c81e1e', fontWeight: 700 }}>
                  {extra.balanced ? '✅ الميزانية متوازنة' : '⚠️ الميزانية غير متوازنة'}
                </div>
              )}
            </div>
          )}

          {/* النتائج */}
          {results.length > 0 && (
            <div style={{ overflowX: 'auto' }}>

              {/* ══ قائمة الدخل ══ */}
              {selected === 'income' && summary && (
                <div style={{ padding: '20px', maxWidth: '680px', margin: '0 auto' }}>
                  <div style={{ border: '1px solid #bfdbfe', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#1a56db', color: 'white', textAlign: 'center', fontWeight: 700 }}>
                      قائمة الدخل — من {fDateFrom} إلى {fDateTo}
                    </div>
                    {['إيرادات', 'مصروفات'].map(section => {
                      const items = results.filter(r => r.section === section)
                      const total = items.reduce((s, r) => s + r.balance, 0)
                      const color = section === 'إيرادات' ? '#0ea77b' : '#c81e1e'
                      return (
                        <div key={section}>
                          <div style={{ padding: '10px 16px', background: section === 'إيرادات' ? '#ecfdf5' : '#fef2f2', fontWeight: 700, color, borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>{section}</div>
                          {items.map((r, i) => (
                            <div key={i} style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9fafb', fontSize: '0.82rem' }}>
                              <span style={{ color: '#374151' }}>{r.code} — {r.name}</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(r.balance)}</span>
                            </div>
                          ))}
                          <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                            <span>إجمالي {section}</span>
                            <span style={{ fontFamily: 'monospace', color }}>{fmt(total)}</span>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', background: summary.net >= 0 ? '#ecfdf5' : '#fef2f2', borderTop: '2px solid #e5e7eb' }}>
                      <span>صافي {summary.net >= 0 ? 'الربح' : 'الخسارة'}</span>
                      <span style={{ fontFamily: 'monospace', color: summary.net >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmt(Math.abs(summary.net))} ر.س</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ قائمة المركز المالي ══ */}
              {selected === 'balance_sheet' && (
                <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
                  <div style={{ border: '1px solid #bfdbfe', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#1a56db', color: 'white', textAlign: 'center', fontWeight: 700 }}>
                      قائمة المركز المالي — {fDateTo}
                    </div>
                    {[
                      { section: 'أصول',           color: '#0ea77b', bg: '#ecfdf5' },
                      { section: 'خصوم',           color: '#c81e1e', bg: '#fef2f2' },
                      { section: 'حقوق الملكية',   color: '#7c3aed', bg: '#f5f3ff' },
                    ].map(({ section, color, bg }) => {
                      const items = results.filter(r => r.section === section)
                      const total = items.reduce((s, r) => s + r.balance, 0)
                      return (
                        <div key={section}>
                          <div style={{ padding: '10px 16px', background: bg, fontWeight: 700, color, borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>{section}</div>
                          {items.map((r, i) => (
                            <div key={i} style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9fafb', fontSize: '0.82rem' }}>
                              <span style={{ color: '#374151' }}>{r.code} — {r.name}</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(r.balance)}</span>
                            </div>
                          ))}
                          {/* صافي الربح ضمن حقوق الملكية */}
                          {section === 'حقوق الملكية' && summary?.netIncome !== 0 && (
                            <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9fafb', fontSize: '0.82rem', background: '#fafafa' }}>
                              <span style={{ color: '#6b7280', fontStyle: 'italic' }}>صافي ربح الفترة</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: summary.netIncome >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmt(summary.netIncome)}</span>
                            </div>
                          )}
                          <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                            <span>إجمالي {section}</span>
                            <span style={{ fontFamily: 'monospace', color }}>{fmt(section === 'حقوق الملكية' ? total + (summary?.netIncome || 0) : total)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ══ التدفقات النقدية ══ */}
              {selected === 'cashflow' && (
                <div style={{ padding: '20px' }}>
                  {extra?.cashAccounts && (
                    <div style={{ marginBottom: '12px', fontSize: '0.78rem', color: '#6b7280', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                      💰 الحسابات النقدية: {extra.cashAccounts}
                    </div>
                  )}
                  {/* رصيد أول المدة */}
                  {extra && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f0f9ff', borderRadius: '8px', marginBottom: '8px', fontWeight: 700, fontSize: '0.875rem' }}>
                      <span>رصيد النقد أول المدة — {fDateFrom}</span>
                      <span style={{ fontFamily: 'monospace', color: '#0891b2' }}>{fmt(extra.openCash)} ر.س</span>
                    </div>
                  )}
                  {/* التدفقات مقسمة بالفئات */}
                  {['تشغيلية', 'استثمارية', 'تمويلية'].map(category => {
                    const catRows = results.filter((r: any) => r.category === category)
                    if (!catRows.length) return null
                    const colorMap: Record<string, string> = { 'تشغيلية': '#0ea77b', 'استثمارية': '#1a56db', 'تمويلية': '#7c3aed' }
                    const bgMap:    Record<string, string> = { 'تشغيلية': '#ecfdf5', 'استثمارية': '#eff6ff', 'تمويلية': '#f5f3ff' }
                    const color = colorMap[category]; const bg = bgMap[category]
                    return (
                      <div key={category} style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 16px', background: bg, fontWeight: 700, color, fontSize: '0.875rem' }}>
                          التدفقات {category}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead><tr style={{ background: '#fafafa' }}>
                            {['نوع العملية', 'تدفق داخل', 'تدفق خارج', 'صافي'].map(h => (
                              <th key={h} style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: '#9ca3af', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem' }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {catRows.map((r: any, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f9fafb', background: r.isTotal ? bg : 'white' }}>
                                <td style={{ padding: '8px 14px', fontWeight: r.isTotal ? 700 : 400, color: r.isTotal ? color : '#374151', paddingRight: r.isTotal ? '14px' : '24px' }}>{r.refType}</td>
                                <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: r.isTotal ? 700 : 400 }}>{!r.isTotal && r.inflow > 0 ? fmt(r.inflow) : ''}</td>
                                <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#c81e1e', fontWeight: r.isTotal ? 700 : 400 }}>{!r.isTotal && r.outflow > 0 ? fmt(r.outflow) : ''}</td>
                                <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 700, color: r.net >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmt(r.net)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                  {/* الملخص النهائي */}
                  {extra && (
                    <div style={{ border: '2px solid #0891b2', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' }}>
                      <div style={{ padding: '10px 16px', background: '#0891b2', color: 'white', fontWeight: 700, textAlign: 'center' }}>
                        ملخص قائمة التدفقات النقدية
                      </div>
                      {[
                        { label: 'رصيد النقد أول المدة', value: extra.openCash,  color: '#0891b2' },
                        { label: 'صافي التغير في النقد',  value: extra.netCash,   color: extra.netCash  >= 0 ? '#0ea77b' : '#c81e1e' },
                        { label: 'رصيد النقد آخر المدة', value: extra.closeCash, color: extra.closeCash >= 0 ? '#0ea77b' : '#c81e1e' },
                      ].map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < 2 ? '1px solid #e5e7eb' : 'none', background: i === 2 ? '#ecfeff' : 'white' }}>
                          <span style={{ fontWeight: i === 2 ? 700 : 400 }}>{row.label}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: row.color }}>{fmt(row.value)} ر.س</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ التغير في حقوق الملكية ══ */}
              {selected === 'equity' && (
                <div style={{ padding: '20px' }}>
                  <div style={{ border: '1px solid #ddd6fe', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#7c3aed', color: 'white', textAlign: 'center', fontWeight: 700 }}>
                      قائمة التغير في حقوق الملكية — من {fDateFrom} إلى {fDateTo}
                    </div>
                    {/* رأس الجدول */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 16px', background: '#f5f3ff', fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', borderBottom: '1px solid #ddd6fe' }}>
                      <span>المكوّن</span>
                      <span style={{ textAlign: 'center' }}>رصيد أول المدة</span>
                      <span style={{ textAlign: 'center' }}>التغير خلال الفترة</span>
                      <span style={{ textAlign: 'center' }}>رصيد آخر المدة</span>
                    </div>
                    {results.map((r: any, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid #f3f4f6', background: r.isTotal ? '#f5f3ff' : r.isRetained ? '#fafafa' : 'white', fontWeight: r.isTotal ? 700 : 400, fontSize: '0.82rem' }}>
                        <span style={{ color: r.isTotal ? '#7c3aed' : r.isRetained ? '#0ea77b' : '#374151' }}>
                          {r.code ? `${r.code} — ` : ''}{r.component}
                        </span>
                        <span style={{ textAlign: 'center', fontFamily: 'monospace', color: r.open >= 0 ? '#374151' : '#c81e1e' }}>
                          {r.open !== 0 ? fmt(r.open) : '—'}
                        </span>
                        <span style={{ textAlign: 'center', fontFamily: 'monospace', color: r.change >= 0 ? '#0ea77b' : '#c81e1e', fontWeight: r.change !== 0 ? 700 : 400 }}>
                          {r.change !== 0 ? (r.change > 0 ? '+' : '') + fmt(r.change) : '—'}
                        </span>
                        <span style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: r.close >= 0 ? '#7c3aed' : '#c81e1e' }}>
                          {fmt(r.close)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ══ صافي الضريبة ══ */}
              {selected === 'tax_net' && (
                <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
                  <div style={{ border: '1px solid #c7d2fe', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#6366f1', color: 'white', textAlign: 'center', fontWeight: 700 }}>
                      صافي الضريبة المستحقة — من {fDateFrom} إلى {fDateTo}
                    </div>
                    {results.map((r: any, i) => (
                      <div key={i} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', background: r.type === 'net' ? '#eef2ff' : 'white', fontWeight: r.type === 'net' ? 800 : 400 }}>
                        <span>{r.item}</span>
                        <span style={{ fontFamily: 'monospace', color: r.type === 'net' ? (r.amount >= 0 ? '#c81e1e' : '#0ea77b') : '#374151', fontWeight: 700 }}>{fmt(r.amount)} ر.س</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ══ فواتير المبيعات ══ */}
              {(selected === 'sales_detail' || selected === 'statement') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['رقم الفاتورة', 'التاريخ', 'الاستحقاق', 'العميل', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#1a56db' }}>{r.invoice_number}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.invoice_date}</td>
                        <td style={{ padding: '9px 14px', color: r.due_date < today && r.status !== 'مدفوعة' ? '#c81e1e' : '#6b7280' }}>{r.due_date || '—'}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.client_name || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{fmt(r.subtotal)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#6366f1' }}>{fmt(r.vat_amount)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{fmt(r.total_amount)}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span className={`badge ${r.status === 'مدفوعة' ? 'badge-green' : r.status === 'مستحقة' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '0.68rem' }}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ══ ملخص مبيعات حسب العميل ══ */}
              {selected === 'sales_summary' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#ecfdf5' }}>
                    {['العميل', 'عدد الفواتير', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'المحصّل', 'المستحق'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #86efac' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 700 }}>{r.client}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'center' }}>{r.count}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{fmt(r.subtotal)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#6366f1' }}>{fmt(r.vat)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.total)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(r.paid)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: r.due > 0 ? '#c81e1e' : '#9ca3af', fontWeight: r.due > 0 ? 700 : 400 }}>{fmt(r.due)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td style={{ padding: '9px 14px' }}>الإجمالي</td>
                      <td style={{ padding: '9px 14px', textAlign: 'center' }}>{results.reduce((s: number, r: any) => s + r.count, 0)}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{fmt(results.reduce((s: number, r: any) => s + r.subtotal, 0))}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#6366f1' }}>{fmt(results.reduce((s: number, r: any) => s + r.vat, 0))}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(results.reduce((s: number, r: any) => s + r.total, 0))}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(results.reduce((s: number, r: any) => s + r.paid, 0))}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{fmt(results.reduce((s: number, r: any) => s + r.due, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* ══ أعمار الديون ══ */}
              {selected === 'aging' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#fef2f2' }}>
                    {['رقم الفاتورة', 'تاريخ الفاتورة', 'تاريخ الاستحقاق', 'العميل', 'المبلغ', 'الأيام', 'الفئة'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #fecaca' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{r.invoice_number}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.invoice_date}</td>
                        <td style={{ padding: '9px 14px', color: '#c81e1e' }}>{r.due_date || '—'}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.client_name || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{fmt(r.total_amount)}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: r.days > 90 ? '#c81e1e' : '#e6820a' }}>{r.days} يوم</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, background: r.bucket === '+90' ? '#fef2f2' : '#fffbeb', color: r.bucket === '+90' ? '#c81e1e' : '#e6820a' }}>{r.bucket} يوم</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ══ المشتريات التفصيلية ══ */}
              {selected === 'purchases_detail' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f5f3ff' }}>
                    {['رقم أمر الشراء', 'التاريخ', 'المورد', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #ddd6fe' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>{r.po_number}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.po_date}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.vendor_name || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{fmt(r.subtotal)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#6366f1' }}>{fmt(r.vat_amount)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.total_amount)}</td>
                        <td style={{ padding: '9px 14px' }}><span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ══ ملخص مشتريات حسب المورد ══ */}
              {selected === 'purchases_summary' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f5f3ff' }}>
                    {['المورد', 'عدد الأوامر', 'قبل الضريبة', 'الضريبة', 'الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #ddd6fe' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 700 }}>{r.vendor}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'center' }}>{r.count}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{fmt(r.subtotal)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#6366f1' }}>{fmt(r.vat)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ══ الضريبة (مبيعات أو مشتريات) ══ */}
              {(selected === 'tax_sales' || selected === 'tax_purchases') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#eef2ff' }}>
                    {['الرقم', 'التاريخ', selected === 'tax_purchases' ? 'المورد' : 'العميل', 'الوعاء الضريبي', 'النسبة', 'الضريبة', 'الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #c7d2fe' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{r.invoice_number || r.po_number}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.invoice_date || r.po_date}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.client_name || r.vendor_name || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{fmt(r.subtotal)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'center' }}>{r.vat_rate || 15}%</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#6366f1' }}>{fmt(r.vat_amount)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ══ ميزان المراجعة ══ */}
              {selected === 'trial' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#ecfeff' }}>
                      <th rowSpan={2} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #a5f3fc', borderLeft: '1px solid #a5f3fc' }}>كود</th>
                      <th rowSpan={2} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #a5f3fc', borderLeft: '1px solid #a5f3fc' }}>اسم الحساب</th>
                      <th rowSpan={2} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #a5f3fc', borderLeft: '1px solid #a5f3fc' }}>النوع</th>
                      <th colSpan={2} style={{ padding: '6px 14px', textAlign: 'center', fontWeight: 600, color: '#0891b2', borderBottom: '1px solid #a5f3fc', borderLeft: '1px solid #a5f3fc', fontSize: '0.75rem' }}>رصيد أول المدة</th>
                      <th colSpan={2} style={{ padding: '6px 14px', textAlign: 'center', fontWeight: 600, color: '#7c3aed', borderBottom: '1px solid #a5f3fc', borderLeft: '1px solid #a5f3fc', fontSize: '0.75rem' }}>حركة الفترة</th>
                      <th colSpan={2} style={{ padding: '6px 14px', textAlign: 'center', fontWeight: 600, color: '#0ea77b', borderBottom: '1px solid #a5f3fc', fontSize: '0.75rem' }}>رصيد آخر المدة</th>
                    </tr>
                    <tr style={{ background: '#f0fafe' }}>
                      {['مدين', 'دائن', 'مدين', 'دائن', 'مدين', 'دائن'].map((h, i) => (
                        <th key={i} style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 500, color: '#9ca3af', borderBottom: '1px solid #a5f3fc', fontSize: '0.72rem', borderLeft: i === 1 || i === 3 ? '1px solid #a5f3fc' : 'none' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#0891b2', fontWeight: 700 }}>{r.code}</td>
                        <td style={{ padding: '8px 14px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '8px 14px', color: '#9ca3af', fontSize: '0.72rem' }}>{r.account_type}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#0891b2' }}>{r.open > 0 ? fmt(r.open) : '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#0891b2' }}>{r.open < 0 ? fmt(Math.abs(r.open)) : '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#7c3aed' }}>{r.debit  > 0 ? fmt(r.debit)  : '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#7c3aed' }}>{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'center', fontWeight: 700, color: '#0ea77b' }}>{r.close > 0 ? fmt(r.close)          : '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'center', fontWeight: 700, color: '#c81e1e' }}>{r.close < 0 ? fmt(Math.abs(r.close)) : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f0fafe', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '9px 14px' }}>الإجمالي</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#0891b2' }}>{fmt(results.filter(r => r.open > 0).reduce((s, r) => s + r.open, 0))}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#0891b2' }}>{fmt(results.filter(r => r.open < 0).reduce((s, r) => s + Math.abs(r.open), 0))}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#7c3aed' }}>{fmt(results.reduce((s, r) => s + r.debit,  0))}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#7c3aed' }}>{fmt(results.reduce((s, r) => s + r.credit, 0))}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#0ea77b' }}>{fmt(results.filter(r => r.close > 0).reduce((s, r) => s + r.close, 0))}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', textAlign: 'center', color: '#c81e1e' }}>{fmt(results.filter(r => r.close < 0).reduce((s, r) => s + Math.abs(r.close), 0))}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* ══ دفتر الأستاذ ══ */}
              {selected === 'ledger' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#ecfeff' }}>
                    {['التاريخ', 'رقم القيد', 'البيان', 'النوع', 'مدين', 'دائن', 'الرصيد'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #a5f3fc' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {/* رصيد أول المدة */}
                    {summary && (
                      <tr style={{ background: '#f0f9ff' }}>
                        <td colSpan={4} style={{ padding: '9px 14px', fontWeight: 700, color: '#0891b2' }}>رصيد أول المدة — {fDateFrom}</td>
                        <td style={{ padding: '9px 14px' }} />
                        <td style={{ padding: '9px 14px' }} />
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: summary['رصيد أول المدة'] >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmt(Math.abs(summary['رصيد أول المدة']))}</td>
                      </tr>
                    )}
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{r.date}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0891b2' }}>{r.entry_no}</td>
                        <td style={{ padding: '9px 14px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#9ca3af', fontSize: '0.72rem' }}>{r.ref_type || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#1a56db', fontWeight: r.debit  > 0 ? 700 : 400 }}>{r.debit  > 0 ? fmt(r.debit)  : '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: r.credit > 0 ? 700 : 400 }}>{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: r.balance >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmt(Math.abs(r.balance))}</td>
                      </tr>
                    ))}
                    {/* رصيد آخر المدة */}
                    {summary && (
                      <tr style={{ background: '#f0f9ff', fontWeight: 700 }}>
                        <td colSpan={4} style={{ padding: '9px 14px', color: '#0891b2' }}>رصيد آخر المدة — {fDateTo}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#1a56db' }}>{fmt(summary['إجمالي المدين'])}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(summary['إجمالي الدائن'])}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: summary['رصيد آخر المدة'] >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmt(Math.abs(summary['رصيد آخر المدة']))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* ══ دفتر اليومية ══ */}
              {selected === 'journal' && (
                <div style={{ padding: '0' }}>
                  {results.map((entry: any, i) => (
                    <div key={i} style={{ borderBottom: '2px solid #f1f5f9', padding: '12px 20px' }}>
                      {/* رأس القيد */}
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px', fontSize: '0.82rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0891b2' }}>{entry.entry_number}</span>
                        <span style={{ color: '#6b7280' }}>{entry.entry_date}</span>
                        <span style={{ flex: 1, fontWeight: 600 }}>{entry.description}</span>
                        <span style={{ fontSize: '0.72rem', color: '#9ca3af', background: '#f8fafc', padding: '2px 8px', borderRadius: '6px' }}>{entry.reference_type}</span>
                      </div>
                      {/* سطور القيد */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <tbody>
                          {(entry.lines || []).map((l: any, j: number) => (
                            <tr key={j} style={{ borderBottom: '1px solid #f9fafb' }}>
                              <td style={{ padding: '5px 10px', paddingRight: l.debit > 0 ? '10px' : '30px', color: '#374151' }}>
                                {l.account?.code} — {l.account?.name}
                              </td>
                              <td style={{ padding: '5px 10px', textAlign: 'left', fontFamily: 'monospace', color: '#1a56db', fontWeight: l.debit > 0 ? 700 : 400, width: '140px' }}>
                                {l.debit > 0 ? fmt(l.debit) : ''}
                              </td>
                              <td style={{ padding: '5px 10px', textAlign: 'left', fontFamily: 'monospace', color: '#0ea77b', fontWeight: l.credit > 0 ? 700 : 400, width: '140px' }}>
                                {l.credit > 0 ? fmt(l.credit) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc' }}>
                            <td style={{ padding: '5px 10px', fontWeight: 600, color: '#6b7280' }}>الإجمالي</td>
                            <td style={{ padding: '5px 10px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, color: '#1a56db' }}>{fmt(entry.total_debit)}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{fmt(entry.total_credit)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {results.length === 0 && !loading && (
            <div style={{ padding: '50px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💰</div>
              <div style={{ fontWeight: 600 }}>اضغط "عرض التقرير" لتحميل البيانات</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
