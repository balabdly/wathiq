'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { fetchPlanningProjects } from '@/lib/project-planning-service'
import { ClipboardList } from 'lucide-react'
import { PlanningContext, type PlanningContextValue } from './PlanningContext'

const LIST_TABS = [
  { href: '/projects/planning/active', label: 'المشاريع النشطة', emoji: '📁', color: '#0ea77b' },
  { href: '/projects/planning/closed', label: 'المشاريع المغلقة', emoji: '📦', color: '#6b7280' },
]

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useStore()
  const pathname = usePathname()
  const isProjectDetail = /\/projects\/planning\/\d+/.test(pathname || '')

  const [activeProjects, setActiveProjects] = useState<PlanningContextValue['activeProjects']>([])
  const [closedProjects, setClosedProjects] = useState<PlanningContextValue['closedProjects']>([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ active: 0, withPlans: 0, closed: 0 })

  const reloadActive = useCallback(async () => {
    if (!tenant) return
    const { data } = await fetchPlanningProjects(tenant.id, 'active')
    setActiveProjects(data || [])
  }, [tenant?.id])

  const reloadClosed = useCallback(async () => {
    if (!tenant) return
    const { data } = await fetchPlanningProjects(tenant.id, 'closed')
    setClosedProjects(data || [])
  }, [tenant?.id])

  const reloadKpis = useCallback(async () => {
    if (!tenant) return
    const [activeRes, closedRes] = await Promise.all([
      fetchPlanningProjects(tenant.id, 'active'),
      fetchPlanningProjects(tenant.id, 'closed'),
    ])
    const active = activeRes.data || []
    setKpis({
      active: active.length,
      withPlans: active.filter(p => p.planning).length,
      closed: (closedRes.data || []).length,
    })
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    Promise.all([reloadActive(), reloadClosed(), reloadKpis()]).finally(() => setLoading(false))
  }, [tenant?.id, reloadActive, reloadClosed, reloadKpis])

  useEffect(() => { reloadKpis() }, [pathname, reloadKpis])

  if (isProjectDetail) {
    return (
      <PlanningContext.Provider value={{
        tenantId: tenant?.id || null, activeProjects, closedProjects, loading,
        reloadActive, reloadClosed, reloadKpis, kpis,
      }}>
        {children}
      </PlanningContext.Provider>
    )
  }

  const activeTab = LIST_TABS.find(t => pathname?.startsWith(t.href))

  return (
    <PlanningContext.Provider value={{
      tenantId: tenant?.id || null, activeProjects, closedProjects, loading,
      reloadActive, reloadClosed, reloadKpis, kpis,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList style={{ width: '20px', height: '20px', color: '#0ea77b' }} />
            مرحلة تخطيط المشروع
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
            تصريح البلدية — الخطة الزمنية — السلامة — المخاطر — الجودة — التكاليف
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'مشاريع نشطة', value: kpis.active, color: '#0ea77b', bg: '#ecfdf5' },
            { label: 'بخطط تخطيط', value: kpis.withPlans, color: '#1a56db', bg: '#eff6ff' },
            { label: 'مغلقة', value: kpis.closed, color: '#6b7280', bg: '#f3f4f6' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '16px', background: k.bg }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
          {LIST_TABS.map(t => {
            const active = pathname?.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href} style={{
                padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.2s',
                background: active ? t.color : 'transparent',
                color: active ? 'white' : 'var(--text3)',
                boxShadow: active ? `0 2px 8px ${t.color}44` : 'none',
              }}>
                {t.emoji} {t.label}
              </Link>
            )
          })}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid var(--border)',
              borderTopColor: activeTab?.color || '#0ea77b', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : children}
      </div>
    </PlanningContext.Provider>
  )
}
