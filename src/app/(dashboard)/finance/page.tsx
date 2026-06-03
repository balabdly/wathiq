'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, DollarSign, FileText,
  ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight,
  AlertCircle, CheckCircle, Clock
} from 'lucide-react'

type Stats = {
  totalInvoiced: number
  totalCollected: number
  totalPurchases: number
  totalExpenses: number
  pendingInvoices: number
  pendingCount: number
  overdueCount: number
  cashBalance: number
}

type RecentTx = {
  id: number; type: string; description: string
  amount: number; date: string; status: string
}

export default function FinanceDashboard() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const [stats, setStats]   = useState<Stats>({ totalInvoiced:0, totalCollected:0, totalPurchases:0, totalExpenses:0, pendingInvoices:0, pendingCount:0, overdueCount:0, cashBalance:0 })
  const [recent, setRecent] = useState<RecentTx[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState<'month' | 'quarter' | 'year'>('month')

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id, period])

  async function loadData() {
    if (!tenant) return
    setLoading(true)

    const now = new Date()
    let fromDate: string
    if (period === 'month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    } else if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      fromDate = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0]
    } else {
      fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    }

    const [invRes, purRes, expRes, trxRes] = await Promise.all([
      supabase.from('finance_invoices').select('total_amount, status, due_date, invoice_date')
        .eq('tenant_id', tenant.id).gte('invoice_date', fromDate),
      supabase.from('purchases').select('total_amount, status')
        .eq('tenant_id', tenant.id).gte('created_at', fromDate),
      supabase.from('finance_expenses').select('amount')
        .eq('tenant_id', tenant.id).gte('expense_date', fromDate),
      supabase.from('finance_treasury').select('type, amount, description, transaction_date, id')
        .eq('tenant_id', tenant.id).order('transaction_date', { ascending: false }).limit(10),
    ])

    const invoices    = invRes.data || []
    const purchases   = purRes.data || []
    const expenses    = expRes.data || []
    const treasury    = trxRes.data || []

    const totalInvoiced   = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
    const totalCollected  = invoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
    const pendingInvoices = invoices.filter(i => i.status === 'مرسلة' || i.status === 'مسودة').reduce((s, i) => s + Number(i.total_amount), 0)
    const pendingCount    = invoices.filter(i => i.status === 'مرسلة' || i.status === 'مسودة').length
    const today = new Date().toISOString().split('T')[0]
    const overdueCount    = invoices.filter(i => i.status !== 'مدفوعة' && i.due_date && i.due_date < today).length
    const totalPurchases  = purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0)
    const totalExpenses   = expenses.reduce((s, e) => s + Number(e.amount), 0)

    // رصيد الخزينة
    const cashIn  = treasury.filter(t => t.type === 'قبض').reduce((s, t) => s + Number(t.amount), 0)
    const cashOut = treasury.filter(t => t.type === 'صرف').reduce((s, t) => s + Number(t.amount), 0)
    const cashBalance = cashIn - cashOut

    setStats({ totalInvoiced, totalCollected, totalPurchases, totalExpenses, pendingInvoices, pendingCount, overdueCount, cashBalance })

    // آخر الحركات
    setRecent(treasury.map(t => ({
      id: t.id, type: t.type, description: t.description,
      amount: Number(t.amount), date: t.transaction_date, status: t.type,
    })))

    setLoading(false)
  }

  const netProfit = stats.totalCollected - stats.totalPurchases - stats.totalExpenses
  const profitPct = stats.totalCollected > 0 ? Math.round((netProfit / stats.totalCollected) * 100) : 0

  const PERIOD_LABELS = { month: 'هذا الشهر', quarter: 'هذا الربع', year: 'هذا العام' }

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💰 لوحة التحكم المالية
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '2px' }}>
            نظرة شاملة على الوضع المالي
          </p>
        </div>
        {/* فلتر الفترة */}
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '10px' }}>
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s',
                background: period === p ? '#1a56db' : 'transparent',
                color: period === p ? 'white' : '#6b7280' }}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs الرئيسية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>

        {/* الإيرادات */}
        <div className="card" style={{ padding: '20px', borderTop: '3px solid #1a56db' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '6px' }}>إجمالي الفواتير</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a56db' }}>{stats.totalInvoiced.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' }}>ريال سعودي</div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            </div>
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
            <span style={{ color: '#0ea77b' }}>✓ محصّل: {stats.totalCollected.toLocaleString()}</span>
            <span style={{ color: '#e6820a' }}>⏳ معلق: {stats.pendingInvoices.toLocaleString()}</span>
          </div>
        </div>

        {/* المشتريات */}
        <div className="card" style={{ padding: '20px', borderTop: '3px solid #e6820a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '6px' }}>المشتريات</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#e6820a' }}>{stats.totalPurchases.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' }}>ريال سعودي</div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart style={{ width: '20px', height: '20px', color: '#e6820a' }} />
            </div>
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
            <button onClick={() => router.push('/finance/purchases')}
              style={{ fontSize: '0.78rem', color: '#e6820a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              عرض التفاصيل ←
            </button>
          </div>
        </div>

        {/* المصروفات */}
        <div className="card" style={{ padding: '20px', borderTop: '3px solid #c81e1e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '6px' }}>المصروفات</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#c81e1e' }}>{stats.totalExpenses.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' }}>ريال سعودي</div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown style={{ width: '20px', height: '20px', color: '#c81e1e' }} />
            </div>
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
            <button onClick={() => router.push('/finance/expenses')}
              style={{ fontSize: '0.78rem', color: '#c81e1e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              عرض التفاصيل ←
            </button>
          </div>
        </div>

        {/* صافي الربح */}
        <div className="card" style={{ padding: '20px', borderTop: '3px solid ' + (netProfit >= 0 ? '#0ea77b' : '#c81e1e') }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '6px' }}>صافي الربح</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: netProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>
                {netProfit >= 0 ? '' : '-'}{Math.abs(netProfit).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' }}>ريال سعودي</div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: netProfit >= 0 ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {netProfit >= 0
                ? <TrendingUp style={{ width: '20px', height: '20px', color: '#0ea77b' }} />
                : <TrendingDown style={{ width: '20px', height: '20px', color: '#c81e1e' }} />}
            </div>
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6', fontSize: '0.78rem', color: netProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>
            هامش الربح: {profitPct}%
          </div>
        </div>
      </div>

      {/* الصف الثاني */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>

        {/* رصيد الخزينة */}
        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #1a56db, #3b82f6)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', opacity: 0.8, marginBottom: '6px' }}>رصيد الخزينة</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.cashBalance.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '2px' }}>ريال سعودي</div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet style={{ width: '20px', height: '20px', color: 'white' }} />
            </div>
          </div>
          <button onClick={() => router.push('/finance/treasury')}
            style={{ marginTop: '14px', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
            فتح الخزينة →
          </button>
        </div>

        {/* الفواتير المعلقة */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>الفواتير المعلقة</span>
            <span style={{ background: '#fffbeb', color: '#e6820a', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>{stats.pendingCount} فاتورة</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fffbeb', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#e6820a' }}>
                <Clock style={{ width: '14px', height: '14px' }} /> معلقة
              </div>
              <span style={{ fontWeight: 700, color: '#e6820a' }}>{stats.pendingInvoices.toLocaleString()} ر.س</span>
            </div>
            {stats.overdueCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fef2f2', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#c81e1e' }}>
                  <AlertCircle style={{ width: '14px', height: '14px' }} /> متأخرة
                </div>
                <span style={{ fontWeight: 700, color: '#c81e1e' }}>{stats.overdueCount} فاتورة</span>
              </div>
            )}
          </div>
          <button onClick={() => router.push('/finance/invoices')}
            style={{ marginTop: '14px', width: '100%', padding: '7px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#1a56db' }}>
            إدارة الفواتير
          </button>
        </div>

        {/* روابط سريعة */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '14px' }}>إجراءات سريعة</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: '➕ فاتورة مبيعات جديدة', color: '#1a56db', bg: '#eff6ff', href: '/finance/invoices?new=1' },
              { label: '🧾 إضافة مصروف',         color: '#c81e1e', bg: '#fef2f2', href: '/finance/expenses?new=1' },
              { label: '💵 قبض مبلغ',             color: '#0ea77b', bg: '#ecfdf5', href: '/finance/treasury?type=قبض' },
              { label: '💸 صرف مبلغ',             color: '#e6820a', bg: '#fffbeb', href: '/finance/treasury?type=صرف' },
            ].map(a => (
              <button key={a.label} onClick={() => router.push(a.href)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'right', background: a.bg, color: a.color, fontWeight: 600, fontSize: '0.82rem', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* آخر حركات الخزينة */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>آخر حركات الخزينة</div>
          <button onClick={() => router.push('/finance/treasury')}
            style={{ fontSize: '0.78rem', color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer' }}>
            عرض الكل ←
          </button>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            لا توجد حركات بعد
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['النوع','البيان','المبلغ','التاريخ'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                        background: r.type === 'قبض' ? '#ecfdf5' : '#fef2f2',
                        color: r.type === 'قبض' ? '#0ea77b' : '#c81e1e' }}>
                        {r.type === 'قبض' ? <ArrowUpRight style={{ width: '12px', height: '12px' }} /> : <ArrowDownRight style={{ width: '12px', height: '12px' }} />}
                        {r.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>{r.description}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: r.type === 'قبض' ? '#0ea77b' : '#c81e1e' }}>
                      {r.type === 'قبض' ? '+' : '-'}{r.amount.toLocaleString()} ر.س
                    </td>
                    <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: '0.82rem' }}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
