'use client'
import { useMemo, useState } from 'react'
import { X, Save, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { TEAM_TYPES, TEAM_ROLES, getTeamSpecializations, type ProjectTeam, type TeamMember } from '@/lib/project-teams'
import type { HrEmployee, ProjectRow } from './types'

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text)', marginBottom: '6px',
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
      e.name.includes(q) ||
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
                <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>
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
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 6px',
                        borderBottom: '1px solid #eee', fontSize: '0.82rem',
                        background: isSelected ? '#eff6ff' : 'transparent', borderRadius: '6px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isLead}
                        onChange={e => toggleMember(emp.id, e.target.checked)}
                        style={{ flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{emp.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                          {emp.job_title || '—'}{emp.department ? ` · ${emp.department}` : ''}
                        </div>
                      </div>
                      {isSelected && (
                        isLead ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#1a56db', padding: '2px 8px', background: '#dbeafe', borderRadius: '8px' }}>قائد</span>
                        ) : (
                          <select
                            value={role}
                            onChange={e => setMemberRole(emp.id, e.target.value)}
                            className="select"
                            style={{ fontSize: '0.72rem', padding: '4px 6px', minWidth: '80px' }}
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
            <input type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} />
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
                <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>
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
