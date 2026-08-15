'use client'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import Link from 'next/link'
import { loadDashboardStats, type DashboardStats } from '@/lib/dashboard-stats'
import { LIFECYCLE_PHASES } from '@/lib/project-lifecycle'
import {
  FolderOpen, AlertTriangle, Package, Users, TrendingUp,
  Wallet, Building2, Clock, CheckCircle2, ArrowLeft, BarChart2,
  Truck, Shield, ShoppingCart, Eye,
} from 'lucide-react'

const fmt  = (n: number) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 0 })
const fmtK = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'م' : n >= 1000 ? (n / 1000).toFixed(1) + 'ك' : String(Math.round(n))

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
    teal:   { bg: '#f0fdfa', icon: '#0d9488', border: '#99f6e4' },
  }
  const c = colors[color] || colors.blue
  return (
    <Link href={href} style={{
      display: 'block', textDecoration: 'none', background: 'white', borderRadius: '14px',
      border: `1px solid ${c.border}`, padding: '18px 20px', transition: 'all 0.2s',
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

function SectionCard({ title, icon, href, color, bg, stats, alert }: {
  title: string
  icon: React.ReactNode
  href: string
  color: string
  bg: string
  stats: { label: string; value: string | number; warn?: boolean }[]
  alert?: string | null
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card" style={{
        padding: '18px', height: '100%', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
        borderRight: `4px solid ${color}`,
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
              {icon}
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>{title}</span>
          </div>
          <ArrowLeft style={{ width: '14px', height: '14px', color: 'var(--text3)' }} />
        </div>
        {alert && (
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#c81e1e', background: '#fef2f2', borderRadius: '6px', padding: '6px 10px', marginBottom: '10px' }}>
            ⚠ {alert}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {stats.map(st => (
            <div key={st.label} style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: st.warn ? '#c81e1e' : color }}>{st.value}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '2px' }}>{st.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}

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

export default function DashboardPage() {
  const { currentUser, tenant } = useStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const perms: string[] = currentUser?.permissions || []
  const tenantModules = (tenant as { modules?: Record<string, boolean> })?.modules || {}

  const access = useMemo(() => ({
    projects:  perms.some(p => ['projects_view', 'projects_edit'].includes(p)) && tenantModules.projects !== false,
    inventory: perms.includes('inventory') && tenantModules.inventory !== false,
    qhse:      perms.includes('qhse') && tenantModules.qhse !== false,
    hr:        perms.some(p => ['hr', 'employees'].includes(p)),
    finance:   perms.includes('finance') && tenantModules.finance !== false,
    purchases: perms.includes('purchases') && tenantModules.purchases !== false,
    assets:    perms.includes('assets') && tenantModules.assets !== false,
    fleet:     (perms.includes('assets') || perms.includes('hr_self') || perms.includes('fleet')) && tenantModules.fleet !== false,
    visits:    perms.some(p => p.startsWith('visits')) || perms.some(p => ['projects_view', 'qhse'].includes(p)),
    reports:   perms.includes('reports'),
  }), [perms, tenantModules])

  useEffect(() => { if (tenant) loadStats() }, [tenant?.id])

  async function loadStats() {
    if (!tenant) return
    setLoading(true)
    try {
      setStats(await loadDashboardStats(tenant.id))
    } finally {
      setLoading(false)
    }
  }

  const greeting = new Date().getHours() < 12 ? 'صباح الخير' : new Date().getHours() < 17 ? 'مساء الخير' : 'مساء النور'
  const dateStr  = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const netProfit    = (stats?.finance.monthRevenue || 0) - (stats?.finance.monthExpenses || 0)
  const profitMargin = stats?.finance.monthRevenue ? (netProfit / stats.finance.monthRevenue * 100) : 0

  const alerts = [
    ...(stats?.projects.delayed ? [{ icon: '🔴', title: `${stats.projects.delayed} مشروع متأخر`, sub: 'يحتاج مراجعة فورية', href: '/projects/monitoring' }] : []),
    ...(stats?.qhse.openNcr ? [{ icon: '⚠️', title: `${stats.qhse.openNcr} NCR معلقة`, sub: 'تحتاج إجراء تصحيحي', href: '/visits' }] : []),
    ...(stats?.inventory.lowStock ? [{ icon: '📦', title: `${stats.inventory.lowStock} مادة منخفضة`, sub: 'تحت حد الأمان', href: '/inventory/materials' }] : []),
    ...(stats?.hr.pendingLeaves ? [{ icon: '📋', title: `${stats.hr.pendingLeaves} طلب إجازة`, sub: 'تنتظر الموافقة', href: '/hr/leaves' }] : []),
    ...(stats?.finance.unpaidInvoices ? [{ icon: '💰', title: `${fmtK(stats.finance.unpaidInvoices)} ر.س غير محصّلة`, sub: 'فواتير عملاء معتمدة', href: '/finance/invoices' }] : []),
    ...(stats?.hr.expiringIqama ? [{ icon: '🪪', title: `${stats.hr.expiringIqama} إقامة تنتهي قريباً`, sub: 'خلال 60 يوم', href: '/hr' }] : []),
    ...(stats?.fleet.expiringDocs ? [{ icon: '📄', title: `${stats.fleet.expiringDocs} وثيقة أسطول`, sub: 'منتهية أو قريبة الانتهاء', href: '/fleet/compliance' }] : []),
    ...(stats?.fleet.openWorkOrders ? [{ icon: '🔧', title: `${stats.fleet.openWorkOrders} أمر عمل مفتوح`, sub: 'صيانة الأسطول', href: '/fleet/maintenance' }] : []),
    ...(stats?.qhse.openCapa ? [{ icon: '📝', title: `${stats.qhse.openCapa} إجراء تصحيحي مفتوح`, sub: 'CAPA — الجودة', href: '/qhse/quality' }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a2e' }}>
            {greeting}، {currentUser?.name.split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '3px' }}>{dateStr}</p>
        </div>
        {access.reports && (
          <Link href="/reports" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--primary)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
            <BarChart2 style={{ width: '15px', height: '15px' }} />
            التقارير
          </Link>
        )}
      </div>

      {/* ملخص مالي */}
      {access.finance && stats && (
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
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {[
              { label: 'إيرادات الشهر', value: fmtK(stats.finance.monthRevenue) + ' ر.س' },
              { label: 'مصروفات الشهر', value: fmtK(stats.finance.monthExpenses) + ' ر.س' },
              { label: 'الرصيد النقدي', value: fmtK(stats.finance.cashBalance) + ' ر.س' },
              { label: 'هامش الربح', value: fmtK(Math.abs(profitMargin)) + '%' },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>{item.value}</div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', marginTop: '3px' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs سريعة */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
          مؤشرات سريعة
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {access.projects && (
            <KpiCard label="المشاريع النشطة" value={stats?.projects.active || 0}
              sub={stats?.projects.delayed ? `⚠ ${stats.projects.delayed} متأخر` : '✅ كلها في الوقت'}
              subOk={!stats?.projects.delayed} icon={<FolderOpen style={{ width: '18px', height: '18px' }} />} color="blue" href="/projects/monitoring" />
          )}
          {access.qhse && (
            <KpiCard label="NCR معلقة" value={stats?.qhse.openNcr || 0}
              sub={stats?.qhse.openNcr ? 'تحتاج إجراء تصحيحي' : '✅ لا توجد ملاحظات'}
              subOk={!stats?.qhse.openNcr} icon={<AlertTriangle style={{ width: '18px', height: '18px' }} />} color={stats?.qhse.openNcr ? 'red' : 'green'} href="/visits" />
          )}
          {access.inventory && (
            <KpiCard label="مواد منخفضة" value={stats?.inventory.lowStock || 0}
              sub={stats?.inventory.lowStock ? 'تحت حد الأمان' : '✅ المخزون آمن'}
              subOk={!stats?.inventory.lowStock} icon={<Package style={{ width: '18px', height: '18px' }} />} color={stats?.inventory.lowStock ? 'amber' : 'green'} href="/inventory/materials" />
          )}
          {access.hr && (
            <KpiCard label="إجمالي الموظفين" value={stats?.hr.totalEmployees || 0}
              sub={stats?.hr.pendingLeaves ? `${stats.hr.pendingLeaves} طلب إجازة معلق` : '✅ لا طلبات معلقة'}
              subOk={!stats?.hr.pendingLeaves} icon={<Users style={{ width: '18px', height: '18px' }} />} color="purple" href="/hr/dashboard" />
          )}
          {access.fleet && (
            <KpiCard label="أسطول متاح" value={`${stats?.fleet.available || 0}/${stats?.fleet.totalUnits || 0}`}
              sub={stats?.fleet.openWorkOrders ? `${stats.fleet.openWorkOrders} أمر عمل مفتوح` : '✅ لا صيانة معلقة'}
              subOk={!stats?.fleet.openWorkOrders} icon={<Truck style={{ width: '18px', height: '18px' }} />} color="teal" href="/fleet" />
          )}
          {access.finance && (
            <KpiCard label="فواتير غير محصّلة" value={fmtK(stats?.finance.unpaidInvoices || 0) + ' ر.س'}
              sub="فواتير عملاء معتمدة" subOk={!(stats?.finance.unpaidInvoices)}
              icon={<TrendingUp style={{ width: '18px', height: '18px' }} />} color="green" href="/finance/invoices" />
          )}
        </div>
      </div>

      {/* بطاقات الأقسام */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
          نظرة على جميع الأقسام
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {access.projects && stats && (
            <SectionCard title="إدارة المشاريع" href="/projects/monitoring" color="#1a56db" bg="#eff6ff"
              icon={<FolderOpen style={{ width: '20px', height: '20px' }} />}
              alert={stats.projects.delayed ? `${stats.projects.delayed} مشروع متأخر` : null}
              stats={[
                { label: 'نشطة', value: stats.projects.active },
                { label: 'مكتملة', value: stats.projects.completed },
                { label: 'مخاطر مسجّلة', value: stats.projects.openRisks },
                { label: 'دروس مستفادة', value: stats.projects.lessons },
                ...LIFECYCLE_PHASES.map(p => ({
                  label: p.label.replace(' المشروع', ''),
                  value: stats.projects.byPhase[p.id] || 0,
                })),
              ]}
            />
          )}

          {access.inventory && stats && (
            <SectionCard title="المخزون" href="/inventory/materials" color="#7c3aed" bg="#f5f3ff"
              icon={<Package style={{ width: '20px', height: '20px' }} />}
              alert={stats.inventory.lowStock ? `${stats.inventory.lowStock} مادة تحت حد الأمان` : null}
              stats={[
                { label: 'مستودعات', value: stats.inventory.warehouses },
                { label: 'أصناف', value: stats.inventory.materials },
                { label: 'منخفضة', value: stats.inventory.lowStock, warn: stats.inventory.lowStock > 0 },
                { label: 'عهدة مفتوحة', value: stats.inventory.projectCustody },
              ]}
            />
          )}

          {access.qhse && stats && (
            <SectionCard title="السلامة والجودة (QHSE)" href="/qhse" color="#c81e1e" bg="#fef2f2"
              icon={<Shield style={{ width: '20px', height: '20px' }} />}
              alert={stats.qhse.openNcr ? `${stats.qhse.openNcr} NCR معلقة` : null}
              stats={[
                { label: 'حوادث مسجّلة', value: stats.qhse.incidents },
                { label: 'NCR مفتوحة', value: stats.qhse.openNcr, warn: stats.qhse.openNcr > 0 },
                { label: 'CAPA مفتوحة', value: stats.qhse.openCapa, warn: stats.qhse.openCapa > 0 },
                { label: 'زيارات معلقة', value: stats.qhse.openVisits },
              ]}
            />
          )}

          {access.hr && stats && (
            <SectionCard title="الموارد البشرية" href="/hr/dashboard" color="#7c3aed" bg="#f5f3ff"
              icon={<Users style={{ width: '20px', height: '20px' }} />}
              alert={stats.hr.expiringIqama ? `${stats.hr.expiringIqama} إقامة تنتهي قريباً` : null}
              stats={[
                { label: 'موظفون نشطون', value: stats.hr.totalEmployees },
                { label: 'إجازات معلقة', value: stats.hr.pendingLeaves, warn: stats.hr.pendingLeaves > 0 },
                { label: 'رواتب مسودة', value: stats.hr.draftPayrolls },
                { label: 'إقامات تنتهي', value: stats.hr.expiringIqama, warn: stats.hr.expiringIqama > 0 },
              ]}
            />
          )}

          {access.finance && stats && (
            <SectionCard title="المالية والمحاسبة" href="/finance" color="#0ea77b" bg="#ecfdf5"
              icon={<Wallet style={{ width: '20px', height: '20px' }} />}
              alert={stats.finance.unpaidInvoices ? `${fmtK(stats.finance.unpaidInvoices)} ر.س غير محصّلة` : null}
              stats={[
                { label: 'إيرادات الشهر', value: fmtK(stats.finance.monthRevenue) },
                { label: 'مصروفات الشهر', value: fmtK(stats.finance.monthExpenses) },
                { label: 'الرصيد النقدي', value: fmtK(stats.finance.cashBalance) },
                { label: 'فواتير موردين', value: fmtK(stats.finance.unpaidVendorInvoices) },
              ]}
            />
          )}

          {(access.purchases || access.finance) && stats && (
            <SectionCard title="المشتريات" href="/finance/purchases" color="#e6820a" bg="#fffbeb"
              icon={<ShoppingCart style={{ width: '20px', height: '20px' }} />}
              alert={stats.finance.openPurchaseOrders ? `${stats.finance.openPurchaseOrders} أمر شراء مفتوح` : null}
              stats={[
                { label: 'أوامر شراء مفتوحة', value: stats.finance.openPurchaseOrders },
                { label: 'فواتير موردين', value: fmtK(stats.finance.unpaidVendorInvoices) },
                { label: 'مصروفات الشهر', value: fmtK(stats.finance.monthExpenses) },
                { label: '—', value: '—' },
              ]}
            />
          )}

          {access.assets && stats && (
            <SectionCard title="الأصول الثابتة" href="/assets" color="#1e3a5f" bg="#eff6ff"
              icon={<Building2 style={{ width: '20px', height: '20px' }} />}
              stats={[
                { label: 'إجمالي الأصول', value: stats.assets.total },
                { label: 'أصول نشطة', value: stats.assets.active },
                { label: 'القيمة الدفترية', value: fmtK(stats.assets.bookValue) },
                { label: 'صيانة الشهر', value: fmtK(stats.assets.maintenanceThisMonth) },
              ]}
            />
          )}

          {access.fleet && stats && (
            <SectionCard title="إدارة الأسطول" href="/fleet" color="#0d9488" bg="#f0fdfa"
              icon={<Truck style={{ width: '20px', height: '20px' }} />}
              alert={stats.fleet.expiringDocs ? `${stats.fleet.expiringDocs} وثيقة تحتاج تجديد` : null}
              stats={[
                { label: 'إجمالي الوحدات', value: stats.fleet.totalUnits },
                { label: 'متاح للتشغيل', value: stats.fleet.available },
                { label: 'أوامر عمل', value: stats.fleet.openWorkOrders, warn: stats.fleet.openWorkOrders > 0 },
                { label: 'وقود الشهر', value: fmtK(stats.fleet.fuelMonthCost) },
              ]}
            />
          )}

          {access.visits && stats && (
            <SectionCard title="الزيارات الميدانية" href="/visits" color="#374151" bg="#f9fafb"
              icon={<Eye style={{ width: '20px', height: '20px' }} />}
              alert={stats.visits.open ? `${stats.visits.open} زيارة لم تُعتمد بعد` : null}
              stats={[
                { label: 'زيارات الشهر', value: stats.visits.thisMonth },
                { label: 'معلقة', value: stats.visits.open, warn: stats.visits.open > 0 },
                { label: 'سلامة', value: stats.visits.safety },
                { label: 'جودة', value: stats.visits.quality },
              ]}
            />
          )}

          {access.reports && (
            <SectionCard title="التقارير" href="/reports" color="#1a56db" bg="#eff6ff"
              icon={<BarChart2 style={{ width: '20px', height: '20px' }} />}
              stats={[
                { label: 'تنفيذية', value: '←' },
                { label: 'مالية', value: '←' },
                { label: 'مشاريع', value: '←' },
                { label: 'QHSE', value: '←' },
              ]}
            />
          )}
        </div>
      </div>

      {/* تنبيهات + مواعيد + فواتير */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '15px', height: '15px', color: '#c81e1e' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>تنبيهات عاجلة</span>
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: '32px', height: '32px', color: '#0ea77b', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>لا توجد تنبيهات</p>
              </div>
            ) : alerts.map((item, i) => <AlertItem key={i} {...item} />)}
          </div>
        </div>

        {access.projects && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock style={{ width: '15px', height: '15px', color: '#1a56db' }} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>مواعيد التسليم القادمة</span>
            </div>
            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
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
                  href="/projects/monitoring"
                />
              ))}
            </div>
          </div>
        )}

        {access.finance && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp style={{ width: '15px', height: '15px', color: '#0ea77b' }} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>آخر الفواتير</span>
              </div>
              <Link href="/finance/invoices" style={{ fontSize: '0.72rem', color: 'var(--primary)', textDecoration: 'none' }}>كل الفواتير</Link>
            </div>
            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
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
        )}
      </div>

      {/* وصول سريع */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.5px', marginBottom: '10px' }}>
          وصول سريع
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
          {[
            access.projects  && { label: 'المتابعة',       icon: '📊', href: '/projects/monitoring' },
            access.projects  && { label: 'حياة المشروع',   icon: '🔄', href: '/projects/initiation/projects' },
            access.inventory && { label: 'المخزون',        icon: '📦', href: '/inventory/materials' },
            access.qhse      && { label: 'QHSE',           icon: '🛡️', href: '/qhse' },
            access.hr        && { label: 'الموارد البشرية', icon: '👥', href: '/hr/dashboard' },
            access.finance   && { label: 'فاتورة جديدة',   icon: '🧾', href: '/finance/invoices' },
            access.finance   && { label: 'مصروف',          icon: '💸', href: '/finance/expenses' },
            (access.purchases || access.finance) && { label: 'أمر شراء', icon: '🛒', href: '/finance/purchases' },
            access.assets    && { label: 'الأصول',         icon: '🏢', href: '/assets' },
            access.fleet     && { label: 'الأسطول',        icon: '🚛', href: '/fleet' },
            access.visits    && { label: 'زيارة ميدانية',  icon: '🔍', href: '/visits' },
            access.reports   && { label: 'التقارير',       icon: '📈', href: '/reports' },
          ].filter(Boolean).map(item => item && (
            <Link key={item.label} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              padding: '16px 10px', background: 'white', borderRadius: '12px',
              border: '1px solid var(--border)', textDecoration: 'none', transition: 'all 0.2s',
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
