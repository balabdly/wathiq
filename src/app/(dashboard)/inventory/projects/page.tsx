// src/app/(dashboard)/inventory/projects/page.tsx
// عهدة المشاريع — قائمة + صفحة تفاصيل لكل مشروع
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { fetchCustodyProjectIds } from '@/lib/project-custody-service'
import {
  FolderOpen, Search, Package, AlertTriangle, RotateCcw, Eye,
} from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

type Project = {
  id: number; name: string; status?: string; location?: string
  material_count?: number; balance_count?: number
}

export default function InventoryProjectsPage() {
  const { tenant, activeBranch } = useStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kpis, setKpis] = useState({ totalProjects: 0, totalMaterials: 0, withBalance: 0 })

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id, activeBranch?.id])

  async function loadBase() {
    if (!tenant) return
    setLoading(true)

    const [pmRes, custodyProjectIds] = await Promise.all([
      supabase.from('project_materials').select('project_id, qty_balance').eq('tenant_id', tenant.id),
      fetchCustodyProjectIds(tenant.id),
    ])

    const countByProject: Record<number, { count: number; balance: number }> = {}
    for (const row of pmRes.data || []) {
      const pid = row.project_id as number
      if (!countByProject[pid]) countByProject[pid] = { count: 0, balance: 0 }
      countByProject[pid].count++
      if (Number(row.qty_balance) > 0) countByProject[pid].balance++
    }

    const custodyIds = new Set(custodyProjectIds)

    const { data: allProjects } = await supabase.from('projects')
      .select('id, name, status, location, branch_id')
      .eq('tenant_id', tenant.id).order('name')

    let filtered = allProjects || []
    if (activeBranch?.id) {
      filtered = filtered.filter(p => p.branch_id === activeBranch.id || custodyIds.has(p.id))
    }

    const projList = filtered
      .filter(p => custodyIds.has(p.id) || p.status !== 'مكتمل')
      .map((p: Project & { branch_id?: number }) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        location: p.location,
        material_count: countByProject[p.id]?.count ?? (custodyIds.has(p.id) ? 1 : 0),
        balance_count: countByProject[p.id]?.balance ?? 0,
      }))
      .sort((a, b) => {
        const aC = custodyIds.has(a.id) ? 1 : 0
        const bC = custodyIds.has(b.id) ? 1 : 0
        if (bC !== aC) return bC - aC
        return a.name.localeCompare(b.name, 'ar')
      })

    const withBalance = (pmRes.data || []).filter(m => Number(m.qty_balance) > 0).length

    setProjects(projList)
    setKpis({
      totalProjects: projList.filter(p => custodyIds.has(p.id)).length || projList.length,
      totalMaterials: pmRes.data?.length || 0,
      withBalance,
    })
    setLoading(false)
  }

  const filtered = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderOpen style={{ width: '22px', height: '22px', color: '#0f766e' }} /> عهدة المشاريع
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>
          قائمة المشاريع — اضغط 👁 لعرض تفاصيل المواد والحركات ورقم الحجز
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'مشاريع عليها عهدة', value: kpis.totalProjects, color: '#0f766e', bg: '#f0fdfa', icon: FolderOpen },
          { label: 'إجمالي الأصناف', value: kpis.totalMaterials, color: '#1a56db', bg: '#eff6ff', icon: Package },
          { label: 'أصناف برصيد بالمخزن', value: kpis.withBalance, color: '#c81e1e', bg: '#fef2f2', icon: AlertTriangle },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: '12px', padding: '14px' }}>
            <kpi.icon style={{ width: '18px', height: '18px', color: kpi.color, marginBottom: '8px' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: '320px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم المشروع..."
            className="input" style={{ paddingRight: '32px', fontSize: '0.82rem', width: '100%' }} />
        </div>
        <button onClick={loadBase} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
          <RotateCcw style={{ width: '14px', height: '14px' }} /> تحديث
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '14px', padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏗️</div>
          <div style={{ fontWeight: 600 }}>لا توجد مشاريع عليها عهدة</div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['المشروع', 'الحالة', 'أصناف', 'برصيد', ''].map(h => (
                  <th key={h || 'action'} style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(proj => (
                <tr key={proj.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{proj.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {proj.status && (
                      <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '8px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>{proj.status}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }} dir="ltr">{proj.material_count ?? 0}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {(proj.balance_count ?? 0) > 0 ? (
                      <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '8px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                        {proj.balance_count}
                      </span>
                    ) : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'left' }}>
                    <Link href={`/inventory/projects/${proj.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '6px 12px', borderRadius: '8px', border: '1px solid #99f6e4',
                        background: '#f0fdfa', color: '#0f766e', fontWeight: 700, fontSize: '0.75rem', textDecoration: 'none',
                      }}>
                      <Eye style={{ width: '14px', height: '14px' }} /> عرض
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
