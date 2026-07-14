'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  Users, Plus, Pencil, X, Save, Search, ChevronDown, ChevronUp,
  FolderOpen, UserPlus, Trash2, Shield,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  TEAM_TYPES, TEAM_ROLES, TEAM_TYPE_STYLE,
  type ProjectTeam, type TeamMember,
} from '@/lib/project-teams'

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px',
}

type HrEmployee = { id: number; name: string; job_title?: string; department?: string }
type ProjectRow = { id: number; name: string; code?: string; status?: string; team_id?: number | null }

function TeamModal({ team, employees, branchId, tenantId, onClose, onSave }: {
  team: ProjectTeam | null
  employees: HrEmployee[]
  branchId: number
  tenantId: string
  onClose: () => void
  onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:        team?.name        || '',
    team_type:   team?.team_type   || 'ميداني',
    lead_id:     team?.lead_id ? String(team.lead_id) : '',
    description: team?.description || '',
    is_active:   team?.is_active ?? true,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم الفريق مطلوب'); return }
    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      branch_id: branchId,
      name: form.name.trim(),
      team_type: form.team_type,
      lead_id: form.lead_id ? Number(form.lead_id) : null,
      description: form.description.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    }
    try {
      if (team) {
        const { error } = await supabase.from('teams').update(payload).eq('id', team.id)
        if (error) throw error
        toast.success('تم تحديث الفريق ✅')
      } else {
        const { data, error } = await supabase.from('teams').insert(payload).select('id').single()
        if (error) throw error
        if (form.lead_id && data?.id) {
          await supabase.from('team_members').upsert({
            tenant_id: tenantId,
            team_id: data.id,
            employee_id: Number(form.lead_id),
            role_in_team: 'قائد',
            is_active: true,
          }, { onConflict: 'team_id,employee_id' })
        }
        toast.success('تم إنشاء الفريق ✅')
      }
      onSave()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err instanceof Error ? err.message : 'غير متوقع'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>{team ? '✏️ تعديل الفريق' : '➕ فريق عمل جديد'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>اسم الفريق *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: الرياض — ميداني 1" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>نوع الفريق</label>
              <select value={form.team_type} onChange={e => set('team_type', e.target.value)} className="select">
                {TEAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>قائد الفريق</label>
              <select value={form.lead_id} onChange={e => set('lead_id', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>وصف</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" rows={2} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            فريق نشط
          </label>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save style={{ width: '14px', height: '14px' }} /> {team ? 'حفظ' : 'إنشاء'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MemberModal({ teamId, tenantId, employees, existingIds, onClose, onSave }: {
  teamId: number
  tenantId: string
  employees: HrEmployee[]
  existingIds: Set<number>
  onClose: () => void
  onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [role, setRole] = useState('عضو')

  const available = employees.filter(e => !existingIds.has(e.id))

  async function handleSave() {
    if (!employeeId) { toast.error('اختر موظفاً'); return }
    setSaving(true)
    const { error } = await supabase.from('team_members').insert({
      tenant_id: tenantId,
      team_id: teamId,
      employee_id: Number(employeeId),
      role_in_team: role,
      is_active: true,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('تمت إضافة العضو ✅')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '420px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>إضافة عضو للفريق</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>الموظف *</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="select">
              <option value="">— اختر —</option>
              {available.map(e => (
                <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>الدور في الفريق</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="select">
              {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || available.length === 0} className="btn btn-primary">إضافة</button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectTeamsPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const canEdit = currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit')

  const [teams, setTeams] = useState<ProjectTeam[]>([])
  const [members, setMembers] = useState<Record<number, TeamMember[]>>({})
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [employees, setEmployees] = useState<HrEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeam, setEditTeam] = useState<ProjectTeam | null>(null)
  const [memberTeamId, setMemberTeamId] = useState<number | null>(null)

  useEffect(() => { if (tenant && activeBranch) loadAll() }, [tenant?.id, activeBranch?.id])

  async function loadAll() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const [teamsRes, projRes, empRes, membersRes] = await Promise.all([
      supabase.from('teams')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('branch_id', activeBranch.id)
        .order('name'),
      supabase.from('projects')
        .select('id, name, code, status, team_id')
        .eq('tenant_id', tenant.id)
        .eq('branch_id', activeBranch.id)
        .order('name'),
      supabase.from('hr_employees')
        .select('id, name, job_title, department')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
      supabase.from('team_members')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true),
    ])

    const projList = projRes.data || []
    const empList = empRes.data || []
    const empMap = Object.fromEntries(empList.map((e: HrEmployee) => [e.id, e]))
    const memberRows = (membersRes.data || []).map((m: TeamMember) => ({
      ...m,
      employee: empMap[m.employee_id],
    }))
    const membersByTeam: Record<number, TeamMember[]> = {}
    memberRows.forEach((m: TeamMember) => {
      if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = []
      membersByTeam[m.team_id].push(m)
    })

    const teamsWithCounts = (teamsRes.data || []).map((t: ProjectTeam) => ({
      ...t,
      lead: t.lead_id ? empMap[t.lead_id] || null : null,
      member_count: (membersByTeam[t.id] || []).length,
      project_count: projList.filter(p => p.team_id === t.id).length,
    }))

    setTeams(teamsWithCounts)
    setMembers(membersByTeam)
    setProjects(projList)
    setEmployees(empRes.data || [])
    setLoading(false)
  }

  async function loadTeamMembers(teamId: number) {
    if (!tenant) return
    const { data } = await supabase.from('team_members')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('team_id', teamId)
      .eq('is_active', true)
    setMembers(prev => ({
      ...prev,
      [teamId]: (data || []).map(m => ({ ...m, employee: employees.find(e => e.id === m.employee_id) })),
    }))
  }

  function toggleExpand(teamId: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else { next.add(teamId); loadTeamMembers(teamId) }
      return next
    })
  }

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
    toast.success('تم إسناد المشروع للفريق ✅')
    loadAll()
  }

  async function unassignProject(projectId: number) {
    const { error } = await supabase.from('projects').update({
      team_id: null,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId)
    if (error) { toast.error(error.message); return }
    toast.success('تم إلغاء الإسناد')
    loadAll()
  }

  async function removeMember(memberId: number, teamId: number) {
    const { error } = await supabase.from('team_members').update({ is_active: false }).eq('id', memberId)
    if (error) { toast.error(error.message); return }
    toast.success('تمت إزالة العضو')
    loadTeamMembers(teamId)
    loadAll()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teams
    return teams.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.team_type.toLowerCase().includes(q) ||
      (t.lead as { name?: string })?.name?.toLowerCase().includes(q),
    )
  }, [teams, search])

  const stats = useMemo(() => ({
    total: teams.length,
    active: teams.filter(t => t.is_active).length,
    members: Object.values(members).reduce((s, arr) => s + arr.length, 0),
    assigned: projects.filter(p => p.team_id).length,
    unassigned: projects.filter(p => !p.team_id && p.status !== 'مكتمل' && p.status !== 'ملغي').length,
  }), [teams, members, projects])

  const unassignedProjects = projects.filter(p => !p.team_id && p.status !== 'مكتمل' && p.status !== 'ملغي')

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '24px', height: '24px', color: '#1a56db' }} />
            إدارة الفرق
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.875rem', marginTop: '4px' }}>
            فرق العمل وإسناد المشاريع — {activeBranch?.name}
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link href="/reports/team-workload" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              📊 تقرير الحمولة
            </Link>
            <button onClick={() => { setEditTeam(null); setShowTeamModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '15px', height: '15px' }} /> فريق جديد
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'إجمالي الفرق', value: stats.total, color: '#1a56db' },
          { label: 'فرق نشطة', value: stats.active, color: '#0ea77b' },
          { label: 'أعضاء', value: stats.members, color: '#7c3aed' },
          { label: 'مشاريع مسندة', value: stats.assigned, color: '#0891b2' },
          { label: 'بدون فريق', value: stats.unassigned, color: stats.unassigned > 0 ? '#e6820a' : '#4b5563' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
          <Search style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" placeholder="بحث في الفرق..." style={{ paddingRight: '36px' }} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          لا توجد فرق — {canEdit ? 'أنشئ أول فريق عمل' : 'تواصل مع المدير'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(team => {
            const style = TEAM_TYPE_STYLE[team.team_type] || TEAM_TYPE_STYLE['مختلط']
            const isOpen = expanded.has(team.id)
            const teamMembers = members[team.id] || []
            const teamProjects = projects.filter(p => p.team_id === team.id)
            const leadName = (team.lead as { name?: string })?.name

            return (
              <div key={team.id} className="card" style={{ overflow: 'hidden', opacity: team.is_active ? 1 : 0.65 }}>
                <div
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                  onClick={() => toggleExpand(team.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{team.name}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: style.bg, color: style.color }}>
                        {team.team_type}
                      </span>
                      {!team.is_active && <span style={{ fontSize: '0.72rem', color: '#c81e1e' }}>موقوف</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '4px' }}>
                      {leadName ? <>👤 {leadName} · </> : null}
                      {team.member_count ?? teamMembers.length} عضو · {team.project_count ?? teamProjects.length} مشروع
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={e => { e.stopPropagation(); setEditTeam(team); setShowTeamModal(true) }}
                      className="btn btn-ghost" style={{ padding: '6px 8px' }}
                    >
                      <Pencil style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                  {isOpen ? <ChevronUp style={{ width: '18px', color: 'var(--text3)' }} /> : <ChevronDown style={{ width: '18px', color: 'var(--text3)' }} />}
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>👥 الأعضاء ({teamMembers.length})</span>
                        {canEdit && (
                          <button onClick={() => setMemberTeamId(team.id)} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
                            <UserPlus style={{ width: '13px', height: '13px' }} /> إضافة
                          </button>
                        )}
                      </div>
                      {teamMembers.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>لا أعضاء بعد</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {teamMembers.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.82rem' }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>{m.employee?.name || '—'}</span>
                                <span style={{ color: 'var(--text3)', marginRight: '6px' }}> · {m.role_in_team}</span>
                              </div>
                              {canEdit && m.role_in_team !== 'قائد' && (
                                <button onClick={() => removeMember(m.id, team.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '2px' }}>
                                  <Trash2 style={{ width: '13px', height: '13px' }} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '10px' }}>
                        <FolderOpen style={{ width: '14px', height: '14px', display: 'inline', marginLeft: '4px' }} />
                        المشاريع المسندة ({teamProjects.length})
                      </div>
                      {teamProjects.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '8px' }}>لا مشاريع مسندة</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                          {teamProjects.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.82rem' }}>
                              <span>{p.code ? `${p.code} — ` : ''}{p.name}</span>
                              {canEdit && (
                                <button onClick={() => unassignProject(p.id)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>إلغاء</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {canEdit && unassignedProjects.length > 0 && (
                        <select
                          className="select"
                          style={{ fontSize: '0.82rem' }}
                          defaultValue=""
                          onChange={e => {
                            if (e.target.value) {
                              assignProject(team.id, Number(e.target.value))
                              e.target.value = ''
                            }
                          }}
                        >
                          <option value="">+ إسناد مشروع...</option>
                          {unassignedProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {stats.unassigned > 0 && (
        <div className="card" style={{ padding: '16px', border: '1px solid #fde68a', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Shield style={{ width: '18px', height: '18px', color: '#d97706' }} />
            <span style={{ fontWeight: 600, color: '#b45309' }}>{stats.unassigned} مشروع نشط بدون فريق</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>
            {unassignedProjects.slice(0, 5).map(p => p.name).join(' · ')}
            {unassignedProjects.length > 5 ? ' ...' : ''}
          </div>
        </div>
      )}

      {showTeamModal && tenant && activeBranch && (
        <TeamModal
          team={editTeam}
          employees={employees}
          branchId={activeBranch.id}
          tenantId={tenant.id}
          onClose={() => { setShowTeamModal(false); setEditTeam(null) }}
          onSave={() => { setShowTeamModal(false); setEditTeam(null); loadAll() }}
        />
      )}

      {memberTeamId && tenant && (
        <MemberModal
          teamId={memberTeamId}
          tenantId={tenant.id}
          employees={employees}
          existingIds={new Set((members[memberTeamId] || []).map(m => m.employee_id))}
          onClose={() => setMemberTeamId(null)}
          onSave={() => { setMemberTeamId(null); loadTeamMembers(memberTeamId); loadAll() }}
        />
      )}
    </div>
  )
}
