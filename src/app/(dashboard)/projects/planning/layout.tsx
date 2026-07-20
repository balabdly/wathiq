'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { fetchAllPlanningProjects } from '@/lib/project-planning-service'
import { PlanningContext, type PlanningContextValue } from './PlanningContext'

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useStore()
  const pathname = usePathname()
  const isProjectDetail = /\/projects\/planning\/\d+/.test(pathname || '')

  const [projects, setProjects] = useState<PlanningContextValue['projects']>([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ total: 0, inPlanning: 0, withPlans: 0, inExecution: 0 })

  const reload = useCallback(async () => {
    if (!tenant) return
    const { data } = await fetchAllPlanningProjects(tenant.id)
    setProjects(data || [])
  }, [tenant?.id])

  const reloadKpis = useCallback(async () => {
    if (!tenant) return
    const { data } = await fetchAllPlanningProjects(tenant.id)
    const list = data || []
    setKpis({
      total: list.length,
      inPlanning: list.filter(p => p.pmo_phase === '2_PREP').length,
      withPlans: list.filter(p => p.planning).length,
      inExecution: list.filter(p => p.pmo_phase === '3_EXEC' || p.pmo_phase === '4_MEASURE').length,
    })
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    Promise.all([reload(), reloadKpis()]).finally(() => setLoading(false))
  }, [tenant?.id, reload, reloadKpis])

  useEffect(() => { reloadKpis() }, [pathname, reloadKpis])

  const ctx: PlanningContextValue = {
    tenantId: tenant?.id || null,
    projects,
    loading,
    reload,
    reloadKpis,
    kpis,
  }

  if (isProjectDetail) {
    return (
      <PlanningContext.Provider value={ctx}>
        {children}
      </PlanningContext.Provider>
    )
  }

  return (
    <PlanningContext.Provider value={ctx}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!isProjectDetail && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'إجمالي المشاريع', value: kpis.total, color: '#0ea77b', bg: '#ecfdf5' },
              { label: 'قيد التخطيط', value: kpis.inPlanning, color: '#1a56db', bg: '#eff6ff' },
              { label: 'بخطط مسجّلة', value: kpis.withPlans, color: '#7c3aed', bg: '#f5f3ff' },
              { label: 'انتقلت للتنفيذ', value: kpis.inExecution, color: '#e6820a', bg: '#fffbeb' },
            ].map(k => (
              <div key={k.label} className="card" style={{ padding: '16px', background: k.bg }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid var(--border)',
              borderTopColor: '#0ea77b', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : children}
      </div>
    </PlanningContext.Provider>
  )
}
