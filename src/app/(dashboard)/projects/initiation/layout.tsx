'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { ensureDefaultSecContract, fetchFrameworkBoqItems } from '@/lib/sec-workflow-service'
import { DEFAULT_SEC_CONTRACT } from '@/lib/sec-workflow'
import { Rocket } from 'lucide-react'
import { InitiationContext, type InitiationProject, type FrameworkBoqRow } from './InitiationContext'

const TABS = [
  { href: '/projects/initiation/projects',   label: 'المشاريع',              emoji: '📁', color: '#1a56db' },
  { href: '/projects/initiation/quantities', label: 'كميات المشروع الابتدائية', emoji: '📋', color: '#7c3aed' },
]

export default function InitiationLayout({ children }: { children: React.ReactNode }) {
  const { tenant, activeBranch } = useStore()
  const pathname = usePathname()

  const [projects, setProjects] = useState<InitiationProject[]>([])
  const [projectTypes, setProjectTypes] = useState<{ id: number; code: string; name: string }[]>([])
  const [frameworkItems, setFrameworkItems] = useState<FrameworkBoqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ total: 0, noClient: 0, noBoq: 0 })

  const reloadShared = useCallback(async () => {
    if (!tenant) return
    const [projRes, typesRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, code, client_id, client_name, type, status, pmo_phase, estimated_value, start_date, end_date, description, created_at')
        .eq('tenant_id', tenant.id)
        .eq('pmo_phase', '1_RECEIPT')
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
      .select('id, client_id')
      .eq('tenant_id', tenant.id)
      .eq('pmo_phase', '1_RECEIPT')

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

  const activeTab = TABS.find(t => pathname?.startsWith(t.href))

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

        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Rocket style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            مرحلة بدء المشروع
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
            تسجيل المشروع — أنواع مخصصة لكل مستأجر — الكميات الابتدائية
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'مشاريع في المرحلة', value: kpis.total, color: '#1a56db', bg: '#eff6ff' },
            { label: 'بدون عميل', value: kpis.noClient, color: '#e6820a', bg: '#fffbeb' },
            { label: 'بدون كميات ابتدائية', value: kpis.noBoq, color: '#c81e1e', bg: '#fef2f2' },
          ].map(kpi => (
            <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = pathname?.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href}
                style={{
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
              borderTopColor: activeTab?.color || '#1a56db', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : children}
      </div>
    </InitiationContext.Provider>
  )
}
