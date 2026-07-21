'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { fetchCloseProjects, type CloseProject } from '@/lib/project-close-service'
import { CloseContext, type CloseContextValue } from './CloseContext'

export default function CloseLayout({ children }: { children: React.ReactNode }) {
  const { tenant, activeBranch } = useStore()
  const pathname = usePathname()
  const isProjectDetail = /\/projects\/close\/\d+/.test(pathname || '')

  const [projects, setProjects] = useState<CloseProject[]>([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ total: 0, ready: 0, blocked: 0 })

  const reload = useCallback(async () => {
    if (!tenant) return
    const { data } = await fetchCloseProjects(tenant.id, activeBranch?.id)
    const list = data || []
    setProjects(list)
    setKpis({
      total: list.length,
      ready: list.filter(p => p.closureProgress?.isComplete).length,
      blocked: list.filter(p => {
        const b = p.blockers
        return (b?.openTasks || 0) > 0 || (b?.openNcr || 0) > 0 || (b?.missingDocs?.length || 0) > 0
      }).length,
    })
  }, [tenant?.id, activeBranch?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [tenant?.id, activeBranch?.id, reload])

  useEffect(() => { reload() }, [pathname, reload])

  const ctx: CloseContextValue = {
    tenantId: tenant?.id || null,
    branchId: activeBranch?.id || null,
    projects,
    loading,
    reload,
    kpis,
  }

  if (isProjectDetail) {
    return (
      <CloseContext.Provider value={ctx}>
        {children}
      </CloseContext.Provider>
    )
  }

  return (
    <CloseContext.Provider value={ctx}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'في سلة الإغلاق', value: kpis.total, color: '#0ea77b', bg: '#ecfdf5' },
            { label: 'جاهزة للاعتماد', value: kpis.ready, color: '#1a56db', bg: '#eff6ff' },
            { label: 'بها موانع', value: kpis.blocked, color: '#c81e1e', bg: '#fef2f2' },
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
              borderTopColor: '#0ea77b', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : children}
      </div>
    </CloseContext.Provider>
  )
}
