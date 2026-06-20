'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, DollarSign, FileText,
  ShoppingCart, AlertCircle, CheckCircle2, Clock,
  BarChart2, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

type MonthlyData = { month: string; invoices: number; expenses: number; purchases: number }
type InvoiceRow   = { id: number; invoice_number: string; client_name: string; total_amount: number; status: string; invoice_date: string }
type ExpenseRow   = { id: number; category: string; description: string; amount: number; expense_date: string }

export default function FinanceDashboard() {
  const { tenant, activeBranch } = useStore()
  const [loading,  setLoading]  = useState(true)

  // KPIs
  const [kpis, setKpis] = useState({
    totalRevenue:    0,
    totalExpenses:   0,
    totalPurchases:  0,
    netProfit:       0,
    paidInvoices:    0,
    unpaidInvoices:  0,
    overdueInvoices: 0,
    invoiceCount:    0,
    expenseCount:    0,
    purchaseCount:   0,
    vatCollected:    0,
    vatPaid:         0,
  })

  // بيانات الرسم البياني
  const [monthly,       setMonthly]       = useState<MonthlyData[]>([])
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRow[]>([])
  const [recentExpenses, setRecentExpenses] = useState<ExpenseRow[]>([])

  useEffect(() => { if (tenant && activeBranch) loadAll() }, [tenant?.id, activeBranch?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const tid = tenant.id

    // ── ١ KPIs ──
    const [invRes, expRes, purRes] = await Promise.all([
      supabase.from('finance_invoices').select('total_amount, subtotal, vat_amount, status, invoice_date, due_date').eq('tenant_id', tid),
      supabase.from('finance_expenses').select('amount, vat_amount, expense_date').eq('tenant_id', tid),
      supabase.from('finance_purchase_orders').select('total_amount, expense_date:created_at').eq('tenant_id', tid),
    ])

    const invoices  = invRes.data  || []
    const expenses  = expRes.data  || []
    const purchases = purRes.data  || []
    const today     = new Date().toISOString().split('T')[0]

    const totalRevenue   = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
    const totalExpenses  = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const totalPurchases = purchases.reduce((s, p) => s + Number(p.total_amount), 0)
    const vatCollected   = invoices.reduce((s, i) => s + Number(i.vat_amount || 0), 0)
    const vatPaid        = expenses.reduce((s, e) => s + Number(e.vat_amount || 0), 0)
    const paidInvoices   = invoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
    const unpaidInvoices = invoices.filter(i => i.status !== 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
    const overdueCount   = invoices.filter(i => i.status !== 'مدفوعة' && i.due_date && i.due_date < today).length

    setKpis({
      totalRevenue,
      totalExpenses: totalExpenses + totalPurchases,
      totalPurchases,
      netProfit:     totalRevenue - totalExpenses - totalPurchases,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices: overdueCount,
      invoiceCount:  invoices.length,
      expenseCount:  expenses.length,
      purchaseCount: purchases.length,
      vatCollected,
      vatPaid,
    })

    // ── ٢ بيانات شهرية ──
    const monthMap: Record<string, MonthlyData> = {}
    const addMonth = (date: string, field: 'invoices' | 'expenses' | 'purchases', amount: number) => {
      if (!date) return
      const m = date.slice(0, 7)
      if (!monthMap[m]) monthMap[m] = { month: m, invoices: 0, expenses: 0, purchases: 0 }
      monthMap[m][field] += amount
    }
    invoices.forEach(i  => addMonth(i.invoice_date, 'invoices',  Number(i.total_amount)))
    expenses.forEach(e  => addMonth(e.expense_date, 'expenses',  Number(e.amount)))
    purchases.forEach(p => addMonth((p as any).expense_date?.slice(0,10), 'purchases', Number(p.total_amount)))

    const sorted = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
    setMonthly(sorted)

    // ── ٣ آخر الفواتير ──
    const { data: inv } = await supabase.from('finance_invoices')
      .select('id, invoice_number, client_name, total_amount, status, invoice_date')
      .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(5)
    setRecentInvoices(inv || [])

    // ── ٤ آخر المصروفات ──
    const { data: exp } = await supabase.from('finance_expenses')
      .select('id, category, description, amount, expense_date')
      .eq('tenant_id', tid).order('expense_date', { ascending: false }).limit(5)
    setRecentExpenses(exp || [])

    setLoading(false)
  }

  // ── الرسم البياني ──
  const maxVal = Math.max(...monthly.map(m => Math.max(m.invoices, m.expenses + m.purchases)), 1)
  const barH   = 140

  const monthLabels: Record<string, string> = {
    '01':'يناير','02':'فبراير','03':'مارس','04':'أبريل',
    '05':'مايو','06':'يونيو','07':'يوليو','08':'أغسطس',
    '09':'سبتمبر','10':'أكتوبر','11':'نوفمبر','12':'ديسمبر'
  }
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-')
    return `${monthLabels[mo]} ${y}`
  }

  const statusColor: Record<string, { bg: string; color: string }> = {
    'مدفوعة':  { bg: '#ecfdf5', color: '#0ea77b' },
    'مرسلة':   { bg: '#eff6ff', color: '#1a56db' },
    'مسودة':   { bg: '#f8fafc', color: '#64748b' },
    'ملغاة':   { bg: '#fef2f2', color: '#c81e1e' },
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text3)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        جاري تحميل البيانات...
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 style={{ width: '22px', height: '22px', color: '#1a56db' }} />
          لوحة التحكم المالية
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>نظرة شاملة على الوضع المالي</p>
      </div>

      {/* KPIs الرئيسية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          {
            label: 'إجمالي الإيرادات', value: kpis.totalRevenue,
            icon: <TrendingUp style={{ width: '20px', height: '20px' }} />,
            color: '#0ea77b', bg: '#ecfdf5', sub: `${kpis.invoiceCount} فاتورة`
          },
          {
            label: 'إجمالي المصروفات', value: kpis.totalExpenses,
            icon: <TrendingDown style={{ width: '20px', height: '20px' }} />,
            color: '#c81e1e', bg: '#fef2f2', sub: `${kpis.expenseCount + kpis.purchaseCount} عملية`
          },
          {
            label: 'صافي الربح', value: kpis.netProfit,
            icon: <DollarSign style={{ width: '20px', height: '20px' }} />,
            color: kpis.netProfit >= 0 ? '#0ea77b' : '#c81e1e',
            bg:    kpis.netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
            sub:   kpis.netProfit >= 0 ? '▲ ربح' : '▼ خسارة'
          },
          {
            label: 'ضريبة القيمة المضافة', value: kpis.vatCollected - kpis.vatPaid,
            icon: <FileText style={{ width: '20px', height: '20px' }} />,
            color: '#7c3aed', bg: '#f5f3ff',
            sub: `محصّلة ${formatCurrency(kpis.vatCollected)} | مدفوعة ${formatCurrency(kpis.vatPaid)}`
          },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '14px', padding: '16px 18px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ color: kpi.color }}>{kpi.icon}</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text3)', fontWeight: 600 }}>{kpi.sub}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: kpi.color, direction: 'ltr', textAlign: 'right' }}>
              {formatCurrency(Math.abs(kpi.value))}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* KPIs الفواتير */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'فواتير مدفوعة',  value: kpis.paidInvoices,    color: '#0ea77b', icon: <CheckCircle2 style={{ width: '16px', height: '16px' }} />, bg: '#ecfdf5' },
          { label: 'فواتير معلقة',   value: kpis.unpaidInvoices,  color: '#e6820a', icon: <Clock style={{ width: '16px', height: '16px' }} />,         bg: '#fffbeb' },
          { label: 'فواتير متأخرة',  value: kpis.overdueInvoices, color: '#c81e1e', icon: <AlertCircle style={{ width: '16px', height: '16px' }} />,   bg: '#fef2f2', isCount: true },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: k.color, background: 'white', borderRadius: '8px', padding: '8px', display: 'flex' }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: k.isCount ? '1.6rem' : '1.1rem', fontWeight: 800, color: k.color }}>
                {k.isCount ? k.value : formatCurrency(k.value)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* الرسم البياني الشهري */}
      {monthly.length > 0 && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>📊 الإيرادات مقابل المصروفات (شهري)</h3>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.72rem', fontWeight: 600 }}>
              <span style={{ color: '#0ea77b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0ea77b' }} /> الإيرادات
              </span>
              <span style={{ color: '#c81e1e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c81e1e' }} /> المصروفات
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: `${barH + 30}px` }}>
            {monthly.map(m => {
              const totalExp = m.expenses + m.purchases
              const invH = Math.round((m.invoices / maxVal) * barH)
              const expH = Math.round((totalExp   / maxVal) * barH)
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: `${barH}px` }}>
                    {/* عمود الإيرادات */}
                    <div style={{ width: '18px', height: `${invH}px`, background: '#0ea77b', borderRadius: '4px 4px 0 0', minHeight: '2px',
                      transition: 'height 0.5s', cursor: 'pointer', position: 'relative' }}
                      title={`الإيرادات: ${formatCurrency(m.invoices)}`} />
                    {/* عمود المصروفات */}
                    <div style={{ width: '18px', height: `${expH}px`, background: '#c81e1e', borderRadius: '4px 4px 0 0', minHeight: '2px',
                      transition: 'height 0.5s', cursor: 'pointer' }}
                      title={`المصروفات: ${formatCurrency(totalExp)}`} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {fmtMonth(m.month)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* الجداول السفلية */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* آخر الفواتير */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              <FileText style={{ width: '15px', height: '15px', display: 'inline', marginLeft: '6px', color: '#1a56db' }} />
              آخر الفواتير
            </h3>
            <a href="/finance" style={{ fontSize: '0.72rem', color: '#1a56db', textDecoration: 'none', fontWeight: 600 }}>عرض الكل ←</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <tbody>
              {recentInvoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{inv.client_name}</div>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 700,
                      background: statusColor[inv.status]?.bg || '#f8fafc',
                      color:      statusColor[inv.status]?.color || '#64748b',
                    }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', direction: 'ltr' }}>
                    {formatCurrency(Number(inv.total_amount))}
                  </td>
                </tr>
              ))}
              {recentInvoices.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.78rem' }}>لا توجد فواتير</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* آخر المصروفات */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              <ShoppingCart style={{ width: '15px', height: '15px', display: 'inline', marginLeft: '6px', color: '#c81e1e' }} />
              آخر المصروفات
            </h3>
            <a href="/finance" style={{ fontSize: '0.72rem', color: '#1a56db', textDecoration: 'none', fontWeight: 600 }}>عرض الكل ←</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <tbody>
              {recentExpenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{exp.category}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{exp.description}</div>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', direction: 'ltr' }}>
                    {formatCurrency(Number(exp.amount))}
                  </td>
                </tr>
              ))}
              {recentExpenses.length === 0 && (
                <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.78rem' }}>لا توجد مصروفات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
