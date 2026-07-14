'use client'
import { useMemo, useState } from 'react'
import { Link2, Plus, UserMinus, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatTeamTypeLabel, TEAM_TYPE_STYLE } from '@/lib/project-teams'
import type { TeamsPageData, ProjectRow } from './types'
import { AssignProjectModal, NewAssignModal } from './modals'

export default function ActiveTeamsTab({ data }: { data: TeamsPageData }) {
  const { teams, projects, employees, canEdit, reload } = data
  const [assignTeamId, setAssignTeamId] = useState<number | null>(null)
  const [showNewAssign, setShowNewAssign] = useState(false)

  const activeTeams = useMemo(() => teams.filter(t => t.is_active), [teams])
  const unassigned = useMemo(
    () => projects.filter(p => !p.team_id && p.status !== 'مكتمل' && p.status !== 'ملغي'),
    [projects],
  )

  async function assignProject(teamId: number, projectId: number) {
    const team = teams.find(t => t.id === teamId)
    const lead = team?.lead_id ? employees.find(e => e.id === team.lead_id) : null
    const { error } = await supabase.from('projects').update({
      team_id: teamId,
      lead_id: team?.lead_id || null,
      engineer: lead?.name || undefined,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId)
    if (error) { toast.error(error.message); return }
    toast.success('تم إسناد المشروع ✅')
    await reload()
  }

  async function unassignProject(p: ProjectRow) {
    if (!confirm(`إلغاء إسناد "${p.name}" من الفريق؟`)) return
    const { error } = await supabase.from('projects').update({
      team_id: null, updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success('تم سحب الإسناد')
    await reload()
  }

  const assignTeam = activeTeams.find(t => t.id === assignTeamId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowNewAssign(true)}
            disabled={unassigned.length === 0 || activeTeams.length === 0}
            className="btn btn-primary"
            style={{ fontSize: '0.875rem', gap: '6px' }}
            title={unassigned.length === 0 ? 'لا مشاريع بانتظار الإسناد' : undefined}
          >
            <Link2 style={{ width: '16px', height: '16px' }} /> إسناد جديد
          </button>
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="card" style={{ padding: '16px 20px', border: '1px solid #fde68a', background: '#fffbeb' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#b45309', marginBottom: '10px' }}>
            ⚠️ {unassigned.length} مشروع نشط بانتظار الإسناد
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {unassigned.map(p => (
              <span key={p.id} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '8px', background: 'white', border: '1px solid #fde68a', color: '#92400e' }}>
                {p.code || p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeTeams.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          لا توجد فرق نشطة — انتقل لتبويب «تكوين الفرق» لإنشاء فريق
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {activeTeams.map(team => {
            const style = TEAM_TYPE_STYLE[team.team_type] || TEAM_TYPE_STYLE['مختلط']
            const teamProjects = projects.filter(p => p.team_id === team.id)
            const leadName = (team.lead as { name?: string })?.name

            return (
              <div key={team.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '18px 20px', background: style.bg, borderBottom: `1px solid ${style.color}22` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1a1a2e' }}>{team.name}</div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: style.color, marginTop: '4px' }}>{formatTeamTypeLabel(team)}</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '52px' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: style.color, lineHeight: 1 }}>{teamProjects.length}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>مشروع</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '10px', display: 'flex', gap: '12px' }}>
                    {leadName && <span>👤 {leadName}</span>}
                    <span><Users style={{ width: '12px', height: '12px', display: 'inline' }} /> {team.member_count ?? 0}</span>
                  </div>
                </div>

                <div style={{ padding: '14px 20px', flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    المشاريع المسندة
                  </div>
                  {teamProjects.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text3)', padding: '12px 0' }}>لا مشاريع — اسند من الزر أدناه</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {teamProjects.map(p => (
                        <div key={p.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                          padding: '10px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e5e7eb',
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>
                              {p.code || '—'} · {p.progress ?? 0}%
                            </div>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => unassignProject(p)}
                              title="سحب الإسناد"
                              style={{ flexShrink: 0, padding: '6px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}
                            >
                              <UserMinus style={{ width: '14px', height: '14px' }} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {canEdit && unassigned.length > 0 && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => setAssignTeamId(team.id)}
                      className="btn btn-primary"
                      style={{ width: '100%', fontSize: '0.82rem', justifyContent: 'center' }}
                    >
                      <Plus style={{ width: '14px', height: '14px' }} /> إسناد مشروع
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showNewAssign && (
        <NewAssignModal
          unassigned={unassigned}
          activeTeams={activeTeams.map(t => ({ id: t.id, name: t.name, team_type: formatTeamTypeLabel(t) }))}
          onClose={() => setShowNewAssign(false)}
          onAssign={(teamId, projectId) => assignProject(teamId, projectId)}
        />
      )}

      {assignTeamId && assignTeam && (
        <AssignProjectModal
          teamName={assignTeam.name}
          unassigned={unassigned}
          onClose={() => setAssignTeamId(null)}
          onAssign={pid => assignProject(assignTeamId, pid)}
        />
      )}
    </div>
  )
}
