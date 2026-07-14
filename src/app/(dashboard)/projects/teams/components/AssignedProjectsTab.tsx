'use client'
import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { TEAM_TYPE_STYLE } from '@/lib/project-teams'
import type { TeamsPageData, ProjectRow } from './types'
import ProjectDetailsModal from './ProjectDetailsModal'

export default function AssignedProjectsTab({ data }: { data: TeamsPageData }) {
  const { teams, projects } = data
  const [teamFilter, setTeamFilter] = useState<number | ''>('')
  const [detailProject, setDetailProject] = useState<ProjectRow | null>(null)

  const assignedProjects = useMemo(() => {
    let list = projects.filter(p => p.team_id)
    if (teamFilter) list = list.filter(p => p.team_id === teamFilter)
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [projects, teamFilter])

  const teamName = (tid: number) => teams.find(t => t.id === tid)?.name || '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text3)' }}>
          {assignedProjects.length} مشروع مسند
        </span>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value ? Number(e.target.value) : '')}
          className="select"
          style={{ fontSize: '0.82rem', minWidth: '180px' }}
        >
          <option value="">كل الفرق</option>
          {teams.filter(t => t.is_active).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {assignedProjects.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>
          لا مشاريع مسندة — اسند من تبويب «الفرق النشطة»
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['المشروع', 'الكود', 'الفريق', 'المهندس', 'الحالة', 'الإنجاز', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignedProjects.map(p => {
                const team = teams.find(t => t.id === p.team_id)
                const tStyle = TEAM_TYPE_STYLE[team?.team_type || ''] || TEAM_TYPE_STYLE['مختلط']
                const progress = p.progress ?? 0
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, maxWidth: '220px' }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>
                      {p.code || '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '2px 9px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
                        background: tStyle.bg, color: tStyle.color, whiteSpace: 'nowrap',
                      }}>
                        {teamName(p.team_id!)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>
                      {p.engineer || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>
                      {p.status || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', minWidth: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#0ea77b' : '#1a56db', borderRadius: '6px' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a56db', minWidth: '32px' }}>{progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', width: '52px' }}>
                      <button
                        onClick={() => setDetailProject(p)}
                        title="عرض التفاصيل وإضافة تحديث"
                        style={{
                          padding: '7px', borderRadius: '8px', border: '1px solid #bfdbfe',
                          background: '#eff6ff', cursor: 'pointer', color: '#1a56db',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Eye style={{ width: '16px', height: '16px' }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailProject && (
        <ProjectDetailsModal
          project={detailProject}
          data={data}
          onClose={() => setDetailProject(null)}
        />
      )}
    </div>
  )
}
