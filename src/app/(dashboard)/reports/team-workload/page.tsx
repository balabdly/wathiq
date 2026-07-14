'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { fetchTeamWorkload, countUnassignedActiveProjects, type TeamWorkloadRow } from '@/lib/team-workload'
import { TEAM_TYPE_STYLE } from '@/lib/project-teams'
import { Users, ArrowRight, Download, AlertTriangle, CheckCircle2, FolderOpen } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TeamWorkloadReportPage() {
  const { tenant, activeBranch } = useStore()
  const [rows, setRows] = useState<TeamWorkloadRow[]>([])
  const [unassigned, setUnassigned] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (tenant && activeBranch) loadData()
  }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const [{ data: projects }] = await Promise.all([
      supabase.from('projects')
        .select('team_id, status')
        .eq('tenant_id', tenant.id)
        .eq('branch_id', activeBranch.id),
    ])
    const workload = await fetchTeamWorkload(supabase, tenant.id, activeBranch.id)
    setRows(workload)
    setUnassigned(countUnassignedActiveProjects(projects || []))
    setLoading(false)
  }

  function exportCsv() {
    const headers = ['الفريق', 'النوع', 'القائد', 'الأعضاء', 'مشاريع نشطة', 'مهام مفتوحة', 'NCR مفتوحة']
    const lines = filtered.map(r => [
      r.team_name, r.team_type, r.lead_name || '—',
      r.member_count, r.active_projects, r.open_tasks, r.open_ncr,
    ])
    const csv = [headers, ...lines].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `حمولة_الفرق_${activeBranch?.name || 'report'}.csv`
    a.click()
    toast.success('تم التصدير')
  }

  const filtered = rows.filter(r =>
    !search || r.team_name.includes(search) || r.team_type.includes(search),
  )

  const totals = {
    teams: filtered.length,
    projects: filtered.reduce((s, r) => s + r.active_projects, 0),
    tasks: filtered.reduce((s, r) => s + r.open_tasks, 0),
    ncr: filtered.reduce((s, r) => s + r.open_ncr, 0),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <Link href="/reports/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text3)', textDecoration: 'none', marginBottom: '6px' }}>
            <ArrowRight style={{ width: '14px', height: '14px' }} /> تقارير المشاريع
          </Link>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Users style={{ width: '22px', height: '22px', color: '#7c3aed' }} />
            حمولة فرق العمل
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '4px' }}>
            مشاريع نشطة · مهام مفتوحة · NCR — {activeBranch?.name}
          </p>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="btn btn-ghost">
          <Download style={{ width: '16px', height: '16px' }} /> تصدير CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        {[
          { label: 'الفرق', value: totals.teams, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'مشاريع نشطة', value: totals.projects, color: '#1a56db', bg: '#eff6ff' },
          { label: 'مهام مفتوحة', value: totals.tasks, color: '#e6820a', bg: '#fffbeb' },
          { label: 'NCR مفتوحة', value: totals.ncr, color: totals.ncr > 0 ? '#c81e1e' : '#0ea77b', bg: totals.ncr > 0 ? '#fef2f2' : '#ecfdf5' },
          { label: 'بدون فريق', value: unassigned, color: unassigned > 0 ? '#c81e1e' : '#6b7280', bg: unassigned > 0 ? '#fef2f2' : '#f3f4f6' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px', background: k.bg }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {unassigned > 0 && (
        <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.82rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          {unassigned} مشروع نشط غير مسند لفريق —{' '}
          <Link href="/projects/teams" style={{ color: '#1a56db', fontWeight: 600 }}>إدارة الفرق</Link>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="بحث باسم الفريق..." className="input" style={{ maxWidth: '280px' }} />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>
          <Users style={{ width: '32px', height: '32px', margin: '0 auto 10px', opacity: 0.3 }} />
          لا توجد فرق في هذا الفرع
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الفريق', 'النوع', 'القائد', 'أعضاء', 'مشاريع', 'مهام', 'NCR', 'الحالة'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const style = TEAM_TYPE_STYLE[r.team_type] || { color: '#4b5563', bg: '#f3f4f6' }
                const overloaded = r.open_tasks > r.member_count * 3 && r.member_count > 0
                const hasNcr = r.open_ncr > 0
                return (
                  <tr key={r.team_id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 700 }}>{r.team_name}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600, background: style.bg, color: style.color }}>
                        {r.team_type}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '0.82rem' }}>{r.lead_name || '—'}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 600 }}>{r.member_count}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1a56db', fontWeight: 700 }}>
                        <FolderOpen style={{ width: '13px', height: '13px' }} /> {r.active_projects}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: r.open_tasks > 0 ? '#e6820a' : 'var(--text3)' }}>
                      {r.open_tasks}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: hasNcr ? '#c81e1e' : '#0ea77b' }}>
                      {r.open_ncr}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {overloaded ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#c81e1e' }}>⚠️ حمولة عالية</span>
                      ) : hasNcr ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#e6820a' }}>NCR مفتوحة</span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0ea77b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <CheckCircle2 style={{ width: '12px', height: '12px' }} /> طبيعي
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
