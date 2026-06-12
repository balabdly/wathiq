'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { DollarSign, Search, X, Download } from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════
// تعريف مجموعات التقارير
// ═══════════════════════════════════════
const REPORT_GROUPS = [
  {
    id: 'financial_statements',
    label: 'القوائم المالية',
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
    reports: [
      { id: 'income',        title: 'قائمة الدخل',                    icon: '📈', desc: 'الإيرادات والمصروفات وصافي الربح' },
      { id: 'balance_sheet', title: 'قائمة المركز المالي',            icon: '🏦', desc: 'الأصول والخصوم وحقوق الملكية' },
      { id: 'cashflow',      title: 'قائمة التدفقات النقدية',         icon: '💧', desc: 'التدفقات التشغيلية والاستثمارية والتمويلية' },
      { id: 'equity',        title: 'قائمة التغير في حقوق الملكية',   icon: '📊', desc: 'التغيرات في رأس المال وحقوق الملكية' },
    ]
  },
  {
    id: 'sales',
    label: 'المبيعات',
    color: '#0ea77b',
    bg: '#ecfdf5',
    border: '#86efac',
    reports: [
      { id: 'sales_detail',  title: 'تقرير المبيعات التفصيلي',        icon: '🧾', desc: 'الفواتير مفصلة بالعميل والمبلغ والحالة' },
      { id: 'sales_client',  title: 'مبيعات حسب العميل',              icon: '👤', desc: 'إجمالي مبيعات كل عميل خلال الفترة' },
      { id: 'aging',         title: 'تقرير أعمار الديون',             icon: '⏳', desc: 'تحليل الذمم المدينة حسب عمر الدين' },
      { id: 'statement',     title: 'كشف حساب عميل',                  icon: '📋', desc: 'كشف مفصل لعميل محدد بالمدفوعات والمستحقات' },
    ]
  },
  {
    id: 'purchases',
    label: 'المشتريات',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    reports: [
      { id: 'purchases_detail', title: 'تقرير المشتريات التفصيلي',    icon: '🛒', desc: 'أوامر الشراء مفصلة بالمورد والتاريخ' },
      { id: 'purchases_vendor', title: 'مشتريات حسب المورد',          icon: '🏭', desc: 'إجمالي مشتريات كل مورد' },
    ]
  },
  {
    id: 'tax',
    label: 'الضريبة',
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
    reports: [
      { id: 'tax_sales',     title: 'ضريبة المبيعات',                 icon: '🧾', desc: 'إجمالي ضريبة القيمة المضافة على المبيعات' },
      { id: 'tax_purchases', title: 'ضريبة المشتريات',               icon: '📋', desc: 'إجمالي ضريبة القيمة المضافة على المشتريات' },
      { id: 'tax_journal',   title: 'دفتر اليومية الضريبية',          icon: '📔', desc: 'كل المعاملات الضريبية في الفترة' },
    ]
  },
  {
    id: 'accounting',
    label: 'الحسابات والقيود',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    reports: [
      { id: 'trial',         title: 'ميزان المراجعة',                  icon: '⚖️', desc: 'أرصدة جميع الحسابات أول وآخر المدة' },
      { id: 'ledger',        title: 'دفتر الأستاذ',                    icon: '📒', desc: 'حركة حساب محدد خلال فترة زمنية' },
      { id: 'journal',       title: 'دفتر اليومية',                    icon: '📗', desc: 'سجل القيود اليومية مرتبة بالتاريخ' },
    ]
  },
]

const thisYear = new Date().getFullYear()
const firstOfYear = `${thisYear}-01-01`
const today = new Date().toISOString().split('T')[0]

export default function ReportsFinancePage() {
  const { tenant, activeBranch } = useStore()
  const [selected,   setSelected]   = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [results,    setResults]    = useState<any[]>([])
  const [accounts,   setAccounts]   = useState<any[]>([])
  const [clients,    setClients]    = useState<any[]>([])
  const [loaded,     setLoaded]     = useState(false)
  const [fDateFrom,  setFDateFrom]  = useState(firstOfYear)
  const [fDateTo,    setFDateTo]    = useState(today)
  const [fAccount,   setFAccount]   = useState('')
  const [fClient,    setFClient]    = useState('')
  const [summary,    setSummary]    = useState<any>(null)

  const allReports = REPORT_GROUPS.flatMap(g => g.reports.map(r => ({ ...r, groupColor: g.color, groupBg: g.bg })))
  const report = allReports.find(r => r.id === selected)

  useEffect(() => {
    if (!tenant || loaded) return
    Promise.all([
      supabase.from('finance_accounts').select('id, code, name, account_type').eq('tenant_id', tenant.id).eq('is_active', true).order('code'),
      supabase.from('finance_clients').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ]).then(([accRes, clientRes]) => {
      setAccounts(accRes.data || [])
      setClients(clientRes.data || [])
      setLoaded(true)
    })
  }, [tenant?.id])

  const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  async function runReport() {
    if (!tenant || !selected) return
    setLoading(true); setResults([]); setSummary(null)

    // ──────── المبيعات ────────
    if (selected === 'sales_detail') {
      let q = supabase.from('finance_invoices').select('*')
        .eq('tenant_id', tenant.id).gte('invoice_date', fDateFrom).lte('invoice_date', fDateTo)
      if (fClient) q = q.eq('client_id', Number(fClient))
      const { data } = await q.order('invoice_date', { ascending: false })
      setResults(data || [])
      setSummary({
        'عدد الفواتير': (data || []).length,
        'إجمالي قبل الضريبة': (data || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0),
        'إجمالي الضريبة': (data || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0),
        'الإجمالي الكلي': (data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
      })

    } else if (selected === 'sales_client') {
      const { data } = await supabase.from('finance_invoices').select('client_name, client_id, subtotal, vat_amount, total_amount, status')
        .eq('tenant_id', tenant.id).gte('invoice_date', fDateFrom).lte('invoice_date', fDateTo)
      const grouped: Record<string, any> = {}
      ;(data || []).forEach((r: any) => {
        const k = r.client_name || 'غير محدد'
        if (!grouped[k]) grouped[k] = { client: k, count: 0, subtotal: 0, vat: 0, total: 0, paid: 0, pending: 0 }
        grouped[k].count++
        grouped[k].subtotal += Number(r.subtotal || 0)
        grouped[k].vat += Number(r.vat_amount || 0)
        grouped[k].total += Number(r.total_amount || 0)
        r.status === 'مدفوعة' ? grouped[k].paid += Number(r.total_amount || 0) : grouped[k].pending += Number(r.total_amount || 0)
      })
      setResults(Object.values(grouped).sort((a, b) => b.total - a.total))

    } else if (selected === 'aging') {
      const { data } = await supabase.from('finance_invoices').select('*')
        .eq('tenant_id', tenant.id).neq('status', 'مدفوعة').order('invoice_date')
      const now = new Date()
      const aged = (data || []).map((inv: any) => {
        const days = Math.floor((now.getTime() - new Date(inv.invoice_date).getTime()) / 86400000)
        return { ...inv, days, bucket: days <= 30 ? '0-30 يوم' : days <= 60 ? '31-60 يوم' : days <= 90 ? '61-90 يوم' : 'أكثر من 90 يوم' }
      })
      setResults(aged)
      const buckets: Record<string, number> = {}
      aged.forEach(r => { buckets[r.bucket] = (buckets[r.bucket] || 0) + Number(r.total_amount || 0) })
      setSummary(buckets)

    } else if (selected === 'statement') {
      const { data } = await supabase.from('finance_invoices').select('*')
        .eq('tenant_id', tenant.id)
        .eq(fClient ? 'client_id' : 'tenant_id', fClient ? Number(fClient) : tenant.id)
        .gte('invoice_date', fDateFrom).lte('invoice_date', fDateTo)
        .order('invoice_date')
      setResults(data || [])
      setSummary({
        'إجمالي الفواتير': (data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
        'المدفوع': (data || []).filter((r: any) => r.status === 'مدفوعة').reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
        'المستحق': (data || []).filter((r: any) => r.status !== 'مدفوعة').reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
      })

    // ──────── المشتريات ────────
    } else if (selected === 'purchases_detail') {
      const { data } = await supabase.from('finance_purchase_orders').select('*')
        .eq('tenant_id', tenant.id).gte('po_date', fDateFrom).lte('po_date', fDateTo)
        .order('po_date', { ascending: false })
      setResults(data || [])
      setSummary({
        'عدد أوامر الشراء': (data || []).length,
        'إجمالي قبل الضريبة': (data || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0),
        'إجمالي الضريبة': (data || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0),
        'الإجمالي': (data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
      })

    } else if (selected === 'purchases_vendor') {
      const { data } = await supabase.from('finance_purchase_orders').select('vendor_name, subtotal, vat_amount, total_amount')
        .eq('tenant_id', tenant.id).gte('po_date', fDateFrom).lte('po_date', fDateTo)
      const grouped: Record<string, any> = {}
      ;(data || []).forEach((r: any) => {
        const k = r.vendor_name || 'غير محدد'
        if (!grouped[k]) grouped[k] = { vendor: k, count: 0, subtotal: 0, vat: 0, total: 0 }
        grouped[k].count++; grouped[k].subtotal += Number(r.subtotal || 0)
        grouped[k].vat += Number(r.vat_amount || 0); grouped[k].total += Number(r.total_amount || 0)
      })
      setResults(Object.values(grouped).sort((a, b) => b.total - a.total))

    // ──────── الضريبة ────────
    } else if (selected === 'tax_sales' || selected === 'tax_purchases' || selected === 'tax_journal') {
      const table = selected !== 'tax_purchases' ? 'finance_invoices' : 'finance_purchase_orders'
      const dateCol = selected !== 'tax_purchases' ? 'invoice_date' : 'po_date'
      const { data } = await supabase.from(table).select('*')
        .eq('tenant_id', tenant.id).gte(dateCol, fDateFrom).lte(dateCol, fDateTo)
        .gt('vat_amount', 0).order(dateCol)
      setResults(data || [])
      setSummary({
        'الوعاء الضريبي': (data || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0),
        'الضريبة 15%': (data || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0),
        'الإجمالي شامل الضريبة': (data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
      })

    // ──────── الحسابات ────────
    } else if (selected === 'trial') {
      const { data: accs } = await supabase.from('finance_accounts')
        .select('id, code, name, account_type, normal_balance').eq('tenant_id', tenant.id).eq('is_active', true).order('code')
      // جلب مجموع المدين والدائن لكل حساب
      const { data: lines } = await supabase.from('finance_journal_lines').select('account_id, debit, credit')
      // جلب entry_ids ضمن الفترة
      const { data: entries } = await supabase.from('finance_journal_entries')
        .select('id').eq('tenant_id', tenant.id).gte('entry_date', fDateFrom).lte('entry_date', fDateTo)
      const entryIds = new Set((entries || []).map((e: any) => e.id))
      const map: Record<number, { debit: number; credit: number }> = {}
      ;(lines || []).filter((l: any) => entryIds.has(l.entry_id)).forEach((l: any) => {
        if (!map[l.account_id]) map[l.account_id] = { debit: 0, credit: 0 }
        map[l.account_id].debit  += Number(l.debit  || 0)
        map[l.account_id].credit += Number(l.credit || 0)
      })
      setResults((accs || []).map((a: any) => ({
        ...a,
        debit:   map[a.id]?.debit  || 0,
        credit:  map[a.id]?.credit || 0,
        balance: (map[a.id]?.debit || 0) - (map[a.id]?.credit || 0),
      })).filter((a: any) => a.debit > 0 || a.credit > 0))

    } else if (selected === 'ledger' || selected === 'journal') {
      const { data: entries } = await supabase.from('finance_journal_entries')
        .select('id, entry_number, entry_date, description, reference_type, total_debit, total_credit, status')
        .eq('tenant_id', tenant.id).gte('entry_date', fDateFrom).lte('entry_date', fDateTo)
        .order('entry_date')
      if (!entries?.length) { setResults([]); setLoading(false); return }

      if (selected === 'ledger' && fAccount) {
        const entryIds = entries.map((e: any) => e.id)
        const { data: lines } = await supabase.from('finance_journal_lines')
          .select('*, entry:finance_journal_entries(entry_number, entry_date, description)')
          .eq('account_id', Number(fAccount)).in('entry_id', entryIds)
        setResults(lines || [])
        setSummary({
          'إجمالي المدين': (lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0),
          'إجمالي الدائن': (lines || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0),
        })
      } else {
        setResults(entries)
        setSummary({
          'عدد القيود': entries.length,
          'إجمالي المدين': entries.reduce((s: number, e: any) => s + Number(e.total_debit || 0), 0),
          'إجمالي الدائن': entries.reduce((s: number, e: any) => s + Number(e.total_credit || 0), 0),
        })
      }

    // ──────── القوائم المالية ────────
    } else if (selected === 'income' || selected === 'balance_sheet') {
      const { data: accs } = await supabase.from('finance_accounts')
        .select('id, code, name, account_type, normal_balance').eq('tenant_id', tenant.id).eq('is_active', true)
      const { data: entries } = await supabase.from('finance_journal_entries')
        .select('id').eq('tenant_id', tenant.id).gte('entry_date', fDateFrom).lte('entry_date', fDateTo)
      const entryIds = new Set((entries || []).map((e: any) => e.id))
      const { data: lines } = await supabase.from('finance_journal_lines').select('account_id, debit, credit')
      const map: Record<number, number> = {}
      ;(lines || []).filter((l: any) => entryIds.has(l.entry_id)).forEach((l: any) => {
        if (!map[l.account_id]) map[l.account_id] = 0
        map[l.account_id] += Number(l.debit || 0) - Number(l.credit || 0)
      })
      const accWithBal = (accs || []).map((a: any) => ({ ...a, balance: Math.abs(map[a.id] || 0) }))

      if (selected === 'income') {
        const revenues = accWithBal.filter((a: any) => a.account_type === 'إيرادات' && (map[a.id] || 0) !== 0)
        const expenses = accWithBal.filter((a: any) => a.account_type === 'مصروفات' && (map[a.id] || 0) !== 0)
        const totRev = revenues.reduce((s: number, a: any) => s + a.balance, 0)
        const totExp = expenses.reduce((s: number, a: any) => s + a.balance, 0)
        setResults([...revenues.map((a: any) => ({ ...a, section: 'إيرادات' })), ...expenses.map((a: any) => ({ ...a, section: 'مصروفات' }))])
        setSummary({ 'إجمالي الإيرادات': totRev, 'إجمالي المصروفات': totExp, 'صافي الربح': totRev - totExp })
      } else {
        const assets      = accWithBal.filter((a: any) => a.account_type === 'أصول')
        const liabilities = accWithBal.filter((a: any) => a.account_type === 'خصوم')
        const equity      = accWithBal.filter((a: any) => a.account_type === 'حقوق الملكية')
        setResults([
          ...assets.map((a: any) => ({ ...a, section: 'أصول' })),
          ...liabilities.map((a: any) => ({ ...a, section: 'خصوم' })),
          ...equity.map((a: any) => ({ ...a, section: 'حقوق الملكية' })),
        ])
        setSummary({
          'إجمالي الأصول': assets.reduce((s: number, a: any) => s + a.balance, 0),
          'إجمالي الخصوم': liabilities.reduce((s: number, a: any) => s + a.balance, 0),
          'حقوق الملكية': equity.reduce((s: number, a: any) => s + a.balance, 0),
        })
      }
    } else {
      // cashflow و equity — بيانات غير كافية حالياً
      toast('هذا التقرير يحتاج بيانات إضافية — قريباً', { icon: '⚙️' })
    }

    setLoading(false)
  }

  function exportCSV() {
    if (!results.length) return
    const skip = ['tenant_id', 'branch_id']
    const headers = Object.keys(results[0]).filter(k => !skip.includes(k))
    const rows = results.map(r => headers.map(h => String((r as any)[h] ?? '')).join(','))
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${report?.title || 'تقرير'}.csv`; a.click()
  }

  const needsAccount  = ['ledger']
  const needsClient   = ['sales_detail', 'statement']
  const needsDateOnly = ['cashflow', 'equity', 'income', 'balance_sheet']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign style={{ width: '22px', height: '22px', color: '#0ea77b' }} /> التقارير المالية
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>اختر المجموعة ثم التقرير المطلوب</p>
      </div>

      {/* المجموعات */}
      {REPORT_GROUPS.map(group => (
        <div key={group.id}>
          {/* عنوان المجموعة */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: group.color }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: group.color }}>{group.label}</span>
          </div>

          {/* بطاقات التقارير */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '6px' }}>
            {group.reports.map(r => (
              <button key={r.id} onClick={() => { setSelected(r.id); setResults([]); setSummary(null) }}
                style={{ textAlign: 'right', padding: '14px', borderRadius: '10px', border: `2px solid ${selected === r.id ? group.color : group.border}`, background: selected === r.id ? group.bg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{r.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selected === r.id ? group.color : '#1a1a2e', marginBottom: '3px' }}>{r.title}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', lineHeight: 1.4 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* الفلاتر والنتائج */}
      {selected && report && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>

          {/* رأس */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: (report as any).groupBg || '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: (report as any).groupColor || '#374151', fontSize: '0.9rem' }}>{report.icon} {report.title}</div>
            <button onClick={() => { setSelected(null); setResults([]); setSummary(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          {/* الفلاتر */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>من تاريخ</label>
              <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>إلى تاريخ</label>
              <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
            </div>
            {needsClient.includes(selected) && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>العميل</label>
                <select value={fClient} onChange={e => setFClient(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '160px' }}>
                  <option value="">كل العملاء</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {needsAccount.includes(selected) && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>الحساب</label>
                <select value={fAccount} onChange={e => setFAccount(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '180px' }}>
                  <option value="">كل الحسابات</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={runReport} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
              {loading
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <Search style={{ width: '14px', height: '14px' }} />}
              عرض التقرير
            </button>
            {results.length > 0 && (
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '8px 12px' }}>
                <Download style={{ width: '14px', height: '14px' }} /> تصدير CSV
              </button>
            )}
          </div>

          {/* ملخص */}
          {summary && Object.keys(summary).length > 0 && (
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {Object.entries(summary).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem',
                    color: k === 'صافي الربح' ? (Number(v) >= 0 ? '#0ea77b' : '#c81e1e') : k.includes('مستحق') ? '#c81e1e' : '#1a1a2e' }}>
                    {typeof v === 'number' ? Number(v).toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س' : String(v)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* النتائج */}
          {results.length > 0 && (
            <div style={{ overflowX: 'auto' }}>

              {/* فواتير المبيعات التفصيلية */}
              {(selected === 'sales_detail' || selected === 'statement') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['رقم الفاتورة', 'التاريخ', 'العميل', 'المشروع', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#1a56db' }}>{r.invoice_number}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{r.invoice_date}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.client_name || '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.project_id || '—'}</td>
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

              {/* مبيعات حسب العميل */}
              {selected === 'sales_client' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#ecfdf5' }}>
                    {['العميل', 'عدد الفواتير', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'مدفوع', 'مستحق'].map(h => (
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
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{fmt(r.total)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(r.paid)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: r.pending > 0 ? '#c81e1e' : '#9ca3af', fontWeight: r.pending > 0 ? 700 : 400 }}>{fmt(r.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* أعمار الديون */}
              {selected === 'aging' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#fef2f2' }}>
                    {['رقم الفاتورة', 'التاريخ', 'العميل', 'المبلغ', 'الأيام', 'الفئة'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #fecaca' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{r.invoice_number}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.invoice_date}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.client_name || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{fmt(r.total_amount)}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: r.days > 90 ? '#c81e1e' : '#e6820a' }}>{r.days} يوم</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: r.days > 90 ? '#fef2f2' : '#fffbeb', color: r.days > 90 ? '#c81e1e' : '#e6820a' }}>{r.bucket}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* المشتريات التفصيلية */}
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

              {/* مشتريات حسب المورد */}
              {selected === 'purchases_vendor' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f5f3ff' }}>
                    {['المورد', 'عدد أوامر الشراء', 'قبل الضريبة', 'الضريبة', 'الإجمالي'].map(h => (
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

              {/* الضريبة */}
              {(selected === 'tax_sales' || selected === 'tax_purchases' || selected === 'tax_journal') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#eef2ff' }}>
                    {['الرقم', 'التاريخ', selected === 'tax_purchases' ? 'المورد' : 'العميل', 'الوعاء الضريبي', 'نسبة الضريبة', 'مبلغ الضريبة', 'الإجمالي'].map(h => (
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

              {/* ميزان المراجعة */}
              {selected === 'trial' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#ecfeff' }}>
                    {['كود', 'اسم الحساب', 'النوع', 'مجموع المدين', 'مجموع الدائن', 'الرصيد'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #a5f3fc' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0891b2', fontWeight: 700 }}>{r.code}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '9px 14px', color: '#9ca3af' }}>{r.account_type}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#1a56db' }}>{fmt(r.debit)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(r.credit)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: r.balance >= 0 ? '#1a56db' : '#c81e1e' }}>
                          {Math.abs(r.balance).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} {r.balance >= 0 ? 'م' : 'د'}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f0f9ff', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '10px 14px' }}>الإجمالي</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db' }}>{fmt(results.reduce((s, r) => s + r.debit, 0))}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(results.reduce((s, r) => s + r.credit, 0))}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )}

              {/* دفتر الأستاذ */}
              {selected === 'ledger' && fAccount && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['التاريخ', 'رقم القيد', 'البيان', 'مدين', 'دائن'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.entry?.entry_date}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0891b2' }}>{r.entry?.entry_number}</td>
                        <td style={{ padding: '9px 14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || r.entry?.description || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#1a56db', fontWeight: r.debit > 0 ? 700 : 400 }}>{r.debit > 0 ? fmt(r.debit) : '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: r.credit > 0 ? 700 : 400 }}>{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* دفتر اليومية */}
              {(selected === 'journal' || (selected === 'ledger' && !fAccount)) && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['رقم القيد', 'التاريخ', 'البيان', 'المرجع', 'إجمالي المدين', 'إجمالي الدائن', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0891b2' }}>{r.entry_number}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{r.entry_date}</td>
                        <td style={{ padding: '9px 14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#9ca3af', fontSize: '0.72rem' }}>{r.reference_type || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#1a56db', fontWeight: 700 }}>{fmt(r.total_debit)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: 700 }}>{fmt(r.total_credit)}</td>
                        <td style={{ padding: '9px 14px' }}><span className="badge badge-green" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* القوائم المالية — قائمة الدخل */}
              {selected === 'income' && (
                <div style={{ padding: '20px' }}>
                  <div style={{ maxWidth: '640px', margin: '0 auto', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', background: '#1a56db', color: 'white', textAlign: 'center', fontWeight: 700 }}>
                      قائمة الدخل — {fDateFrom} إلى {fDateTo}
                    </div>
                    {['إيرادات', 'مصروفات'].map(section => {
                      const items = results.filter((r: any) => r.section === section)
                      const total = items.reduce((s: number, r: any) => s + r.balance, 0)
                      return (
                        <div key={section}>
                          <div style={{ padding: '10px 16px', background: section === 'إيرادات' ? '#ecfdf5' : '#fef2f2', fontWeight: 700, color: section === 'إيرادات' ? '#0ea77b' : '#c81e1e', borderBottom: '1px solid var(--border)' }}>{section}</div>
                          {items.map((r: any, i) => (
                            <div key={i} style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                              <span>{r.code} — {r.name}</span>
                              <span style={{ fontFamily: 'monospace' }}>{fmt(r.balance)}</span>
                            </div>
                          ))}
                          <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                            <span>إجمالي {section}</span>
                            <span style={{ fontFamily: 'monospace', color: section === 'إيرادات' ? '#0ea77b' : '#c81e1e' }}>{fmt(total)}</span>
                          </div>
                        </div>
                      )
                    })}
                    {summary && (
                      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', background: summary['صافي الربح'] >= 0 ? '#ecfdf5' : '#fef2f2' }}>
                        <span>صافي الربح / الخسارة</span>
                        <span style={{ fontFamily: 'monospace', color: summary['صافي الربح'] >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmt(summary['صافي الربح'])} ر.س</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* قائمة المركز المالي */}
              {selected === 'balance_sheet' && (
                <div style={{ padding: '20px' }}>
                  <div style={{ maxWidth: '640px', margin: '0 auto', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', background: '#1a56db', color: 'white', textAlign: 'center', fontWeight: 700 }}>
                      قائمة المركز المالي — {fDateTo}
                    </div>
                    {['أصول', 'خصوم', 'حقوق الملكية'].map(section => {
                      const items = results.filter((r: any) => r.section === section)
                      const total = items.reduce((s: number, r: any) => s + r.balance, 0)
                      const color = section === 'أصول' ? '#0ea77b' : section === 'خصوم' ? '#c81e1e' : '#7c3aed'
                      const bg = section === 'أصول' ? '#ecfdf5' : section === 'خصوم' ? '#fef2f2' : '#f5f3ff'
                      return (
                        <div key={section}>
                          <div style={{ padding: '10px 16px', background: bg, fontWeight: 700, color, borderBottom: '1px solid var(--border)' }}>{section}</div>
                          {items.map((r: any, i) => (
                            <div key={i} style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                              <span>{r.code} — {r.name}</span>
                              <span style={{ fontFamily: 'monospace' }}>{fmt(r.balance)}</span>
                            </div>
                          ))}
                          <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                            <span>إجمالي {section}</span>
                            <span style={{ fontFamily: 'monospace', color }}>{fmt(total)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {results.length === 0 && !loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💰</div>
              اضغط "عرض التقرير" لتحميل البيانات
            </div>
          )}
        </div>
      )}
    </div>
  )
}
