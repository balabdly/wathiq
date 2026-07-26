// src/app/(dashboard)/inventory/projects/page.tsx
// عهدة المشاريع — قائمة + تفاصيل (مستلمة / غير مستلمة حسب المقايسة / للإرجاع للعميل)
'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { TEAM_TYPE_STYLE } from '@/lib/project-teams'
import {
  fetchProjectCustodyDetail,
  fetchCustodyProjectIds,
  type ProjectCustodyDetail,
} from '@/lib/project-custody-service'
import {
  FolderOpen, Search, Package, AlertTriangle, RotateCcw,
  Eye, X, Download, ArrowLeftRight, Users, Clock, Undo2,
} from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

function unwrapJoin<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined
  return Array.isArray(value) ? value[0] : value
}

type Project = {
  id: number; name: string; status?: string; location?: string
  team_id?: number | null; engineer?: string
  material_count?: number; balance_count?: number
}
type Loan = {
  id: string; from_project_id: number; to_project_id: number
  qty_loaned: number; qty_returned: number; status: string; loan_date: string
  material?: { name: string; unit: string }
}

type DetailTab = 'received' | 'pending_receive' | 'pending_return'

function ProjectCustodyModal({
  project, projNames, teamNames, teamTypes, tenantId,
  onClose, onRefresh,
}: {
  project: Project
  projNames: Record<number, string>
  teamNames: Record<number, string>
  teamTypes: Record<number, string>
  tenantId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const [tab, setTab] = useState<DetailTab>('received')
  const [detail, setDetail] = useState<ProjectCustodyDetail | null>(null)
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [project.id])

  async function load() {
    setLoading(true)
    const [custody, loansRes] = await Promise.all([
      fetchProjectCustodyDetail(tenantId, project.id, project.name),
      supabase.from('project_material_loans')
        .select('*, material:materials(name, unit)')
        .eq('tenant_id', tenantId)
        .or(`from_project_id.eq.${project.id},to_project_id.eq.${project.id}`)
        .neq('status', 'مُعاد كلياً')
        .order('loan_date'),
    ])
    setDetail(custody)
    setLoans((loansRes.data || []).map(row => ({
      ...row,
      material: unwrapJoin((row as { material?: { name: string; unit: string } | { name: string; unit: string }[] }).material),
    })) as Loan[])
    setLoading(false)
  }

  function exportCsv() {
    if (!detail) return
    const sections: string[][] = [
      ['═══ المواد المستلمة ═══'],
      ['المادة', 'الوحدة', 'مستلم', 'مصروف', 'مرجع للعميل', 'الرصيد'],
      ...detail.received.map(r => [r.name, r.unit, String(r.qty_received), String(r.qty_issued), String(r.qty_returned), String(r.qty_balance)]),
      [],
      ['═══ غير المستلمة (حسب المقايسة) ═══'],
      ['المادة', 'الوحدة', 'مخطط', 'مستلم', 'متبقي'],
      ...detail.notYetReceived.map(r => [r.description, r.unit, String(r.qty_planned), String(r.qty_received), String(r.qty_pending)]),
      [],
      ['═══ متبقي للإرجاع للعميل ═══'],
      ['المادة', 'الوحدة', 'الرصيد'],
      ...detail.pendingClientReturn.map(r => [r.name, r.unit, String(r.qty_balance)]),
    ]
    const csv = sections.map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `عهدة_${project.name}.xls`
    a.click()
  }

  const TABS: { id: DetailTab; label: string; icon: typeof Package; count: number; color: string }[] = detail ? [
    { id: 'received', label: 'مستلمة', icon: Package, count: detail.received.length, color: '#0ea77b' },
    { id: 'pending_receive', label: 'غير مستلمة (المقايسة)', icon: Clock, count: detail.notYetReceived.length, color: '#e6820a' },
    { id: 'pending_return', label: 'للإرجاع للعميل', icon: Undo2, count: detail.pendingClientReturn.length, color: '#c81e1e' },
  ] : []

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '860px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#f0fdfa', borderBottom: '2px solid #99f6e4', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontWeight: 800, color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Eye style={{ width: '18px', height: '18px' }} /> {project.name}
            </h3>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {project.status && <span>{project.status}</span>}
              {project.team_id && teamNames[project.team_id] && (
                <span style={{ color: TEAM_TYPE_STYLE[teamTypes[project.team_id]]?.color || '#7c3aed' }}>
                  👥 {teamNames[project.team_id]}
                </span>
              )}
              {project.engineer && <span>👤 {project.engineer}</span>}
              {project.location && <span>📍 {project.location}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => { load(); onRefresh() }} title="تحديث"
              style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #99f6e4', background: 'white', cursor: 'pointer', color: '#0f766e' }}>
              <RotateCcw style={{ width: '14px', height: '14px' }} />
            </button>
            <button onClick={exportCsv} disabled={!detail} title="تصدير"
              style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
              <Download style={{ width: '14px', height: '14px' }} />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid var(--border)', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : detail && (
          <>
            <div style={{ display: 'flex', gap: '6px', padding: '12px 16px 0', flexWrap: 'wrap', flexShrink: 0 }}>
              {TABS.map(t => {
                const Icon = t.icon
                const active = tab === t.id
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '10px', border: `1px solid ${active ? t.color : 'var(--border)'}`,
                    background: active ? t.color + '12' : 'white', color: active ? t.color : 'var(--text3)',
                    fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                  }}>
                    <Icon style={{ width: '14px', height: '14px' }} />
                    {t.label}
                    {t.count > 0 && (
                      <span style={{
                        background: active ? t.color : '#e5e7eb', color: active ? 'white' : '#6b7280',
                        borderRadius: '999px', padding: '1px 7px', fontSize: '0.68rem', fontWeight: 800,
                      }}>{t.count}</span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '12px 16px 16px' }}>
              {tab === 'received' && (
                <>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text3)', margin: '0 0 10px' }}>
                    كل ما استُلم من العميل (SEC) وسُجّل على عهدة المشروع
                  </p>
                  {detail.received.length === 0 ? (
                    <EmptyState text="لم يُستلم أي مادة بعد" />
                  ) : (
                    <MatTable headers={['المادة', 'الوحدة', 'مستلم', 'مصروف', 'مرجع', 'الرصيد']}
                      rows={detail.received.map(r => [
                        r.name, r.unit,
                        <span key="r" style={{ color: '#0ea77b', fontWeight: 700 }} dir="ltr">{fmt(r.qty_received)}</span>,
                        <span key="i" style={{ color: '#c81e1e', fontWeight: 700 }} dir="ltr">{fmt(r.qty_issued)}</span>,
                        <span key="ret" dir="ltr">{r.qty_returned > 0 ? fmt(r.qty_returned) : '—'}</span>,
                        <span key="b" style={{ fontWeight: 800, color: r.qty_balance > 0 ? '#1a56db' : '#94a3b8' }} dir="ltr">{fmt(r.qty_balance)}</span>,
                      ])} />
                  )}
                </>
              )}

              {tab === 'pending_receive' && (
                <>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text3)', margin: '0 0 10px' }}>
                    بنود المقايسة التي لم تُستلم من العميل بعد (مخطط − مستلم)
                  </p>
                  {!detail.has_boq ? (
                    <div style={{ padding: '24px', textAlign: 'center', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', fontSize: '0.82rem', color: '#92400e' }}>
                      لا توجد مقايسة مسجّلة — أضف بنود المواد في التخطيط لمتابعة ما تبقّى للاستلام
                    </div>
                  ) : detail.notYetReceived.length === 0 ? (
                    <EmptyState text="✅ كل بنود المقايسة مستلمة" />
                  ) : (
                    <MatTable headers={['المادة', 'الوحدة', 'مخطط', 'مستلم', 'متبقي للاستلام']}
                      rows={detail.notYetReceived.map(r => [
                        r.description, r.unit,
                        <span key="p" dir="ltr">{fmt(r.qty_planned)}</span>,
                        <span key="r" dir="ltr">{fmt(r.qty_received)}</span>,
                        <span key="pend" style={{ fontWeight: 800, color: '#e6820a' }} dir="ltr">{fmt(r.qty_pending)}</span>,
                      ])} />
                  )}
                </>
              )}

              {tab === 'pending_return' && (
                <>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text3)', margin: '0 0 10px' }}>
                    مواد باقية في العهدة (رصيد &gt; 0) — يُفترض إرجاعها للعميل عند انتهاء المشروع
                  </p>
                  {detail.pendingClientReturn.length === 0 ? (
                    <EmptyState text="لا يوجد رصيد متبقٍ للإرجاع" />
                  ) : (
                    <MatTable headers={['المادة', 'الوحدة', 'مستلم', 'مصروف', 'الرصيد (للإرجاع)']}
                      rows={detail.pendingClientReturn.map(r => [
                        r.name, r.unit,
                        <span key="r" dir="ltr">{fmt(r.qty_received)}</span>,
                        <span key="i" dir="ltr">{fmt(r.qty_issued)}</span>,
                        <span key="b" style={{ fontWeight: 800, color: '#c81e1e' }} dir="ltr">{fmt(r.qty_balance)}</span>,
                      ])} />
                  )}
                </>
              )}

              {loans.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#faf9ff', borderRadius: '10px', border: '1px solid #ede9fe' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowLeftRight style={{ width: '14px', height: '14px' }} /> ذمم استعارة مفتوحة ({loans.length})
                  </div>
                  {loans.map(loan => {
                    const lent = loan.from_project_id === project.id
                    const other = projNames[lent ? loan.to_project_id : loan.from_project_id] || '—'
                    const remaining = Number(loan.qty_loaned) - Number(loan.qty_returned)
                    return (
                      <div key={loan.id} style={{ fontSize: '0.75rem', padding: '6px 0', borderBottom: '1px solid #ede9fe' }}>
                        {lent ? '⬅ أعار إلى' : '➡ استعار من'} <strong>{other}</strong> — {loan.material?.name} — متبقٍ {fmt(remaining)} {loan.material?.unit}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '10px' }}>
      {text}
    </div>
  )
}

function MatTable({ headers, rows }: { headers: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 12px', fontWeight: j === 0 ? 600 : 400 }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function InventoryProjectsPage() {
  const { tenant, activeBranch } = useStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [projNames, setProjNames] = useState<Record<number, string>>({})
  const [teamNames, setTeamNames] = useState<Record<number, string>>({})
  const [teamTypes, setTeamTypes] = useState<Record<number, string>>({})
  const [teamsList, setTeamsList] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [viewProject, setViewProject] = useState<Project | null>(null)
  const [kpis, setKpis] = useState({ totalProjects: 0, totalMaterials: 0, withBalance: 0, openLoans: 0, noTeam: 0 })

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id, activeBranch?.id])

  async function loadBase() {
    if (!tenant) return
    setLoading(true)

    const [pmRes, custodyProjectIds, projectsRes, loansRes, teamsRes] = await Promise.all([
      supabase.from('project_materials').select('project_id, qty_balance').eq('tenant_id', tenant.id),
      fetchCustodyProjectIds(tenant.id),
      supabase.from('projects').select('id, name, status, location, team_id, engineer, branch_id')
        .eq('tenant_id', tenant.id).order('name'),
      supabase.from('project_material_loans').select('status').eq('tenant_id', tenant.id),
      supabase.from('teams').select('id, name, team_type')
        .eq('tenant_id', tenant.id).eq('is_active', true),
    ])

    const countByProject: Record<number, { count: number; balance: number }> = {}
    for (const row of pmRes.data || []) {
      const pid = row.project_id as number
      if (!countByProject[pid]) countByProject[pid] = { count: 0, balance: 0 }
      countByProject[pid].count++
      if (Number(row.qty_balance) > 0) countByProject[pid].balance++
    }

    const custodyIds = new Set(custodyProjectIds)
    let allProjects = projectsRes.data || []

    // فرع نشط: اعرض مشاريع الفرع + أي مشروع له عهدة مهما كان فرعه
    if (activeBranch?.id) {
      allProjects = allProjects.filter(p =>
        p.branch_id === activeBranch.id || custodyIds.has(p.id),
      )
    }

    // اعرض: مشاريع لها عهدة، أو مشاريع نشطة (غير مكتملة)
    const projList = allProjects
      .filter(p => custodyIds.has(p.id) || p.status !== 'مكتمل')
      .map((p: Project) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        location: p.location,
        team_id: p.team_id,
        engineer: p.engineer,
        material_count: countByProject[p.id]?.count ?? (custodyIds.has(p.id) ? 1 : 0),
        balance_count: countByProject[p.id]?.balance ?? 0,
      }))
      .sort((a, b) => {
        const aCustody = custodyIds.has(a.id) ? 1 : 0
        const bCustody = custodyIds.has(b.id) ? 1 : 0
        if (bCustody !== aCustody) return bCustody - aCustody
        return a.name.localeCompare(b.name, 'ar')
      })

    const nameMap: Record<number, string> = {}
    allProjects.forEach((p: { id: number; name: string }) => { nameMap[p.id] = p.name })
    const tMap: Record<number, string> = {}
    const tTypeMap: Record<number, string> = {}
    ;(teamsRes.data || []).forEach((t: { id: number; name: string; team_type: string }) => {
      tMap[t.id] = t.name; tTypeMap[t.id] = t.team_type
    })

    const withBalance = (pmRes.data || []).filter(m => Number(m.qty_balance) > 0).length
    const openLoans = (loansRes.data || []).filter(l => l.status !== 'مُعاد كلياً').length

    setProjects(projList)
    setProjNames(nameMap)
    setTeamNames(tMap)
    setTeamTypes(tTypeMap)
    setTeamsList((teamsRes.data || []).map((t: { id: number; name: string }) => ({ id: t.id, name: t.name })))
    setKpis({
      totalProjects: projList.filter(p => custodyIds.has(p.id)).length || projList.length,
      totalMaterials: pmRes.data?.length || 0,
      withBalance,
      openLoans,
      noTeam: projList.filter(p => !p.team_id).length,
    })
    setLoading(false)
  }

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (teamFilter === 'none') return !p.team_id
    if (teamFilter && String(p.team_id) !== teamFilter) return false
    return true
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
          قائمة المشاريع — اضغط 👁 لعرض: المستلمة · غير المستلمة (المقايسة) · للإرجاع للعميل
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'مشاريع عليها عهدة', value: kpis.totalProjects, color: '#0f766e', bg: '#f0fdfa', icon: FolderOpen },
          { label: 'إجمالي الأصناف', value: kpis.totalMaterials, color: '#1a56db', bg: '#eff6ff', icon: Package },
          { label: 'أصناف برصيد', value: kpis.withBalance, color: '#c81e1e', bg: '#fef2f2', icon: AlertTriangle },
          { label: 'ذمم استعارة', value: kpis.openLoans, color: '#7c3aed', bg: '#f5f3ff', icon: ArrowLeftRight },
          { label: 'بدون فريق', value: kpis.noTeam, color: kpis.noTeam > 0 ? '#c81e1e' : '#6b7280', bg: kpis.noTeam > 0 ? '#fef2f2' : '#f3f4f6', icon: Users },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: '12px', padding: '14px' }}>
            <kpi.icon style={{ width: '18px', height: '18px', color: kpi.color, marginBottom: '8px' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: '300px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم المشروع..."
            className="input" style={{ paddingRight: '32px', fontSize: '0.82rem', width: '100%' }} />
        </div>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="select" style={{ width: 'auto', minWidth: '180px' }}>
          <option value="">كل الفرق</option>
          <option value="none">بدون فريق</option>
          {teamsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
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
                {['المشروع', 'الحالة', 'الفريق', 'أصناف', 'برصيد', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', borderBottom: '1px solid var(--border)' }}>{h}</th>
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
                  <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text3)' }}>
                    {proj.team_id && teamNames[proj.team_id]
                      ? teamNames[proj.team_id]
                      : <span style={{ color: '#c81e1e' }}>بدون فريق</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }} dir="ltr">{proj.material_count ?? 0}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {(proj.balance_count ?? 0) > 0 ? (
                      <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '8px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                        {proj.balance_count}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'left' }}>
                    <button onClick={() => setViewProject(proj)} title="عرض التفاصيل"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '6px 12px', borderRadius: '8px', border: '1px solid #99f6e4',
                        background: '#f0fdfa', color: '#0f766e', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem',
                      }}>
                      <Eye style={{ width: '14px', height: '14px' }} /> عرض
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewProject && tenant && (
        <ProjectCustodyModal
          project={viewProject}
          projNames={projNames}
          teamNames={teamNames}
          teamTypes={teamTypes}
          tenantId={tenant.id}
          onClose={() => setViewProject(null)}
          onRefresh={loadBase}
        />
      )}
    </div>
  )
}
