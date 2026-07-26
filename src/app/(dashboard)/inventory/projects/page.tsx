// src/app/(dashboard)/inventory/projects/page.tsx
// عهدة المشاريع — قائمة + صفحة تفاصيل لكل مشروع
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { fetchCustodyProjectIds } from '@/lib/project-custody-service'
import { FolderOpen, Search, RotateCcw, Eye } from 'lucide-react'

type Project = {
  id: number
  name: string
  code?: string | null
  status?: string
}

export default function InventoryProjectsPage() {
  const { tenant, activeBranch } = useStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id, activeBranch?.id])

  async function loadBase() {
    if (!tenant) return
    setLoading(true)

    const custodyProjectIds = await fetchCustodyProjectIds(tenant.id)
    const custodyIds = new Set(custodyProjectIds)

    const { data: allProjects } = await supabase.from('projects')
      .select('id, name, code, status, branch_id')
      .eq('tenant_id', tenant.id).order('name')

    let filtered = allProjects || []
    if (activeBranch?.id) {
      filtered = filtered.filter(p => p.branch_id === activeBranch.id || custodyIds.has(p.id))
    }

    const projList = filtered
      .filter(p => custodyIds.has(p.id) || p.status !== 'مكتمل')
      .map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        status: p.status,
      }))
      .sort((a, b) => {
        const aC = custodyIds.has(a.id) ? 1 : 0
        const bC = custodyIds.has(b.id) ? 1 : 0
        if (bC !== aC) return bC - aC
        return (a.code || a.name).localeCompare(b.code || b.name, 'ar')
      })

    setProjects(projList)
    setLoading(false)
  }

  const filtered = projects.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  })

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
          اضغط 👁 لعرض عهدة المشروع وأذوناته
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: '320px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم أو اسم المشروع..."
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
                {['رقم المشروع', 'الحالة', ''].map(h => (
                  <th key={h || 'action'} style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(proj => (
                <tr key={proj.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1a56db' }} dir="ltr">{proj.code || '—'}</div>
                    {!proj.code && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{proj.name}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {proj.status ? (
                      <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '8px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>{proj.status}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'left', width: '56px' }}>
                    <Link href={`/inventory/projects/${proj.id}`} title="عرض العهدة"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #99f6e4',
                        background: '#f0fdfa', color: '#0f766e', textDecoration: 'none',
                      }}>
                      <Eye style={{ width: '16px', height: '16px' }} />
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
