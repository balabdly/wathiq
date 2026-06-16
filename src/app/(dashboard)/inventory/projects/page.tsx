'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  FolderOpen, Search, Package, TrendingDown,
  ChevronDown, ChevronUp, Download, AlertTriangle, RotateCcw
} from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

type ProjectMaterial = {
  id: number; project_id: number; material_id: number; warehouse_id: number
  qty_received: number; qty_issued: number; qty_balance: number
  material?: { name: string; unit: string; catalog_no?: string; sec_number?: string; mat_code?: string }
  warehouse?: { name: string }
}

type Project = { id: number; name: string; status?: string; location?: string }

export default function InventoryProjectsPage() {
  const { tenant } = useStore()

  const [projects,   setProjects]   = useState<Project[]>([])
  const [materials,  setMaterials]  = useState<Record<number, ProjectMaterial[]>>({})
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set())
  const [loadingMat, setLoadingMat] = useState<Set<number>>(new Set())

  // KPIs
  const [kpis, setKpis] = useState({ totalProjects: 0, totalMaterials: 0, lowBalance: 0 })

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id])

  async function loadBase() {
    if (!tenant) return
    setLoading(true)

    // جلب المشاريع التي عليها مواد
    const { data: pmData } = await supabase.from('project_materials')
      .select('project_id').eq('tenant_id', tenant.id)
    const projectIds = Array.from(new Set((pmData || []).map((p: any) => p.project_id)))

    if (projectIds.length === 0) { setLoading(false); return }

    const { data: projData } = await supabase.from('projects')
      .select('id, name, status, location').in('id', projectIds).order('name')

    // إجمالي المواد والمنخفضة
    const { data: allPM } = await supabase.from('project_materials')
      .select('qty_balance').eq('tenant_id', tenant.id)
    const lowBalance = (allPM || []).filter(m => Number(m.qty_balance) === 0).length

    setProjects(projData || [])
    setKpis({ totalProjects: projectIds.length, totalMaterials: allPM?.length || 0, lowBalance })
    setLoading(false)
  }

  async function loadProjectMaterials(projectId: number) {
    if (!tenant) return

    // لو البيانات محملة — فقط toggle الفتح/الإغلاق
    if (materials[projectId] !== undefined) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.has(projectId) ? next.delete(projectId) : next.add(projectId)
        return next
      })
      return
    }

    setLoadingMat(prev => new Set(Array.from(prev).concat(projectId)))

    const { data } = await supabase
      .from('project_materials')
      .select('*, material:materials(name, unit, catalog_no, sec_number, mat_code), warehouse:warehouses(name)')
      .eq('tenant_id', tenant.id)
      .eq('project_id', projectId)

    setMaterials(prev => ({ ...prev, [projectId]: data || [] }))
    setExpanded(prev => new Set(Array.from(prev).concat(projectId)))
    setLoadingMat(prev => { const next = new Set(prev); next.delete(projectId); return next })
  }

  async function refreshProject(projectId: number) {
    if (!tenant) return
    setLoadingMat(prev => new Set(Array.from(prev).concat(projectId)))
    const { data } = await supabase
      .from('project_materials')
      .select('*, material:materials(name, unit, catalog_no, sec_number, mat_code), warehouse:warehouses(name)')
      .eq('tenant_id', tenant.id)
      .eq('project_id', projectId)
    setMaterials(prev => ({ ...prev, [projectId]: data || [] }))
    setLoadingMat(prev => { const next = new Set(prev); next.delete(projectId); return next })
  }
    const mats = materials[proj.id] || []
    const headers = ['الاسم', 'رقم الكتالوج', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'الرصيد']
    const rows = mats.map(m => [
      m.material?.name || '—', m.material?.catalog_no || '—',
      m.warehouse?.name || '—', m.material?.unit || '—',
      m.qty_received, m.qty_issued, m.qty_balance,
    ])
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `مواد_${proj.name}.xls`; a.click()
  }

  const filtered = projects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* العنوان */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen style={{ width: '22px', height: '22px', color: '#0f766e' }} /> عهدة المشاريع
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>
            المواد المستلمة والمصروفة والرصيد لكل مشروع
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {[
          { label: 'مشاريع عليها مواد', value: kpis.totalProjects, color: '#0f766e', bg: '#f0fdfa', icon: FolderOpen },
          { label: 'إجمالي أصناف المواد', value: kpis.totalMaterials, color: '#1a56db', bg: '#eff6ff', icon: Package },
          { label: 'أصناف رصيدها صفر', value: kpis.lowBalance, color: '#c81e1e', bg: '#fef2f2', icon: AlertTriangle },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: '12px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <kpi.icon style={{ width: '18px', height: '18px', color: kpi.color }} />
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* البحث */}
      <div style={{ position: 'relative', maxWidth: '300px' }}>
        <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث باسم المشروع..." className="input" style={{ paddingRight: '32px', fontSize: '0.82rem' }} />
      </div>

      {/* قائمة المشاريع */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🏗️</div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>لا توجد مشاريع عليها مواد</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(proj => {
            const isExpanded = expanded.has(proj.id)
            const isLoadingMat = loadingMat.has(proj.id)
            const mats = materials[proj.id] || []
            const totalReceived = mats.reduce((s, m) => s + Number(m.qty_received), 0)
            const totalIssued   = mats.reduce((s, m) => s + Number(m.qty_issued), 0)
            const totalBalance  = mats.reduce((s, m) => s + Number(m.qty_balance), 0)
            const zeroBalance   = mats.filter(m => Number(m.qty_balance) === 0).length

            return (
              <div key={proj.id} style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
                {/* رأس المشروع */}
                <div
                  onClick={() => loadProjectMaterials(proj.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2, #f8fafc)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FolderOpen style={{ width: '20px', height: '20px', color: '#0f766e' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px', display: 'flex', gap: '10px' }}>
                        {proj.location && <span>📍 {proj.location}</span>}
                        {proj.status && <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '10px', padding: '1px 7px', fontWeight: 600 }}>{proj.status}</span>}
                      </div>
                    </div>
                  </div>

                  {/* إحصائيات سريعة — تظهر فقط إذا تم تحميل المواد */}
                  {mats.length > 0 && (
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0ea77b' }}>{mats.length}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>صنف</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0ea77b' }}>{fmt(totalReceived)}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>مستلم</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#c81e1e' }}>{fmt(totalIssued)}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>مصروف</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: totalBalance > 0 ? '#1a56db' : '#c81e1e' }}>{fmt(totalBalance)}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>الرصيد</div>
                      </div>
                      {zeroBalance > 0 && (
                        <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '20px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: 700 }}>
                          {zeroBalance} نفذت
                        </span>
                      )}
                      <button onClick={e => { e.stopPropagation(); refreshProject(proj.id) }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}
                        title="تحديث">
                        <RotateCcw style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); exportProject(proj) }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                        <Download style={{ width: '13px', height: '13px' }} />
                      </button>
                    </div>
                  )}

                  <div style={{ color: 'var(--text3)', flexShrink: 0 }}>
                    {isLoadingMat
                      ? <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      : isExpanded ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />
                    }
                  </div>
                </div>

                {/* تفاصيل المواد */}
                {isExpanded && mats.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg2, #f8fafc)' }}>
                            {['المادة', 'رقم الكتالوج', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'الرصيد', 'الحالة'].map(h => (
                              <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mats.map((m, i) => {
                            const balance  = Number(m.qty_balance)
                            const received = Number(m.qty_received)
                            const pct      = received > 0 ? Math.round((balance / received) * 100) : 0
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)', background: balance === 0 ? '#fff5f5' : 'transparent' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {m.material?.name || '—'}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a56db' }}>
                                  {m.material?.catalog_no || m.material?.sec_number || '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>
                                  {m.warehouse?.name || '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>
                                  {m.material?.unit || '—'}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: 700 }}>
                                  {fmt(received)}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e', fontWeight: 700 }}>
                                  {fmt(Number(m.qty_issued))}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: balance === 0 ? '#c81e1e' : balance < received * 0.2 ? '#d97706' : '#1a56db' }}>
                                  {fmt(balance)}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {balance === 0 ? (
                                    <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '20px', padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700 }}>نفذ</span>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', minWidth: '60px' }}>
                                        <div style={{ height: '100%', borderRadius: '3px', background: pct > 50 ? '#0ea77b' : pct > 20 ? '#d97706' : '#c81e1e', width: `${pct}%`, transition: 'width 0.3s' }} />
                                      </div>
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{pct}%</span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          {/* سطر الإجمالي */}
                          <tr style={{ background: '#f0fdfa', fontWeight: 700 }}>
                            <td colSpan={4} style={{ padding: '10px 14px', color: '#0f766e' }}>الإجمالي — {mats.length} صنف</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0ea77b' }}>{fmt(totalReceived)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#c81e1e' }}>{fmt(totalIssued)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#1a56db', fontSize: '0.95rem' }}>{fmt(totalBalance)}</td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {isExpanded && mats.length === 0 && !isLoadingMat && (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem', borderTop: '1px solid var(--border)' }}>
                    لا توجد مواد مسجلة لهذا المشروع
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
