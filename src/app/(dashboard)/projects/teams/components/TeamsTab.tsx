'use client'
import { useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatTeamTypeLabel, TEAM_TYPE_STYLE, type ProjectTeam } from '@/lib/project-teams'
import type { TeamsPageData } from './types'
import { TeamModal, TeamViewModal, TeamMembersEditModal } from './modals'

const actionBtn = (color: string, bg: string, border: string) => ({
  padding: '7px', borderRadius: '8px', border: `1px solid ${border}`,
  background: bg, cursor: 'pointer' as const, color, display: 'flex' as const, alignItems: 'center' as const,
})

export default function TeamsTab({ data }: { data: TeamsPageData }) {
  const { teams, members, projects, employees, canEdit, canDelete, tenantId, reload } = data
  const [search, setSearch] = useState('')
  const [taskCounts, setTaskCounts] = useState<Record<number, number>>({})
  const [viewTeam, setViewTeam] = useState<ProjectTeam | null>(null)
  const [editTeam, setEditTeam] = useState<ProjectTeam | null>(null)
  const [showNewTeam, setShowNewTeam] = useState(false)

  const activeTeams = useMemo(() => teams.filter(t => t.is_active), [teams])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return activeTeams
    return activeTeams.filter(t => t.name.includes(q) || formatTeamTypeLabel(t).includes(q))
  }, [activeTeams, search])

  useEffect(() => {
    if (!tenantId || projects.length === 0) {
      setTaskCounts({})
      return
    }
    const projectTeamMap = Object.fromEntries(projects.filter(p => p.team_id).map(p => [p.id, p.team_id!]))
    const ids = Object.keys(projectTeamMap).map(Number)
    if (ids.length === 0) return

    supabase.from('project_tasks')
      .select('project_id')
      .eq('tenant_id', tenantId)
      .in('project_id', ids)
      .then(({ data: rows }) => {
        const counts: Record<number, number> = {}
        ;(rows || []).forEach((r: { project_id: number }) => {
          const tid = projectTeamMap[r.project_id]
          if (tid) counts[tid] = (counts[tid] || 0) + 1
        })
        setTaskCounts(counts)
      })
  }, [tenantId, projects])

  async function deleteTeam(team: ProjectTeam) {
    const teamProjects = projects.filter(p => p.team_id === team.id)
    const msg = teamProjects.length > 0
      ? `حذف "${team.name}"؟\n\nسيتم إلغاء إسناد ${teamProjects.length} مشروع.`
      : `حذف "${team.name}"؟`
    if (!confirm(msg)) return

    for (const p of teamProjects) {
      await supabase.from('projects').update({ team_id: null, updated_at: new Date().toISOString() }).eq('id', p.id)
    }
    const { error } = await supabase.from('teams').delete().eq('id', team.id)
    if (error) { toast.error(error.message); return }
    toast.success('تم حذف الفريق')
    await reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" placeholder="بحث في الفرق..." style={{ paddingRight: '32px', width: '220px', fontSize: '0.82rem' }} />
        </div>
        {canEdit && (
          <button onClick={() => setShowNewTeam(true)} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> فريق جديد
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          {activeTeams.length === 0 ? 'لا فرق نشطة — أنشئ فريقاً جديداً' : 'لا نتائج للبحث'}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الفريق', 'النوع / التخصص', 'الأعضاء', 'المهام', ''].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(team => {
                const style = TEAM_TYPE_STYLE[team.team_type] || TEAM_TYPE_STYLE['ميداني']
                const teamMembers = members[team.id] || []
                const tasks = taskCounts[team.id] || 0
                return (
                  <tr key={team.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{team.name}</div>
                      {(team.lead as { name?: string })?.name && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '2px' }}>
                          👤 {(team.lead as { name?: string }).name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '8px', background: style.bg, color: style.color, fontWeight: 600 }}>
                        {formatTeamTypeLabel(team)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1a56db' }}>{teamMembers.length}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#7c3aed' }}>{tasks}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setViewTeam(team)}
                          title="عرض التفاصيل"
                          style={actionBtn('#1a56db', '#eff6ff', '#bfdbfe')}
                        >
                          <Eye style={{ width: '15px', height: '15px' }} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => setEditTeam(team)}
                            title="تعديل الأعضاء"
                            style={actionBtn('#6b7280', '#f9fafb', '#e5e7eb')}
                          >
                            <Pencil style={{ width: '15px', height: '15px' }} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => deleteTeam(team)}
                            title="حذف الفريق"
                            style={actionBtn('#c81e1e', '#fef2f2', '#fecaca')}
                          >
                            <Trash2 style={{ width: '15px', height: '15px' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewTeam && (
        <TeamViewModal
          team={viewTeam}
          members={members[viewTeam.id] || []}
          projects={projects}
          taskCount={taskCounts[viewTeam.id] || 0}
          onClose={() => setViewTeam(null)}
        />
      )}

      {editTeam && (
        <TeamMembersEditModal
          team={editTeam}
          members={members[editTeam.id] || []}
          employees={employees}
          tenantId={tenantId}
          onClose={() => setEditTeam(null)}
          onSave={async () => { await reload() }}
        />
      )}

      {showNewTeam && (
        <TeamModal
          team={null}
          employees={employees}
          branchId={data.branchId}
          tenantId={tenantId}
          onClose={() => setShowNewTeam(false)}
          onSave={async () => { setShowNewTeam(false); await reload() }}
        />
      )}
    </div>
  )
}
