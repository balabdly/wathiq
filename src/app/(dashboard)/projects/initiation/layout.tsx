'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { fetchInitiationBasketProjects } from '@/lib/project-initiation-service'
import { ensureDefaultSecContract, fetchFrameworkBoqItems } from '@/lib/sec-workflow-service'
import { DEFAULT_SEC_CONTRACT } from '@/lib/sec-workflow'
import { InitiationContext, type InitiationProject, type FrameworkBoqRow } from './InitiationContext'

export default function InitiationLayout({ children }: { children: React.ReactNode }) {
  const { tenant, activeBranch } = useStore()
  const pathname = usePathname()

  const [projects, setProjects] = useState<InitiationProject[]>([])
  const [projectTypes, setProjectTypes] = useState<{ id: number; code: string; name: string }[]>([])
  const [frameworkItems, setFrameworkItems] = useState<FrameworkBoqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ total: 0, readyForPlanning: 0, noClient: 0, noBoq: 0 })

  const reloadShared = useCallback(async () => {
    if (!tenant) return
    const [basketRes, typesRes] = await Promise.all([
      fetchInitiationBasketProjects(tenant.id),
      supabase.from('project_types')
        .select('id, code, name')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
    ])
    setProjects(basketRes.data || [])
    setProjectTypes(typesRes.data || [])

    try {
      const contractId = await ensureDefaultSecContract(tenant.id, DEFAULT_SEC_CONTRACT)
      const { data: items } = await fetchFrameworkBoqItems(tenant.id, contractId)
      setFrameworkItems((items || []).map(i => ({
        id: i.id,
        item_code: i.item_code,
        description_ar: i.description_ar || i.description_en,
        unit: i.unit,
        unit_price: Number(i.unit_price),
      })))
    } catch {
      setFrameworkItems([])
    }
  }, [tenant?.id])

  const reloadKpis = useCallback(async () => {
    if (!tenant) return
    const { data } = await fetchInitiationBasketProjects(tenant.id)
    const list = data || []
    setKpis({
      total: list.length,
      readyForPlanning: list.filter(p => p.client_id).length,
      noClient: list.filter(p => !p.client_id).length,
      noBoq: 0,
    })
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    Promise.all([reloadShared(), reloadKpis()]).finally(() => setLoading(false))
  }, [tenant?.id, reloadShared, reloadKpis])

  useEffect(() => { reloadKpis() }, [pathname, reloadKpis])

  const isDetail = /\/projects\/initiation\/\d+/.test(pathname || '')

  return (
    <InitiationContext.Provider value={{
      tenantId: tenant?.id || null,
      branchId: activeBranch?.id || null,
      projects,
      projectTypes,
      frameworkItems,
      loading,
      reloadShared,
      reloadKpis,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!isDetail && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'في سلة البدء', value: kpis.total, color: '#1a56db', bg: '#eff6ff' },
              { label: 'جاهز للتخطيط', value: kpis.readyForPlanning, color: '#0ea77b', bg: '#ecfdf5' },
              { label: 'بدون عميل', value: kpis.noClient, color: '#e6820a', bg: '#fffbeb' },
              { label: 'بدون كميات', value: kpis.noBoq, color: '#c81e1e', bg: '#fef2f2' },
            ].map(kpi => (
              <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid var(--border)',
              borderTopColor: '#1a56db', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : children}
      </div>
    </InitiationContext.Provider>
  )
}
