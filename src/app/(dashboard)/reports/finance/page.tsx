'use client'
import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { DollarSign, Search, X, Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

const REPORTS = [
  { id: 'sales',        title: 'تقرير المبيعات التفصيلي',        icon: '📈', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', desc: 'فواتير المبيعات مفصلة بالعميل والتاريخ والمبلغ', filters: ['date_range', 'client'] },
  { id: 'purchases',    title: 'تقرير المشتريات',                icon: '🛒', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', desc: 'سجل المشتريات مفصل بالمورد والتاريخ', filters: ['date_range'] },
  { id: 'aging',        title: 'تقرير أعمار الديون',             icon: '⏳', color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', desc: 'تحليل الذمم المدينة حسب عمر الدين', filters: ['date_range'] },
  { id: 'trial',        title: 'ميزان المراجعة',                 icon: '⚖️', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', desc: 'أرصدة الحسابات أول وآخر المدة', filters: ['date_range'] },
  { id: 'ledger',       title: 'دفتر الأستاذ',                   icon: '📒', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', desc: 'حركة حساب محدد خلال فترة زمنية', filters: ['date_range', 'account'] },
  { id: 'statement',   title: 'كشف حساب عميل',                  icon: '👤', color: '#e6820a', bg: '#fffbeb', border: '#fcd34d', desc: 'كشف حساب تفصيلي لعميل محدد', filters: ['date_range', 'client'] },
  { id: 'tax_sales',   title: 'تقرير ضريبة المبيعات',           icon: '🧾', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', desc: 'إجمالي ضريبة القيمة المضافة على المبيعات', filters: ['date_range'] },
  { id: 'tax_purchases', title: 'تقرير ضريبة المشتريات',        icon: '📋', color: '#9333ea', bg: '#fdf4ff', border: '#e9d5ff', desc: 'إجمالي ضريبة القيمة المضافة على المشتريات', filters: ['date_range'] },
  { id: 'daily_journal', title: 'دفتر اليومية',                  icon: '📔', color: '#374151', bg: '#f9fafb', border: '#e5e7eb', desc: 'سجل القيود اليومية مرتبة بالتاريخ', filters: ['date_range', 'account'] },
  { id: 'income',       title: 'قائمة الدخل',                   icon: '💰', color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', desc: 'الإيرادات والمصروفات وصافي الربح', filters: ['date_range'] },
  { id: 'balance_sheet', title: 'الميزانية العمومية',            icon: '🏦', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', desc: 'الأصول والخصوم وحقوق الملكية', filters: ['date_range'] },
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

  const [fDateFrom, setFDateFrom] = useState(firstOfYear)
  const [fDateTo,   setFDateTo]   = useState(today)
  const [fAccount,  setFAccount]  = useState('')
  const [fClient,   setFClient]   = useState('')
  const [summary,   setSummary]   = useState<any>(null)

  const report = REPORTS.find(r => r.id === selected)

  async function loadFiltersData() {
    if (loaded || !tenant) return
    const [accRes, clientRes] = await Promise.all([
      supabase.from('finance_accounts').select('id, code, name, type').eq('tenant_id', tenant.id).order('code'),
      supabase.from('finance_clients').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ])
    setAccounts(accRes.data || [])
    setClients(clientRes.data || [])
    setLoaded(true)
  }

  async function selectReport(id: string) {
    setSelected(id); setResults([]); setSummary(null)
    await loadFiltersData()
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'

  async function runReport() {
    if (!tenant || !selected) return
    setLoading(true); setResults([]); setSummary(null)

    if (selected === 'sales') {
      let q = supabase.from('finance_invoices')
        .select('*, client:finance_clients(name)')
        .eq('tenant_id', tenant.id)
        .gte('invoice_date', fDateFrom).lte('invoice_date', fDateTo)
        .order('invoice_date', { ascending: false })
      if (fClient) q = q.eq('client_id', Number(fClient))
      const { data } = await q
      setResults(data || [])
      const total = (data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
      const vat   = (data || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0)
      setSummary({ total, vat, count: (data || []).length })

    } else if (selected === 'purchases') {
      const { data } = await supabase.from('finance_purchases')
        .select('*').eq('tenant_id', tenant.id)
        .gte('po_date', fDateFrom).lte('po_date', fDateTo)
        .order('po_date', { ascending: false })
      setResults(data || [])
      const total = (data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
      const vat   = (data || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0)
      setSummary({ total, vat, count: (data || []).length })

    } else if (selected === 'aging') {
      const { data } = await supabase.from('finance_invoices')
        .select('*, client:finance_clients(name)')
        .eq('tenant_id', tenant.id).eq('status', 'مستحقة')
        .order('invoice_date')
      const now = new Date()
      const aged = (data || []).map((inv: any) => {
        const days = Math.floor((now.getTime() - new Date(inv.invoice_date).getTime()) / 86400000)
        return { ...inv, days_outstanding: days, bucket: days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '+90' }
      })
      setResults(aged)
      const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '+90': 0 }
      aged.forEach((r: any) => { buckets[r.bucket as keyof typeof buckets] += Number(r.total || 0) })
      setSummary(buckets)

    } else if (selected === 'trial') {
      const { data } = await supabase.from('finance_accounts')
        .select('code, name, type').eq('tenant_id', tenant.id).order('code')
      // جلب الحركات
      const { data: entries } = await supabase.from('finance_journal_entries')
        .select('account_id, debit, credit, entry_date')
        .eq('tenant_id', tenant.id)
        .gte('entry_date', fDateFrom).lte('entry_date', fDateTo)
      const map: Record<number, { debit: number; credit: number }> = {}
      ;(entries || []).forEach((e: any) => {
        if (!map[e.account_id]) map[e.account_id] = { debit: 0, credit: 0 }
        map[e.account_id].debit  += Number(e.debit || 0)
        map[e.account_id].credit += Number(e.credit || 0)
      })
      const { data: accWithId } = await supabase.from('finance_accounts').select('id, code, name, type').eq('tenant_id', tenant.id).order('code')
      setResults((accWithId || []).map((a: any) => ({
        ...a, debit: map[a.id]?.debit || 0, credit: map[a.id]?.credit || 0,
        balance: (map[a.id]?.debit || 0) - (map[a.id]?.credit || 0),
      })).filter((a: any) => a.debit > 0 || a.credit > 0))

    } else if (selected === 'ledger' || selected === 'daily_journal') {
      let q = supabase.from('finance_journal_entries')
        .select('*, account:finance_accounts(code, name)')
        .eq('tenant_id', tenant.id)
        .gte('entry_date', fDateFrom).lte('entry_date', fDateTo)
        .order('entry_date')
      if (fAccount) q = q.eq('account_id', Number(fAccount))
      const { data } = await q
      setResults(data || [])
      setSummary({
        totalDebit: (data || []).reduce((s: number, r: any) => s + Number(r.debit || 0), 0),
        totalCredit: (data || []).reduce((s: number, r: any) => s + Number(r.credit || 0), 0),
      })

    } else if (selected === 'statement') {
      let q = supabase.from('finance_journal_entries')
        .select('*, account:finance_accounts(code, name)')
        .eq('tenant_id', tenant.id)
        .gte('entry_date', fDateFrom).lte('entry_date', fDateTo)
        .order('entry_date')
      if (fClient) q = q.eq('client_id', Number(fClient))
      const { data } = await q
      setResults(data || [])

    } else if (selected === 'tax_sales' || selected === 'tax_purchases') {
      const table = selected === 'tax_sales' ? 'finance_invoices' : 'finance_purchases'
      const dateCol = selected === 'tax_sales' ? 'invoice_date' : 'po_date'
      const { data } = await supabase.from(table)
        .select('*').eq('tenant_id', tenant.id)
        .gte(dateCol, fDateFrom).lte(dateCol, fDateTo)
        .gt('vat_amount', 0).order(dateCol)
      setResults(data || [])
      const vat   = (data || []).reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0)
      const base  = (data || []).reduce((s: number, r: any) => s + Number(r.subtotal || r.total || 0), 0)
      setSummary({ base, vat, total: base + vat })

    } else if (selected === 'income') {
      const { data } = await supabase.from('finance_journal_entries')
        .select('*, account:finance_accounts(code, name, type)')
        .eq('tenant_id', tenant.id)
        .gte('entry_date', fDateFrom).lte('entry_date', fDateTo)
        .in('account_type', ['إيرادات', 'مصروفات'])
        .order('account_type')
      const revenues  = (data || []).filter((r: any) => r.account?.type === 'إيرادات')
      const expenses  = (data || []).filter((r: any) => r.account?.type === 'مصروفات')
      const totRev = revenues.reduce((s: number, r: any) => s + Number(r.credit || 0) - Number(r.debit || 0), 0)
      const totExp = expenses.reduce((s: number, r: any) => s + Number(r.debit || 0) - Number(r.credit || 0), 0)
      setResults(data || [])
      setSummary({ revenues: totRev, expenses: totExp, net: totRev - totExp })

    } else if (selected === 'balance_sheet') {
      const { data } = await supabase.from('finance_accounts')
        .select('id, code, name, type').eq('tenant_id', tenant.id)
        .in('type', ['أصول', 'خصوم', 'حقوق الملكية']).order('code')
      const { data: entries } = await supabase.from('finance_journal_entries')
        .select('account_id, debit, credit')
        .eq('tenant_id', tenant.id).lte('entry_date', fDateTo)
      const map: Record<number, number> = {}
      ;(entries || []).forEach((e: any) => {
        if (!map[e.account_id]) map[e.account_id] = 0
        map[e.account_id] += Number(e.debit || 0) - Number(e.credit || 0)
      })
      setResults((data || []).map((a: any) => ({ ...a, balance: map[a.id] || 0 })))
    }

    setLoading(false)
  }

  function exportCSV() {
    if (!results.length) return
    const skip = ['tenant_id', 'branch_id', 'client', 'account']
    const headers = Object.keys(results[0]).filter(k => !skip.includes(k))
    const rows = results.map(r => headers.map(h => String((r as any)[h] ?? '')).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${report?.title}.csv`; a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign style={{ width: '22px', height: '22px', color: '#0ea77b' }} /> التقارير المالية
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>اختر التقرير المطلوب لعرض محددات البحث</p>
      </div>

      {/* البطاقات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
        {REPORTS.map(r => (
          <button key={r.id} onClick={() => selectReport(r.id)}
            style={{ textAlign: 'right', padding: '14px', borderRadius: '12px', border: `2px solid ${selected === r.id ? r.color : r.border}`, background: selected === r.id ? r.bg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '5px' }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: selected === r.id ? r.color : '#1a1a2e', marginBottom: '3px' }}>{r.title}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.5 }}>{r.desc}</div>
          </button>
        ))}
      </div>

      {/* الفلاتر والنتائج */}
      {selected && report && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: report.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: report.color }}>{report.icon} {report.title}</div>
            <button onClick={() => { setSelected(null); setResults([]); setSummary(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          {/* الفلاتر */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {report.filters.includes('date_range') && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>من تاريخ</label>
                  <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>إلى تاريخ</label>
                  <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
                </div>
              </>
            )}
            {report.filters.includes('client') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>العميل</label>
                <select value={fClient} onChange={e => setFClient(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '160px' }}>
                  <option value="">كل العملاء</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {report.filters.includes('account') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>الحساب</label>
                <select value={fAccount} onChange={e => setFAccount(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '180px' }}>
                  <option value="">كل الحسابات</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={runReport} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
              {loading ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Search style={{ width: '14px', height: '14px' }} />}
              عرض التقرير
            </button>
            {results.length > 0 && (
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '8px 12px' }}>
                <Download style={{ width: '14px', height: '14px' }} /> تصدير CSV
              </button>
            )}
          </div>

          {/* ملخص */}
          {summary && (
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {Object.entries(summary).map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '2px' }}>{
                    k === 'total' ? 'الإجمالي' : k === 'vat' ? 'الضريبة' : k === 'count' ? 'العدد' :
                    k === 'revenues' ? 'الإيرادات' : k === 'expenses' ? 'المصروفات' : k === 'net' ? 'صافي الربح' :
                    k === 'totalDebit' ? 'إجمالي المدين' : k === 'totalCredit' ? 'إجمالي الدائن' :
                    k === 'base' ? 'القاعدة الضريبية' : k
                  }</div>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: k === 'net' && Number(v) < 0 ? '#c81e1e' : '#0ea77b' }}>
                    {typeof v === 'number' && k !== 'count' ? Number(v).toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س' : String(v)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* النتائج */}
          {results.length > 0 && (
            <div style={{ overflowX: 'auto' }}>

              {/* المبيعات */}
              {selected === 'sales' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['رقم الفاتورة', 'التاريخ', 'العميل', 'المبلغ قبل الضريبة', 'الضريبة', 'الإجمالي', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{r.invoice_number}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.invoice_date}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.client?.name || r.client_name || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{Number(r.subtotal || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#6366f1' }}>{Number(r.vat_amount || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{Number(r.total || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px' }}><span className={`badge ${r.status === 'مدفوعة' ? 'badge-green' : r.status === 'مستحقة' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* المشتريات */}
              {selected === 'purchases' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['رقم أمر الشراء', 'التاريخ', 'المورد', 'المبلغ', 'الضريبة', 'الإجمالي', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{r.po_number}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.po_date}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.vendor_name || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{Number(r.subtotal || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#6366f1' }}>{Number(r.vat_amount || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{Number(r.total || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px' }}><span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* أعمار الديون */}
              {selected === 'aging' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#fef2f2' }}>
                    {['رقم الفاتورة', 'التاريخ', 'العميل', 'المبلغ', 'أيام الاستحقاق', 'الفئة'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #fecaca' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{r.invoice_number}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.invoice_date}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.client?.name || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{Number(r.total || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: r.days_outstanding > 90 ? '#c81e1e' : '#e6820a' }}>{r.days_outstanding} يوم</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: r.bucket === '+90' ? '#fef2f2' : '#fffbeb', color: r.bucket === '+90' ? '#c81e1e' : '#e6820a' }}>{r.bucket}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ميزان المراجعة */}
              {selected === 'trial' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f5f3ff' }}>
                    {['كود الحساب', 'اسم الحساب', 'النوع', 'مجموع المدين', 'مجموع الدائن', 'الرصيد'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #ddd6fe' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>{r.code}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{r.type}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db' }}>{Number(r.debit).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{Number(r.credit).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: r.balance >= 0 ? '#1a56db' : '#c81e1e' }}>
                          {Math.abs(r.balance).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} {r.balance >= 0 ? 'مدين' : 'دائن'}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '10px 14px' }}>الإجمالي</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db' }}>{results.reduce((s, r) => s + r.debit, 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{results.reduce((s, r) => s + r.credit, 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )}

              {/* دفتر الأستاذ / اليومية / كشف الحساب */}
              {(selected === 'ledger' || selected === 'daily_journal' || selected === 'statement') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['التاريخ', 'الحساب', 'البيان', 'مدين', 'دائن', 'المرجع'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{r.entry_date}</td>
                        <td style={{ padding: '10px 14px' }}>{r.account?.code} — {r.account?.name}</td>
                        <td style={{ padding: '10px 14px', color: '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db', fontWeight: r.debit > 0 ? 700 : 400 }}>{r.debit > 0 ? Number(r.debit).toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: r.credit > 0 ? 700 : 400 }}>{r.credit > 0 ? Number(r.credit).toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af' }}>{r.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* الضريبة */}
              {(selected === 'tax_sales' || selected === 'tax_purchases') && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ background: '#eef2ff' }}>
                    {['الرقم', 'التاريخ', selected === 'tax_sales' ? 'العميل' : 'المورد', 'الوعاء الضريبي', 'نسبة الضريبة', 'مبلغ الضريبة', 'الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #c7d2fe' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map((r: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{r.invoice_number || r.po_number}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.invoice_date || r.po_date}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.client?.name || r.vendor_name || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{Number(r.subtotal || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{r.vat_rate || 15}%</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#6366f1', fontWeight: 700 }}>{Number(r.vat_amount || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{Number(r.total || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* الدخل */}
              {selected === 'income' && summary && (
                <div style={{ padding: '24px' }}>
                  <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>قائمة الدخل</div>
                      <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{fDateFrom} — {fDateTo}</div>
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', background: '#ecfdf5', fontWeight: 700, color: '#0ea77b', borderBottom: '1px solid var(--border)' }}>الإيرادات</div>
                      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                        <span>إجمالي الإيرادات</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{summary.revenues.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                      </div>
                      <div style={{ padding: '12px 16px', background: '#fef2f2', fontWeight: 700, color: '#c81e1e', borderBottom: '1px solid var(--border)' }}>المصروفات</div>
                      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                        <span>إجمالي المصروفات</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{summary.expenses.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                      </div>
                      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', background: summary.net >= 0 ? '#ecfdf5' : '#fef2f2', fontWeight: 700 }}>
                        <span style={{ fontSize: '1rem' }}>صافي الربح / الخسارة</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: summary.net >= 0 ? '#0ea77b' : '#c81e1e' }}>
                          {summary.net.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                        </span>
                      </div>
                    </div>
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
