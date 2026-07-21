'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { fetchMeasureProjects, type MeasureProject } from '@/lib/project-measure-service'
import { MeasureContext, type MeasureContextValue } from './MeasureContext'

export default function MeasureLayout({ children }: { children: React.ReactNode }) {
  const { tenant, activeBranch } = useStore()
  const pathname = usePathname()
  const isProjectDetail = /\/projects\/measure\/\d+/.test(pathname || '')

  const [projects, setProjects] = useState<MeasureProject[]>([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ total: 0, ready: 0, inProgress: 0 })

  const reload = useCallback(async () => {
    if (!tenant) return
    const { data } = await fetchMeasureProjects(tenant.id, activeBranch?.id)
    const list = data || []
    setProjects(list)
    setKpis({
      total: list.length,
      ready: list.filter(p => p.measureProgress?.isComplete).length,
      inProgress: list.filter(p => !p.measureProgress?.isComplete).length,
    })
  }, [tenant?.id, activeBranch?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [tenant?.id, activeBranch?.id, reload])

  useEffect(() => { reload() }, [pathname, reload])

  const ctx: MeasureContextValue = {
    tenantId: tenant?.id || null,
    branchId: activeBranch?.id || null,
    projects,
    loading,
    reload,
    kpis,
  }

  if (isProjectDetail) {
    return (
      <MeasureContext.Provider value={ctx}>
        {children}
      </MeasureContext.Provider>
    )
  }

  return (
    <MeasureContext.Provider value={ctx}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'في سلة المقايسة', value: kpis.total, color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'جاهزة للإغلاق', value: kpis.ready, color: '#0ea77b', bg: '#ecfdf5' },
            { label: 'قيد الإكمال', value: kpis.inProgress, color: '#e6820a', bg: '#fffbeb' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '16px', background: k.bg }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid var(--border)',
              borderTopColor: '#7c3aed', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : children}
      </div>
    </MeasureContext.Provider>
  )
}
