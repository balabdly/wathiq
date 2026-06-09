'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  AlertTriangle, CheckCircle2, Clock, ArrowLeft,
  Receipt, ShoppingCart, Wallet, Scale
} from 'lucide-react'

type KPI = { label: string; value: string; sub?: string; color: string; bg: string; icon: any; href?: string }

export default function FinanceDashboardPage() {
  const { tenant } = useStore()
  const router     = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData]       = useState<any>({})

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const tid = tenant.id
    const today = new Date().toISOString().split('T')[0]
    const yearStart = today.substring(0, 4) + '-01-01'

    const [
      invRes, vendInvRes, expRes, cashRes, jlRes
    ] = await Promise.all([
      // فواتير المبيعات
      supabase.from('finance_invoices').select('status, total_amount, due_date').eq('tenant_id', tid),
      // فواتير الموردين
      supabase.from('finance_vendor_invoices').select('status, total_amount, due_date').eq('tenant_id', tid),
      // المصروفات هذا العام
      supabase.from('finance_expenses').select('total_amount').eq('tenant_id', tid).eq('status', 'مدفوع').gte('expense_date', yearStart),
      // الحسابات البنكية
      supabase.from('finance_accounts').select('id, code, name').eq('tenant_id', tid).in('code', ['1111','1112','1113','1114','1115']),
      // أرصدة الحسابات البنكية
      supabase.from('finance_journal_lines')
        .select('account_id, debit, credit, finance_journal_entries!inner(tenant_id)')
        .eq('finance_journal_entries.tenant_id', tid),
    ])

    const invoices    = invRes.data    || []
    const vendInvs    = vendInvRes.data || []
    const expenses    = expRes.data    || []

    // فواتير المبيعات
    const totalSales    = invoices.reduce((s: number, i: any) => s + Number(i.total_amount), 0)
    const paidSales     = invoices.filter((i: any) => i.status === 'مدفوعة').reduce((s: number, i: any) => s + Number(i.total_amount), 0)
    const unpaidSales   = invoices.filter((i: any) => ['مرسلة', 'متأخرة'].includes(i.status)).reduce((s: number, i: any) => s + Number(i.total_amount), 0)
    const overdueSales  = invoices.filter((i: any) => i.status !== 'مدفوعة' && i.due_date && i.due_date < today)

    // فواتير الموردين
    const totalPurch    = vendInvs.reduce((s: number, i: any) => s + Number(i.total_amount), 0)
    const unpaidPurch   = vendInvs.filter((i: any) => i.status === 'معتمدة').reduce((s: number, i: any) => s + Number(i.total_amount), 0)
    const overduePurch  = vendInvs.filter((i: any) => i.status === 'معتمدة' && i.due_date && i.due_date < today)

    // المصروفات
    const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.total_amount), 0)

    // أرصدة البنوك
    const cashAccounts = cashRes.data || []
    const lineMap: Record<number, { debit: number; credit: number }> = {}
    ;(jlRes.data || []).forEach((l: any) => {
      if (!lineMap[l.account_id]) lineMap[l.account_id] = { debit: 0, credit: 0 }
      lineMap[l.account_id].debit  += Number(l.debit  || 0)
      lineMap[l.account_id].credit += Number(l.credit || 0)
    })
    const totalCash = cashAccounts.reduce((s: number, a: any) => {
      const b = lineMap[a.id] || { debit: 0, credit: 0 }
      return s + (b.debit - b.credit)
    }, 0)

    setData({
      totalSales, paidSales, unpaidSales, overdueSales: overdueSales.length,
      totalPurch, unpaidPurch, overduePurch: overduePurch.length,
      totalExpenses, totalCash,
      collectRate: totalSales > 0 ? Math.round((paidSales / totalSales) * 100) : 0,
    })
    setLoading(false)
  }

  const fmt = (n: number) => n.toLocaleString('ar-SA', { maximumFractionDigits: 0 }) + ' ر.س'

  const KPIs: KPI[] = [
    { label: 'إجمالي المبيعات',    value: fmt(data.totalSales   || 0), sub: `محصّل: ${data.collectRate || 0}%`,              color: '#0ea77b', bg: '#ecfdf5', icon: TrendingUp,   href: '/finance/invoices' },
    { label: 'ذمم مدينة',          value: fmt(data.unpaidSales  || 0), sub: `${data.overdueSales || 0} فاتورة متأخرة`,     color: data.overdueSales > 0 ? '#c81e1e' : '#1a56db', bg: data.overdueSales > 0 ? '#fef2f2' : '#eff6ff', icon: Receipt, href: '/finance/invoices' },
    { label: 'ذمم دائنة',          value: fmt(data.unpaidPurch  || 0), sub: `${data.overduePurch || 0} فاتورة متأخرة`,     color: data.overduePurch > 0 ? '#c81e1e' : '#e6820a', bg: data.overduePurch > 0 ? '#fef2f2' : '#fffbeb', icon: ShoppingCart, href: '/finance/purchases' },
    { label: 'المصروفات',          value: fmt(data.totalExpenses || 0), sub: 'مصروفات مدفوعة',                              color: '#7c3aed', bg: '#f5f3ff', icon: CreditCard,  href: '/finance/expenses' },
    { label: 'السيولة النقدية',    value: fmt(data.totalCash    || 0), sub: 'إجمالي الحسابات البنكية',                     color: data.totalCash >= 0 ? '#0ea77b' : '#c81e1e', bg: data.totalCash >= 0 ? '#ecfdf5' : '#fef2f2', icon: Wallet },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign style={{ width: '20px', height: '20px', color: '#0ea77b' }} />
          لوحة المالية
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>نظرة شاملة على الوضع المالي</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0ea77b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {KPIs.map(kpi => (
              <div key={kpi.label} className="card"
                onClick={() => kpi.href && router.push(kpi.href)}
                style={{ padding: '16px', background: kpi.bg, cursor: kpi.href ? 'pointer' : 'default', transition: 'transform 0.15s' }}
                onMouseEnter={e => kpi.href && ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
                onMouseLeave={e => kpi.href && ((e.currentTarget as HTMLElement).style.transform = 'translateY(0)')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <kpi.icon style={{ width: '20px', height: '20px', color: kpi.color }} />
                  {kpi.href && <ArrowLeft style={{ width: '14px', height: '14px', color: '#9ca3af' }} />}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '4px' }}>{kpi.label}</div>
                {kpi.sub && <div style={{ fontSize: '0.7rem', color: kpi.color, marginTop: '3px', opacity: 0.8 }}>{kpi.sub}</div>}
              </div>
            ))}
          </div>

          {/* تنبيهات */}
          {(data.overdueSales > 0 || data.overduePurch > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>⚠️ تنبيهات تحتاج متابعة</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {data.overdueSales > 0 && (
                  <div onClick={() => router.push('/finance/invoices')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca', cursor: 'pointer', flex: 1, minWidth: '200px' }}>
                    <AlertTriangle style={{ width: '16px', height: '16px', color: '#c81e1e', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#c81e1e' }}>{data.overdueSales} فاتورة مبيعات متأخرة</div>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>اضغط للمراجعة والتحصيل</div>
                    </div>
                  </div>
                )}
                {data.overduePurch > 0 && (
                  <div onClick={() => router.push('/finance/purchases')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', cursor: 'pointer', flex: 1, minWidth: '200px' }}>
                    <Clock style={{ width: '16px', height: '16px', color: '#e6820a', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e6820a' }}>{data.overduePurch} فاتورة مورد متأخرة</div>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>اضغط للمراجعة والسداد</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* روابط سريعة للقوائم المالية */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px', color: '#374151' }}>
              📊 القوائم المالية
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: 'ميزان المراجعة', icon: '⚖️', color: '#1a56db', bg: '#eff6ff', tab: 'trial' },
                { label: 'قائمة الدخل',   icon: '📈', color: '#0ea77b', bg: '#ecfdf5', tab: 'income' },
                { label: 'الميزانية العمومية', icon: '🏦', color: '#7c3aed', bg: '#f5f3ff', tab: 'balance' },
              ].map(item => (
                <button key={item.tab}
                  onClick={() => router.push(`/finance/statements?tab=${item.tab}`)}
                  style={{ padding: '14px', borderRadius: '10px', border: `1px solid ${item.bg === '#eff6ff' ? '#bfdbfe' : item.bg === '#ecfdf5' ? '#bbf7d0' : '#ddd6fe'}`, background: item.bg, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{item.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: item.color }}>{item.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* وصول سريع للوحدات */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
            {[
              { label: 'فواتير المبيعات', href: '/finance/invoices',    icon: '🧾', color: '#0ea77b' },
              { label: 'المشتريات',       href: '/finance/purchases',   icon: '🛒', color: '#e6820a' },
              { label: 'المصروفات',       href: '/finance/expenses',    icon: '💳', color: '#7c3aed' },
              { label: 'الخزينة',         href: '/finance/treasury',    icon: '🏦', color: '#1a56db' },
              { label: 'الحسابات',        href: '/finance/accounting',  icon: '📒', color: '#374151' },
            ].map(link => (
              <button key={link.href}
                onClick={() => router.push(link.href)}
                style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg2)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'white')}>
                <span style={{ fontSize: '1.2rem' }}>{link.icon}</span>
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: link.color }}>{link.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
