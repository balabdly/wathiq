'use client'
import { useMemo, useState } from 'react'
import { ChevronLeft, Link2, Pencil, Plus, Search, Trash2, UserMinus, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatTeamTypeLabel, TEAM_ROLES, TEAM_TYPE_STYLE, type ProjectTeam, type TeamMember } from '@/lib/project-teams'
import type { TeamsPageData, ProjectRow } from './types'
import { getHrEmployeeName } from './types'
import { AssignProjectModal, NewAssignModal, TeamModal } from './modals'

const PANEL_H = 'min(480px, calc(100vh - 340px))'

export default function TeamsTab({ data }: { data: TeamsPageData }) {
  const { teams, members, projects, employees, canEdit, tenantId, reload } = data
  const [selectedId, setSelectedId] = useState<number | null>(teams.find(t => t.is_active)?.id ?? teams[0]?.id ?? null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeam, setEditTeam] = useState<ProjectTeam | null>(null)
  const [showNewAssign, setShowNewAssign] = useState(false)
  const [assignTeamId, setAssignTeamId] = useState<number | null>(null)
  const [teamSearch, setTeamSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [hrSearch, setHrSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const selected = teams.find(t => t.id === selectedId) ?? null
  const teamMembers = selected ? (members[selected.id] || []) : []
  const memberEmpIds = useMemo(() => new Set(teamMembers.map(m => m.employee_id)), [teamMembers])

  const unassigned = useMemo(
    () => projects.filter(p => !p.team_id && p.status !== 'مكتمل' && p.status !== 'ملغي'),
    [projects],
  )

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim()
    if (!q) return teams
    return teams.filter(t => t.name.includes(q) || formatTeamTypeLabel(t).includes(q))
  }, [teams, teamSearch])

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim()
    if (!q) return teamMembers
    return teamMembers.filter(m =>
      (m.employee?.name || '').includes(q) ||
      (m.employee?.job_title || '').includes(q),
    )
  }, [teamMembers, memberSearch])

  const availableEmployees = useMemo(() => {
    const q = hrSearch.trim()
    return employees
      .filter(e => !memberEmpIds.has(e.id))
      .filter(e => !q || getHrEmployeeName(e).includes(q) || (e.job_title || '').includes(q) || (e.department || '').includes(q))
  }, [employees, memberEmpIds, hrSearch])

  const teamProjects = selected ? projects.filter(p => p.team_id === selected.id) : []
  const assignTeam = teams.find(t => t.id === assignTeamId)

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

  async function addMember(empId: number) {
    if (!selected || !canEdit) return
    setBusyId(empId)
    const { error } = await supabase.from('team_members').upsert({
      tenant_id: tenantId,
      team_id: selected.id,
      employee_id: empId,
      role_in_team: 'عضو',
      is_active: true,
    }, { onConflict: 'team_id,employee_id' })
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    toast.success('تمت إضافة العضو')
    await reload()
  }

  async function removeMember(m: TeamMember) {
    if (!selected || !canEdit) return
    if (m.role_in_team === 'قائد') {
      toast.error('عيّن قائداً آخر قبل حذف القائد')
      return
    }
    if (!confirm(`إزالة "${m.employee?.name || 'العضو'}" من الفريق؟`)) return
    setBusyId(m.employee_id)
    const { error } = await supabase.from('team_members').update({ is_active: false }).eq('id', m.id)
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    toast.success('تمت إزالة العضو')
    await reload()
  }

  async function setLead(empId: number) {
    if (!selected || !canEdit) return
    setBusyId(empId)
    const emp = employees.find(e => e.id === empId)
    await supabase.from('teams').update({ lead_id: empId, updated_at: new Date().toISOString() }).eq('id', selected.id)
    await supabase.from('team_members').upsert({
      tenant_id: tenantId, team_id: selected.id,
      employee_id: empId, role_in_team: 'قائد', is_active: true,
    }, { onConflict: 'team_id,employee_id' })
    const prevLead = teamMembers.find(m => m.role_in_team === 'قائد' && m.employee_id !== empId)
    if (prevLead) {
      await supabase.from('team_members').update({ role_in_team: 'عضو' }).eq('id', prevLead.id)
    }
    if (emp) {
      await supabase.from('projects').update({ lead_id: empId, engineer: getHrEmployeeName(emp) }).eq('team_id', selected.id)
    }
    setBusyId(null)
    toast.success('تم تعيين القائد')
    await reload()
  }

  async function updateRole(m: TeamMember, role: string) {
    if (!selected || !canEdit || m.role_in_team === 'قائد') return
    const { error } = await supabase.from('team_members').update({ role_in_team: role }).eq('id', m.id)
    if (error) { toast.error(error.message); return }
    await reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setEditTeam(null); setShowTeamModal(true) }}
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} /> فريق جديد
          </button>
          <button
            onClick={() => setShowNewAssign(true)}
            disabled={unassigned.length === 0 || teams.filter(t => t.is_active).length === 0}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem' }}
            title={unassigned.length === 0 ? 'لا مشاريع بانتظار الإسناد' : undefined}
          >
            <Link2 style={{ width: '16px', height: '16px' }} /> إسناد مشروع
          </button>
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="card" style={{ padding: '14px 18px', border: '1px solid #fde68a', background: '#fffbeb' }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#b45309', marginBottom: '8px' }}>
            ⚠️ {unassigned.length} مشروع نشط بانتظار الإسناد
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {unassigned.map(p => (
              <span key={p.id} style={{ fontSize: '0.75rem', padding: '3px 9px', borderRadius: '8px', background: 'white', border: '1px solid #fde68a', color: '#92400e' }}>
                {p.code || p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) 1fr', gap: '16px', alignItems: 'stretch' }}>
        {/* قائمة الفرق */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: PANEL_H }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px' }}>الفرق ({teams.length})</div>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
              <input value={teamSearch} onChange={e => setTeamSearch(e.target.value)} className="input" placeholder="بحث..." style={{ paddingRight: '32px', fontSize: '0.78rem', padding: '7px 32px 7px 10px' }} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredTeams.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>
                {teams.length === 0 ? 'لا فرق — أنشئ فريقاً جديداً' : 'لا نتائج'}
              </div>
            ) : filteredTeams.map(t => {
              const style = TEAM_TYPE_STYLE[t.team_type] || TEAM_TYPE_STYLE['ميداني']
              const isSel = t.id === selectedId
              const count = members[t.id]?.length || 0
              const pCount = projects.filter(p => p.team_id === t.id).length
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    width: '100%', textAlign: 'right', padding: '11px 14px', border: 'none', cursor: 'pointer',
                    background: isSel ? '#eff6ff' : 'transparent',
                    borderRight: isSel ? '3px solid #1a56db' : '3px solid transparent',
                    borderBottom: '1px solid var(--bg2)', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: t.is_active ? '#1a1a2e' : '#9ca3af' }}>
                    {t.name}{!t.is_active && ' (معطّل)'}
                  </div>
                  <div style={{ fontSize: '0.67rem', color: style.color, marginTop: '2px' }}>{formatTeamTypeLabel(t)}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: '2px' }}>
                    👥 {count} · 📁 {pCount}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {!selected ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ← اختر فريقاً أو أنشئ فريقاً جديداً
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            <div className="card" style={{ padding: '16px 18px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{selected.name}</h2>
                  <span style={{
                    display: 'inline-block', marginTop: '6px', padding: '3px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
                    background: (TEAM_TYPE_STYLE[selected.team_type] || TEAM_TYPE_STYLE['ميداني']).bg,
                    color: (TEAM_TYPE_STYLE[selected.team_type] || TEAM_TYPE_STYLE['ميداني']).color,
                  }}>
                    {formatTeamTypeLabel(selected)}
                  </span>
                </div>
                {canEdit && (
                  <button onClick={() => { setEditTeam(selected); setShowTeamModal(true) }} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
                    <Pencil style={{ width: '14px', height: '14px' }} /> تعديل
                  </button>
                )}
              </div>
            </div>

            {/* مشاريع مسندة */}
            <div className="card" style={{ padding: '14px 18px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>📁 المشاريع المسندة ({teamProjects.length})</span>
                {canEdit && unassigned.length > 0 && selected.is_active && (
                  <button onClick={() => setAssignTeamId(selected.id)} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                    <Plus style={{ width: '13px', height: '13px' }} /> إسناد
                  </button>
                )}
              </div>
              {teamProjects.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>لا مشاريع — اسند مشروعاً من الزر أعلاه</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {teamProjects.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '9px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{p.code || '—'} · {p.progress ?? 0}% · {p.status || '—'}</div>
                      </div>
                      {canEdit && (
                        <button onClick={() => unassignProject(p)} title="سحب الإسناد" style={{ flexShrink: 0, padding: '6px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                          <UserMinus style={{ width: '14px', height: '14px' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* أعضاء + HR */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1, minHeight: 0 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: PANEL_H }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px' }}>👥 أعضاء الفريق ({teamMembers.length})</div>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
                    <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="input" placeholder="بحث..." style={{ paddingRight: '32px', fontSize: '0.78rem', padding: '7px 32px 7px 10px' }} />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {teamMembers.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#e6820a', fontSize: '0.82rem' }}>أضف أعضاء من HR ←</div>
                  ) : filteredMembers.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--bg2)', fontSize: '0.82rem', background: m.role_in_team === 'قائد' ? '#f0f7ff' : 'transparent' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.employee?.name || '—'}
                          {m.role_in_team === 'قائد' && <span style={{ marginRight: '6px', fontSize: '0.65rem', color: '#1a56db', fontWeight: 700 }}>★ قائد</span>}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{m.employee?.job_title || '—'}</div>
                      </div>
                      {canEdit && m.role_in_team !== 'قائد' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <select value={m.role_in_team} onChange={e => updateRole(m, e.target.value)} className="select" style={{ fontSize: '0.68rem', padding: '3px 4px', minWidth: '72px' }}>
                            {TEAM_ROLES.filter(r => r !== 'قائد').map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button onClick={() => setLead(m.employee_id)} disabled={busyId === m.employee_id} title="تعيين قائد" style={{ padding: '5px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}>
                            <UserPlus style={{ width: '13px', height: '13px' }} />
                          </button>
                          <button onClick={() => removeMember(m)} disabled={busyId === m.employee_id} style={{ padding: '5px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                            <Trash2 style={{ width: '13px', height: '13px' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: PANEL_H }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>📋 الموارد البشرية</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '8px' }}>{availableEmployees.length} متاح للإضافة</div>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
                    <input value={hrSearch} onChange={e => setHrSearch(e.target.value)} className="input" placeholder="بحث..." style={{ paddingRight: '32px', fontSize: '0.78rem', padding: '7px 32px 7px 10px' }} />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {availableEmployees.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>لا موظفين متاحين</div>
                  ) : availableEmployees.map(emp => (
                    <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--bg2)', fontSize: '0.82rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getHrEmployeeName(emp)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{emp.job_title || '—'}</div>
                      </div>
                      {canEdit && (
                        <button onClick={() => addMember(emp.id)} disabled={busyId === emp.id} style={{ flexShrink: 0, padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#1a56db', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                          <ChevronLeft style={{ width: '14px', height: '14px' }} /> إضافة
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showTeamModal && (
        <TeamModal
          team={editTeam}
          employees={employees}
          existingMembers={editTeam ? (members[editTeam.id] || []) : []}
          branchId={data.branchId}
          tenantId={tenantId}
          onClose={() => { setShowTeamModal(false); setEditTeam(null) }}
          onSave={async () => { setShowTeamModal(false); setEditTeam(null); await reload() }}
        />
      )}
      {showNewAssign && (
        <NewAssignModal
          unassigned={unassigned}
          activeTeams={teams.filter(t => t.is_active).map(t => ({ id: t.id, name: t.name, team_type: formatTeamTypeLabel(t) }))}
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
