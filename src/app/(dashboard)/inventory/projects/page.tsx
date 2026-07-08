// src/app/(dashboard)/inventory/projects/page.tsx
// عهدة المشاريع — عرض المستلم/المصروف/المرجع/الرصيد والذمم لكل مشروع
// ملاحظة معمارية: تعديل المقايسة حُذف من هنا نهائياً — مكانه قسم المشاريع (طبقة العقد)
// المخزون طبقة حركة فقط: استلام، صرف، إرجاع، تحويل، استعارة وتسوية
'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  FolderOpen, Search, Package, AlertTriangle, RotateCcw,
  ChevronDown, ChevronUp, Download, ArrowLeftRight
} from 'lucide-react'

// ══════════════════════════════════════════
// الألوان والثوابت
// ══════════════════════════════════════════
const MOVEMENT_COLORS = {
  استلام:      { color: '#0ea77b', bg: '#ecfdf5', border: '#86efac', label: 'استلام عهدة' },
  صرف:         { color: '#c81e1e', bg: '#fef2f2', border: '#fecaca', label: 'صرف'          },
  ارجاع_عميل: { color: '#e6820a', bg: '#fffbeb', border: '#fde68a', label: 'إرجاع للعميل' },
  استعارة:     { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', label: 'ذمّة استعارة' },
}

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

type Project     = { id: number; name: string; status?: string; location?: string }
type ProjectMat  = {
  id: number; project_id: number; material_id: number; warehouse_id: number
  qty_received: number; qty_issued: number; qty_returned: number; qty_balance: number
  material?: { name: string; unit: string; catalog_no?: string; sec_number?: string }
  warehouse?: { name: string }
}
type Loan = {
  id: string; from_project_id: number; to_project_id: number
  qty_loaned: number; qty_returned: number; status: string; loan_date: string
  material?: { name: string; unit: string }
}

// ══════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════
export default function InventoryProjectsPage() {
  const { tenant } = useStore()

  const [projects,    setProjects]    = useState<Project[]>([])
  const [projNames,   setProjNames]   = useState<Record<number, string>>({})
  const [materials,   setMaterials]   = useState<Record<number, ProjectMat[]>>({})
  const [loans,       setLoans]       = useState<Record<number, Loan[]>>({})
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [expanded,    setExpanded]    = useState<Set<number>>(new Set())
  const [loadingProj, setLoadingProj] = useState<Set<number>>(new Set())
  const [kpis, setKpis] = useState({ totalProjects: 0, totalMaterials: 0, zeroBalance: 0, openLoans: 0 })

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id])

  async function loadBase() {
    if (!tenant) return
    setLoading(true)
    const { data: pmData } = await supabase.from('project_materials')
      .select('project_id').eq('tenant_id', tenant.id)
    const projectIds = Array.from(new Set((pmData || []).map((p: any) => p.project_id)))
    if (projectIds.length === 0) { setLoading(false); return }

    const [projRes, allProjRes, allPM, loansRes] = await Promise.all([
      supabase.from('projects').select('id, name, status, location')
        .in('id', projectIds)
        .neq('status', 'مكتمل')  // إخفاء المكتملة
        .order('name'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id),
      supabase.from('project_materials').select('qty_balance').eq('tenant_id', tenant.id),
      supabase.from('project_material_loans').select('status').eq('tenant_id', tenant.id),
    ])

    const zeroBalance = (allPM.data || []).filter(m => Number(m.qty_balance) === 0).length
    const openLoans   = (loansRes.data || []).filter(l => l.status !== 'مُعاد كلياً').length

    const nameMap: Record<number, string> = {}
    ;(allProjRes.data || []).forEach((p: any) => { nameMap[p.id] = p.name })

    setProjects(projRes.data || [])
    setProjNames(nameMap)
    setKpis({ totalProjects: projectIds.length, totalMaterials: allPM.data?.length || 0, zeroBalance, openLoans })
    setLoading(false)
  }

  async function fetchProjectData(projectId: number) {
    if (!tenant) return
    const [matsRes, loansRes] = await Promise.all([
      supabase.from('project_materials')
        .select('*, material:materials(name, unit, catalog_no, sec_number), warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('project_id', projectId),
      supabase.from('project_material_loans')
        .select('*, material:materials(name, unit)')
        .eq('tenant_id', tenant.id)
        .or(`from_project_id.eq.${projectId},to_project_id.eq.${projectId}`)
        .neq('status', 'مُعاد كلياً')
        .order('loan_date'),
    ])
    setMaterials(prev => ({ ...prev, [projectId]: matsRes.data  || [] }))
    setLoans(prev     => ({ ...prev, [projectId]: (loansRes.data || []) as Loan[] }))
  }

  async function loadProjectData(projectId: number) {
    if (!tenant) return
    if (materials[projectId] !== undefined) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.has(projectId) ? next.delete(projectId) : next.add(projectId)
        return next
      })
      return
    }
    setLoadingProj(prev => new Set(Array.from(prev).concat(projectId)))
    await fetchProjectData(projectId)
    setExpanded(prev => new Set(Array.from(prev).concat(projectId)))
    setLoadingProj(prev => { const next = new Set(prev); next.delete(projectId); return next })
  }

  async function refreshProject(projectId: number) {
    if (!tenant) return
    setLoadingProj(prev => new Set(Array.from(prev).concat(projectId)))
    await fetchProjectData(projectId)
    setLoadingProj(prev => { const next = new Set(prev); next.delete(projectId); return next })
    loadBase()
  }

  function exportProject(proj: Project) {
    const mats = materials[proj.id] || []
    const headers = ['الاسم', 'رقم الكتالوج', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'مرجع للعميل', 'الرصيد']
    const rows = mats.map(m => [
      m.material?.name || '—', m.material?.catalog_no || '—',
      m.warehouse?.name || '—', m.material?.unit || '—',
      m.qty_received, m.qty_issued, m.qty_returned || 0, m.qty_balance,
    ])
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `مواد_${proj.name}.xls`; a.click()
  }

  const filtered = projects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* العنوان */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderOpen style={{ width: '22px', height: '22px', color: '#0f766e' }} /> عهدة المشاريع
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>
          المستلم والمصروف والمرجع والرصيد وذمم الاستعارة لكل مشروع — تعديل المقايسة من قسم المشاريع
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
        {[
          { label: 'مشاريع عليها عهدة', value: kpis.totalProjects,  color: '#0f766e', bg: '#f0fdfa', icon: FolderOpen    },
          { label: 'إجمالي الأصناف',    value: kpis.totalMaterials, color: '#1a56db', bg: '#eff6ff', icon: Package        },
          { label: 'أصناف رصيدها صفر', value: kpis.zeroBalance,    color: '#c81e1e', bg: '#fef2f2', icon: AlertTriangle  },
          { label: 'ذمم استعارة مفتوحة', value: kpis.openLoans,    color: '#7c3aed', bg: '#f5f3ff', icon: ArrowLeftRight, alert: kpis.openLoans > 0 },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: '12px', padding: '14px', position: 'relative' }}>
            {(kpi as any).alert && <div style={{ position: 'absolute', top: '10px', left: '10px', width: '8px', height: '8px', borderRadius: '50%', background: '#c81e1e' }} className="pulse-dot" />}
            <kpi.icon style={{ width: '18px', height: '18px', color: kpi.color, marginBottom: '8px' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* مفتاح الألوان */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {Object.entries(MOVEMENT_COLORS).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: val.color }} />
            <span style={{ color: 'var(--text3)' }}>{val.label}</span>
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
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>لا توجد مشاريع عليها عهدة</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(proj => {
            const isExpanded   = expanded.has(proj.id)
            const isLoading    = loadingProj.has(proj.id)
            const mats         = materials[proj.id] || []
            const projLoans    = loans[proj.id]     || []
            // لا جمع كميات عبر الأصناف — وحدات مختلطة (متر + قطعة) رقمها بلا معنى
            const zeroItems   = mats.filter(m => Number(m.qty_balance) === 0).length
            const activeItems = mats.length - zeroItems

            return (
              <div key={proj.id} style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>

                {/* رأس المشروع */}
                <div onClick={() => loadProjectData(proj.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2, #f8fafc)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FolderOpen style={{ width: '20px', height: '20px', color: '#0f766e' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {proj.status && <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '10px', padding: '1px 7px', fontWeight: 600 }}>{proj.status}</span>}
                        {proj.location && <span>📍 {proj.location}</span>}
                        {projLoans.length > 0 && (
                          <span style={{ background: '#f5f3ff', color: '#7c3aed', borderRadius: '10px', padding: '1px 7px', fontWeight: 700 }}>
                            🔁 {projLoans.length} ذمّة مفتوحة
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* عدّادات أصناف فقط — الكميات التفصيلية بوحداتها في الجدول أدناه */}
                  {mats.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ background: '#f0fdfa', color: '#0f766e', borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700 }}>
                        {mats.length} صنف
                      </span>
                      {activeItems > 0 && (
                        <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {activeItems} برصيد
                        </span>
                      )}
                      {zeroItems > 0 && (
                        <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {zeroItems} نفذت
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => refreshProject(proj.id)} title="تحديث"
                      style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}>
                      <RotateCcw style={{ width: '13px', height: '13px' }} />
                    </button>
                    <button onClick={() => exportProject(proj)} title="تصدير"
                      style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                      <Download style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>

                  <div style={{ color: 'var(--text3)', flexShrink: 0 }}>
                    {isLoading
                      ? <div style={{ width: '16px', height: '16px', border: '2px solid var(--border)', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      : isExpanded ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />}
                  </div>
                </div>

                {/* تفاصيل المشروع */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>

                    {/* جدول المواد */}
                    {mats.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>
                        لا توجد مواد لهذا المشروع
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg2, #f8fafc)' }}>
                              {['المادة', 'رقم الكتالوج', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'مرجع للعميل', 'الرصيد', 'الحالة'].map(h => (
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
                                <tr key={i} style={{ borderBottom: '1px solid var(--bg2)', background: balance === 0 ? '#fff5f5' : 'transparent' }}>
                                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.material?.name || '—'}</td>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a56db' }}>{m.material?.catalog_no || '—'}</td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>{m.warehouse?.name || '—'}</td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{m.material?.unit || '—'}</td>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: MOVEMENT_COLORS.استلام.color }}>{fmt(received)}</td>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: MOVEMENT_COLORS.صرف.color }}>{fmt(Number(m.qty_issued))}</td>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: Number(m.qty_returned) > 0 ? MOVEMENT_COLORS.ارجاع_عميل.color : 'var(--text3)' }}>
                                    {Number(m.qty_returned) > 0 ? fmt(Number(m.qty_returned)) : '—'}
                                  </td>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem', color: balance === 0 ? '#c81e1e' : '#1a56db' }}>
                                    {fmt(balance)}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ width: '60px', height: '6px', borderRadius: '3px', background: 'var(--bg2, #e5e7eb)', overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: balance === 0 ? '#c81e1e' : pct < 25 ? '#e6820a' : '#0ea77b', transition: 'width 0.3s' }} />
                                      </div>
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{pct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* ذمم الاستعارة المفتوحة */}
                    {projLoans.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: '#faf9ff' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ArrowLeftRight style={{ width: '14px', height: '14px' }} /> ذمم الاستعارة المفتوحة — تُسوَّى من تبويب التحويل والاستعارة، وذمّة مفتوحة = لا إقفال
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {projLoans.map(loan => {
                            const lent      = loan.from_project_id === proj.id
                            const otherName = projNames[lent ? loan.to_project_id : loan.from_project_id] || '—'
                            const remaining = Number(loan.qty_loaned) - Number(loan.qty_returned)
                            return (
                              <div key={loan.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', padding: '7px 12px', background: 'white', border: '1px solid #ede9fe', borderRadius: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, color: lent ? '#e6820a' : '#0ea77b' }}>
                                  {lent ? '⬅ أعار إلى' : '➡ استعار من'}
                                </span>
                                <span style={{ fontWeight: 600 }}>{otherName}</span>
                                <span style={{ color: 'var(--text3)' }}>—</span>
                                <span>{loan.material?.name || '—'}</span>
                                <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: 700 }}>
                                  متبقٍ {fmt(remaining)} {loan.material?.unit || ''}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>
                                  (مستعار {fmt(Number(loan.qty_loaned))} — مُسوّى {fmt(Number(loan.qty_returned))} — {loan.loan_date})
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style jsx global>{`
        .pulse-dot { animation: pulse-anim 2s infinite; }
        @keyframes pulse-anim { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
      `}</style>
    </div>
  )
}
