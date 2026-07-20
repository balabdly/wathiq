'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { ensureDefaultSecContract, fetchFrameworkBoqItems } from '@/lib/sec-workflow-service'
import { DEFAULT_SEC_CONTRACT } from '@/lib/sec-workflow'
import { SEC_PMO_PHASES } from '@/lib/project-phase-display'
import { InitiationContext, type InitiationProject, type FrameworkBoqRow } from './InitiationContext'

export default function InitiationLayout({ children }: { children: React.ReactNode }) {
  const { tenant, activeBranch } = useStore()
  const pathname = usePathname()

  const [projects, setProjects] = useState<InitiationProject[]>([])
  const [projectTypes, setProjectTypes] = useState<{ id: number; code: string; name: string }[]>([])
  const [frameworkItems, setFrameworkItems] = useState<FrameworkBoqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ total: 0, inStart: 0, noClient: 0, noBoq: 0 })

  const reloadShared = useCallback(async () => {
    if (!tenant) return
    const [projRes, typesRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, code, client_id, client_name, type, status, pmo_phase, estimated_value, start_date, end_date, description, created_at')
        .eq('tenant_id', tenant.id)
        .in('pmo_phase', SEC_PMO_PHASES)
        .order('created_at', { ascending: false }),
      supabase.from('project_types')
        .select('id, code, name')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
    ])
    setProjects(projRes.data || [])
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
    const { data: phaseProjects } = await supabase
      .from('projects')
      .select('id, client_id, pmo_phase')
      .eq('tenant_id', tenant.id)
      .in('pmo_phase', SEC_PMO_PHASES)

    const list = phaseProjects || []
    const ids = list.map(p => p.id)
    let noBoq = list.length

    if (ids.length > 0) {
      const { data: boqRows } = await supabase
        .from('project_boq_versions')
        .select('project_id')
        .eq('tenant_id', tenant.id)
        .eq('version_type', 'INITIAL')
        .in('project_id', ids)
      const withBoq = new Set((boqRows || []).map(r => r.project_id))
      noBoq = list.filter(p => !withBoq.has(p.id)).length
    }

    setKpis({
      total: list.length,
      inStart: list.filter(p => p.pmo_phase === '1_RECEIPT').length,
      noClient: list.filter(p => !p.client_id).length,
      noBoq,
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
              { label: 'إجمالي المشاريع', value: kpis.total, color: '#1a56db', bg: '#eff6ff' },
              { label: 'في مرحلة البدء', value: kpis.inStart, color: '#6b7280', bg: '#f9fafb' },
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
