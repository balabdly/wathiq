'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  FolderOpen, AlertTriangle, Package, Users,
  TrendingUp, TrendingDown, Wallet, Building2,
  Clock, CheckCircle2, ArrowLeft, BarChart2
} from 'lucide-react'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Stats = {
  // المشاريع
  activeProjects:  number
  delayedProjects: number
  // المالية
  monthRevenue:    number
  monthExpenses:   number
  cashBalance:     number
  unpaidInvoices:  number
  // HR
  totalEmployees:  number
  pendingLeaves:   number
  // المخزون
  lowMaterials:    number
  // الأصول
  totalAssetsBook: number
  // QHSE
  openNcr:         number
  // تنبيهات
  upcomingDeadlines: { name: string; daysLeft: number; id: number }[]
  recentInvoices:    { number: string; client: string; amount: number; date: string }[]
}

const fmt  = (n: number) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 0 })
const fmtK = (n: number) => n >= 1000000 ? (n/1000000).toFixed(1) + 'م' : n >= 1000 ? (n/1000).toFixed(1) + 'ك' : String(Math.round(n))

// ════════════════════════════════════════
// مكوّن: KPI Card
// ════════════════════════════════════════
function KpiCard({ label, value, sub, subOk, icon, color, href }: {
  label: string; value: string | number; sub: string; subOk: boolean
  icon: React.ReactNode; color: string; href: string
}) {
  const colors: Record<string, { bg: string; icon: string; border: string }> = {
    blue:   { bg: '#eff6ff', icon: '#1a56db', border: '#bfdbfe' },
    green:  { bg: '#ecfdf5', icon: '#0ea77b', border: '#a7f3d0' },
    red:    { bg: '#fef2f2', icon: '#c81e1e', border: '#fecaca' },
    amber:  { bg: '#fffbeb', icon: '#e6820a', border: '#fde68a' },
    purple: { bg: '#f5f3ff', icon: '#7c3aed', border: '#ddd6fe' },
    navy:   { bg: '#eff6ff', icon: '#1e3a5f', border: '#bfdbfe' },
  }
  const c = colors[color] || colors.blue
  return (
    <Link href={href} style={{
      display: 'block', textDecoration: 'none',
      background: 'white', borderRadius: '14px',
      border: `1px solid ${c.border}`,
      padding: '18px 20px',
      transition: 'all 0.2s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>{label}</span>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.icon }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a2e', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', marginTop: '6px', color: subOk ? '#0ea77b' : '#e6820a', fontWeight: 600 }}>{sub}</div>
    </Link>
  )
}

// ════════════════════════════════════════
// مكوّن: Alert Item
// ════════════════════════════════════════
function AlertItem({ icon, title, sub, href }: { icon: string; title: string; sub: string; href: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', textDecoration: 'none', borderBottom: '1px solid var(--bg2)', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '2px' }}>{sub}</div>
      </div>
      <ArrowLeft style={{ width: '14px', height: '14px', color: 'var(--text3)', flexShrink: 0 }} />
    </Link>
  )
}

// ════════════════════════════════════════
// مكوّن: Mini Bar Chart (SVG)
// ════════════════════════════════════════
function MiniBar({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '40px' }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, background: i === data.length - 1 ? color : color + '55',
          borderRadius: '3px 3px 0 0',
          height: `${Math.max(10, (v / max) * 100)}%`,
          transition: 'height 0.3s',
        }} />
      ))}
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function DashboardPage() {
  const { currentUser, tenant, projects, visits, materials } = useStore()
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (tenant) loadStats() }, [tenant?.id])

  async function loadStats() {
    if (!tenant) return
    setLoading(true)
    const tid = tenant.id
    const now = new Date(); now.setHours(0,0,0,0)
    const thisMonth = now.getMonth() + 1
    const thisYear  = now.getFullYear()

    const [
      projRes, visRes, matRes, empRes, leaveRes,
      invoiceRes, expenseRes, cashRes, assetRes, payrollRes,
    ] = await Promise.all([
      supabase.from('projects').select('id,name,status,progress,end_date').eq('tenant_id', tid),
      supabase.from('visits').select('id,specs,type,resolved_report').eq('tenant_id', tid),
      supabase.from('project_materials').select('id,qty,reorder,source').eq('tenant_id', tid),
      supabase.from('hr_employees').select('id').eq('tenant_id', tid).eq('is_active', true),
      supabase.from('hr_leaves').select('id,status').eq('tenant_id', tid).eq('status', 'معلق'),
      supabase.from('finance_invoices').select('invoice_number,total_amount,status,client_name,invoice_date')
        .eq('tenant_id', tid).order('invoice_date', { ascending: false }).limit(5),
      supabase.from('finance_expenses').select('total_amount,expense_date')
        .eq('tenant_id', tid).gte('expense_date', `${thisYear}-${String(thisMonth).padStart(2,'0')}-01`),
      supabase.from('finance_cash_accounts').select('id,opening_balance').eq('tenant_id', tid),
      supabase.from('finance_assets').select('book_value').eq('tenant_id', tid).eq('status', 'نشط'),
      supabase.from('hr_payroll').select('net_salary').eq('tenant_id', tid).eq('month', thisMonth).eq('year', thisYear),
    ])

    const proj  = projRes.data  || []
    const vis   = visRes.data   || []
    const mats  = matRes.data   || []
    const invs  = invoiceRes.data || []
    const exps  = expenseRes.data || []
    const assets = assetRes.data || []

    const delayed = proj.filter(p => {
      if (p.progress >= 100) return false
      if (!p.end_date) return p.status === 'متأخر'
      return new Date(p.end_date) < now
    })

    const upcoming = proj.filter(p => {
      if (!p.end_date || p.progress >= 100) return false
      const diff = (new Date(p.end_date).getTime() - now.getTime()) / 86400000
      return diff >= 0 && diff <= 30
    }).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime()).slice(0, 5)

    // الإيرادات = فواتير شهر الحالي
    const monthRevenue  = invs.filter(i => {
      if (!i.invoice_date) return false
      const d = new Date(i.invoice_date)
      return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear
    }).reduce((s, i) => s + Number(i.total_amount), 0)

    const monthExpenses = exps.reduce((s, e) => s + Number(e.total_amount), 0)
      + (payrollRes.data || []).reduce((s, p) => s + Number(p.net_salary), 0)

    // الرصيد النقدي
    const cashBalance = (cashRes.data || []).reduce((s, c) => s + Number(c.opening_balance), 0)

    // فواتير غير مدفوعة
    const unpaidInvoices = invs.filter(i => i.status === 'معتمدة' || i.status === 'مرسلة')
      .reduce((s, i) => s + Number(i.total_amount), 0)

    setStats({
      activeProjects:  proj.filter(p => p.status !== 'مكتمل').length,
      delayedProjects: delayed.length,
      monthRevenue,
      monthExpenses,
      cashBalance,
      unpaidInvoices,
      totalEmployees:  (empRes.data || []).length,
      pendingLeaves:   (leaveRes.data || []).length,
      lowMaterials:    mats.filter(m => m.qty <= m.reorder && m.source !== 'كهرباء').length,
      totalAssetsBook: assets.reduce((s, a) => s + Number(a.book_value), 0),
      openNcr:         vis.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length,
      upcomingDeadlines: upcoming.map(p => ({
        name: p.name, id: p.id,
        daysLeft: Math.round((new Date(p.end_date!).getTime() - now.getTime()) / 86400000),
      })),
      recentInvoices: invs.slice(0, 5).map(i => ({
        number: i.invoice_number, client: i.client_name,
        amount: Number(i.total_amount), date: i.invoice_date,
      })),
    })
    setLoading(false)
  }

  const greeting = new Date().getHours() < 12 ? 'صباح الخير' : new Date().getHours() < 17 ? 'مساء الخير' : 'مساء النور'
  const dateStr  = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const netProfit    = (stats?.monthRevenue || 0) - (stats?.monthExpenses || 0)
  const profitMargin = stats?.monthRevenue ? (netProfit / stats.monthRevenue * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ══ Header ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a2e' }}>
            {greeting}، {currentUser?.name.split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '3px' }}>{dateStr}</p>
        </div>
        <Link href="/reports" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--primary)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
          <BarChart2 style={{ width: '15px', height: '15px' }} />
          التقارير
        </Link>
      </div>

      {/* ══ KPIs — المشاريع والجودة ══ */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
          المشاريع والجودة
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <KpiCard label="المشاريع النشطة" value={stats?.activeProjects || 0}
            sub={stats?.delayedProjects ? `⚠ ${stats.delayedProjects} متأخر` : '✅ كلها في الوقت'}
            subOk={!stats?.delayedProjects} icon={<FolderOpen style={{ width: '18px', height: '18px' }} />} color="blue" href="/projects" />
          <KpiCard label="NCR معلقة" value={stats?.openNcr || 0}
            sub={stats?.openNcr ? 'تحتاج إجراء تصحيحي' : '✅ لا توجد ملاحظات'}
            subOk={!stats?.openNcr} icon={<AlertTriangle style={{ width: '18px', height: '18px' }} />} color={stats?.openNcr ? 'red' : 'green'} href="/visits" />
          <KpiCard label="مواد منخفضة" value={stats?.lowMaterials || 0}
            sub={stats?.lowMaterials ? 'تحت حد الأمان' : '✅ المخزون آمن'}
            subOk={!stats?.lowMaterials} icon={<Package style={{ width: '18px', height: '18px' }} />} color={stats?.lowMaterials ? 'amber' : 'green'} href="/inventory/materials" />
          <KpiCard label="إجمالي الموظفين" value={stats?.totalEmployees || 0}
            sub={stats?.pendingLeaves ? `${stats.pendingLeaves} طلب إجازة معلق` : '✅ لا طلبات معلقة'}
            subOk={!stats?.pendingLeaves} icon={<Users style={{ width: '18px', height: '18px' }} />} color="purple" href="/hr" />
        </div>
      </div>

      {/* ══ KPIs — المالية ══ */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
          المالية — {new Date().toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <KpiCard label="إيرادات الشهر" value={fmtK(stats?.monthRevenue || 0) + ' ر.س'}
            sub="من الفواتير المسجلة" subOk={true}
            icon={<TrendingUp style={{ width: '18px', height: '18px' }} />} color="green" href="/finance/invoices" />
          <KpiCard label="مصروفات الشهر" value={fmtK(stats?.monthExpenses || 0) + ' ر.س'}
            sub="مصروفات + رواتب" subOk={true}
            icon={<TrendingDown style={{ width: '18px', height: '18px' }} />} color="red" href="/finance/expenses" />
          <KpiCard label="الرصيد النقدي" value={fmtK(stats?.cashBalance || 0) + ' ر.س'}
            sub="إجمالي الصناديق والبنوك" subOk={(stats?.cashBalance || 0) > 0}
            icon={<Wallet style={{ width: '18px', height: '18px' }} />} color="blue" href="/finance/treasury" />
          <KpiCard label="القيمة الدفترية للأصول" value={fmtK(stats?.totalAssetsBook || 0) + ' ر.س'}
            sub="بعد الإهلاك المتراكم" subOk={true}
            icon={<Building2 style={{ width: '18px', height: '18px' }} />} color="navy" href="/assets" />
        </div>
      </div>

      {/* ══ صافي الربح — شريط ملون ══ */}
      <div style={{
        background: netProfit >= 0 ? 'linear-gradient(135deg, #0D2040, #1a56db)' : 'linear-gradient(135deg, #7f1d1d, #c81e1e)',
        borderRadius: '14px', padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', letterSpacing: '1px' }}>
            {netProfit >= 0 ? '📈 صافي الربح — هذا الشهر' : '📉 صافي الخسارة — هذا الشهر'}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>
            {fmt(Math.abs(netProfit))} <span style={{ fontSize: '1rem', fontWeight: 400 }}>ر.س</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '32px' }}>
          {[
            { label: 'هامش الربح', value: fmtK(Math.abs(profitMargin)) + '%' },
            { label: 'فواتير غير محصّلة', value: fmtK(stats?.unpaidInvoices || 0) + ' ر.س' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>{item.value}</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', marginTop: '3px' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ تنبيهات + مواعيد + فواتير ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>

        {/* تنبيهات عاجلة */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '15px', height: '15px', color: '#c81e1e' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>تنبيهات عاجلة</span>
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {[
              ...(stats?.delayedProjects ? [{ icon: '🔴', title: `${stats.delayedProjects} مشروع متأخر`, sub: 'يحتاج مراجعة فورية', href: '/projects' }] : []),
              ...(stats?.openNcr ? [{ icon: '⚠️', title: `${stats.openNcr} NCR معلقة`, sub: 'تحتاج إجراء تصحيحي', href: '/visits' }] : []),
              ...(stats?.lowMaterials ? [{ icon: '📦', title: `${stats.lowMaterials} مادة منخفضة`, sub: 'تحت حد الأمان', href: '/inventory/materials' }] : []),
              ...(stats?.pendingLeaves ? [{ icon: '📋', title: `${stats.pendingLeaves} طلب إجازة`, sub: 'تنتظر الموافقة', href: '/hr' }] : []),
            ].length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: '32px', height: '32px', color: '#0ea77b', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>لا توجد تنبيهات</p>
              </div>
            ) : [
              ...(stats?.delayedProjects ? [{ icon: '🔴', title: `${stats.delayedProjects} مشروع متأخر`, sub: 'يحتاج مراجعة فورية', href: '/projects' }] : []),
              ...(stats?.openNcr ? [{ icon: '⚠️', title: `${stats.openNcr} NCR معلقة`, sub: 'تحتاج إجراء تصحيحي', href: '/visits' }] : []),
              ...(stats?.lowMaterials ? [{ icon: '📦', title: `${stats.lowMaterials} مادة منخفضة`, sub: 'تحت حد الأمان', href: '/inventory/materials' }] : []),
              ...(stats?.pendingLeaves ? [{ icon: '📋', title: `${stats.pendingLeaves} طلب إجازة`, sub: 'تنتظر الموافقة', href: '/hr' }] : []),
              ...(stats?.unpaidInvoices ? [{ icon: '💰', title: `${fmtK(stats.unpaidInvoices)} ر.س غير محصّلة`, sub: 'فواتير معتمدة مع العملاء', href: '/finance/invoices' }] : []),
            ].map((item, i) => <AlertItem key={i} {...item} />)}
          </div>
        </div>

        {/* مواعيد التسليم */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock style={{ width: '15px', height: '15px', color: '#1a56db' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>مواعيد التسليم القادمة</span>
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {!stats?.upcomingDeadlines?.length ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: '32px', height: '32px', color: '#0ea77b', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>لا مواعيد خلال 30 يوم</p>
              </div>
            ) : stats.upcomingDeadlines.map((d, i) => (
              <AlertItem key={i}
                icon={d.daysLeft === 0 ? '🔴' : d.daysLeft <= 7 ? '🟠' : d.daysLeft <= 14 ? '🟡' : '🟢'}
                title={d.name}
                sub={d.daysLeft === 0 ? 'اليوم!' : d.daysLeft === 1 ? 'غداً' : `${d.daysLeft} يوم`}
                href={`/projects`}
              />
            ))}
          </div>
        </div>

        {/* آخر الفواتير */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp style={{ width: '15px', height: '15px', color: '#0ea77b' }} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>آخر الفواتير</span>
            </div>
            <Link href="/finance/invoices" style={{ fontSize: '0.72rem', color: 'var(--primary)', textDecoration: 'none' }}>كل الفواتير</Link>
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {!stats?.recentInvoices?.length ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>لا توجد فواتير</p>
              </div>
            ) : stats.recentInvoices.map((inv, i) => (
              <AlertItem key={i}
                icon="🧾"
                title={`${inv.client} — ${fmtK(inv.amount)} ر.س`}
                sub={`${inv.number} · ${inv.date}`}
                href="/finance/invoices"
              />
            ))}
          </div>
        </div>
      </div>

      {/* ══ روابط سريعة ══ */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.5px', marginBottom: '10px' }}>
          وصول سريع
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          {[
            { label: 'مشروع جديد',    icon: '🏗️', href: '/projects' },
            { label: 'فاتورة جديدة',  icon: '🧾', href: '/finance/invoices' },
            { label: 'مصروف جديد',    icon: '💸', href: '/finance/expenses' },
            { label: 'أمر شراء',      icon: '🛒', href: '/finance/purchases' },
            { label: 'تسجيل إجازة',   icon: '📅', href: '/hr' },
            { label: 'زيارة ميدانية', icon: '🔍', href: '/visits' },
          ].map(item => (
            <Link key={item.label} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              padding: '16px 10px', background: 'white', borderRadius: '12px',
              border: '1px solid var(--border)', textDecoration: 'none',
              transition: 'all 0.2s', cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.background = '#eff6ff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'white' }}>
              <span style={{ fontSize: '22px' }}>{item.icon}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
