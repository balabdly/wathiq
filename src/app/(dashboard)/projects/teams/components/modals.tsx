'use client'
import { useMemo, useState } from 'react'
import { X, Save, UserPlus, Search, Trash2, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { TEAM_TYPES, TEAM_ROLES, getTeamSpecializations, formatTeamTypeLabel, TEAM_TYPE_STYLE, type ProjectTeam, type TeamMember } from '@/lib/project-teams'
import type { HrEmployee, ProjectRow } from './types'
import { getHrEmployeeName } from './types'

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px',
}

/** تجاوز width:100% العام على input في globals.css */
const chk: React.CSSProperties = {
  width: '16px', height: '16px', minWidth: '16px', flexShrink: 0, padding: 0, margin: 0,
}

export function TeamModal({ team, employees, existingMembers = [], branchId, tenantId, onClose, onSave }: {
  team: ProjectTeam | null
  employees: HrEmployee[]
  existingMembers?: TeamMember[]
  branchId: number
  tenantId: string
  onClose: () => void
  onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const initialType = team?.team_type && (TEAM_TYPES as readonly string[]).includes(team.team_type)
    ? team.team_type
    : 'ميداني'

  function buildInitialMembers(): Map<number, string> {
    const map = new Map<number, string>()
    existingMembers.forEach(m => map.set(m.employee_id, m.role_in_team))
    return map
  }

  const [selectedMembers, setSelectedMembers] = useState<Map<number, string>>(buildInitialMembers)

  const [form, setForm] = useState({
    name:            team?.name            || '',
    team_type:       initialType,
    specialization:  team?.specialization || getTeamSpecializations(initialType)[0] || '',
    lead_id:         team?.lead_id ? String(team.lead_id) : '',
    description:     team?.description     || '',
    is_active:       team?.is_active ?? true,
  })

  const specOptions = useMemo(() => getTeamSpecializations(form.team_type), [form.team_type])

  const typeOptions = useMemo(() => {
    const base = [...TEAM_TYPES]
    if (team?.team_type && !(TEAM_TYPES as readonly string[]).includes(team.team_type)) {
      return [team.team_type, ...base]
    }
    return base
  }, [team?.team_type])

  const filteredEmployees = useMemo(() => {
    const q = memberSearch.trim()
    if (!q) return employees
    return employees.filter(e =>
      getHrEmployeeName(e).includes(q) ||
      (e.job_title || '').includes(q) ||
      (e.department || '').includes(q),
    )
  }, [employees, memberSearch])

  const selectedCount = useMemo(() => {
    const ids = new Set(selectedMembers.keys())
    if (form.lead_id) ids.add(Number(form.lead_id))
    return ids.size
  }, [selectedMembers, form.lead_id])

  function setField(k: string, v: unknown) {
    setForm(f => {
      if (k === 'team_type') {
        const specs = getTeamSpecializations(String(v))
        return { ...f, team_type: String(v), specialization: specs[0] || '' }
      }
      if (k === 'lead_id') {
        const leadId = Number(v)
        setSelectedMembers(prev => {
          const next = new Map(prev)
          Array.from(next.entries()).forEach(([id, role]) => {
            if (role === 'قائد') next.set(id, 'عضو')
          })
          if (v) next.set(leadId, 'قائد')
          return next
        })
      }
      return { ...f, [k]: v }
    })
  }

  function toggleMember(empId: number, checked: boolean) {
    const leadId = form.lead_id ? Number(form.lead_id) : null
    if (empId === leadId) return
    setSelectedMembers(prev => {
      const next = new Map(prev)
      if (checked) next.set(empId, 'عضو')
      else next.delete(empId)
      return next
    })
  }

  function setMemberRole(empId: number, role: string) {
    if (empId === Number(form.lead_id)) return
    setSelectedMembers(prev => {
      const next = new Map(prev)
      if (next.has(empId)) next.set(empId, role)
      return next
    })
  }

  async function syncMembers(teamId: number, leadId: number) {
    const finalMap = new Map(selectedMembers)
    finalMap.set(leadId, 'قائد')

    await supabase.from('team_members').update({ is_active: false }).eq('team_id', teamId)

    const rows = Array.from(finalMap.entries()).map(([employee_id, role_in_team]) => ({
      tenant_id: tenantId,
      team_id: teamId,
      employee_id,
      role_in_team,
      is_active: true,
    }))

    if (rows.length > 0) {
      const { error } = await supabase.from('team_members').upsert(rows, { onConflict: 'team_id,employee_id' })
      if (error) throw error
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم الفريق مطلوب'); return }
    if (specOptions.length > 0 && !form.specialization) {
      toast.error('اختر التخصص')
      return
    }
    if (!form.lead_id) {
      toast.error('اختر قائد الفريق من الموارد البشرية')
      return
    }
    const leadId = Number(form.lead_id)
    const memberCount = new Set([...Array.from(selectedMembers.keys()), leadId]).size
    if (memberCount < 2) {
      toast.error('اختر قائد الفريق وعضواً واحداً على الأقل')
      return
    }
    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      branch_id: branchId,
      name: form.name.trim(),
      team_type: form.team_type,
      specialization: form.specialization.trim() || null,
      lead_id: leadId,
      description: form.description.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    }
    try {
      if (team) {
        const { error } = await supabase.from('teams').update(payload).eq('id', team.id)
        if (error) throw error
        await syncMembers(team.id, leadId)
        toast.success('تم تحديث الفريق ✅')
      } else {
        const { data, error } = await supabase.from('teams').insert(payload).select('id').single()
        if (error) throw error
        if (data?.id) await syncMembers(data.id, leadId)
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
      <div className="modal-box" style={{ maxWidth: '580px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h3 style={{ fontWeight: 700 }}>{team ? '✏️ تعديل الفريق' : '➕ فريق عمل جديد'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>اسم الفريق *</label>
            <input value={form.name} onChange={e => setField('name', e.target.value)} className="input" placeholder="مثال: الرياض — ميداني شبكات" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>نوع الفريق *</label>
              <select value={form.team_type} onChange={e => setField('team_type', e.target.value)} className="select">
                {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>التخصص *</label>
              {specOptions.length > 0 ? (
                <select value={form.specialization} onChange={e => setField('specialization', e.target.value)} className="select">
                  <option value="">— اختر التخصص —</option>
                  {specOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  value={form.specialization}
                  onChange={e => setField('specialization', e.target.value)}
                  className="input"
                  placeholder="اكتب التخصص..."
                />
              )}
            </div>
          </div>
          <div>
            <label style={lbl}>قائد الفريق * <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '0.75rem' }}>(من الموارد البشرية)</span></label>
            <select value={form.lead_id} onChange={e => setField('lead_id', e.target.value)} className="select">
              <option value="">— اختر قائد الفريق —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{getHrEmployeeName(e)}{e.job_title ? ` — ${e.job_title}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...lbl, marginBottom: 0 }}>أعضاء الفريق * <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '0.75rem' }}>(موظفون مسجلون في HR)</span></label>
              <span style={{ fontSize: '0.72rem', color: selectedCount >= 2 ? '#0ea77b' : '#e6820a', fontWeight: 600 }}>
                {selectedCount} مختار
              </span>
            </div>
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="input"
              placeholder="بحث بالاسم أو المسمى أو القسم..."
              style={{ marginBottom: '8px', fontSize: '0.82rem' }}
            />
            {employees.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                لا يوجد موظفون نشطون في الموارد البشرية
              </div>
            ) : (
              <div style={{
                maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '6px 8px', background: '#fafafa',
              }}>
                {filteredEmployees.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>لا نتائج</div>
                ) : filteredEmployees.map(emp => {
                  const isLead = emp.id === Number(form.lead_id)
                  const isSelected = selectedMembers.has(emp.id) || isLead
                  const role = isLead ? 'قائد' : (selectedMembers.get(emp.id) || 'عضو')
                  return (
                    <div
                      key={emp.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px',
                        borderBottom: '1px solid #eee', fontSize: '0.82rem',
                        background: isSelected ? '#eff6ff' : 'transparent', borderRadius: '6px',
                        width: '100%',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isLead}
                        onChange={e => toggleMember(emp.id, e.target.checked)}
                        style={chk}
                      />
                      <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getHrEmployeeName(emp)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.job_title || '—'}{emp.department ? ` · ${emp.department}` : ''}
                        </div>
                      </div>
                      {isSelected && (
                        isLead ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#1a56db', padding: '2px 8px', background: '#dbeafe', borderRadius: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>قائد</span>
                        ) : (
                          <select
                            value={role}
                            onChange={e => setMemberRole(emp.id, e.target.value)}
                            className="select"
                            style={{ fontSize: '0.72rem', padding: '4px 6px', minWidth: '80px', width: 'auto', flexShrink: 0 }}
                            onClick={e => e.stopPropagation()}
                          >
                            {TEAM_ROLES.filter(r => r !== 'قائد').map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '6px', marginBottom: 0 }}>
              يجب اختيار القائد وعضو واحد على الأقل من سجل الموارد البشرية
            </p>
          </div>

          <div>
            <label style={lbl}>وصف</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)} className="input" rows={2} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} style={chk} />
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

export function MemberModal({ teamId, tenantId, employees, existingIds, onClose, onSave }: {
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
    const { error } = await supabase.from('team_members').upsert({
      tenant_id: tenantId, team_id: teamId,
      employee_id: Number(employeeId), role_in_team: role, is_active: true,
    }, { onConflict: 'team_id,employee_id' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('تمت إضافة العضو ✅')
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '420px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus style={{ width: '18px' }} /> إضافة عضو
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>الموظف * <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '0.75rem' }}>(من الموارد البشرية)</span></label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="select">
              <option value="">— اختر —</option>
              {available.map(e => (
                <option key={e.id} value={e.id}>{getHrEmployeeName(e)}{e.job_title ? ` — ${e.job_title}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>الدور</label>
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

export function NewAssignModal({ unassigned, activeTeams, onClose, onAssign }: {
  unassigned: ProjectRow[]
  activeTeams: { id: number; name: string; team_type: string }[]
  onClose: () => void
  onAssign: (teamId: number, projectId: number) => Promise<void>
}) {
  const [projectId, setProjectId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAssign() {
    if (!projectId || !teamId) { toast.error('اختر المشروع والفريق'); return }
    setSaving(true)
    await onAssign(Number(teamId), Number(projectId))
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>➕ إسناد مشروع جديد</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>المشروع *</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="select">
              <option value="">— اختر مشروعاً غير مسند —</option>
              {unassigned.map(p => (
                <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>الفريق *</label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} className="select">
              <option value="">— اختر الفريق —</option>
              {activeTeams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.team_type})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleAssign} disabled={saving || !projectId || !teamId} className="btn btn-primary">إسناد</button>
        </div>
      </div>
    </div>
  )
}

export function AssignTeamToProjectModal({ project, activeTeams, onClose, onAssign }: {
  project: ProjectRow
  activeTeams: { id: number; name: string; team_type: string }[]
  onClose: () => void
  onAssign: (teamId: number) => Promise<void>
}) {
  const [teamId, setTeamId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAssign() {
    if (!teamId) { toast.error('اختر الفريق'); return }
    setSaving(true)
    await onAssign(Number(teamId))
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '440px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, margin: 0 }}>إسناد مشروع لفريق</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.875rem' }}>
            <strong>{project.name}</strong>
            {project.code && <span style={{ color: 'var(--text3)', marginRight: '8px' }}>({project.code})</span>}
          </div>
          <div>
            <label style={lbl}>الفريق *</label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} className="select">
              <option value="">— اختر الفريق —</option>
              {activeTeams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.team_type})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleAssign} disabled={saving || !teamId} className="btn btn-primary">إسناد</button>
        </div>
      </div>
    </div>
  )
}

export function AssignProjectModal({ teamName, unassigned, onClose, onAssign }: {
  teamName: string
  unassigned: ProjectRow[]
  onClose: () => void
  onAssign: (projectId: number) => Promise<void>
}) {
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAssign() {
    if (!projectId) return
    setSaving(true)
    await onAssign(Number(projectId))
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>إسناد مشروع — {teamName}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body">
          <label style={lbl}>اختر المشروع</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="select">
            <option value="">— اختر مشروعاً —</option>
            {unassigned.map(p => (
              <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>
            ))}
          </select>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleAssign} disabled={saving || !projectId} className="btn btn-primary">إسناد</button>
        </div>
      </div>
    </div>
  )
}

const iconBtn = (color: string, bg: string, border: string): React.CSSProperties => ({
  padding: '6px', borderRadius: '8px', border: `1px solid ${border}`,
  background: bg, cursor: 'pointer', color, display: 'flex', alignItems: 'center',
})

/** عرض تفاصيل الفريق — أعضاء + مهام */
export function TeamViewModal({ team, members, projects, taskCount, onClose }: {
  team: ProjectTeam
  members: TeamMember[]
  projects: ProjectRow[]
  taskCount: number
  onClose: () => void
}) {
  const style = TEAM_TYPE_STYLE[team.team_type] || TEAM_TYPE_STYLE['ميداني']
  const teamProjects = projects.filter(p => p.team_id === team.id)
  const lead = members.find(m => m.role_in_team === 'قائد')

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontWeight: 700, margin: 0 }}>{team.name}</h3>
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '8px', background: style.bg, color: style.color, fontWeight: 600 }}>
              {formatTeamTypeLabel(team)}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { label: 'الأعضاء', value: members.length, color: '#1a56db' },
              { label: 'المشاريع', value: teamProjects.length, color: '#0ea77b' },
              { label: 'المهام', value: taskCount, color: '#7c3aed' },
            ].map(s => (
              <div key={s.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {lead && (
            <div style={{ fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text3)' }}>القائد: </span>
              <strong>{lead.employee?.name || '—'}</strong>
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>👥 الأعضاء</div>
            {members.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>لا أعضاء</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 600 }}>{m.employee?.name || '—'}</span>
                    <span style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>{m.role_in_team}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {teamProjects.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>📁 المشاريع المسندة</div>
              {teamProjects.map(p => (
                <div key={p.id} style={{ fontSize: '0.78rem', color: 'var(--text3)', padding: '4px 0' }}>{p.name}{p.code ? ` (${p.code})` : ''}</div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إغلاق</button>
        </div>
      </div>
    </div>
  )
}

/** تعديل أعضاء الفريق */
export function TeamMembersEditModal({ team, members, employees, tenantId, onClose, onSave }: {
  team: ProjectTeam
  members: TeamMember[]
  employees: HrEmployee[]
  tenantId: string
  onClose: () => void
  onSave: () => void
}) {
  const [memberSearch, setMemberSearch] = useState('')
  const [hrSearch, setHrSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const memberEmpIds = useMemo(() => new Set(members.map(m => m.employee_id)), [members])

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim()
    if (!q) return members
    return members.filter(m => (m.employee?.name || '').includes(q) || (m.employee?.job_title || '').includes(q))
  }, [members, memberSearch])

  const availableEmployees = useMemo(() => {
    const q = hrSearch.trim()
    return employees
      .filter(e => !memberEmpIds.has(e.id))
      .filter(e => !q || getHrEmployeeName(e).includes(q) || (e.job_title || '').includes(q))
  }, [employees, memberEmpIds, hrSearch])

  async function addMember(empId: number) {
    setBusyId(empId)
    const { error } = await supabase.from('team_members').upsert({
      tenant_id: tenantId, team_id: team.id, employee_id: empId, role_in_team: 'عضو', is_active: true,
    }, { onConflict: 'team_id,employee_id' })
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    toast.success('تمت الإضافة')
    onSave()
  }

  async function removeMember(m: TeamMember) {
    if (m.role_in_team === 'قائد') { toast.error('عيّن قائداً آخر أولاً'); return }
    if (!confirm(`إزالة "${m.employee?.name}"؟`)) return
    setBusyId(m.employee_id)
    const { error } = await supabase.from('team_members').update({ is_active: false }).eq('id', m.id)
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    toast.success('تمت الإزالة')
    onSave()
  }

  async function setLead(empId: number) {
    setBusyId(empId)
    const emp = employees.find(e => e.id === empId)
    await supabase.from('teams').update({ lead_id: empId, updated_at: new Date().toISOString() }).eq('id', team.id)
    await supabase.from('team_members').upsert({
      tenant_id: tenantId, team_id: team.id, employee_id: empId, role_in_team: 'قائد', is_active: true,
    }, { onConflict: 'team_id,employee_id' })
    const prevLead = members.find(m => m.role_in_team === 'قائد' && m.employee_id !== empId)
    if (prevLead) await supabase.from('team_members').update({ role_in_team: 'عضو' }).eq('id', prevLead.id)
    if (emp) {
      await supabase.from('projects').update({ lead_id: empId, engineer: getHrEmployeeName(emp) }).eq('team_id', team.id)
    }
    setBusyId(null)
    toast.success('تم تعيين القائد')
    onSave()
  }

  async function updateRole(m: TeamMember, role: string) {
    if (m.role_in_team === 'قائد') return
    const { error } = await supabase.from('team_members').update({ role_in_team: role }).eq('id', m.id)
    if (error) { toast.error(error.message); return }
    onSave()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '720px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, margin: 0 }}>✏️ تعديل أعضاء — {team.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '420px' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.82rem' }}>👥 الأعضاء ({members.length})</div>
            <div style={{ padding: '8px' }}>
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="input" placeholder="بحث..." style={{ fontSize: '0.78rem', marginBottom: '6px' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredMembers.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderBottom: '1px solid var(--bg2)', fontSize: '0.8rem', background: m.role_in_team === 'قائد' ? '#f0f7ff' : 'transparent' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{m.employee?.name || '—'}{m.role_in_team === 'قائد' && ' ★'}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{m.employee?.job_title || '—'}</div>
                  </div>
                  {m.role_in_team !== 'قائد' && (
                    <>
                      <select value={m.role_in_team} onChange={e => updateRole(m, e.target.value)} className="select" style={{ fontSize: '0.65rem', padding: '2px', minWidth: '64px' }}>
                        {TEAM_ROLES.filter(r => r !== 'قائد').map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={() => setLead(m.employee_id)} disabled={busyId === m.employee_id} title="قائد" style={iconBtn('#1a56db', '#eff6ff', '#bfdbfe')}>
                        <UserPlus style={{ width: '12px', height: '12px' }} />
                      </button>
                      <button onClick={() => removeMember(m)} disabled={busyId === m.employee_id} style={iconBtn('#c81e1e', '#fef2f2', '#fecaca')}>
                        <Trash2 style={{ width: '12px', height: '12px' }} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.82rem', background: '#f8fafc' }}>📋 HR — إضافة</div>
            <div style={{ padding: '8px' }}>
              <input value={hrSearch} onChange={e => setHrSearch(e.target.value)} className="input" placeholder="بحث..." style={{ fontSize: '0.78rem', marginBottom: '6px' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {availableEmployees.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>لا موظفين متاحين</div>
              ) : availableEmployees.map(emp => (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--bg2)', fontSize: '0.8rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{getHrEmployeeName(emp)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{emp.job_title || '—'}</div>
                  </div>
                  <button onClick={() => addMember(emp.id)} disabled={busyId === emp.id} style={{ padding: '5px 10px', borderRadius: '8px', border: 'none', background: '#1a56db', color: 'white', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <ChevronLeft style={{ width: '12px', height: '12px' }} /> إضافة
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary">تم</button>
        </div>
      </div>
    </div>
  )
}
