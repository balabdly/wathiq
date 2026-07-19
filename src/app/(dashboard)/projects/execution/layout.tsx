'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { fetchExecutionProjects, type ExecutionProject } from '@/lib/project-execution-service'
import { HardHat } from 'lucide-react'
import { ExecutionContext, type ExecutionContextValue } from './ExecutionContext'

export default function ExecutionLayout({ children }: { children: React.ReactNode }) {
  const { tenant, activeBranch } = useStore()
  const pathname = usePathname()
  const isProjectDetail = /\/projects\/execution\/\d+/.test(pathname || '')

  const [projects, setProjects] = useState<ExecutionProject[]>([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ total: 0, assigned: 0, unassigned: 0 })

  const reload = useCallback(async () => {
    if (!tenant) return
    const { data } = await fetchExecutionProjects(tenant.id, activeBranch?.id)
    const list = data || []
    setProjects(list)
    setKpis({
      total: list.length,
      assigned: list.filter(p => p.team_id).length,
      unassigned: list.filter(p => !p.team_id).length,
    })
  }, [tenant?.id, activeBranch?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [tenant?.id, activeBranch?.id, reload])

  useEffect(() => { reload() }, [pathname, reload])

  const ctx: ExecutionContextValue = {
    tenantId: tenant?.id || null,
    branchId: activeBranch?.id || null,
    projects,
    loading,
    reload,
    kpis,
  }

  if (isProjectDetail) {
    return (
      <ExecutionContext.Provider value={ctx}>
        {children}
      </ExecutionContext.Provider>
    )
  }

  return (
    <ExecutionContext.Provider value={ctx}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardHat style={{ width: '20px', height: '20px', color: '#e6820a' }} />
            مرحلة تنفيذ المشروع
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
            إسناد الفرق — متابعة الإنجاز اليومي — استعراض خطط التخطيط
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'مشاريع قيد التنفيذ', value: kpis.total, color: '#e6820a', bg: '#fffbeb' },
            { label: 'مسندة لفرق', value: kpis.assigned, color: '#0ea77b', bg: '#ecfdf5' },
            { label: 'بانتظار الإسناد', value: kpis.unassigned, color: '#c81e1e', bg: '#fef2f2' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '16px', background: k.bg }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
          <Link href="/projects/execution" style={{
            padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600,
            textDecoration: 'none', transition: 'all 0.2s',
            background: pathname === '/projects/execution' ? '#e6820a' : 'transparent',
            color: pathname === '/projects/execution' ? 'white' : 'var(--text3)',
            boxShadow: pathname === '/projects/execution' ? '0 2px 8px #e6820a44' : 'none',
          }}>
            🏗️ قائمة المشاريع
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid var(--border)',
              borderTopColor: '#e6820a', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : children}
      </div>
    </ExecutionContext.Provider>
  )
}
