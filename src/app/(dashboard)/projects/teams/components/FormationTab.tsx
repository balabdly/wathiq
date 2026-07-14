'use client'
import { useMemo, useState } from 'react'
import { ChevronLeft, Pencil, Plus, Search, Trash2, UserMinus, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatTeamTypeLabel, TEAM_ROLES, TEAM_TYPE_STYLE, type ProjectTeam, type TeamMember } from '@/lib/project-teams'
import type { TeamsPageData } from './types'
import { TeamModal } from './modals'

const PANEL_H = 'min(520px, calc(100vh - 320px))'

export default function FormationTab({ data }: { data: TeamsPageData }) {
  const { teams, members, employees, canEdit, tenantId, reload } = data
  const [selectedId, setSelectedId] = useState<number | null>(teams[0]?.id ?? null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeam, setEditTeam] = useState<ProjectTeam | null>(null)
  const [teamSearch, setTeamSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [hrSearch, setHrSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const selected = teams.find(t => t.id === selectedId) ?? null
  const teamMembers = selected ? (members[selected.id] || []) : []
  const memberEmpIds = useMemo(() => new Set(teamMembers.map(m => m.employee_id)), [teamMembers])

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
      .filter(e => !q || e.name.includes(q) || (e.job_title || '').includes(q) || (e.department || '').includes(q))
  }, [employees, memberEmpIds, hrSearch])

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
    // إعادة تعيين القائد السابق كعضو
    const prevLead = teamMembers.find(m => m.role_in_team === 'قائد' && m.employee_id !== empId)
    if (prevLead) {
      await supabase.from('team_members').update({ role_in_team: 'عضو' }).eq('id', prevLead.id)
    }
    if (emp) {
      await supabase.from('projects').update({ lead_id: empId, engineer: emp.name }).eq('team_id', selected.id)
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
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', alignItems: 'stretch' }}>
      {/* ── قائمة الفرق (سكرول) ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: PANEL_H }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>الفرق ({teams.length})</span>
            {canEdit && (
              <button
                onClick={() => { setEditTeam(null); setShowTeamModal(true) }}
                style={{ padding: '5px 9px', borderRadius: '8px', border: 'none', background: '#1a56db', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 600 }}
              >
                <Plus style={{ width: '13px', height: '13px' }} /> جديد
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
            <input
              value={teamSearch}
              onChange={e => setTeamSearch(e.target.value)}
              className="input"
              placeholder="بحث..."
              style={{ paddingRight: '32px', fontSize: '0.78rem', padding: '7px 32px 7px 10px' }}
            />
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredTeams.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>
              {teams.length === 0 ? 'لا فرق بعد' : 'لا نتائج'}
            </div>
          ) : filteredTeams.map(t => {
            const style = TEAM_TYPE_STYLE[t.team_type] || TEAM_TYPE_STYLE['ميداني']
            const isSel = t.id === selectedId
            const count = members[t.id]?.length || 0
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
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: t.is_active ? '#1a1a2e' : '#9ca3af' }}>{t.name}</div>
                <div style={{ fontSize: '0.67rem', color: style.color, marginTop: '2px' }}>{formatTeamTypeLabel(t)}</div>
                <div style={{ fontSize: '0.65rem', color: count >= 2 ? 'var(--text3)' : '#e6820a', marginTop: '2px' }}>
                  👥 {count} عضو
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── تفاصيل + قوائم الموظفين ── */}
      {!selected ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ← اختر فريقاً من القائمة أو أنشئ فريقاً جديداً
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
          {/* رأس الفريق */}
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
                {selected.description && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '6px', marginBottom: 0 }}>{selected.description}</p>
                )}
              </div>
              {canEdit && (
                <button onClick={() => { setEditTeam(selected); setShowTeamModal(true) }} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
                  <Pencil style={{ width: '14px', height: '14px' }} /> تعديل البيانات
                </button>
              )}
            </div>
          </div>

          {/* عمودان: أعضاء الفريق | موظفو HR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1, minHeight: 0 }}>
            {/* أعضاء الفريق الحاليون */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: PANEL_H }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px' }}>
                  👥 أعضاء الفريق ({teamMembers.length})
                </div>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
                  <input
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="input"
                    placeholder="بحث في الأعضاء..."
                    style={{ paddingRight: '32px', fontSize: '0.78rem', padding: '7px 32px 7px 10px' }}
                  />
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {teamMembers.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: '#e6820a', fontSize: '0.82rem' }}>
                    لا أعضاء — أضف من قائمة الموارد البشرية ←
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>لا نتائج</div>
                ) : filteredMembers.map(m => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                      borderBottom: '1px solid var(--bg2)', fontSize: '0.82rem',
                      background: m.role_in_team === 'قائد' ? '#f0f7ff' : 'transparent',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.employee?.name || '—'}
                        {m.role_in_team === 'قائد' && (
                          <span style={{ marginRight: '6px', fontSize: '0.65rem', color: '#1a56db', fontWeight: 700 }}>★ قائد</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{m.employee?.job_title || '—'}</div>
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {m.role_in_team !== 'قائد' ? (
                          <>
                            <select
                              value={m.role_in_team}
                              onChange={e => updateRole(m, e.target.value)}
                              className="select"
                              style={{ fontSize: '0.68rem', padding: '3px 4px', minWidth: '72px' }}
                            >
                              {TEAM_ROLES.filter(r => r !== 'قائد').map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setLead(m.employee_id)}
                              disabled={busyId === m.employee_id}
                              title="تعيين قائد"
                              style={{ padding: '5px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}
                            >
                              <UserPlus style={{ width: '13px', height: '13px' }} />
                            </button>
                            <button
                              onClick={() => removeMember(m)}
                              disabled={busyId === m.employee_id}
                              title="حذف من الفريق"
                              style={{ padding: '5px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}
                            >
                              <Trash2 style={{ width: '13px', height: '13px' }} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => removeMember(m)}
                            disabled
                            title="لا يمكن حذف القائد — عيّن قائداً آخر أولاً"
                            style={{ padding: '5px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#f3f4f6', cursor: 'not-allowed', color: '#9ca3af', opacity: 0.5 }}
                          >
                            <UserMinus style={{ width: '13px', height: '13px' }} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* موظفو الموارد البشرية — للإضافة */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: PANEL_H }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: '#f8fafc' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>
                  📋 الموارد البشرية
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '8px' }}>
                  {availableEmployees.length} موظف متاح للإضافة
                </div>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
                  <input
                    value={hrSearch}
                    onChange={e => setHrSearch(e.target.value)}
                    className="input"
                    placeholder="بحث بالاسم أو المسمى..."
                    style={{ paddingRight: '32px', fontSize: '0.78rem', padding: '7px 32px 7px 10px' }}
                  />
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {employees.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>
                    لا موظفون في الموارد البشرية
                  </div>
                ) : availableEmployees.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>
                    {memberEmpIds.size === employees.length
                      ? '✅ كل الموظفين مضافون للفريق'
                      : 'لا نتائج للبحث'}
                  </div>
                ) : availableEmployees.map(emp => (
                  <div
                    key={emp.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                      borderBottom: '1px solid var(--bg2)', fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                        {emp.job_title || '—'}{emp.department ? ` · ${emp.department}` : ''}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => addMember(emp.id)}
                        disabled={busyId === emp.id}
                        title="إضافة للفريق"
                        style={{
                          flexShrink: 0, padding: '6px 10px', borderRadius: '8px', border: 'none',
                          background: '#1a56db', color: 'white', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600,
                        }}
                      >
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

      {showTeamModal && (
        <TeamModal
          team={editTeam}
          employees={employees}
          existingMembers={editTeam ? (members[editTeam.id] || []) : []}
          branchId={data.branchId}
          tenantId={tenantId}
          onClose={() => { setShowTeamModal(false); setEditTeam(null) }}
          onSave={async () => {
            setShowTeamModal(false)
            setEditTeam(null)
            await reload()
          }}
        />
      )}
    </div>
  )
}
